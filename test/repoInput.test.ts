import { describe, expect, test } from "bun:test";
import { normalizeRepoIdentifier, parseRepoInput } from "../src/utils/repoInput";

describe("repo input parser", () => {
  test("normalizes github url", () => {
    expect(normalizeRepoIdentifier("https://github.com/foo/bar")).toBe("foo/bar");
  });

  test("parses mixed separators and de-duplicates", () => {
    expect(parseRepoInput("foo/bar, baz/qux foo/bar")).toEqual(["foo/bar", "baz/qux"]);
  });

  test("throws on invalid token", () => {
    expect(() => parseRepoInput("foo")).toThrow("invalid repository identifier");
  });
});
