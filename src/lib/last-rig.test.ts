// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { LAST_RIG_KEY, readLastRig, writeLastRig } from "@/lib/last-rig";

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
