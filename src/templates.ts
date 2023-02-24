import { Template } from "https://deno.land/x/apex_cli@v0.0.18/src/config.ts";

const template: Template = {
  info: {
    name: "@iota",
    description: "Iota module project templates",
  },

  templates: [
    "templates/rust/template.ts",
    "templates/tinygo/template.ts",
  ],
};

export default template;
