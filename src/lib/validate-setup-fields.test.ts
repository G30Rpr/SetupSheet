import { describe, expect, it } from "vitest";

import {
  MAX_CAR_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_GAME_VERSION_LENGTH,
  MAX_TRACK_LENGTH,
} from "@/lib/data";
import {
  AUTHOR_NOTE_REQUIRED_ERROR,
  validateSetupFields,
} from "@/lib/validate-setup-fields";

function validInput() {
  return {
    game: "iRacing",
    car: "Porsche 911 GT3 Cup",
    track: "Spa",
    condition: "Dry",
    description: "",
    rigProfile: "Wheel + 3 Pedals",
    tags: ["Safe"],
  };
}

describe("validateSetupFields", () => {
  it("returns null for valid input", () => {
    expect(validateSetupFields(validInput())).toBeNull();
  });

  it("rejects an unknown game", () => {
    expect(validateSetupFields({ ...validInput(), game: "Not A Game" })).toBe("Unknown game.");
  });

  it("rejects an unknown condition", () => {
    expect(validateSetupFields({ ...validInput(), condition: "Snowy" })).toBe(
      "Unknown condition."
    );
  });

  it("rejects an unknown rig profile", () => {
    expect(validateSetupFields({ ...validInput(), rigProfile: "Steering Wheel Only" })).toBe(
      "Unknown rig profile."
    );
  });

  it("rejects an unknown tag", () => {
    expect(validateSetupFields({ ...validInput(), tags: ["Not A Tag"] })).toBe("Unknown tag.");
  });

  it("rejects a car name over the max length", () => {
    const result = validateSetupFields({ ...validInput(), car: "x".repeat(MAX_CAR_LENGTH + 1) });
    expect(result).toBe(`Car name is too long — max ${MAX_CAR_LENGTH} characters.`);
  });

  it("accepts a car name at exactly the max length", () => {
    const result = validateSetupFields({ ...validInput(), car: "x".repeat(MAX_CAR_LENGTH) });
    expect(result).toBeNull();
  });

  it("rejects a track name over the max length", () => {
    const result = validateSetupFields({
      ...validInput(),
      track: "x".repeat(MAX_TRACK_LENGTH + 1),
    });
    expect(result).toBe(`Track name is too long — max ${MAX_TRACK_LENGTH} characters.`);
  });

  it("rejects a description over the max length", () => {
    const result = validateSetupFields({
      ...validInput(),
      description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1),
    });
    expect(result).toBe(`Description is too long — max ${MAX_DESCRIPTION_LENGTH} characters.`);
  });

  it("returns only the first triggered message when multiple fields are invalid", () => {
    const result = validateSetupFields({
      ...validInput(),
      game: "Not A Game",
      condition: "Snowy",
    });
    expect(result).toBe("Unknown game.");
  });

  it("rejects malformed action payloads instead of throwing", () => {
    expect(validateSetupFields(null)).toBe("Invalid setup fields.");
    expect(validateSetupFields({ ...validInput(), tags: "Safe" })).toBe(
      "Tags must be a list of valid values."
    );
    expect(validateSetupFields({ ...validInput(), car: "   " })).toBe("Car is required.");
  });

  it("rejects non-string or oversized structured values", () => {
    expect(
      validateSetupFields({ ...validInput(), setupValues: { frontArb: 3 } })
    ).toBe("Setup values are invalid or too large.");
    expect(
      validateSetupFields({ ...validInput(), setupValues: { frontArb: "x".repeat(201) } })
    ).toBe("Setup values are invalid or too large.");
  });

  it("requires a non-empty author note when the caller demands one (uploads)", () => {
    expect(validateSetupFields({ ...validInput(), description: "" }, { requireAuthorNote: true })).toBe(
      AUTHOR_NOTE_REQUIRED_ERROR
    );
    expect(
      validateSetupFields({ ...validInput(), description: "   \n " }, { requireAuthorNote: true })
    ).toBe(AUTHOR_NOTE_REQUIRED_ERROR);
    expect(
      validateSetupFields(
        { ...validInput(), description: "Likes a planted rear. Hates kerbs. Softened the ARB." },
        { requireAuthorNote: true }
      )
    ).toBeNull();
  });

  it("stays lenient without the flag so legacy File only rows remain editable", () => {
    expect(validateSetupFields({ ...validInput(), description: "" })).toBeNull();
  });

  it("accepts a game version at the max length and treats empty as unreported", () => {
    expect(
      validateSetupFields({
        ...validInput(),
        gameVersion: "v".repeat(MAX_GAME_VERSION_LENGTH),
      })
    ).toBeNull();
    expect(validateSetupFields({ ...validInput(), gameVersion: "1.6" })).toBeNull();
    expect(validateSetupFields({ ...validInput(), gameVersion: "  " })).toBeNull();
    expect(validateSetupFields({ ...validInput(), gameVersion: null })).toBeNull();
    expect(validateSetupFields(validInput())).toBeNull();
  });

  it("rejects a game version over the max length or of the wrong type", () => {
    expect(
      validateSetupFields({
        ...validInput(),
        gameVersion: "v".repeat(MAX_GAME_VERSION_LENGTH + 1),
      })
    ).toBe("Game version is too long — max 40 characters.");
    expect(validateSetupFields({ ...validInput(), gameVersion: 1.6 })).toBe(
      "Invalid setup fields."
    );
  });
});
