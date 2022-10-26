import { constantCase } from "../src/utils/index.js";

describe("utils", () => {
  test("constantCase", () => {
    expect(constantCase("myId")).toEqual(`MY_ID`);
  });
});
