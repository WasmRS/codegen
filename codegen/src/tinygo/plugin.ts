import {
  Configuration,
  TaskDefinition,
} from "https://deno.land/x/apex_cli@v0.0.15/src/config.ts";
import * as apex from "../deps/core/mod.ts";

const importUrl = new URL(".", import.meta.url);
function urlify(relpath: string): string {
  return new URL(relpath, importUrl).toString();
}

interface Alias {
  type: string;
  import?: string;
  format?: string;
  parse?: string;
}
type Aliases = Record<string, Alias>;

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
  config.config.aliases ||= {};
  config.generates ||= {};

  const interfaces = doc.definitions
    .filter((d) => d.isKind(apex.ast.Kind.InterfaceDefinition))
    .map((d) => d as apex.ast.InterfaceDefinition);

  const hasServices = interfaces
    .find((i) => {
      return i.annotation("service") != undefined ||
        i.annotation("events") != undefined ||
        i.annotation("actor") != undefined;
    }) != undefined;

  const aliases = config.config.aliases as Aliases;
  if (!aliases.UUID) {
    aliases["UUID"] = {
      type: "uuid.UUID",
      import: "github.com/google/uuid",
      format: "String",
      parse: "uuid.Parse",
    };
  }

  const { module, package: pkg } = config.config;

  const mod = urlify("./mod.ts");

  const generates = config.generates || [];
  config.generates = generates;

  const prefixCmd = config.config.prefixCmd != undefined
    ? config.config.prefixCmd
    : `cmd/`;
  const prefixPkg = config.config.prefixPkg != undefined
    ? config.config.prefixPkg
    : `pkg/`;

  generates[`${prefixCmd}main.go`] = {
    module: mod,
    visitorClass: `MainVisitor`,
    config: {
      package: "main",
      import: `${module}/pkg/${pkg}`,
    },
  };

  generates[`${prefixPkg}${pkg}/interfaces.go`] = {
    module: mod,
    visitorClass: "InterfacesVisitor",
  };

  generates[`${prefixPkg}${pkg}/iota.go`] = {
    module: "/Users/pkedy/go/src/github.com/apexlang/codegen/src/go/mod.ts",
    visitorClass: "GoVisitor",
    append: [
      {
        module: mod,
        visitorClass: "MsgPackVisitor",
      },
      {
        module: mod,
        visitorClass: "ExportVisitor",
      },
      {
        module: mod,
        visitorClass: "ProviderVisitor",
      },
    ],
  };

  if (hasServices) {
    generates[`${prefixPkg}${pkg}/services.go`] = {
      ifNotExists: true,
      module: mod,
      visitorClass: `ScaffoldVisitor`,
      config: {
        types: ["service", "events", "actors"],
      },
    };
  }

  const tasks = config.tasks ||= {};
  const names = new Set<string>(Object.keys(tasks).map((k) => taskName(k)));
  const defaultTasks: Record<string, TaskDefinition> = {
    all: {
      description: "Clean, generate, and build",
      deps: ["clean", "generate", "deps", "build"],
    },
    clean: {
      description: "Clean the build directory",
      cmds: ["rm -Rf build"],
    },
    deps: {
      description: "Install necessary dependencies",
      cmds: ["go mod tidy"],
    },
    build: {
      description: "Build the module",
      cmds: [
        "mkdir -p build",
        `tinygo build -o build/${config.config.name}.wasm --scheduler=none --target=wasi -no-debug cmd/main.go`,
      ],
    },
    test: {
      description: "Run tests",
      cmds: ["go test --count=1 ./pkg/..."],
    },
  };
  for (const key of Object.keys(defaultTasks)) {
    if (!names.has(taskName(key))) {
      tasks[key] = defaultTasks[key];
    }
  }

  return config;
}
