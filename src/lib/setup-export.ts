import { ACC_CAR_NAME_MAP } from "@/lib/acc-setup-parser";
import { setupSchemas } from "@/lib/setup-schemas";
import type { Setup } from "@/lib/types";

function parseDegrees(val?: string): number {
  if (!val) return -3.0;
  const num = parseFloat(val.replace("°", "").trim());
  return isNaN(num) ? -3.0 : num;
}

function parseNum(val?: string, defaultVal = 0): number {
  if (!val) return defaultVal;
  const num = parseFloat(val.replace(/[^\d.-]/g, ""));
  return isNaN(num) ? defaultVal : num;
}

/**
 * Converts a setup's tuning values into a valid Assetto Corsa Competizione
 * .json setup file structure, suitable for importing directly into ACC's
 * Document/Assetto Corsa Competizione/Setups folder.
 */
export function buildAccSetupJson(setup: Setup): string {
  const v = setup.setupValues ?? {};

  let carName = "porsche_992_gt3_r";
  for (const [key, name] of Object.entries(ACC_CAR_NAME_MAP)) {
    if (name.toLowerCase() === setup.car.toLowerCase()) {
      carName = key;
      break;
    }
  }

  const flCamber = parseDegrees(v.frontLeftCamber);
  const frCamber = parseDegrees(v.frontRightCamber);
  const rlCamber = parseDegrees(v.rearLeftCamber);
  const rrCamber = parseDegrees(v.rearRightCamber);

  const accObj = {
    carName,
    basicSetup: {
      alignment: {
        steerRatio: parseNum(v.steerRatio, 14),
        camber: [0, 0, 0, 0],
        staticCamber: [flCamber, frCamber, rlCamber, rrCamber],
        toe: [0, 0, 0, 0],
        toeOutLinear: [0, 0, 0, 0],
        casterLF: parseNum(v.caster, 0),
        casterRF: parseNum(v.caster, 0),
      },
      electronics: {
        tC1: parseNum(v.tractionControl, 3),
        tC2: parseNum(v.tractionControl2, 3),
        abs: parseNum(v.abs, 3),
        eCUMap: parseNum(v.engineMap, 1),
      },
      strategy: {
        fuel: parseNum(v.fuel, 25),
        tyreSet: Math.max(0, parseNum(v.tyreSet, 1) - 1),
        frontBrakePadCompound: Math.max(0, parseNum(v.frontBrakePadSet, 1) - 1),
        rearBrakePadCompound: Math.max(0, parseNum(v.rearBrakePadSet, 1) - 1),
      },
      tyres: {
        tyreCompound: v.tyreCompound === "Wet" ? 1 : 0,
      },
    },
    advancedSetup: {
      mechanicalBalance: {
        aRBFront: parseNum(v.frontArb, 3),
        aRBRear: parseNum(v.rearArb, 3),
        brakeTorque: 100,
        brakeBias: parseNum(v.brakeBias, 56),
      },
      dampers: {
        bumpSlow: [
          parseNum(v.frontLeftSlowBump, 5),
          parseNum(v.frontRightSlowBump, 5),
          parseNum(v.rearLeftSlowBump, 5),
          parseNum(v.rearRightSlowBump, 5),
        ],
        bumpFast: [
          parseNum(v.frontLeftFastBump, 5),
          parseNum(v.frontRightFastBump, 5),
          parseNum(v.rearLeftFastBump, 5),
          parseNum(v.rearRightFastBump, 5),
        ],
        reboundSlow: [
          parseNum(v.frontLeftSlowRebound, 8),
          parseNum(v.frontRightSlowRebound, 8),
          parseNum(v.rearLeftSlowRebound, 8),
          parseNum(v.rearRightSlowRebound, 8),
        ],
        reboundFast: [
          parseNum(v.frontLeftFastRebound, 8),
          parseNum(v.frontRightFastRebound, 8),
          parseNum(v.rearLeftFastRebound, 8),
          parseNum(v.rearRightFastRebound, 8),
        ],
      },
      aeroBalance: {
        rearWing: parseNum(v.rearWing, 5),
        splitter: parseNum(v.frontDiffuser, 3),
        brakeDuct: [parseNum(v.frontBrakeDuct, 3), parseNum(v.rearBrakeDuct, 3)],
      },
    },
  };

  return JSON.stringify(accObj, null, 2);
}

/**
 * Converts a setup's tuning values into a standard .ini setup file, suitable
 * for Assetto Corsa and other sims supporting INI config imports.
 */
export function buildSetupIni(setup: Setup): string {
  const lines: string[] = [
    `; SetupSheet Generated Setup File`,
    `; Car: ${setup.car}`,
    `; Track: ${setup.track}`,
    `; Game: ${setup.game}`,
    ``,
    `[HEADER]`,
    `CAR=${setup.car}`,
    `TRACK=${setup.track}`,
    `CONDITION=${setup.condition}`,
    `RIG=${setup.rigProfile}`,
    ``,
  ];

  const v = setup.setupValues;
  if (v) {
    for (const group of setupSchemas[setup.game] ?? []) {
      const rows = group.fields.filter((f) => v[f.key]);
      if (rows.length === 0) continue;
      lines.push(`[${group.title.toUpperCase().replace(/\s+/g, "_")}]`);
      for (const field of rows) {
        lines.push(`${field.key.toUpperCase()}=${v[field.key]}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Formats a manually-entered setup's values into a plain-text export, for
 * setups that don't have an uploaded file to download directly.
 */
export function buildSetupExportText(setup: Setup): string {
  const lines: string[] = [
    `${setup.car} — ${setup.track}`,
    `Game: ${setup.game}`,
    `Condition: ${setup.condition}`,
  ];

  if (setup.lapTime) lines.push(`Lap time: ${setup.lapTime}`);
  lines.push(`Rig: ${setup.rigProfile}`, "");

  const v = setup.setupValues;
  if (v) {
    for (const group of setupSchemas[setup.game] ?? []) {
      const rows = group.fields.filter((field) => v[field.key]);
      if (rows.length === 0) continue;
      lines.push(group.title);
      for (const field of rows) {
        lines.push(`  ${field.label}: ${v[field.key]}`);
      }
      lines.push("");
    }
  }

  if (setup.description) {
    lines.push("Description:", setup.description, "");
  }

  lines.push("Downloaded from SetupSheet");

  return lines.join("\n");
}

export interface ExportFormatOption {
  id: "acc-json" | "ini" | "txt";
  label: string;
  ext: string;
  mime: string;
  generate: (setup: Setup) => string;
}

export function getAvailableExportFormats(setup: Setup): ExportFormatOption[] {
  const options: ExportFormatOption[] = [];

  if (setup.game === "Assetto Corsa Competizione") {
    options.push({
      id: "acc-json",
      label: "Download ACC Game File (.json)",
      ext: ".json",
      mime: "application/json",
      generate: buildAccSetupJson,
    });
  }

  if (setup.game === "Assetto Corsa") {
    options.push({
      id: "ini",
      label: "Download Assetto Corsa File (.ini)",
      ext: ".ini",
      mime: "text/plain",
      generate: buildSetupIni,
    });
  }

  options.push({
    id: "txt",
    label: "Download Tuning Summary (.txt)",
    ext: ".txt",
    mime: "text/plain",
    generate: buildSetupExportText,
  });

  return options;
}

/** Builds a filesystem-safe filename for a generated setup export. */
export function buildSetupExportFilename(setup: Setup, ext = ".txt"): string {
  const safe = `${setup.car}-${setup.track}-setup`.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return `${safe}${ext.startsWith(".") ? ext : `.${ext}`}`;
}
