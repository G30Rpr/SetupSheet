import { describe, expect, it } from "vitest";

import { pickPendingPrompts, PROMPT_MIN_AGE_MS } from "@/lib/rating-prompts";

const NOW = Date.parse("2026-10-21T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const event = (
  setupId: string,
  createdAt: string,
  promptDismissedAt: string | null = null
) => ({ setupId, createdAt, promptDismissedAt });

describe("pickPendingPrompts (24h post-download prompt)", () => {
  it("prompts only about downloads at least 24h old", () => {
    const picked = pickPendingPrompts(
      [event("a", hoursAgo(25)), event("b", hoursAgo(23)), event("c", hoursAgo(1))],
      new Set(),
      new Set(),
      3,
      NOW
    );
    expect(picked.map((p) => p.setupId)).toEqual(["a"]);
  });

  it("excludes rated setups, dismissed prompts, and the viewer's own setups", () => {
    const picked = pickPendingPrompts(
      [
        event("rated", hoursAgo(30)),
        event("dismissed", hoursAgo(30)),
        event("dismissed", hoursAgo(40), hoursAgo(5)),
        event("own", hoursAgo(30)),
        event("pending", hoursAgo(30)),
      ],
      new Set(["rated"]),
      new Set(["own"]),
      3,
      NOW
    );
    expect(picked.map((p) => p.setupId)).toEqual(["pending"]);
  });

  it("prompts once per setup with the newest download time, newest first", () => {
    const picked = pickPendingPrompts(
      [
        event("older", hoursAgo(50)),
        event("newer", hoursAgo(40)),
        event("older", hoursAgo(60)),
      ],
      new Set(),
      new Set(),
      3,
      NOW
    );
    expect(picked).toEqual([
      { setupId: "newer", downloadedAt: hoursAgo(40) },
      { setupId: "older", downloadedAt: hoursAgo(50) },
    ]);
  });

  it("caps at the limit and never invents prompts for empty history", () => {
    const many = ["a", "b", "c", "d", "e"].map((id) => event(id, hoursAgo(30)));
    expect(pickPendingPrompts(many, new Set(), new Set(), 3, NOW)).toHaveLength(3);
    expect(pickPendingPrompts([], new Set(), new Set(), 3, NOW)).toEqual([]);
  });

  it("treats the age boundary honestly (24h minus a tick is too soon)", () => {
    const justUnder = new Date(NOW - PROMPT_MIN_AGE_MS + 60_000).toISOString();
    const atEdge = new Date(NOW - PROMPT_MIN_AGE_MS).toISOString();
    const picked = pickPendingPrompts(
      [event("soon", justUnder), event("ready", atEdge)],
      new Set(),
      new Set(),
      3,
      NOW
    );
    expect(picked.map((p) => p.setupId)).toEqual(["ready"]);
  });
});
