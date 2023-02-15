import {
  Context,
  Interface,
  ObjectMap,
  Operation,
  Parameter,
  Stream,
} from "../../deps/core/model.ts";
import { rust } from "../../deps/codegen/mod.ts";
import { convertDescription } from "../utils/conversions.ts";
import { convertType } from "../utils/types.ts";

import { SourceGenerator } from "./base.ts";
import { ActionKind, Actions, determineVariant, stream } from "../utils/mod.ts";

const { rustify, rustifyCaps, trimLines } = rust.utils;

interface OperationDetails {
  traitSignature: string;
  variant: ActionKind;
}

export class ServiceVisitor extends SourceGenerator<Interface> {
  ops: Record<string, OperationDetails> = {};
  exports = new Actions();
  wrappers: string[] = [];
  types: string[] = [];

  constructor(context: Context) {
    super(context.interface, context);
    this.walk();
  }

  buffer(): string {
    const rootName = rustifyCaps(this.node.name);
    const iface = `${rustify(this.node.name)}`;
    const componentName = `${rootName}Component`;
    const serviceName = `${rootName}Service`;
    const service_module = `${iface}_service`;

    const innerSource = this.writer.string();

    const comment = convertDescription(this.node.description);

    const traitImpls = Object.entries(this.ops)
      .map(([name, details]) => {
        const rusty_name = rustify(name);
        switch (details.variant) {
          case ActionKind.RequestResponse:
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(input).await?)}`;
          case ActionKind.RequestStream:
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(input).await?)}`;
          case ActionKind.RequestChannel:
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(input).await?)}`;
          default:
            throw new Error("Invalid action kind");
        }
      })
      .join("\n");

    return `
pub(crate) struct ${componentName}();

impl ${componentName} {
  ${this.wrappers.join("\n")}
}

#[async_trait::async_trait(?Send)]
${trimLines([comment])}
pub(crate) trait ${serviceName} {
  ${innerSource}
}

#[async_trait::async_trait(?Send)]
impl ${serviceName} for ${componentName} {
    ${traitImpls}
}

pub mod ${service_module} {
  #[allow(unused_imports)]
  pub(crate) use super::*;
  ${this.types.join("\n")}
}
`;
  }

  visitOperation(context: Context): void {
    const { operation } = context;

    const [traitFn, wrapper, types] = convertOperation(
      operation,
      this.node.name,
      false,
      this.config,
    );
    this.ops[operation.name] ||= {
      traitSignature: traitFn,
      variant: determineVariant(operation),
    };
    this.wrappers.push(wrapper);
    this.types.push(types);
    const variant = determineVariant(operation);
    this.exports[variant].push([this.node.name, operation.name]);

    this.write(`${traitFn};`);
  }
}

function callAsDeserialize(callee: string, arg: string): string {
  return `<${callee} as serde::Deserialize>::deserialize(${arg})`;
}

function paramDeserializer(p: Parameter, config: ObjectMap): string {
  const mappedType = convertType(p.type, config);
  if (stream(p)) {
    return `real_${rustify(p.name, true)}_rx`;
  } else {
    return `${
      callAsDeserialize(
        mappedType,
        `map.remove("${p.name}")
    .ok_or_else(|| wasmrs_guest::Error::MissingInput("${p.name}".to_owned()))?`,
      )
    }.map_err(|e| wasmrs_guest::Error::Decode(e.to_string()))?`;
  }
}

function propertyParamDeserializer(
  config: ObjectMap,
): (p: Parameter) => string {
  return function (p: Parameter): string {
    return `${rustify(p.name)}: ${paramDeserializer(p, config)},`;
  };
}

function serializePayload(id: string) {
  return `serialize(&${id}).map(|b| Payload::new_data(None, Some(b.into()))).map_err(|e| PayloadError::application_error(e.to_string()))`;
}

export function convertOperation(
  op: Operation,
  iface: string,
  _global: boolean,
  config: ObjectMap,
): [string, string, string] {
  const opName = rustify(op.name);
  const service_module = `${rustify(iface)}_service`;
  const opModule = `${service_module}::${opName}`;
  const component_name = `${rustifyCaps(iface)}Component`;

  const comment = convertDescription(op.description);

  const variant = determineVariant(op);
  let traitFn, wrapper;
  let qualifiedInputType;
  if (op.unary) {
    qualifiedInputType = convertType(op.parameters[0].type, config);
  } else {
    qualifiedInputType = `${opModule}::Input`;
  }
  const qualifiedOutputType = `${opModule}::Output`;

  let inputBuilder;
  if (op.unary) {
    const p = op.parameters[0];
    inputBuilder = paramDeserializer(p, config);
  } else {
    inputBuilder = `${qualifiedInputType} {${
      op.parameters
        .map(propertyParamDeserializer(config))
        .join("\n")
    }}`;
  }

  let simpleInputDeserializer;
  if (op.parameters.length > 0) {
    simpleInputDeserializer = Fn(
      `des`,
    ).Args("mut map: std::collections::BTreeMap<String, Value>").Type(
      `Result<${qualifiedInputType}, Error>`,
    ).Body(
      `Ok(${inputBuilder})`,
    );
  } else {
    simpleInputDeserializer = Fn(
      `des`,
    ).Args("_map: std::collections::BTreeMap<String, Value>").Type(
      `Result<${qualifiedInputType}, Error>`,
    ).Body(
      `unreachable!()`,
    );
  }

  if (variant === ActionKind.RequestResponse) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${opName}(input: ${qualifiedInputType}) -> Result<${qualifiedOutputType}, GenericError>
    `;

    wrapper = Fn(
      `${opName}_wrapper`,
    ).Args([`input: IncomingMono`]).Type(`Result<OutgoingMono, GenericError>`)
      .Body(
        [
          "let (tx, rx) = runtime::oneshot();",
          "let input = deserialize_helper(input);",

          Spawn([
            `let input_payload = ${
              Match("input.await").Error("let _ = tx.send(Err(e)); return;")
            };`,
            simpleInputDeserializer,
            `let _ = ${component_name}::${opName}(${
              Match(Call("des").With("input_payload")).Error(
                [
                  "let _ = tx.send(Err(PayloadError::application_error(e.to_string())));",
                  "return;",
                ],
              )
            })
          .await.map(|result| ${
              serializePayload("result")
            }).map(|output| {let _ = tx.send(output);});`,
          ]),
          "Ok(Mono::from_future(async move { rx.await? }))",
        ],
      );
  } else if (variant === ActionKind.RequestStream) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${opName}(
      input: ${qualifiedInputType},
    ) -> Result<${qualifiedOutputType}, GenericError>
    `;

    wrapper = Fn(
      `${opName}_wrapper`,
    ).Args("input: IncomingMono").Type(`Result<OutgoingStream, GenericError>`)
      .Body(
        [
          "let (out_tx, out_rx) = Flux::new_channels();",
          "let input = deserialize_helper(input);",
          Spawn([
            `let input_payload = ${
              Match("input.await").Error("let _ = out_tx.error(e);return;")
            };`,
            simpleInputDeserializer,
            `let input = ${
              Match("des(input_payload)").Error(
                `let _ = out_tx.error(PayloadError::application_error(e.to_string()));return;`,
              )
            };`,
            Match(`${component_name}::${opName}(input).await`).Cases({
              "Ok(mut result)": [
                While("let Some(next) = result.next().await").Do(
                  [
                    `let out = ${
                      Match("next").Cases({
                        "Ok(output)": serializePayload("output"),
                        "Err(e)": "Err(e)",
                      })
                    };`,
                    `let _ = out_tx.send_result(out);`,
                  ],
                ),
                "out_tx.complete();",
              ],
              "Err(e)":
                "let _ = out_tx.error(PayloadError::application_error(e.to_string()));",
            }),
          ]),
          "Ok(out_rx)",
        ],
      );
  } else if (variant === ActionKind.RequestChannel) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${opName}(
      input: ${qualifiedInputType},
    ) -> Result<${qualifiedOutputType}, GenericError>
    `;
    const streamingParams = op.parameters.filter(stream);

    let deserializeHelper;
    if (streamingParams.length > 0) {
      deserializeHelper =
        `move |payload: ParsedPayload| -> Result<${qualifiedInputType}, Error> {
      let mut map = deserialize_generic(&payload.data)?;
        let input = ${inputBuilder};

      ${
          op.parameters.filter(stream).map((p) =>
            If(`let Some(v) = map.remove("${p.name}")`).Then(
              `let _ = ${rustify(p.name, true)}_inner_tx.send_result(${
                callAsDeserialize(
                  convertType((p.type as Stream).type, config),
                  "v",
                )
              }.map_err(|e| PayloadError::application_error(e.to_string())));`,
            )
          ).join("\n")
        }
      Ok(input)
    }`;
    } else {
      deserializeHelper =
        `move |payload: ParsedPayload| -> Result<${qualifiedInputType}, Error> {unreachable!()}`;
    }

    const inputStreams = op.parameters.filter(stream).flatMap((
      p,
    ) => [
      Let([
        `real_${rustify(p.name, true)}_tx`,
        `real_${rustify(p.name, true)}_rx`,
      ]).Equal("Flux::new_channels();"),
      Let(`${rustify(p.name, true)}_inner_tx`).Equal(
        `real_${rustify(p.name, true)}_tx.clone();`,
      ),
    ]).join("\n");

    const handleInputStreams = (
      config: ObjectMap,
    ): (p: Parameter) => string => {
      return (p) => {
        const t = p.type as Stream;
        return If(`let Some(a) = payload.remove("${p.name}")`).Then(
          `let _ = real_${rustify(p.name, true)}_tx.send_result(${
            callAsDeserialize(convertType(t.type, config), "a")
          }.map_err(|e| PayloadError::application_error(e.to_string())),
        );`,
        );
      };
    };

    const outputHandler = Match("result").Cases({
      "Ok(output)": `let _ = real_out_tx.send_result(${
        serializePayload("output")
      });`,
      "Err(e)": "let _ = real_out_tx.error(e);",
    });
    wrapper = Fn(
      `${opName}_wrapper`,
    ).Args(["input: IncomingStream"]).Type(
      `Result<OutgoingStream, GenericError>`,
    ).Body(
      [
        "let (real_out_tx, real_out_rx) = Flux::new_channels();",
        inputStreams,
        Spawn([
          `let des = ${deserializeHelper};`,
          `let input_map = ${
            If(
              "let Ok(Some(Ok(first))) = input.recv().await",
            ).Then([
              // spawn a task to handle subsequent payloads on the input streams
              Spawn(
                While(
                  `let Ok(Some(Ok(payload))) = input.recv().await`,
                ).Do(
                  If(
                    "let Ok(mut payload) = deserialize_generic(&payload.data)",
                  ).Then(
                    op.parameters.filter(stream).map(
                      handleInputStreams(config),
                    ),
                  ).Else("break;"),
                ),
              ),
              Match("des(first)").Error([
                "let _ = real_out_tx.error(PayloadError::application_error(e.to_string()));",
                "return",
              ]),
            ]).Else(`return;`)
          };`,
          Match(`${component_name}::${opName}(input_map).await`).Cases({
            "Err(e)": [
              "let _ = real_out_tx.error(PayloadError::application_error(e.to_string()));",
              "return",
            ],
            "Ok(mut result)": [
              stream(op.type)
                ? While(
                  "let Some(result) = result.next().await",
                ).Do(outputHandler)
                : `let _ = real_out_tx.send_result(${
                  serializePayload("result")
                });`,
            ],
          }),
        ]),
        "Ok(real_out_rx)",
      ],
    );
  } else {
    throw new Error("unreachable");
  }

  let types;
  if (op.unary) {
    const arg = op.parameters[0] as Parameter;
    types = `
      pub mod ${opName} {
        #[allow(unused_imports)]
        pub(crate) use super::*;

        pub(crate) type Input = ${convertType(arg.type, config)};

        pub(crate) type Output = ${convertType(op.type, config)};
      }  `;
  } else {
    const inputFields = op.parameters
      .map((p) => {
        return `
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
      })
      .join("\n");
    types = `
      pub mod ${opName} {
        #[allow(unused_imports)]
        pub(crate) use super::*;

        #[allow(unused)]
        pub(crate) struct Input {
          ${inputFields}
        }

        pub(crate) type Output = ${convertType(op.type, config)};
      }  `;
  }

  return [traitFn, wrapper, types];
}

// Trying out some utility functions to add some basic type checking to large chunks of generated code.

type Lines = string | string[];

function j(lines: Lines, separator = "\n"): string {
  const block = Array.isArray(lines) ? lines.join(separator) : lines;
  const openParens = block.match(/\(/g) || [];
  const openCurlies = block.match(/\{/g) || [];
  const closeParens = block.match(/\)/g) || [];
  const closeCurlies = block.match(/\}/g) || [];
  if (
    openParens.length !== closeParens.length ||
    openCurlies.length !== closeCurlies.length
  ) {
    console.error(lines);
  }

  return block;
}

function Fn(name: string): string & Fn {
  return Object.assign(`fn ${name}`, { Args: _args });
}

export function If(expr: string): string & If {
  const src = `if ${expr}`;
  return Object.assign(src, { Then: _then });
}

export function Let(ids: Lines): string & Let {
  let src;
  if (Array.isArray(ids)) {
    src = `let (${j(ids, ",")}) = `;
  } else {
    src = `let ${ids} = `;
  }
  return Object.assign(src, { Equal: _equal });
}

export function Call(expr: string): string & Call {
  const src = `${expr}()`;
  return Object.assign(src, { With: _with });
}

export function IgnoreReturn(expr: string): string {
  return `let _ = ${expr}`;
}

export function While(expr: string): string & While {
  const src = `while ${expr}`;
  return Object.assign(src, { Do: _do });
}

export function Match(expr: string): string & Match {
  const src = `match ${expr}`;
  return Object.assign(src, {
    Cases: _cases,
    Error: (stmts: Lines): string => _cases.call(src, { err: stmts }),
  });
}

function Spawn(statements: Lines): string {
  return `spawn(async move ${_block(statements)});`;
}

function _then(this: string, statements: Lines): string & Then {
  const src = `${this}${_block(statements)}`;
  return Object.assign(src, { Else: _else });
}

function _else(this: string, statements: Lines): string {
  return `${this}else${_block(statements)}`;
}

function _args(this: string, args: Lines): string & Args {
  const src = `${this}(${j(args, ",")})`;
  return Object.assign(src, { Type: _type });
}

function _type(this: string, type: string): string & Type {
  const src = `${this}->${type}`;
  return Object.assign(src, { Body: _body });
}

function _body(this: string, statements: Lines): string {
  return `${this}${_block(statements)}`;
}

function _with(this: string, args: Lines): string {
  // This removes the trailing `()` appended by the `Call` function.
  const callee = this.substring(0, this.length - 2);
  return `${callee}(${j(args, ",")})`;
}

function _cases(this: string, cases: Record<string, Lines>): string {
  if (Object.keys(cases).length === 1 && "err" in cases) {
    return `${this} {
      Ok(o)=> o,
      Err(e)=> ${_block(cases.err)},
    }`;
  } else {
    return `${this} { ${
      j(Object.entries(cases).map(([k, v]) => `${k} => ${_block(v)},`))
    } }`;
  }
}

function _do(this: string, statements: Lines): string {
  return `${this}${_block(statements)}`;
}

function _equal(this: string, expr: Lines): string {
  if (Array.isArray(expr)) {
    return `${this}(${j(expr, ",")})`;
  } else {
    return `${this}${expr}`;
  }
}

function _block(statements: Lines): string {
  if (!Array.isArray(statements)) {
    statements = [statements];
  }
  return `{${j(statements, "\n")}}`;
}

interface Then {
  Else(expr: Lines): string;
}

interface Fn {
  Args(params: Lines): string & Args;
}

interface Args {
  Type(type: string): string & Type;
}

interface Type {
  Body(body: Lines): string;
}

interface Call {
  With(params: Lines): string;
}

interface If {
  Then(stmts: Lines): string & Then;
}

interface Let {
  Equal(expr: string): string;
}
interface Match {
  Cases(cases: Record<string, Lines>): string;
  Error(errCase: Lines): string;
}

interface While {
  Do(stmts: Lines): string;
}
