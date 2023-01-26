// deno-lint-ignore-file require-await
import {
  FSStructure,
  Template,
} from "https://deno.land/x/apex_cli@v0.0.15/src/config.ts";

const importUrl = new URL(".", import.meta.url);
function urlify(relpath: string): string {
  return new URL(relpath, importUrl).toString();
}

const template: Template = {
  info: {
    name: "@iota/tinygo",
    description: "Iota TinyGo module project",
    variables: [
      {
        name: "module",
        description: "The module name",
        type: "input",
        prompt:
          "Please enter the module name (e.g. github.com/myorg/myservice)",
        default: "github.com/myorg/myservice",
      },
      {
        name: "package",
        description: "The main package name",
        type: "input",
        prompt: "Please enter the main package name (e.g. myservice)",
        default: "myservice",
      },
    ],
  },

  async process(_vars): Promise<FSStructure> {
    return {
      variables: {
        plugin: urlify("../../tinygo/plugin.ts"),
      },
      files: [
        ".vscode/extensions.json",
        ".vscode/settings.json",
        ".vscode/tasks.json",
        "apex.axdl",
      ],
      templates: {
        "tmpl": [
          "apex.yaml.tmpl",
          "go.mod.tmpl",
        ],
      },
    };
  },
};

export default template;
