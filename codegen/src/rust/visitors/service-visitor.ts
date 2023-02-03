import {
  Context,
  Interface,
  Kind,
  ObjectMap,
  Operation,
  Parameter,
  Stream,
} from "../../deps/core/model.ts";
import { rust } from "../../deps/codegen/mod.ts";
import { convertDescription } from "../utils/conversions.ts";
import { convertType } from "../utils/types.ts";

import { SourceGenerator } from "./base.ts";
import { ActionKind, Actions, determineVariant } from "../utils/mod.ts";

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
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs).await?)}`;
          case ActionKind.RequestStream:
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs).await?)}`;
          case ActionKind.RequestChannel:
            return `${details.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs).await?)}`;
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

export function convertOperation(
  op: Operation,
  iface: string,
  _global: boolean,
  config: ObjectMap,
): [string, string, string] {
  const name = rustify(op.name);
  const service_module = `${rustify(iface)}_service`;
  const component_name = `${rustifyCaps(iface)}Component`;

  const comment = convertDescription(op.description);

  const variant = determineVariant(op);
  let traitFn, wrapper;

  if (variant === ActionKind.RequestResponse) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${name}(
      inputs: ${service_module}::${name}::Inputs,
    ) -> Result<${service_module}::${name}::Outputs, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingMono) -> Result<OutgoingMono, GenericError> {
      let (tx, rx) = runtime::oneshot();

      let input = deserialize_helper(input);

      let task = async move {

        let input_payload = match input.await {
          Ok(i) => i,
          Err(e) => {
            let _ = tx.send(Err(e));
            return;
          }
        };
        use wasmrs_guest::Value;
        fn des(mut map: std::collections::BTreeMap<String, Value>) -> Result<${service_module}::${name}::Inputs, Error> {
          Ok(${service_module}::${name}::Inputs {
            ${
      op.parameters
        .map((p) => {
          return `${rustify(p.name)}: <${
            convertType(p.type, config)
          } as serde::Deserialize>::deserialize(map.remove("${p.name}").ok_or_else(|| wasmrs_guest::Error::MissingInput("${p.name}".to_owned()))?).map_err(|e| wasmrs_guest::Error::Decode(e.to_string()))?,`;
        })
        .join("\n")
    }
          })
        }

        let input = match des(input_payload) {
          Ok(i) => i,
          Err(e) => {
            let _ = tx.send(Err(PayloadError::application_error(e.to_string())));
            return;
          }
        };

        ${component_name}::
          ${name}(input)
          .await
          .map(|result| {
              Ok(serialize(&result).map(|bytes| Payload::new_data(None, Some(bytes.into())))?)
          })
          .map(|output| tx.send(output).unwrap());
      };

      spawn(task);

      Ok(Mono::from_future(async move { rx.await? }))
    }`;
  } else if (variant === ActionKind.RequestStream) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${name}(
      inputs: ${service_module}::${name}::Inputs,
    ) -> Result<${service_module}::${name}::Outputs, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingMono) -> Result<OutgoingStream, GenericError> {
      // generated

      let (out_tx, out_rx) = Flux::new_channels();

      let input = deserialize_helper(input);

      spawn(async move {
          let input_payload = match input.await {
            Ok(i) => i,
            Err(e) => {
              let _ = out_tx.error(e);
              return;
            }
          };
          use wasmrs_guest::Value;
          fn des(mut map: std::collections::BTreeMap<String, Value>) -> Result<${service_module}::${name}::Inputs, Error> {
            Ok(${service_module}::${name}::Inputs {
              ${
      op.parameters
        .map((p) => {
          return `${rustify(p.name)}: <${
            convertType(p.type, config)
          } as serde::Deserialize>::deserialize(map.remove("${p.name}").ok_or_else(|| wasmrs_guest::Error::MissingInput("${p.name}".to_owned()))?).map_err(|e| wasmrs_guest::Error::Decode(e.to_string()))?,`;
        })
        .join("\n")
    }
            })
          }

          let input = match des(input_payload) {
            Ok(i) => i,
            Err(e) => {
              let _ = out_tx.error(PayloadError::application_error(e.to_string()));
              return;
            }
          };

          match ${component_name}::${name}(input).await {
            Ok(mut result) => {
              while let Some(next) = result.next().await {
                let out = match next {
                  Ok(output) => match serialize(&output) {
                    Ok(bytes) => Ok(Payload::new_data(None, Some(bytes.into()))),
                    Err(e) => Err(PayloadError::application_error(e.to_string())),
                  },
                  Err(e) => Err(e),
                };
                let _ = out_tx.send_result(out);
              }
              out_tx.complete();
            }
            Err(e) => {
              let _ = out_tx.error(PayloadError::application_error(e.to_string()));
            }
          };
      });

      Ok(out_rx)
    }`;
  } else if (variant === ActionKind.RequestChannel) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${name}(
      inputs: ${service_module}::${name}::Inputs,
    ) -> Result<${service_module}::${name}::Outputs, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingStream) -> Result<OutgoingStream, GenericError> {
      // generated
      let (inputs_tx, inputs_rx) = Flux::<${service_module}::${name}::Inputs, PayloadError>::new_channels();

      ${
      op.parameters.filter((p) => p.type.kind === Kind.Stream).map((p) =>
        `let (real_${rustify(p.name)}_tx, real_${
          rustify(p.name)
        }_rx) = Flux::new_channels();`
      ).join("\n")
    }

      let (real_out_tx, real_out_rx) = Flux::new_channels();


      ${
      op.parameters.filter((p) => p.type.kind === Kind.Stream).map((p) =>
        `let ${rustify(p.name)}_inner_tx = real_${rustify(p.name)}_tx.clone();`
      ).join("\n")
    }
      spawn(async move {
          let input_map = if let Ok(Some(Ok(first))) = input.recv().await {

            use wasmrs_guest::Value;
            let des = move |payload: ParsedPayload| -> Result<${service_module}::${name}::Inputs, Error> {
              println!("deserializing {:2x?}", payload.data);
              let mut map = deserialize_generic(&payload.data)?;
                let input = ${service_module}::${name}::Inputs {
                ${
      op.parameters.filter((p) => p.type.kind !== Kind.Stream)
        .map((p) => {
          return `${rustify(p.name)}: <${
            convertType(p.type, config)
          } as serde::Deserialize>::deserialize(map.remove("${p.name}").ok_or_else(|| wasmrs_guest::Error::MissingInput("${p.name}".to_owned()))?).map_err(|e| wasmrs_guest::Error::Decode(e.to_string()))?,`;
        })
        .join("\n")
    }
    ${
      op.parameters.filter((p) => p.type.kind === Kind.Stream).map((p) =>
        `${rustify(p.name)}: real_${rustify(p.name)}_rx,`
      ).join("\n")
    }
              };
            println!("map: {:?}",map);

              ${
      op.parameters.filter((p) => p.type.kind === Kind.Stream).map((p) =>
        `if let Some(v) = map.remove("${p.name}") {
          println!("value: {:?}",v);
          ${rustify(p.name)}_inner_tx.send_result(<${
          convertType((p.type as Stream).type, config)
        } as serde::Deserialize>::deserialize(v).map_err(|e| PayloadError::application_error(e.to_string())));
        }`
      ).join("\n")
    }
              Ok(input)
            };

            spawn(async move {

              while let Ok(Some(Ok(payload))) = input.recv().await {
                if let Ok(mut payload) = deserialize_generic(&payload.data) {
                  ${
      op.parameters.filter((p) => p.type.kind === Kind.Stream).map((p) => {
        const t = p.type as Stream;
        return `
                    if let Some(a) = payload.remove("${p.name}") {
                      real_${rustify(p.name)}_tx.send_result(
                        <${
          convertType(t.type, config)
        } as serde::Deserialize>::deserialize(a)
                          .map_err(|e| PayloadError::application_error(e.to_string())),
                      );
                    }
  `;
      }).join("\n")
    }
                } else {
                  break;
                }
              }
            });

            match des(first) {
              Ok(i) => i,
              Err(e) => {
                let _ = real_out_tx.error(PayloadError::application_error(e.to_string()));
                return;
              }
            }
          } else {
            return;
          };
          let result = ${component_name}::${name}(input_map).await;
          if let Err(e) = result {
              real_out_tx.error(PayloadError::application_error(e.to_string()));
          } else {
            let mut result = result.unwrap();
            while let Some(result) = result.next().await {
              match result {
                Ok(output) => {
                  let _ = real_out_tx.send_result(
                    serialize(&output)
                      .map(|b| Payload::new_data(None, Some(b.into())))
                      .map_err(|e| PayloadError::application_error(e.to_string())),
                  );
                }
                Err(e) => {
                  let _ = real_out_tx.error(e);
                }
              }
            }
          }

      });

      Ok(real_out_rx)

    }`;
  } else {
    throw new Error("unreachable");
  }

  let types;
  if (op.unary) {
    const arg = op.parameters[0] as Parameter;
    types = `
      pub mod ${name} {
        #[allow(unused_imports)]
        pub(crate) use super::*;

        pub(crate) type Inputs = ${convertType(arg.type, config)};

        pub(crate) type Outputs = ${convertType(op.type, config)};
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
      pub mod ${name} {
        #[allow(unused_imports)]
        pub(crate) use super::*;

        pub(crate) struct Inputs {
          ${inputFields}
        }

        pub(crate) type Outputs = ${convertType(op.type, config)};
      }  `;
  }

  return [traitFn, wrapper, types];
}
