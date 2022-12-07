import { constantCase } from "../src/rust/utils/index.js";

describe("utils", () => {
  test("constantCase", () => {
    expect(constantCase("myId")).toEqual(`MY_ID`);
  });
});
