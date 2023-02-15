import {
  Context,
  Interface,
  ObjectMap,
  Operation,
  Stream,
} from "../../deps/core/model.ts";
import { rust } from "../../deps/codegen/mod.ts";
import { convertDescription } from "../utils/conversions.ts";
import {
  ActionKind,
  Actions,
  constantCase,
  determineVariant,
  nonStream,
  stream,
} from "../utils/mod.ts";
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

  const variant = determineVariant(op);

  let impl;

  switch (variant) {
    case ActionKind.RequestResponse:
      impl = gen_request_response(op, interfaceName, config);
      break;
    case ActionKind.RequestChannel:
      impl = gen_request_channel(op, interfaceName, config);
      break;
    case ActionKind.RequestStream:
      impl = gen_request_stream(op, interfaceName, config);
      break;
    default:
      throw new Error(`Unknown variant: ${variant}`);
  }

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
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
    })
    .join("\n");

  const lifetime = op.parameters.length > 0 ? "" : "";
  const lifetimeIn = op.parameters.length > 0 ? "" : "";

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

  #[derive(serde::Serialize, serde::Deserialize)]
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
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
    })
    .join("\n");

  const lifetime = op.parameters.length > 0 ? "" : "";
  const lifetimeIn = op.parameters.length > 0 ? "" : "";

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

  #[derive(serde::Serialize, serde::Deserialize)]
  pub struct Inputs${lifetime} {
    ${inputFields}
  }

  pub(crate) type Outputs = ${convertType((op.type as Stream).type, config)};
}
`;
}

function gen_request_channel(
  op: Operation,
  interfaceName: string,
  config: ObjectMap,
): string {
  const name = rustify(op.name);
  const indexConstant = constantCase(`${interfaceName}_${name}`);

  const inputFields = op.parameters
    .map((p) => {
      return `
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
    })
    .join("\n");

  const inputFirst = op.parameters.filter(nonStream)
    .map((p) => {
      return `
      pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
    })
    .join("\n");

  const lifetime = op.parameters.length > 0 ? "" : "";
  const lifetimeIn = op.parameters.length > 0 ? "" : "";

  return `
pub(crate) fn ${name}(
  mut inputs: ${name}::Inputs${lifetimeIn},
) -> impl Stream<Item = Result<${name}::Outputs, PayloadError>> {
//) -> wasmrs_guest::Flux<${name}::Outputs, PayloadError> {
  let op_id_bytes = ${indexConstant}_INDEX_BYTES.as_slice();

  let (tx, rx) = Flux::new_channels();

  #[derive(serde::Serialize, serde::Deserialize)]
  #[serde(untagged)]
  enum OpInputs {
    Params(${name}::InputFirst),
    ${
    op.parameters.filter(stream).map((p) =>
      `${rustifyCaps(p.name)}(${convertType((p.type as Stream).type, config)}),`
    )
  }
  }

  let first = OpInputs::Params(${name}::InputFirst {
    ${
    op.parameters.filter(nonStream).map((p) =>
      `${rustify(p.name)}: inputs.${rustify(p.name)},`
    )
  }
  });

  ${
    op.parameters.filter(stream).map((p) => `
  let tx_inner = tx.clone();
  spawn(async move {
    while let Some(payload) = inputs.${rustify(p.name)}.next().await {
      if let Err(e) = payload {
        tx_inner.error(e);
        continue;
      }
      let payload = payload.unwrap();
      let message = OpInputs::${rustifyCaps(p.name)}(payload);
      let payload = wasmrs_guest::serialize(&message).map(|b| Payload::new_data(None, Some(b.into()))).map_err(|e|PayloadError::application_error(e.to_string()));
      let _ = tx_inner.send_result(payload);
    }
  });
  `)
  }

  let payload = wasmrs_guest::serialize(&first)
    .map(|b| Payload::new([op_id_bytes, &[0, 0, 0, 0]].concat().into(), b.into()))
    .map_err(|e|PayloadError::application_error(e.to_string()));
  tx.send_result(payload);

  Host::default().request_channel(rx).map(|result| {
      result
          .map(|payload| Ok(deserialize::<${name}::Outputs>(&payload.data.unwrap())?))?
  })
}

pub(crate) mod ${name} {
  use super::*;

  pub struct Inputs${lifetime} {
    ${inputFields}
  }

  #[derive(serde::Serialize, serde::Deserialize)]
  pub struct InputFirst {
    ${inputFirst}
  }

  pub(crate) type Outputs = ${convertType(op.type, config)};
}
`;
}
