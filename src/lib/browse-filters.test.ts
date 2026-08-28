import { describe, expect, it } from "vitest";

import {
  ALL_BROWSE_FILTER,
  buildBrowseSearchExpression,
  normalizeBrowseFilters,
} from "@/lib/browse-filters";

describe("browse filter normalization", () => {
  it("accepts the supported filter values", () => {
    expect(
      normalizeBrowseFilters({
        search: "spa porsche",
        game: "iRacing",
        car: ALL_BROWSE_FILTER,
        track: "Spa",
        condition: "Dry",
        rig: ALL_BROWSE_FILTER,
      })
    ).toEqual({
      search: "spa porsche",
      game: "iRacing",
      car: ALL_BROWSE_FILTER,
      track: "Spa",
      condition: "Dry",
      rig: ALL_BROWSE_FILTER,
    });
  });

  it("rejects malformed or oversized filter payloads", () => {
    expect(normalizeBrowseFilters(null)).toBeNull();
    expect(
      normalizeBrowseFilters({
        search: "x".repeat(81),
        game: ALL_BROWSE_FILTER,
        car: ALL_BROWSE_FILTER,
        track: ALL_BROWSE_FILTER,
        condition: ALL_BROWSE_FILTER,
        rig: ALL_BROWSE_FILTER,
      })
    ).toBeNull();
    expect(
      normalizeBrowseFilters({
        search: "",
        game: "Unknown game",
        car: ALL_BROWSE_FILTER,
        track: ALL_BROWSE_FILTER,
        condition: ALL_BROWSE_FILTER,
        rig: ALL_BROWSE_FILTER,
      })
    ).toBeNull();
  });

  it("removes PostgREST operators from the server search expression", () => {
    const expression = buildBrowseSearchExpression("spa, *");
    expect(expression).toBe(
      "game.ilike.*spa*,car.ilike.*spa*,track.ilike.*spa*,description.ilike.*spa*,author_username.ilike.*spa*,tags.cs.{spa}"
    );
  });
});
