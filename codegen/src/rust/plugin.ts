import { Configuration } from "https://deno.land/x/apex_cli@v0.0.6/src/config.ts";
import * as apex from "./deps/apex_core.ts";
import * as codegen from "./deps/apex_codegen.ts";
import { Context, Operation } from "./deps/apex_model.ts";
import { determineVariant } from "./utils/mod.ts";
const utils = codegen.rust.utils;

const importUrl = new URL(".", import.meta.url);

function urlify(relpath: string): string {
  const url = new URL(relpath, importUrl).toString();
  return url;
}

export default function (
  doc: apex.ast.Document,
  config: Configuration,
): Configuration {
  config.generates ||= {};

  const context = new Context({}, doc);

  const interfaces = doc.definitions.filter(
    (def) => def.getKind() === apex.ast.Kind.InterfaceDefinition,
  ) as apex.ast.InterfaceDefinition[];

  const modules: Record<string, string[]> = {};

  interfaces.forEach((iface) => {
    const rusty_iface = utils.rustify(iface.name.value);
    if (iface.annotation("service")) {
      modules[rusty_iface] = [];
      iface.operations.forEach((op) => {
        const rusty_action = utils.rustify(op.name.value);
        modules[rusty_iface].push(rusty_action);
        config.generates[`./src/actions/${rusty_iface}/${rusty_action}.rs`] = {
          module: urlify("./action-scaffold.ts"),
          ifNotExists: true,
          config: {
            variant: determineVariant(new Operation(context.getType, op)),
            interface: rusty_iface,
            action: rusty_action,
            datetime: "wasmrs_guest::Timestamp",
            visibility: {
              _all: "pub",
            },
          },
        };
      });
    }
  });

  config.generates[`./src/lib.rs`] = {
    ifNotExists: true,
    module: urlify("./lib-boilerplate.ts"),
    config: {},
  };

  config.generates[`./src/error.rs`] = {
    ifNotExists: true,
    module: urlify("./error-boilerplate.ts"),
    config: {},
  };

  config.generates[`./src/actions/mod.rs`] = {
    module: urlify("./default-visitor.ts"),
    config: {
      modules,
      serde: true,
      derive: {
        _all: [],
      },
      datetime: "wasmrs_guest::Timestamp",
      visibility: {
        _all: "pub",
      },
    },
  };

  return config;
}
