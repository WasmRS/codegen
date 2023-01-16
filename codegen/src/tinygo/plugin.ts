import { Configuration } from "https://deno.land/x/apex_cli@v0.0.6/src/config.ts";
import * as apex from "../deps/core/mod.ts";

const importUrl = new URL(".", import.meta.url);

function urlify(relpath: string): string {
  const url = new URL(relpath, importUrl).toString();
  console.error(url);
  return url;
}

interface Alias {
  type: string;
  import?: string;
  format?: string;
  parse?: string;
}
type Aliases = Record<string, Alias>;

interface TasksConfig {
  tasks: Record<string, string[]>;
}

function taskName(taskExpr: string): string {
  const idx = taskExpr.indexOf(">");
  if (idx != -1) {
    return taskExpr.substring(idx).trim();
  }
  return taskExpr.trim();
}

export default function (
  _doc: apex.ast.Document,
  config: Configuration,
): Configuration {
  config.config ||= {};
  config.config.aliases ||= {};
  config.generates ||= {};

  const aliases = config.config.aliases as Aliases;
  if (!aliases.UUID) {
    aliases["UUID"] = {
      type: "uuid.UUID",
      import: "github.com/nanobus/iota/go/types/uuid",
      format: "String",
      parse: "uuid.Parse",
    };
  }

  const { module, package: pkg } = config.config;

  const mod = urlify("./mod.ts");

  config.generates[`./cmd/main.go`] = {
    ifNotExists: true,
    module: mod,
    visitorClass: `MainVisitor`,
    config: {
      import: `${module}/pkg/${pkg}`,
    },
  };

  [
    {
      file: "msgpack.go",
      visitorClass: "MsgPackVisitor",
    },
    {
      file: "interfaces.go",
      visitorClass: "InterfacesVisitor",
    },
    {
      file: "export.go",
      visitorClass: "ExportVisitor",
    },
    {
      file: "providers.go",
      visitorClass: "ProviderVisitor",
    },
  ].forEach((item) => {
    config.generates[`pkg/${pkg}/${item.file}`] = {
      module: mod,
      visitorClass: item.visitorClass,
    };
  });

  config.generates[`pkg/${pkg}/service.go`] = {
    ifNotExists: true,
    module: mod,
    visitorClass: `ScaffoldVisitor`,
    config: {
      types: ["service"],
    },
  };

  const tasks = (config as unknown as TasksConfig).tasks ||= {};
  const names = new Set<string>(Object.keys(tasks).map((k) => taskName(k)));
  const defaultTasks: Record<string, string[]> = {
    "all > clean generate deps build": [],
    clean: [
      "rm -Rf build",
    ],
    deps: [
      "go mod tidy",
    ],
    build: [
      "mkdir -p build",
      `tinygo build -o build/${config.config.name}.wasm --scheduler=none --target=wasi -no-debug cmd/main.go`,
    ],
    test: [
      "go test --count=1 ./pkg/...",
    ],
  };
  for (const key of Object.keys(defaultTasks)) {
    if (!names.has(taskName(key))) {
      tasks[key] = defaultTasks[key];
    }
  }

  return config;
}
