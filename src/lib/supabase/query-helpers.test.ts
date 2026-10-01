import { describe, expect, it, vi } from "vitest";

import {
  unwrapCachedCount,
  unwrapCachedList,
  unwrapCachedSingle,
  unwrapCount,
  unwrapList,
  unwrapSingle,
} from "@/lib/supabase/query-helpers";

describe("Supabase query result helpers", () => {
  it("keeps ordinary read fallbacks for non-cached queries", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(unwrapList({ data: null, error: new Error("offline") }, "list failed")).toEqual([]);
    expect(unwrapCount({ count: null, error: new Error("offline") }, "count failed")).toBe(0);
    expect(unwrapSingle({ data: null, error: new Error("offline") }, "single failed")).toBeNull();
    log.mockRestore();
  });

  it("throws on cached query errors so an outage cannot be cached as empty data", () => {
    const error = { code: "PGRST000", message: "database unavailable" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => unwrapCachedList({ data: null, error }, "cached list failed")).toThrow(
      "Cached database read failed"
    );
    expect(() => unwrapCachedCount({ count: null, error }, "cached count failed")).toThrow(
      "Cached database read failed"
    );
    expect(() => unwrapCachedSingle({ data: null, error }, "cached row failed")).toThrow(
      "Cached database read failed"
    );
    expect(log).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });

  it("preserves legitimate empty cached results", () => {
    expect(unwrapCachedList({ data: [], error: null }, "list failed")).toEqual([]);
    expect(unwrapCachedCount({ count: 0, error: null }, "count failed")).toBe(0);
    expect(unwrapCachedSingle({ data: null, error: null }, "single failed")).toBeNull();
  });
});
