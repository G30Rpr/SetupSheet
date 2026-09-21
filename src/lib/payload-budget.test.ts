import { describe, expect, it } from "vitest";

import { SETUPS_BROWSE_LIMIT } from "@/lib/supabase/setups";
import { SETUP_CARD_PAGE_SIZE } from "@/lib/ui-constants";
import type { Setup } from "@/lib/types";

/**
 * Payload budget for the serialized setup rows that cross the RSC boundary.
 *
 * Every `Setup` handed to `SetupsBrowser` (a client component) is serialized in
 * full into the response, so this cost is per-row and multiplies by the browse
 * index size. Nothing about the app's rendering would fail if these numbers
 * doubled -- the page just gets heavier -- which is exactly why it needs an
 * assertion rather than a comment.
 *
 * The fixture below is deliberately worst-case rather than typical: the longest
 * car/track/description strings the schema allows, the largest per-game
 * `setup_values` map (Le Mans Ultimate's 74 fields), and every optional field
 * populated. If a new field is added to `Setup`, the measured size moves and
 * this test states the new cost.
 */

/** Longest real-world values: LMU's field list, all populated. */
const LMU_FIELD_COUNT = 74;

function worstCaseSetup(): Setup {
  const setupValues: Record<string, string | number> = {};
  for (let index = 0; index < LMU_FIELD_COUNT; index += 1) {
    // Realistic mix of numeric and short-label values.
    setupValues[`field_${index}_long_key_name`] = index % 3 === 0 ? 12.5 : "Soft";
  }

  return {
    id: "31bcad00-84e3-4eb0-8458-ba15f8eb1b8a",
    game: "Le Mans Ultimate",
    car: "Porsche 911 LMGT3 R (992)",
    track: "Autodromo Enzo e Dino Ferrari – Imola",
    condition: "Dry",
    lapTime: "1:41.288",
    description: "d".repeat(400),
    tags: ["Race", "Aggressive", "Beginner"],
    rigProfile: "Direct Drive + Load Cell",
    setupValues: setupValues as Setup["setupValues"],
    fileName: "setup-with-a-fairly-long-descriptive-filename.json",
    fileUrl:
      "https://abcdefghijklmnop.supabase.co/storage/v1/object/public/setup-files/7ec21b4c-4a9b-4044-b2be-f6929af9be6a/12345678-1234-1234-1234-123456789abc-setup.json",
    telemetryFileName: "telemetry-abcdefghijklmnop-1234567890.vbo",
    telemetryFileUrl:
      "https://abcdefghijklmnop.supabase.co/storage/v1/object/public/setup-files/7ec21b4c-4a9b-4044-b2be-f6929af9be6a/telemetry-12345678-1234-1234-1234-123456789abc-run.vbo",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    pace: 4.2,
    predictability: 3.8,
    ratingCount: 7,
    upvotes: 12,
    downloads: 34,
    uploadedAt: "2026-07-08T10:00:00.000Z",
    updatedAt: "2026-07-09T10:00:00.000Z",
    author: "a_reasonably_long_discord_username",
    authorId: "7ec21b4c-4a9b-4044-b2be-f6929af9be6a",
    authorAvatarUrl:
      "https://cdn.discordapp.com/avatars/165306996092829697/e108a856984ba333402bcbe916f725d2.png",
    hasUpvoted: false,
    hasFavorited: false,
    myRating: null,
    isOwner: false,
    isVerifiedLap: true,
  };
}

const PER_SETUP_BUDGET_BYTES = 4 * 1024;
const BROWSE_PAYLOAD_BUDGET_BYTES = 512 * 1024;
const LOAD_OLDER_PAGE_BUDGET_BYTES = 200 * 1024;

describe("setup payload budget", () => {
  const serializedBytes = JSON.stringify(worstCaseSetup()).length;

  it("keeps an individual setup under the per-row budget", () => {
    expect(
      serializedBytes,
      `worst-case Setup serializes to ${(serializedBytes / 1024).toFixed(2)} KiB; ` +
        "either trim the row (see the setup_values note above) or raise this budget deliberately"
    ).toBeLessThanOrEqual(PER_SETUP_BUDGET_BYTES);
  });

  it("keeps the whole browse index under budget", () => {
    const worstCase = serializedBytes * SETUPS_BROWSE_LIMIT;
    expect(
      worstCase,
      `${SETUPS_BROWSE_LIMIT} setups serialize to ${(worstCase / 1024 / 1024).toFixed(2)} MiB`
    ).toBeLessThanOrEqual(BROWSE_PAYLOAD_BUDGET_BYTES);
  });

  it("keeps one 'load older' page under budget", () => {
    const pageSize = SETUP_CARD_PAGE_SIZE * 2; // mirrors SETUPS_BROWSE_PAGE_SIZE
    const worstCase = serializedBytes * pageSize;
    expect(
      worstCase,
      `${pageSize} setups serialize to ${(worstCase / 1024).toFixed(0)} KiB`
    ).toBeLessThanOrEqual(LOAD_OLDER_PAGE_BUDGET_BYTES);
  });

  it("records how much of the row is the setup_values map", () => {
    // Not an assertion about correctness -- a tripwire that makes the biggest
    // contributor visible if this budget is ever tightened. ~57% at audit time.
    const withoutValues = { ...worstCaseSetup(), setupValues: undefined };
    const valuesShare = 1 - JSON.stringify(withoutValues).length / serializedBytes;
    expect(valuesShare).toBeGreaterThan(0.3);
  });
});
