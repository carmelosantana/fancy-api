import { expect, test } from "vitest";
import { version } from "./index";

test("has version", () => {
  expect(version).toBe("0.1.0");
});
