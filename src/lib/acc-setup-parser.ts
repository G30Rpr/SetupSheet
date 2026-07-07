import type { SetupValues } from "@/lib/types";

/**
 * Maps ACC's internal car identifiers (the "carName" field in an exported
 * setup .json) to this site's display names in car-lists.ts. Verified
 * against a real sample collection (github.com/JenSeReal/ACC-Setups) rather
 * than guessed. Cars ACC exports that aren't on our roster yet (e.g.
 * "bmw_m2_cs_racing") are simply left unmapped -- parsing still succeeds,
 * the Car field just isn't auto-filled for those.
 */
const ACC_CAR_NAME_MAP: Record<string, string> = {
  alpine_a110_gt4: "Alpine A110 GT4 2018",
  amr_v12_vantage_gt3: "Aston Martin V12 Vantage GT3 2013",
  amr_v8_vantage_gt3: "Aston Martin V8 Vantage GT3 2019",
  amr_v8_vantage_gt4: "Aston Martin V8 Vantage GT4 2018",
  audi_r8_gt4: "Audi R8 LMS GT4 2018",
  audi_r8_lms: "Audi R8 LMS GT3 2015",
  audi_r8_lms_evo: "Audi R8 LMS Evo GT3 2019",
  audi_r8_lms_evo_ii: "Audi R8 LMS Evo II GT3 2022",
  audi_r8_lms_gt2: "Audi R8 LMS GT2",
  bentley_continental_gt3_2016: "Bentley Continental GT3 2015",
  bentley_continental_gt3_2018: "Bentley Continental GT3 2018",
  bmw_m4_gt3: "BMW M4 GT3 2021",
  bmw_m4_gt4: "BMW M4 GT4 2018",
  bmw_m6_gt3: "BMW M6 GT3 2017",
  chevrolet_camaro_gt4r: "Chevrolet Camaro GT4-R 2017",
  ferrari_296_gt3: "Ferrari 296 GT3 2023",
  ferrari_488_challenge_evo: "Ferrari 488 Challenge Evo 2020 GTC",
  ferrari_488_gt3: "Ferrari 488 GT3 2018",
  ferrari_488_gt3_evo: "Ferrari 488 EVO GT3 2020",
  ford_mustang_gt3: "Ford Mustang GT3",
  ginetta_g55_gt4: "Ginetta G55 GT4 2012",
  honda_nsx_gt3: "Honda NSX GT3 2017",
  honda_nsx_gt3_evo: "Honda NSX Evo GT3 2019",
  jaguar_g3: "Emil Frey Jaguar GT3 2012",
  ktm_xbow_gt2: "KTM X-Bow GT2",
  ktm_xbow_gt4: "KTM X-Bow GT4 2016",
  lamborghini_gallardo_rex: "Reiter Engineering R-EX GT3 2017",
  lamborghini_huracan_gt3: "Lamborghini Huracan GT3 2015",
  lamborghini_huracan_gt3_evo: "Lamborghini Huracan Evo GT3 2019",
  lamborghini_huracan_gt3_evo2: "Lamborghini Huracan EVO2 GT3 2023",
  lamborghini_huracan_st: "Lamborghini Huracan Super Trofeo 2015 GTC",
  lamborghini_huracan_st_evo2: "Lamborghini Huracan Super Trofeo Evo 2 2021 GTC",
  lexus_rc_f_gt3: "Lexus RC F GT3 2016",
  maserati_mc20_gt2: "Maserati MC20 GT2",
  maserati_mc_gt4: "Maserati GranTurismo MC GT4 2016",
  mclaren_570s_gt4: "McLaren 570S GT4 2016",
  mclaren_650s_gt3: "McLaren 650S GT3 2015",
  mclaren_720s_gt3: "McLaren 720S GT3 2019",
  mclaren_720s_gt3_evo: "McLaren 720S Evo GT3 2023",
  mercedes_amg_gt2: "Mercedes-AMG GT2",
  mercedes_amg_gt3: "Mercedes AMG GT3 2015",
  mercedes_amg_gt3_evo: "Mercedes AMG Evo GT3 2020",
  mercedes_amg_gt4: "Mercedes AMG GT4 2016",
  nissan_gt_r_gt3_2017: "Nissan GTR Nismo GT3 2015",
  nissan_gt_r_gt3_2018: "Nissan GTR Nismo GT3 2018",
  porsche_718_cayman_gt4_mr: "Porsche 718 Cayman GT4 Clubsport 2019",
  porsche_935: "Porsche 935 GT2",
  porsche_991_gt2_rs_mr: "Porsche 991 II GT2 RS CS Evo",
  porsche_991_gt3_r: "Porsche 911 GT3 R 2018",
  porsche_991ii_gt3_cup: "Porsche 911 II GT3 Cup 2017 GTC",
  porsche_991ii_gt3_r: "Porsche 911 II GT3 R 2019",
  porsche_992_gt3_cup: "Porsche 992 GT3 Cup 2021 GTC",
  porsche_992_gt3_r: "Porsche 992 GT3 R 2023",
};

export interface AccParseResult {
  car: string | null;
  setupValues: SetupValues;
  fieldCount: number;
}

const TYRE_COMPOUND_NAMES = ["Dry", "Wet"];

function degrees(value: unknown): string | undefined {
  return typeof value === "number" ? `${value.toFixed(2)}°` : undefined;
}

function num(value: unknown): string | undefined {
  return typeof value === "number" ? String(value) : undefined;
}

/**
 * Parses an ACC exported setup .json. Only fills in fields that are
 * genuinely usable straight out of the file -- ACC stores most tuning
 * values (tyre pressure, spring rate, ride height, brake bias, steering
 * ratio, caster, diff preload...) as small step-indices into a per-car
 * lookup table the game never exposes, so guessing a conversion would
 * silently produce a wrong setup. Those are left blank for manual entry.
 * Returns null if the file doesn't look like an ACC setup export at all.
 */
export function parseAccSetupFile(jsonText: string): AccParseResult | null {
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return null;
  }

  if (typeof data !== "object" || data === null || !("basicSetup" in data)) {
    return null;
  }

  const root = data as Record<string, unknown>;
  const basic = (root.basicSetup ?? {}) as Record<string, unknown>;
  const advanced = (root.advancedSetup ?? {}) as Record<string, unknown>;
  const alignment = (basic.alignment ?? {}) as Record<string, unknown>;
  const electronics = (basic.electronics ?? {}) as Record<string, unknown>;
  const strategy = (basic.strategy ?? {}) as Record<string, unknown>;
  const tyres = (basic.tyres ?? {}) as Record<string, unknown>;
  const mechanicalBalance = (advanced.mechanicalBalance ?? {}) as Record<string, unknown>;
  const dampers = (advanced.dampers ?? {}) as Record<string, unknown>;
  const aeroBalance = (advanced.aeroBalance ?? {}) as Record<string, unknown>;

  const staticCamber = alignment.staticCamber;
  const camberArr = Array.isArray(staticCamber) ? staticCamber : [];
  const dampersBumpSlow = Array.isArray(dampers.bumpSlow) ? dampers.bumpSlow : [];
  const dampersBumpFast = Array.isArray(dampers.bumpFast) ? dampers.bumpFast : [];
  const dampersReboundSlow = Array.isArray(dampers.reboundSlow) ? dampers.reboundSlow : [];
  const dampersReboundFast = Array.isArray(dampers.reboundFast) ? dampers.reboundFast : [];
  const brakeDuct = Array.isArray(aeroBalance.brakeDuct) ? aeroBalance.brakeDuct : [];

  const values: SetupValues = {};

  function set(key: string, value: string | undefined) {
    if (value !== undefined) values[key] = value;
  }

  // Tyres -- only camber has a real-unit field (staticCamber, degrees).
  // Pressure/toe/caster are raw steps with no public conversion table.
  set("frontLeftCamber", degrees(camberArr[0]));
  set("frontRightCamber", degrees(camberArr[1]));
  set("rearLeftCamber", degrees(camberArr[2]));
  set("rearRightCamber", degrees(camberArr[3]));

  // Electronics -- these ARE the raw values shown on the in-game dial.
  set("tractionControl", num(electronics.tC1));
  set("tractionControl2", num(electronics.tC2));
  set("abs", num(electronics.abs));
  set("engineMap", num(electronics.eCUMap));

  // Fuel & Strategy -- fuel is already litres; set/compound numbers are
  // 0-indexed in the file vs. 1-indexed on screen.
  set("fuel", typeof strategy.fuel === "number" ? `${strategy.fuel} L` : undefined);
  set(
    "tyreCompound",
    typeof tyres.tyreCompound === "number" ? TYRE_COMPOUND_NAMES[tyres.tyreCompound] : undefined
  );
  set("tyreSet", typeof strategy.tyreSet === "number" ? String(strategy.tyreSet + 1) : undefined);
  set(
    "frontBrakePadSet",
    typeof strategy.frontBrakePadCompound === "number"
      ? String(strategy.frontBrakePadCompound + 1)
      : undefined
  );
  set(
    "rearBrakePadSet",
    typeof strategy.rearBrakePadCompound === "number"
      ? String(strategy.rearBrakePadCompound + 1)
      : undefined
  );

  // Mechanical Grip -- ARB is the raw in-game click count, directly usable.
  set("frontArb", num(mechanicalBalance.aRBFront));
  set("rearArb", num(mechanicalBalance.aRBRear));

  // Dampers -- these are the raw click values shown in-game, not a
  // converted physical unit, so they're directly usable as-is.
  set("frontLeftSlowBump", num(dampersBumpSlow[0]));
  set("frontRightSlowBump", num(dampersBumpSlow[1]));
  set("rearLeftSlowBump", num(dampersBumpSlow[2]));
  set("rearRightSlowBump", num(dampersBumpSlow[3]));
  set("frontLeftFastBump", num(dampersBumpFast[0]));
  set("frontRightFastBump", num(dampersBumpFast[1]));
  set("rearLeftFastBump", num(dampersBumpFast[2]));
  set("rearRightFastBump", num(dampersBumpFast[3]));
  set("frontLeftSlowRebound", num(dampersReboundSlow[0]));
  set("frontRightSlowRebound", num(dampersReboundSlow[1]));
  set("rearLeftSlowRebound", num(dampersReboundSlow[2]));
  set("rearRightSlowRebound", num(dampersReboundSlow[3]));
  set("frontLeftFastRebound", num(dampersReboundFast[0]));
  set("frontRightFastRebound", num(dampersReboundFast[1]));
  set("rearLeftFastRebound", num(dampersReboundFast[2]));
  set("rearRightFastRebound", num(dampersReboundFast[3]));

  // Aero -- wing/splitter/ducts are raw click positions, directly usable.
  set("rearWing", num(aeroBalance.rearWing));
  set("frontDiffuser", num(aeroBalance.splitter));
  set("frontBrakeDuct", num(brakeDuct[0]));
  set("rearBrakeDuct", num(brakeDuct[1]));

  const car =
    typeof root.carName === "string" ? ACC_CAR_NAME_MAP[root.carName] ?? null : null;

  return { car, setupValues: values, fieldCount: Object.keys(values).length };
}
