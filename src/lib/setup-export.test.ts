import { describe, expect, it } from "vitest";

import { buildSetupExportFilename, buildSetupExportText } from "@/lib/setup-export";
import { makeSetup } from "@/lib/test-helpers/make-setup";

describe("buildSetupExportText", () => {
  it("includes the lap time line when present", () => {
    const text = buildSetupExportText(makeSetup({ lapTime: "2:19.104" }));
    expect(text).toContain("Lap time: 2:19.104");
  });

  it("omits the lap time line when blank", () => {
    const text = buildSetupExportText(makeSetup({ lapTime: "" }));
    expect(text).not.toContain("Lap time:");
  });

  it("only emits a group section for fields with a truthy value", () => {
    const text = buildSetupExportText(
      makeSetup({
        game: "iRacing",
        setupValues: { lfTirePressure: "23.5 psi" },
      })
    );
    expect(text).toContain("Tires & Alignment");
    expect(text).toContain("Left front tire pressure: 23.5 psi");
    expect(text).not.toContain("Suspension");
  });

  it("emits no group sections when setupValues is empty", () => {
    const text = buildSetupExportText(makeSetup({ game: "iRacing", setupValues: {} }));
    expect(text).not.toContain("Tires & Alignment");
  });

  it("emits no group sections when setupValues is absent", () => {
    const text = buildSetupExportText(makeSetup({ game: "iRacing", setupValues: undefined }));
    expect(text).not.toContain("Tires & Alignment");
  });

  it("includes the description block only when non-empty", () => {
    const withDescription = buildSetupExportText(makeSetup({ description: "Great for quali" }));
    expect(withDescription).toContain("Description:");
    expect(withDescription).toContain("Great for quali");

    const withoutDescription = buildSetupExportText(makeSetup({ description: "" }));
    expect(withoutDescription).not.toContain("Description:");
  });

  it("always ends with the SetupSheet attribution line", () => {
    const text = buildSetupExportText(makeSetup());
    expect(text.trim().endsWith("Downloaded from SetupSheet")).toBe(true);
  });
});

describe("buildSetupExportFilename", () => {
  it("sanitizes disallowed characters to underscores and collapses runs", () => {
    const filename = buildSetupExportFilename(
      makeSetup({ car: "BMW M4 GT3 (2021)", track: "Spa-Francorchamps" })
    );
    expect(filename).toBe("BMW_M4_GT3_2021_-Spa-Francorchamps-setup.txt");
  });

  it("always ends in .txt", () => {
    const filename = buildSetupExportFilename(makeSetup());
    expect(filename.endsWith(".txt")).toBe(true);
  });
});
