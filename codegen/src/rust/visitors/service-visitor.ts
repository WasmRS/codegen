import {
  Context,
  Interface,
  ObjectMap,
  Operation,
  Parameter,
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
      .map(([name, deets]) => {
        const rusty_name = rustify(name);
        switch (deets.variant) {
          case ActionKind.RequestResponse:
            return `${deets.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs.await?).await?)}`;
          case ActionKind.RequestStream:
            return `${deets.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs.await?, outputs).await?)}`;
          case ActionKind.RequestChannel:
            return `${deets.traitSignature} { Ok(crate::actions::${iface}::${rusty_name}::task(inputs, outputs).await?)}`;
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
      inputs: Mono<${service_module}::${name}::Inputs, PayloadError>,
    ) -> Result<${service_module}::${name}::Outputs, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingMono) -> Result<OutgoingMono, GenericError> {
      let (tx, rx) = runtime::oneshot();

      let input = Mono::from_future(input.map(|r| r.map(|v| Ok(deserialize(&v.data)?))?));
      let task = ${component_name}::
          ${name}(input)
          .map(|result| {
              let output = result?;
              Ok(serialize(&output).map(|bytes| Payload::new_data(None, Some(bytes.into())))?)
          })
          .map(|output| tx.send(output).unwrap());

      spawn(task);

      Ok(Mono::from_future(async move { rx.await? }))
    }`;
  } else if (variant === ActionKind.RequestStream) {
    traitFn = `
    ${trimLines([comment])}
    async fn ${name}(
      inputs: Mono<${service_module}::${name}::Inputs, PayloadError>,
      outputs: Flux<${service_module}::${name}::Outputs, PayloadError>
    ) -> Result<Flux<${service_module}::${name}::Outputs, PayloadError>, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingMono) -> Result<OutgoingStream, GenericError> {
      // generated

      let (out_tx, out_rx) = Flux::new_channels();

      let input = deserialize_helper(input);

      spawn(async move {
          let task = Self {};
          let (outputs_tx, mut outputs_rx) = Flux::new_channels();
          let outputs = outputs_tx;
          match ${component_name}::${name}(input, outputs).await {
              Ok(_) => {
                  while let Some(next) = outputs_rx.next().await {
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
      inputs: FluxReceiver<${service_module}::${name}::Inputs, PayloadError>,
      outputs: Flux<${service_module}::${name}::Outputs, PayloadError>
    ) -> Result<Flux<${service_module}::${name}::Outputs, PayloadError>, GenericError>
    `;

    wrapper = `
    fn ${name}_wrapper(input: IncomingStream) -> Result<OutgoingStream, GenericError> {
      // generated
      let (inputs_tx, inputs_rx) = Flux::<${service_module}::${name}::Inputs, PayloadError>::new_channels();

      spawn(async move {
          while let Ok(Some(Ok(payload))) = input.recv().await {
              inputs_tx.send_result(deserialize(&payload.data).map_err(|e| e.into()));
          }
      });
      let (real_out_tx, real_out_rx) = Flux::new_channels();
      let (outputs_tx, mut outputs_rx) = Flux::new_channels();

      spawn(async move {
          while let Some(result) = outputs_rx.next().await {
              match result {
                  Ok(payload) => match serialize(&payload) {
                      Ok(bytes) => {
                          real_out_tx.send(Payload::new_data(None, Some(Bytes::from(bytes))));
                      }
                      Err(e) => {
                          real_out_tx.error(PayloadError::application_error(e.to_string()));
                      }
                  },
                  Err(err) => {
                      real_out_tx.error(err);
                  }
              }
          }
      });

      spawn(async move {
          let _result = ${component_name}::${name}(inputs_rx, outputs_tx).await;
      });

      Ok(real_out_rx)

    }`;
  } else {
    throw new Error("unreachable");
  }

  let types;
  if (variant === ActionKind.RequestChannel) {
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
  #[serde(rename = "${p.name}")]
  pub(crate) ${rustify(p.name)}: ${convertType(p.type, config)},
  `;
      })
      .join("\n");
    types = `
      pub mod ${name} {
        #[allow(unused_imports)]
        pub(crate) use super::*;
        #[derive(serde::Deserialize)]
        pub(crate) struct Inputs {
          ${inputFields}
        }

        pub(crate) type Outputs = ${convertType(op.type, config)};
      }  `;
  }

  return [traitFn, wrapper, types];
}
