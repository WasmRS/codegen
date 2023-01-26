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
    name: "@iota/rust",
    description: "Iota Rust module project",
    variables: [],
  },

  async process(_vars): Promise<FSStructure> {
    return {
      variables: {
        plugin: urlify("../../rust/plugin.ts"),
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
          "Cargo.toml.tmpl",
        ],
      },
    };
  },
};

export default template;
