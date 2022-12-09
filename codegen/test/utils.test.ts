import { constantCase } from "../src/rust/utils/mod.ts";

describe("utils", () => {
  test("constantCase", () => {
    expect(constantCase("myId")).toEqual(`MY_ID`);
  });
});
