import * as model from "../deps/core/model.ts";
import * as codegen from "../deps/codegen/mod.ts";
import { ServiceVisitor } from "./visitors/service-visitor.ts";
import { ProviderVisitor } from "./visitors/provider-visitor.ts";
import { ActionKind, Actions, constantCase } from "./utils/mod.ts";

type Context = model.Context;
const utils = codegen.rust.utils;

export default class DefaultVisitor extends codegen.rust.RustBasic {
  namespace = "";
  exports = new Actions();
  imports = new Actions();

  visitNamespace(context: Context): void {
    const { namespace } = context;
    this.namespace = namespace.name;
  }

  visitContextBefore(context: Context): void {
    super.visitContextBefore(context);
    if (context.config.modules) {
      Object.entries(
        context.config.modules as Record<string, string[]>,
      ).forEach(([iface, actions]: [string, string[]]) => {
        this.append(`
        pub(crate) mod ${iface} {
          pub(crate) use super::*;
          ${actions.map((a) => `pub(crate) mod ${a};`).join("\n")}
        }
        `);
      });
    }

    this.append(`
use wasmrs_guest::FutureExt;

use wasmrs_guest::*;

#[no_mangle]
extern "C" fn __wasmrs_init(
    guest_buffer_size: u32,
    host_buffer_size: u32,
    max_host_frame_len: u32,
) {
    wasmrs_guest::init_logging();

    init_exports();
    init_imports();
    wasmrs_guest::init(guest_buffer_size, host_buffer_size, max_host_frame_len);
}

fn deserialize_helper(
  i: Mono<ParsedPayload, PayloadError>,
) -> Mono<std::collections::BTreeMap<String, wasmrs_guest::Value>, PayloadError> {
  Mono::from_future(async move {
    match i.await {
      Ok(bytes) => match deserialize(&bytes.data) {
        Ok(v) => Ok(v),
        Err(e) => Err(PayloadError::application_error(e.to_string())),
      },
      Err(e) => Err(PayloadError::application_error(e.to_string())),
    }
  })
}
`);
  }

  visitContextAfter(context: Context): void {
    super.visitContextAfter(context);

    const imports = [
      this.imports[ActionKind.RequestResponse].map(
        writeImport(this.namespace, ActionKind.RequestResponse),
      ).join("\n"),
      this.imports[ActionKind.RequestStream].map(
        writeImport(this.namespace, ActionKind.RequestStream),
      ).join("\n"),
      this.imports[ActionKind.RequestChannel].map(
        writeImport(this.namespace, ActionKind.RequestChannel),
      ).join("\n"),
    ];

    const exports = [
      this.exports[ActionKind.RequestResponse].map(
        writeExport(this.namespace, ActionKind.RequestResponse),
      ).join("\n"),
      this.exports[ActionKind.RequestStream].map(
        writeExport(this.namespace, ActionKind.RequestStream),
      ).join("\n"),
      this.exports[ActionKind.RequestChannel].map(
        writeExport(this.namespace, ActionKind.RequestChannel),
      ).join("\n"),
    ];

    this.write(`
pub(crate) fn init_imports() {
  ${imports.join("\n")}
}
pub(crate) fn init_exports() {
  ${exports.join("\n")}
}
    `);
  }

  visitInterface(context: Context): void {
    const iface = context.interface;
    if (iface.annotation("service")) {
      const visitor = new ServiceVisitor(context);
      this.exports.merge(visitor.exports);

      this.append(visitor.buffer());
    } else if (iface.annotation("provider")) {
      const visitor = new ProviderVisitor(context, this.imports.num());
      this.imports.merge(visitor.imports);
      this.append(visitor.buffer());
    } else {
      super.visitInterface(context);
    }
  }
}

function writeImport(
  ns: string,
  kind: ActionKind,
): ([iface, op]: [string, string]) => string {
  return ([iface, op]) => {
    const importConstant = constantCase(`${iface}_${op}`);
    let variant;
    switch (kind) {
      case ActionKind.RequestResponse:
        variant = "RequestResponse";
        break;
      case ActionKind.RequestChannel:
        variant = "RequestChannel";
        break;
      case ActionKind.RequestStream:
        variant = "RequestStream";
        break;
      default:
        throw new Error("Unknown action kind");
    }

    return `
  wasmrs_guest::add_import(
    u32::from_be_bytes(${importConstant}_INDEX_BYTES),OperationType::${variant},"${ns}.${iface}","${op}",
  );`;
  };
}

function writeExport(
  ns: string,
  kind: ActionKind,
): ([iface, op]: [string, string]) => string {
  return ([iface, op]) => {
    let variant;
    switch (kind) {
      case ActionKind.RequestResponse:
        variant = "request_response";
        break;
      case ActionKind.RequestChannel:
        variant = "request_channel";
        break;
      case ActionKind.RequestStream:
        variant = "request_stream";
        break;
      default:
        throw new Error("Unknown action kind");
    }

    return `
    wasmrs_guest::register_${variant}(
      "${ns}.${iface}","${op}",${
      utils.rustifyCaps(
        `${iface}Component`,
      )
    }::${utils.rustify(op)}_wrapper,
    );`;
  };
}
