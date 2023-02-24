import { constantCase } from "../src/rust/utils/mod.ts";
import { assertEquals } from "./deps.ts";

Deno.test("constantCase", () => {
  assertEquals(constantCase("myId"), "MY_ID");
});
