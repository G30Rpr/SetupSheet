import { describe, expect, it } from "vitest";

import {
  buildAccSetupJson,
  buildSetupExportFilename,
  buildSetupExportText,
  buildSetupIni,
  getAvailableExportFormats,
} from "@/lib/setup-export";
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
        setupValues: { frontTirePressure: "23.5 psi" },
      })
    );
    expect(text).toContain("Tires & Chassis");
    expect(text).toContain("Front tire pressure: 23.5 psi");
    expect(text).not.toContain("Suspension");
  });

  it("emits no group sections when setupValues is empty", () => {
    const text = buildSetupExportText(makeSetup({ game: "iRacing", setupValues: {} }));
    expect(text).not.toContain("Tires & Chassis");
  });

  it("emits no group sections when setupValues is absent", () => {
    const text = buildSetupExportText(makeSetup({ game: "iRacing", setupValues: undefined }));
    expect(text).not.toContain("Tires & Chassis");
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

describe("buildAccSetupJson", () => {
  it("converts ACC setup values into valid JSON with basicSetup and advancedSetup", () => {
    const setup = makeSetup({
      game: "Assetto Corsa Competizione",
      car: "Porsche 992 GT3 R 2023",
      setupValues: {
        frontLeftCamber: "-3.20°",
        tractionControl: "4",
        abs: "2",
        fuel: "30 L",
      },
    });

    const jsonStr = buildAccSetupJson(setup);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.carName).toBe("porsche_992_gt3_r");
    expect(parsed.basicSetup.alignment.staticCamber[0]).toBe(-3.2);
    expect(parsed.basicSetup.electronics.tC1).toBe(4);
    expect(parsed.basicSetup.electronics.abs).toBe(2);
    expect(parsed.basicSetup.strategy.fuel).toBe(30);
  });
});

describe("buildSetupIni", () => {
  it("generates INI headers and sections", () => {
    const setup = makeSetup({
      game: "Assetto Corsa",
      car: "Ferrari 488 GT3",
      track: "Monza",
      setupValues: {
        frontCamber: "-3.0",
      },
    });

    const iniText = buildSetupIni(setup);
    expect(iniText).toContain("[HEADER]");
    expect(iniText).toContain("CAR=Ferrari 488 GT3");
    expect(iniText).toContain("TRACK=Monza");
  });
});

describe("getAvailableExportFormats", () => {
  it("returns ACC json option for ACC games", () => {
    const accSetup = makeSetup({ game: "Assetto Corsa Competizione" });
    const formats = getAvailableExportFormats(accSetup);
    expect(formats.some((f) => f.id === "acc-json")).toBe(true);
  });

  it("returns INI option for Assetto Corsa", () => {
    const acSetup = makeSetup({ game: "Assetto Corsa" });
    const formats = getAvailableExportFormats(acSetup);
    expect(formats.some((f) => f.id === "ini")).toBe(true);
  });
});

describe("buildSetupExportFilename", () => {
  it("sanitizes disallowed characters to underscores and collapses runs", () => {
    const filename = buildSetupExportFilename(
      makeSetup({ car: "BMW M4 GT3 (2021)", track: "Spa-Francorchamps" })
    );
    expect(filename).toBe("BMW_M4_GT3_2021_-Spa-Francorchamps-setup.txt");
  });

  it("custom extension parameter is applied", () => {
    const filename = buildSetupExportFilename(makeSetup(), ".json");
    expect(filename.endsWith(".json")).toBe(true);
  });
});
