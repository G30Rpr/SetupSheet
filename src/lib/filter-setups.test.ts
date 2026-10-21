import { describe, expect, it } from "vitest";

import {
  ALL,
  filterAndSortSetups,
  getSearchSuggestions,
  setupMatchesRigAxes,
} from "@/lib/filter-setups";
import { makeSetup } from "@/lib/test-helpers/make-setup";

const noFilters = { search: "", game: ALL, car: ALL, track: ALL, condition: ALL, rig: ALL, tag: ALL };

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

  it("filters by tag deterministically (exact tag, not fuzzy search)", () => {
    const setups = [
      makeSetup({ id: "1", tags: ["Safe", "Race"] }),
      makeSetup({ id: "2", tags: ["Aggressive"] }),
      makeSetup({ id: "3", tags: [] }),
    ];
    expect(filterAndSortSetups(setups, { ...noFilters, tag: "Safe" }, "newest").map((s) => s.id)).toEqual(["1"]);
    expect(filterAndSortSetups(setups, { ...noFilters, tag: "Aggressive" }, "newest").map((s) => s.id)).toEqual(["2"]);
    expect(filterAndSortSetups(setups, { ...noFilters, tag: ALL }, "newest").map((s) => s.id)).toEqual(["1", "2", "3"]);
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

describe("filterAndSortSetups — bestMatch (default)", () => {
  it("ranks setups matching the preferred rig first", () => {
    const setups = [
      makeSetup({ id: "1", rigProfile: "Gamepad", ratingCount: 5, predictability: 4 }),
      makeSetup({ id: "2", rigProfile: "Direct Drive + Load Cell", ratingCount: 1, predictability: 5 }),
      makeSetup({ id: "3", rigProfile: "Gamepad", ratingCount: 2, predictability: 3 }),
    ];
    expect(
      filterAndSortSetups(setups, noFilters, "bestMatch", "Direct Drive + Load Cell").map((s) => s.id)
    ).toEqual(["2", "1", "3"]);
  });

  it("a single 5.0 never outranks a well-evidenced 3.8 (more ratings first)", () => {
    const setups = [
      makeSetup({ id: "lone", ratingCount: 1, pace: 5, predictability: 5 }),
      makeSetup({ id: "many", ratingCount: 20, pace: 3.8, predictability: 3.8 }),
    ];
    expect(filterAndSortSetups(setups, noFilters, "bestMatch").map((s) => s.id)).toEqual([
      "many",
      "lone",
    ]);
    // Same guarantee inside one rig class (both share the default fixture
    // rig, so the preferred rig matches them equally): evidence still wins.
    expect(
      filterAndSortSetups(setups, noFilters, "bestMatch", "Direct Drive + Load Cell").map((s) => s.id)
    ).toEqual(["many", "lone"]);
  });

  it("breaks evidence ties by Predictability", () => {
    const setups = [
      makeSetup({ id: "1", ratingCount: 4, predictability: 3.2 }),
      makeSetup({ id: "2", ratingCount: 4, predictability: 4.6 }),
    ];
    expect(filterAndSortSetups(setups, noFilters, "bestMatch").map((s) => s.id)).toEqual(["2", "1"]);
  });

  it("an explicit rig filter wins over the saved rig", () => {
    const setups = [
      makeSetup({ id: "1", rigProfile: "Gamepad", ratingCount: 5 }),
      makeSetup({ id: "2", rigProfile: "Wheel + 3 Pedals", ratingCount: 1 }),
    ];
    expect(
      filterAndSortSetups(setups, { ...noFilters, rig: "Wheel + 3 Pedals" }, "bestMatch", "Gamepad")
    ).toHaveLength(1);
  });

  it("ranks exact two-axis hardware matches ahead of the legacy category match", () => {
    // My rig: wheel + load cell. "exact" shares both axes but a different
    // legacy category; "category" shares the category but not the brake axis.
    const setups = [
      makeSetup({
        id: "exact",
        rigProfile: "Wheel + 3 Pedals",
        inputDevice: "wheel",
        brakeType: "load_cell",
        ratingCount: 1,
      }),
      makeSetup({
        id: "category",
        rigProfile: "Direct Drive + Load Cell",
        inputDevice: "direct_drive",
        brakeType: "load_cell",
        ratingCount: 20,
      }),
      makeSetup({
        id: "other",
        rigProfile: "Gamepad",
        inputDevice: "gamepad",
        brakeType: null,
        ratingCount: 30,
      }),
    ];
    expect(
      filterAndSortSetups(
        setups,
        noFilters,
        "bestMatch",
        "Direct Drive + Load Cell",
        {
          inputDevice: "wheel",
          brakeType: "load_cell",
        }
      ).map((s) => s.id)
    ).toEqual(["exact", "category", "other"]);
  });

  it("keeps the evidence guarantee inside one match tier", () => {
    const setups = [
      makeSetup({
        id: "lone",
        inputDevice: "wheel",
        brakeType: "standard",
        ratingCount: 1,
        pace: 5,
        predictability: 5,
      }),
      makeSetup({
        id: "many",
        inputDevice: "wheel",
        brakeType: "standard",
        ratingCount: 20,
        pace: 3.8,
        predictability: 3.8,
      }),
    ];
    expect(
      filterAndSortSetups(setups, noFilters, "bestMatch", null, {
        inputDevice: "wheel",
        brakeType: "standard",
      }).map((s) => s.id)
    ).toEqual(["many", "lone"]);
  });

  it("falls back to the legacy category when no axes preference is available", () => {
    const setups = [
      makeSetup({ id: "1", rigProfile: "Gamepad", inputDevice: "gamepad", ratingCount: 9 }),
      makeSetup({ id: "2", rigProfile: "Wheel + 3 Pedals", inputDevice: "wheel", brakeType: "standard", ratingCount: 1 }),
    ];
    expect(filterAndSortSetups(setups, noFilters, "bestMatch", "Wheel + 3 Pedals").map((s) => s.id)).toEqual([
      "2",
      "1",
    ]);
  });

  it("setupMatchesRigAxes matches only exact pairs", () => {
    const setup = makeSetup({ inputDevice: "wheel", brakeType: "handbrake" });
    expect(setupMatchesRigAxes(setup, { inputDevice: "wheel", brakeType: "handbrake" })).toBe(true);
    expect(setupMatchesRigAxes(setup, { inputDevice: "wheel", brakeType: "standard" })).toBe(false);
    expect(setupMatchesRigAxes(setup, null)).toBe(false);
  });
});

describe("getSearchSuggestions", () => {
  it("returns nothing for an empty or whitespace-only query", () => {
    const setups = [makeSetup({ id: "1", car: "BMW M4 GT3" })];
    expect(getSearchSuggestions(setups, "")).toEqual([]);
    expect(getSearchSuggestions(setups, "   ")).toEqual([]);
  });

  it("matches car, track, and game as substrings, case-insensitively", () => {
    const setups = [makeSetup({ id: "1", game: "Assetto Corsa Competizione", car: "BMW M4 GT3", track: "Spa-Francorchamps" })];
    expect(getSearchSuggestions(setups, "bmw")).toEqual(["BMW M4 GT3"]);
    expect(getSearchSuggestions(setups, "SPA")).toEqual(["Spa-Francorchamps"]);
    expect(getSearchSuggestions(setups, "competizione")).toEqual(["Assetto Corsa Competizione"]);
  });

  it("de-duplicates a name shared by multiple setups", () => {
    const setups = [
      makeSetup({ id: "1", car: "BMW M4 GT3", track: "Spa" }),
      makeSetup({ id: "2", car: "BMW M4 GT3", track: "Monza" }),
    ];
    expect(getSearchSuggestions(setups, "bmw")).toEqual(["BMW M4 GT3"]);
  });

  it("does not fuzzy-match a typo (unlike filterAndSortSetups' search)", () => {
    const setups = [makeSetup({ id: "1", car: "Porsche 911 GT3 R" })];
    expect(getSearchSuggestions(setups, "porshe")).toEqual([]);
  });

  it("caps results at the given limit", () => {
    const setups = Array.from({ length: 10 }, (_, i) => makeSetup({ id: String(i), car: `Car ${i}` }));
    expect(getSearchSuggestions(setups, "car", 3)).toHaveLength(3);
  });
});
