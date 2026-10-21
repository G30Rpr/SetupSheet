import { describe, expect, it } from "vitest";

import {
  EMPTY_TOTALS,
  mergeTotals,
  rigTypeSubScores,
  similarRigPredictability,
  splitBySimilarRig,
} from "@/lib/rating-splits";
import type { RatingSplit } from "@/lib/types";

const dd: RatingSplit = { rigProfile: "Direct Drive + Load Cell", paceSum: 12, paceN: 3, predSum: 11, predN: 3 };
const wheel: RatingSplit = { rigProfile: "Wheel + 3 Pedals", paceSum: 4, paceN: 1, predSum: 2, predN: 1 };
const unshared: RatingSplit = { rigProfile: null, paceSum: 5, paceN: 1, predSum: 4, predN: 1 };

describe("mergeTotals", () => {
  it("sums buckets and is empty for none", () => {
    expect(mergeTotals([dd, wheel])).toEqual({ paceSum: 16, paceN: 4, predSum: 13, predN: 4 });
    expect(mergeTotals([])).toEqual(EMPTY_TOTALS);
  });
});

describe("splitBySimilarRig", () => {
  it("puts the anchor rig's bucket on a similar rig and everything else in the rest", () => {
    const { similar, others } = splitBySimilarRig([dd, wheel, unshared], "Direct Drive + Load Cell");

    expect(similar).toEqual({ paceSum: 12, paceN: 3, predSum: 11, predN: 3 });
    // Unshared-rig ratings count as everyone else (P2: "Everyone else").
    expect(others).toEqual({ paceSum: 9, paceN: 2, predSum: 6, predN: 2 });
  });

  it("reads Unrated (empty totals) for a side with no ratings", () => {
    const { similar, others } = splitBySimilarRig([wheel], "Gamepad");

    expect(similar).toEqual(EMPTY_TOTALS);
    expect(others).toEqual({ paceSum: 4, paceN: 1, predSum: 2, predN: 1 });
  });

  it("falls back to everyone-else totals when there is no anchor", () => {
    const { similar, others } = splitBySimilarRig([dd, wheel], null);

    expect(similar).toEqual(EMPTY_TOTALS);
    expect(others.paceN).toBe(4);
  });
});

describe("rigTypeSubScores (2c)", () => {
  it("withholds each score until that rig type reaches 3 ratings on it", () => {
    const rows = rigTypeSubScores([
      { rigProfile: "Gamepad", paceSum: 13.5, paceN: 3, predSum: 4, predN: 1 },
    ]);
    expect(rows).toEqual([
      {
        rigProfile: "Gamepad",
        pace: 4.5,
        paceN: 3,
        predictability: null,
        predN: 1,
      },
    ]);
  });

  it("omits rig types below the floor on both scores, and unshared-rig buckets entirely", () => {
    const rows = rigTypeSubScores([
      { rigProfile: "Gamepad", paceSum: 8, paceN: 2, predSum: 8, predN: 2 },
      { rigProfile: null, paceSum: 20, paceN: 5, predSum: 20, predN: 5 },
    ]);
    expect(rows).toEqual([]);
  });

  it("orders by strongest evidence first, then name", () => {
    const rows = rigTypeSubScores([
      { rigProfile: "Wheel + 3 Pedals", paceSum: 12, paceN: 3, predSum: 12, predN: 3 },
      { rigProfile: "Gamepad", paceSum: 21, paceN: 5, predSum: 21, predN: 5 },
      { rigProfile: "Direct Drive + Load Cell", paceSum: 24, paceN: 4, predSum: 24, predN: 4 },
    ]);
    expect(rows.map((r) => r.rigProfile)).toEqual([
      "Gamepad",
      "Direct Drive + Load Cell",
      "Wheel + 3 Pedals",
    ]);
  });

  it("averages within the 0-5 score scale", () => {
    const rows = rigTypeSubScores([
      { rigProfile: "Gamepad", paceSum: 11.4, paceN: 3, predSum: 7.6, predN: 2 },
    ]);
    expect(rows[0].pace).toBeCloseTo(3.8, 5);
    expect(rows[0].predictability).toBeNull();
  });
});

describe("similarRigPredictability", () => {
  it("averages the rig's predictability and ignores other buckets", () => {
    expect(similarRigPredictability([dd, wheel], "Direct Drive + Load Cell")).toBeCloseTo(11 / 3);
    expect(similarRigPredictability([dd, wheel], "Gamepad")).toBeNull();
    expect(similarRigPredictability(undefined, "Gamepad")).toBeNull();
    expect(similarRigPredictability([dd], null)).toBeNull();
  });
});
