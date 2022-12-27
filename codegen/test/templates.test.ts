import { parseTemplateExpression } from "../src/rust/templates.ts";
import { assertEquals } from "./deps.ts";

Deno.test("template expressions", () => {
  const replaced = parseTemplateExpression("${new_id}", {
    new_id: "myNewId",
  });
  assertEquals(replaced, "myNewId");
});
