// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  LAST_RIG_AXES_KEY,
  LAST_RIG_KEY,
  readLastRig,
  readLastRigAxes,
  readMyRigAxes,
  writeLastRig,
  writeLastRigAxes,
} from "@/lib/last-rig";

afterEach(() => {
  window.localStorage.clear();
});

describe("last-rig persistence", () => {
  it("remembers and restores a valid rig", () => {
    writeLastRig("Gamepad");
    expect(window.localStorage.getItem(LAST_RIG_KEY)).toBe("Gamepad");
    expect(readLastRig()).toBe("Gamepad");
  });

  it("forgets the rig when cleared", () => {
    writeLastRig("Direct Drive + Load Cell");
    writeLastRig(null);
    expect(window.localStorage.getItem(LAST_RIG_KEY)).toBeNull();
    expect(readLastRig()).toBeNull();
  });

  it("ignores values that are not one of the four rig profiles", () => {
    window.localStorage.setItem(LAST_RIG_KEY, "Direct Drive + Handbrake");
    expect(readLastRig()).toBeNull();
  });

  it("returns null when nothing is saved", () => {
    expect(readLastRig()).toBeNull();
  });
});

describe("last-rig axes persistence (0039/0040)", () => {
  it("remembers and restores a valid axes pair", () => {
    writeLastRigAxes({ inputDevice: "wheel", brakeType: "load_cell" });
    expect(JSON.parse(window.localStorage.getItem(LAST_RIG_AXES_KEY) ?? "null")).toEqual({
      inputDevice: "wheel",
      brakeType: "load_cell",
    });
    expect(readLastRigAxes()).toEqual({ inputDevice: "wheel", brakeType: "load_cell" });
  });

  it("forgets the axes when cleared", () => {
    writeLastRigAxes({ inputDevice: "gamepad", brakeType: null });
    writeLastRigAxes(null);
    expect(window.localStorage.getItem(LAST_RIG_AXES_KEY)).toBeNull();
    expect(readLastRigAxes()).toBeNull();
  });

  it("discards unknown vocabulary instead of guessing", () => {
    window.localStorage.setItem(
      LAST_RIG_AXES_KEY,
      JSON.stringify({ inputDevice: "yoke", brakeType: "standard" })
    );
    expect(readLastRigAxes()).toBeNull();
    window.localStorage.setItem(LAST_RIG_AXES_KEY, "not json");
    expect(readLastRigAxes()).toBeNull();
  });

  it("readMyRigAxes prefers explicit axes, then derives from the legacy category", () => {
    // Legacy category only -> derived axes (rig_axes_for parity).
    writeLastRig("Wheel + Handbrake");
    expect(readMyRigAxes()).toEqual({ inputDevice: "wheel", brakeType: "handbrake" });

    // Explicit axes win.
    writeLastRigAxes({ inputDevice: "gamepad", brakeType: null });
    expect(readMyRigAxes()).toEqual({ inputDevice: "gamepad", brakeType: null });
  });
});
