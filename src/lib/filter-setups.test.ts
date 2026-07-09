import { describe, expect, it } from "vitest";

import { ALL, filterAndSortSetups } from "@/lib/filter-setups";
import { makeSetup } from "@/lib/test-helpers/make-setup";

const noFilters = { search: "", game: ALL, car: ALL, track: ALL, condition: ALL, rig: ALL };

describe("filterAndSortSetups — facet filters", () => {
  it("filters by game/car/track/condition/rig", () => {
    const setups = [
      makeSetup({ id: "1", game: "iRacing", car: "A", track: "X", condition: "Dry", rigProfile: "Gamepad" }),
      makeSetup({ id: "2", game: "F1 25", car: "B", track: "Y", condition: "Wet", rigProfile: "Wheel + 3 Pedals" }),
    ];

    expect(filterAndSortSetups(setups, { ...noFilters, game: "iRacing" }, "newest").map((s) => s.id)).toEqual(["1"]);
    expect(filterAndSortSetups(setups, { ...noFilters, car: "B" }, "newest").map((s) => s.id)).toEqual(["2"]);
    expect(filterAndSortSetups(setups, { ...noFilters, track: "X" }, "newest").map((s) => s.id)).toEqual(["1"]);
    expect(filterAndSortSetups(setups, { ...noFilters, condition: "Wet" }, "newest").map((s) => s.id)).toEqual(["2"]);
    expect(filterAndSortSetups(setups, { ...noFilters, rig: "Gamepad" }, "newest").map((s) => s.id)).toEqual(["1"]);
  });

  it("returns everything when all filters are ALL and search is empty", () => {
    const setups = [makeSetup({ id: "1" }), makeSetup({ id: "2" })];
    expect(filterAndSortSetups(setups, noFilters, "newest")).toHaveLength(2);
  });
});

describe("filterAndSortSetups — text search", () => {
  it("matches a single exact substring, same as the old behavior", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R" }), makeSetup({ id: "2", car: "BMW M4 GT3" })];
    const result = filterAndSortSetups(setups, { ...noFilters, search: "porsche" }, "newest");
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it("matches multi-word queries regardless of token order (AND semantics)", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R", track: "Spa-Francorchamps" })];
    const orderMatching = filterAndSortSetups(setups, { ...noFilters, search: "spa porsche" }, "newest");
    expect(orderMatching.map((s) => s.id)).toEqual(["1"]);
  });

  it("requires every token to match (AND, not OR)", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R", track: "Spa-Francorchamps" })];
    const result = filterAndSortSetups(setups, { ...noFilters, search: "porsche monza" }, "newest");
    expect(result).toHaveLength(0);
  });

  it("tolerates a single-character typo per token", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R" })];
    const result = filterAndSortSetups(setups, { ...noFilters, search: "porshe" }, "newest");
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it("does not match a token that's 2+ edits away from every haystack word", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R" })];
    const result = filterAndSortSetups(setups, { ...noFilters, search: "poorshch" }, "newest");
    expect(result).toHaveLength(0);
  });

  it("searches across game, car, track, author, description, and tags", () => {
    const setups = [
      makeSetup({ id: "1", author: "speedy_racer" }),
      makeSetup({ id: "2", description: "great for wet weather" }),
      makeSetup({ id: "3", tags: ["Aggressive"] }),
    ];
    expect(filterAndSortSetups(setups, { ...noFilters, search: "speedy_racer" }, "newest").map((s) => s.id)).toEqual(["1"]);
    expect(filterAndSortSetups(setups, { ...noFilters, search: "weather" }, "newest").map((s) => s.id)).toEqual(["2"]);
    expect(filterAndSortSetups(setups, { ...noFilters, search: "aggressive" }, "newest").map((s) => s.id)).toEqual(["3"]);
  });
});

describe("filterAndSortSetups — sorting", () => {
  it("sorts by trending (upvotes desc)", () => {
    const setups = [makeSetup({ id: "1", upvotes: 5 }), makeSetup({ id: "2", upvotes: 20 })];
    expect(filterAndSortSetups(setups, noFilters, "trending").map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("sorts by mostDownloaded (downloads desc)", () => {
    const setups = [makeSetup({ id: "1", downloads: 1 }), makeSetup({ id: "2", downloads: 99 })];
    expect(filterAndSortSetups(setups, noFilters, "mostDownloaded").map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("sorts by safest (predictability desc)", () => {
    const setups = [makeSetup({ id: "1", predictability: 2 }), makeSetup({ id: "2", predictability: 4.5 })];
    expect(filterAndSortSetups(setups, noFilters, "safest").map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("sorts by fastest (lap time ascending), unparseable times sort last", () => {
    const setups = [
      makeSetup({ id: "1", lapTime: "2:20.000" }),
      makeSetup({ id: "2", lapTime: "2:19.500" }),
      makeSetup({ id: "3", lapTime: "" }),
    ];
    expect(filterAndSortSetups(setups, noFilters, "fastest").map((s) => s.id)).toEqual(["2", "1", "3"]);
  });

  it("leaves order untouched for 'newest' (caller is expected to have already sorted by date)", () => {
    const setups = [makeSetup({ id: "1" }), makeSetup({ id: "2" }), makeSetup({ id: "3" })];
    expect(filterAndSortSetups(setups, noFilters, "newest").map((s) => s.id)).toEqual(["1", "2", "3"]);
  });
});
