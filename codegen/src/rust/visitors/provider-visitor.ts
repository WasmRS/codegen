import {
  Context,
  Interface,
  Kind,
  ObjectMap,
  Operation,
  Stream,
} from "../../deps/core/model.ts";
import { rust } from "../../deps/codegen/mod.ts";
import { convertDescription } from "../utils/conversions.ts";
import { Actions, constantCase, determineVariant } from "../utils/mod.ts";
import { convertType } from "../utils/types.ts";

import { SourceGenerator } from "./base.ts";
const { rustify, rustifyCaps, trimLines } = rust.utils;

export class ProviderVisitor extends SourceGenerator<Interface> {
  index = 0;
  imports = new Actions();
  wrappers: string[] = [];
  types: string[] = [];

  constructor(context: Context, indexStart: number) {
    super(context.interface, context);
    this.index = indexStart;
    this.walk();
  }

  buffer(): string {
    const rootName = rustifyCaps(this.node.name);

    const module_name = `${rustify(this.node.name)}`;

    const innerSource = this.writer.string();

    const comment = convertDescription(this.node.description);

    const indexConstants = this.node.operations.map((op, i) => {
      return `static ${
        constantCase(
          `${rootName}_${op.name}`,
        )
      }_INDEX_BYTES: [u8; 4] = ${this.index + i}u32.to_be_bytes();`;
    });

    return `
${indexConstants.join("\n")}
${trimLines([comment])}
pub mod ${module_name} {
  use super::*;
  ${innerSource}
}
`;
  }

  visitOperation(context: Context): void {
    const { operation } = context;

    const source = convertOperation(
      operation,
      this.node.name,
      false,
      this.config,
    );
    const variant = determineVariant(operation);
    this.imports[variant].push([this.node.name, operation.name]);

    this.write(source);
  }
}

export function convertOperation(
  op: Operation,
  interfaceName: string,
  _global: boolean,
  config: ObjectMap,
): string {
  const comment = convertDescription(op.description);

  const impl = op.type.kind === Kind.Stream
    ? gen_request_stream(op, interfaceName, config)
    : gen_request_response(op, interfaceName, config);

  return `
${trimLines([comment])}
${impl}
`;
}

function gen_request_response(
  op: Operation,
  interfaceName: string,
  config: ObjectMap,
): string {
  const name = rustify(op.name);
  const indexConstant = constantCase(`${interfaceName}_${name}`);

  const inputFields = op.parameters
    .map((p) => {
      return `
  #[serde(rename = "${p.name}")]
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config, true, "'a")},
  `;
    })
    .join("\n");

  const lifetime = op.parameters.length > 0 ? "<'a>" : "";
  const lifetimeIn = op.parameters.length > 0 ? "<'_>" : "";

  return `
pub(crate) fn ${name}(
  inputs: ${name}::Inputs${lifetimeIn},
) -> wasmrs_guest::Mono<${name}::Outputs, PayloadError> {
  let op_id_bytes = ${indexConstant}_INDEX_BYTES.as_slice();
  let payload = match wasmrs_guest::serialize(&inputs) {
      Ok(bytes) => Payload::new([op_id_bytes, &[0, 0, 0, 0]].concat().into(), bytes.into()),
      Err(e) => return Mono::new_error(PayloadError::application_error(e.to_string())),
  };
  let fut = Host::default().request_response(payload).map(|result| {
      result
          .map(|payload| Ok(deserialize::<${name}::Outputs>(&payload.data.unwrap())?))?
  });
  Mono::from_future(fut)
}

pub(crate) mod ${name} {
  use super::*;

  #[derive(serde::Serialize)]
  pub struct Inputs${lifetime} {
    ${inputFields}
  }

  pub(crate) type Outputs = ${convertType(op.type, config)};
}
`;
}

function gen_request_stream(
  op: Operation,
  interfaceName: string,
  config: ObjectMap,
): string {
  const name = rustify(op.name);
  const indexConstant = constantCase(`${interfaceName}_${name}`);

  const inputFields = op.parameters
    .map((p) => {
      return `
  #[serde(rename = "${p.name}")]
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config, true, "'a")},
  `;
    })
    .join("\n");

  const lifetime = op.parameters.length > 0 ? "<'a>" : "";
  const lifetimeIn = op.parameters.length > 0 ? "<'_>" : "";

  return `
pub(crate) fn ${name}(
  inputs: ${name}::Inputs${lifetimeIn},
) -> impl Stream<Item = Result<${name}::Outputs, PayloadError>> {
//) -> wasmrs_guest::Flux<${name}::Outputs, PayloadError> {
  let op_id_bytes = ${indexConstant}_INDEX_BYTES.as_slice();
  let payload = match wasmrs_guest::serialize(&inputs) {
      Ok(bytes) => Payload::new([op_id_bytes, &[0, 0, 0, 0]].concat().into(), bytes.into()),
      Err(_) => unreachable!(),
  };
  Host::default().request_stream(payload).map(|result| {
      result
          .map(|payload| Ok(deserialize::<${name}::Outputs>(&payload.data.unwrap())?))?
  })
}

pub(crate) mod ${name} {
  use super::*;

  #[derive(serde::Serialize)]
  pub struct Inputs${lifetime} {
    ${inputFields}
  }

  pub(crate) type Outputs = ${convertType((op.type as Stream).type, config)};
}
`;
}
