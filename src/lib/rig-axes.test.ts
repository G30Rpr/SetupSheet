import { describe, expect, it } from "vitest";

import {
  axesFromRigProfile,
  axesMatch,
  isRigBrakeType,
  isRigInputDevice,
  parseRigAxes,
} from "@/lib/rig-axes";

describe("axesFromRigProfile", () => {
  it("maps each legacy category to the approved axes (0039 rig_axes_for parity)", () => {
    expect(axesFromRigProfile("Gamepad")).toEqual({ inputDevice: "gamepad", brakeType: null });
    expect(axesFromRigProfile("Wheel + 3 Pedals")).toEqual({
      inputDevice: "wheel",
      brakeType: "standard",
    });
    expect(axesFromRigProfile("Wheel + Handbrake")).toEqual({
      inputDevice: "wheel",
      brakeType: "handbrake",
    });
    expect(axesFromRigProfile("Direct Drive + Load Cell")).toEqual({
      inputDevice: "direct_drive",
      brakeType: "load_cell",
    });
  });

  it("is injective: no two categories share an axes pair", () => {
    const pairs = (
      ["Gamepad", "Wheel + 3 Pedals", "Wheel + Handbrake", "Direct Drive + Load Cell"] as const
    ).map((rig) => JSON.stringify(axesFromRigProfile(rig)));
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

describe("axesMatch", () => {
  it("matches only exact axis pairs", () => {
    const wheelStandard = { inputDevice: "wheel", brakeType: "standard" } as const;
    expect(axesMatch(wheelStandard, { inputDevice: "wheel", brakeType: "standard" })).toBe(true);
    expect(axesMatch(wheelStandard, { inputDevice: "wheel", brakeType: "handbrake" })).toBe(false);
    expect(axesMatch(wheelStandard, { inputDevice: "direct_drive", brakeType: "standard" })).toBe(
      false
    );
  });

  it("matches gamepads only with null brake axes", () => {
    const gamepad = { inputDevice: "gamepad", brakeType: null } as const;
    expect(axesMatch(gamepad, { inputDevice: "gamepad", brakeType: null })).toBe(true);
    expect(axesMatch(gamepad, { inputDevice: "gamepad", brakeType: "standard" })).toBe(false);
  });

  it("never matches when either side lacks an input device", () => {
    expect(axesMatch(null, { inputDevice: "wheel", brakeType: "standard" })).toBe(false);
    expect(axesMatch({ inputDevice: null, brakeType: null }, { inputDevice: "gamepad", brakeType: null })).toBe(false);
    expect(axesMatch(undefined, undefined)).toBe(false);
  });
});

describe("parseRigAxes", () => {
  it("accepts known vocabularies and nulls unknown brake values", () => {
    expect(parseRigAxes({ inputDevice: "wheel", brakeType: "load_cell" })).toEqual({
      inputDevice: "wheel",
      brakeType: "load_cell",
    });
    expect(parseRigAxes({ inputDevice: "gamepad", brakeType: "spaces" })).toEqual({
      inputDevice: "gamepad",
      brakeType: null,
    });
    expect(parseRigAxes({ inputDevice: "wheel" })).toEqual({
      inputDevice: "wheel",
      brakeType: null,
    });
  });

  it("rejects junk instead of guessing", () => {
    expect(parseRigAxes(null)).toBeNull();
    expect(parseRigAxes("wheel")).toBeNull();
    expect(parseRigAxes({ inputDevice: "yoke", brakeType: "standard" })).toBeNull();
    expect(parseRigAxes({ brakeType: "standard" })).toBeNull();
  });
});

describe("vocabulary guards", () => {
  it("accepts only the 0039/0040 vocabularies", () => {
    expect(isRigInputDevice("gamepad")).toBe(true);
    expect(isRigInputDevice("Gamepad")).toBe(false);
    expect(isRigInputDevice("wheel")).toBe(true);
    expect(isRigInputDevice("direct_drive")).toBe(true);
    expect(isRigBrakeType("standard")).toBe(true);
    expect(isRigBrakeType("load_cell")).toBe(true);
    expect(isRigBrakeType("handbrake")).toBe(true);
    expect(isRigBrakeType(null)).toBe(false);
    expect(isRigBrakeType("hydraulic")).toBe(false);
  });
});
