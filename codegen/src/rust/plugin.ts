import {
  Configuration,
  TaskDefinition,
} from "https://deno.land/x/apex_cli@v0.0.15/src/config.ts";
import * as apex from "../deps/core/mod.ts";
import * as rust from "../deps/codegen/rust.ts";
import { Context, Operation } from "../deps/core/model.ts";
import { determineVariant } from "./utils/mod.ts";
import { parse } from "https://deno.land/std@0.177.0/encoding/toml.ts";

const utils = rust.utils;

const importUrl = new URL(".", import.meta.url);

function urlify(relpath: string): string {
  const url = new URL(relpath, importUrl).toString();
  return url;
}

function taskName(taskExpr: string): string {
  const idx = taskExpr.indexOf(">");
  if (idx != -1) {
    return taskExpr.substring(idx).trim();
  }
  return taskExpr.trim();
}

export default function (
  doc: apex.ast.Document,
  config: Configuration,
): Configuration {
  config.config ||= {};
  const generates = config.generates ||= {};
  const context = new Context({}, doc);

  const { module } = config.config;
  config.config.name ||= module;
  try {
    const cargoToml = Deno.readTextFileSync("./Cargo.toml");
    const cargo = parse(cargoToml) as any;
    config.config.name ||= cargo.package.name;
  } catch {}
  if (!config.config.name) {
    throw new Error(
      "No name provided in config, and no Cargo.toml found with a name",
    );
  }
  const wasmName = `${(config.config.name as string).replace("-", "_")}.wasm`;

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
        generates[`./src/actions/${rusty_iface}/${rusty_action}.rs`] = {
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
      bytes: "wasmrs_guest::Bytes",
      derive: {
        _all: [],
      },
      datetime: "wasmrs_guest::Timestamp",
      visibility: {
        _all: "pub",
      },
    },
  };

  const tasks = config.tasks ||= {};
  const names = new Set<string>(Object.keys(tasks).map((k) => taskName(k)));
  const defaultTasks: Record<string, TaskDefinition> = {
    all: {
      description: "Clean, generate, and build",
      deps: ["generate", "clean", "build"],
    },
    clean: {
      description: "Clean the build directory",
      cmds: [
        "cargo clean",
        "rm -Rf build",
      ],
    },
    build: {
      description: "Build the module",
      cmds: [
        "mkdir -p build",
        `cargo build --target wasm32-unknown-unknown --release`,
        `cp target/wasm32-unknown-unknown/release/${wasmName} build/`,
      ],
    },
    test: {
      description: "Run tests",
      cmds: ["cargo test"],
    },
  };
  for (const key of Object.keys(defaultTasks)) {
    if (!names.has(taskName(key))) {
      tasks[key] = defaultTasks[key];
    }
  }

  return config;
}
