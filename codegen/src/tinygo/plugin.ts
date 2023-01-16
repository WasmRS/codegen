import { Configuration } from "https://deno.land/x/apex_cli@v0.0.6/src/config.ts";
import * as apex from "../deps/core/mod.ts";

const importUrl = new URL(".", import.meta.url);

function urlify(relpath: string): string {
  const url = new URL(relpath, importUrl).toString();
  console.error(url);
  return url;
}

interface Alias {
  type: string,
  import?: string,
  format?: string,
  parse?: string,
}
type Aliases = Record<string, Alias>

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
    }
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

  return config;
}
