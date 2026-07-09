import { describe, expect, it } from "vitest";

import { getCarsForGame, getTracksForGame } from "@/lib/data";
import { makeSetup } from "@/lib/test-helpers/make-setup";

describe("getCarsForGame", () => {
  it("returns unique, sorted car names across all games with no filter", () => {
    const setups = [
      makeSetup({ game: "iRacing", car: "Porsche 911 GT3 Cup" }),
      makeSetup({ game: "F1 25", car: "Ferrari" }),
      makeSetup({ game: "iRacing", car: "Porsche 911 GT3 Cup" }),
    ];
    expect(getCarsForGame(setups)).toEqual(["Ferrari", "Porsche 911 GT3 Cup"]);
  });

  it("filters to a single game when provided", () => {
    const setups = [
      makeSetup({ game: "iRacing", car: "Porsche 911 GT3 Cup" }),
      makeSetup({ game: "F1 25", car: "Ferrari" }),
    ];
    expect(getCarsForGame(setups, "F1 25")).toEqual(["Ferrari"]);
  });

  it("returns an empty array for empty input", () => {
    expect(getCarsForGame([])).toEqual([]);
  });
});

describe("getTracksForGame", () => {
  it("dedupes the same track across multiple setups", () => {
    const setups = [
      makeSetup({ game: "iRacing", track: "Spa" }),
      makeSetup({ game: "iRacing", track: "Spa" }),
      makeSetup({ game: "iRacing", track: "Monza" }),
    ];
    expect(getTracksForGame(setups)).toEqual(["Monza", "Spa"]);
  });

  it("filters to a single game when provided", () => {
    const setups = [
      makeSetup({ game: "iRacing", track: "Spa" }),
      makeSetup({ game: "F1 25", track: "Monza" }),
    ];
    expect(getTracksForGame(setups, "iRacing")).toEqual(["Spa"]);
  });
});
