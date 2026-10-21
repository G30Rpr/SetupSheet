import { describe, expect, it } from "vitest";

import { ENGINEER_SYMPTOMS } from "@/lib/engineer-types";
import {
  browseLinkForSymptom,
  ENGINEER_SETUP_MAP,
  mappingForSymptom,
  setupsForSymptom,
  WET_SETUP_MAPPING,
} from "@/lib/engineer-setup-map";
import { makeSetup } from "@/lib/test-helpers/make-setup";

describe("ENGINEER_SETUP_MAP (the editable table)", () => {
  it("covers every symptom with valid vocabularies", () => {
    for (const symptom of ENGINEER_SYMPTOMS) {
      const mapping = ENGINEER_SETUP_MAP[symptom.id];
      expect(mapping, symptom.id).toBeDefined();
      expect(mapping.rationale.length).toBeGreaterThan(10);
      for (const tag of mapping.tags) {
        expect(["Safe", "Beginner", "Quali", "Race", "Aggressive", "Wet Weather"]).toContain(tag);
      }
      expect(["safest", "fastest", "bestMatch"]).toContain(mapping.lead);
    }
  });
});

describe("setupsForSymptom", () => {
  const setups = [
    makeSetup({
      id: "safe-calm",
      tags: ["Safe"],
      condition: "Dry",
      lapTime: "2:20.000",
      ratingCount: 10,
      predictability: 4.5,
    }),
    makeSetup({
      id: "safe-faster",
      tags: ["Safe"],
      condition: "Dry",
      lapTime: "2:18.000",
      ratingCount: 10,
      predictability: 3.5,
    }),
    makeSetup({
      id: "quali-rocket",
      tags: ["Quali"],
      condition: "Dry",
      lapTime: "2:17.000",
      ratingCount: 2,
      predictability: 2.5,
    }),
    makeSetup({
      id: "wet-work",
      tags: ["Wet Weather", "Safe"],
      condition: "Wet",
      lapTime: "2:30.000",
      ratingCount: 4,
      predictability: 4.8,
    }),
    makeSetup({ id: "unrelated", tags: ["Race"], condition: "Dry", ratingCount: 50 }),
  ];

  it("surfaces tag-matched setups, most predictable first for stability symptoms", () => {
    // The wet-condition setup never appears in a dry diagnosis.
    const matches = setupsForSymptom(setups, "front-locking", false);
    expect(matches.map((s) => s.id)).toEqual(["safe-calm", "safe-faster"]);
  });

  it("leads fastest for the rotation symptom and only attack setups match", () => {
    const matches = setupsForSymptom(setups, "mid-corner-understeer", false);
    expect(matches.map((s) => s.id)).toEqual(["quali-rocket"]);
  });

  it("the wet overlay narrows to Wet Weather work, most predictable first", () => {
    const matches = setupsForSymptom(setups, "front-locking", true);
    expect(matches.map((s) => s.id)).toEqual(["wet-work"]);
  });

  it("tyre-pressure symptoms rank by evidence across all setups", () => {
    const matches = setupsForSymptom(setups, "hot-tyre-pressure-high", false, 2);
    expect(matches.map((s) => s.id)).toEqual(["unrelated", "safe-calm"]);
  });

  it("returns nothing honest when nothing matches -- never invents entries", () => {
    expect(setupsForSymptom([], "exit-oversteer", false)).toEqual([]);
  });
});

describe("browseLinkForSymptom", () => {
  it("points Browse at the mapping's tag and ordering", () => {
    expect(browseLinkForSymptom("front-locking", false)).toEqual({ tag: "Safe", sort: "safest" });
    expect(browseLinkForSymptom("mid-corner-understeer", false)).toEqual({
      tag: "Quali",
      sort: "fastest",
    });
    expect(browseLinkForSymptom("front-locking", true)).toEqual({
      tag: "Wet Weather",
      sort: "safest",
    });
  });

  it("has no link when the mapping has no representative tag", () => {
    expect(browseLinkForSymptom("hot-tyre-pressure-low", false)).toBeNull();
    expect(mappingForSymptom("hot-tyre-pressure-low", false)).toBe(
      ENGINEER_SETUP_MAP["hot-tyre-pressure-low"]
    );
    expect(mappingForSymptom("front-locking", true)).toBe(WET_SETUP_MAPPING);
  });
});
