import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

type BracesApi = {
  (input: string, options?: Record<string, unknown>): string[];
  parse(input: string, options?: Record<string, unknown>): unknown;
  compile(input: string, options?: Record<string, unknown>): string[];
  expand(input: string, options?: Record<string, unknown>): string[];
};

const loadCommonJs = createRequire(import.meta.url);
const braces = loadCommonJs("braces") as BracesApi;
const MAX_NESTING_DEPTH = 512;

const nested = (open: string, close: string, depth: number) =>
  `${open.repeat(depth)}x${close.repeat(depth)}`;

describe("braces recursion depth guard", () => {
  it("preserves ordinary brace expansion", () => {
    expect(braces("{a,{b,c}}", { expand: true })).toEqual(["a", "b", "c"]);
  });

  it("accepts the configured boundary and rejects deeper brace patterns", () => {
    expect(braces.parse(nested("{", "}", MAX_NESTING_DEPTH))).toBeDefined();

    const overLimit = nested("{", "}", MAX_NESTING_DEPTH + 1);
    for (const parse of [braces.parse, braces.compile, braces.expand, braces]) {
      expect(() => parse(overLimit)).toThrow(/maximum \(512\)/);
    }
  });

  it("also bounds nested parenthesis AST traversal", () => {
    const overLimit = nested("(", ")", MAX_NESTING_DEPTH + 1);
    expect(() => braces.compile(overLimit)).toThrow(/maximum \(512\)/);
  });
});
