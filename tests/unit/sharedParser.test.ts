import { describe, expect, it } from "vitest";
import { getPath, numberOrZero, stringOrEmpty } from "../../src/sharedParser.js";

describe("getPath", () => {
  it("walks nested arrays", () => {
    expect(getPath([[1], [2, 3]], [1, 1])).toBe(3);
  });

  it("returns the root value for an empty path", () => {
    expect(getPath("root", [])).toBe("root");
  });

  it("returns undefined when an intermediate value is not an array", () => {
    expect(getPath([1], [0, 0])).toBeUndefined();
  });

  it("returns undefined when an index is missing", () => {
    expect(getPath([1], [5])).toBeUndefined();
  });

  it("returns undefined when the value is not an array", () => {
    expect(getPath(null, [0])).toBeUndefined();
  });
});

describe("stringOrEmpty", () => {
  it("returns the string unchanged", () => {
    expect(stringOrEmpty("hello")).toBe("hello");
  });

  it("returns an empty string for non-strings", () => {
    expect(stringOrEmpty(42)).toBe("");
    expect(stringOrEmpty(undefined)).toBe("");
  });
});

describe("numberOrZero", () => {
  it("returns the number unchanged", () => {
    expect(numberOrZero(42)).toBe(42);
  });

  it("returns zero for non-numbers", () => {
    expect(numberOrZero("42")).toBe(0);
    expect(numberOrZero(undefined)).toBe(0);
  });
});
