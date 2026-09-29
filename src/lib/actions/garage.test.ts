import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGarageSession } from "@/lib/actions/garage";
import type { Setup } from "@/lib/types";

const { createClientMock, getCurrentUserMock, getSetupByIdMock, revalidatePathMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getSetupByIdMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/supabase/setups", () => ({ getSetupById: getSetupByIdMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

const SOURCE_SETUP_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const sourceSetup = {
  id: SOURCE_SETUP_ID,
  game: "Assetto Corsa Competizione",
  car: "BMW M4 GT3",
  track: "Monza",
  condition: "Wet",
  rigProfile: "Wheel + 3 Pedals",
  setupValues: {
    frontLeftTyrePressure: "26.0 psi",
    brakeBias: "56% front",
    notAnAccField: "ignored",
  },
} as unknown as Setup;

function makeSupabase() {
  const rpc = vi.fn().mockResolvedValue({ data: SESSION_ID, error: null });
  return { client: { rpc }, rpc };
}

const validSourceInput = {
  sourceSetupId: SOURCE_SETUP_ID,
  copySourceSetupValues: true,
  // Source metadata sent by a hostile/old browser must never be authoritative.
  game: "Gran Turismo 7",
  car: "Forged car",
  track: "Forged track",
  condition: "Mixed",
  rig: "Gamepad",
  setupValues: { brakeBias: "forged value" },
  baselineNote: "  From the public setup  ",
};

describe("createGarageSession from a public setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getSetupByIdMock.mockResolvedValue(sourceSetup);
  });

  it("re-reads the public setup, derives metadata, and copies values only on opt-in", async () => {
    const { client, rpc } = makeSupabase();
    createClientMock.mockResolvedValue(client);

    await expect(createGarageSession(validSourceInput)).resolves.toEqual({
      sessionId: SESSION_ID,
      error: null,
    });

    expect(getSetupByIdMock).toHaveBeenCalledWith(SOURCE_SETUP_ID);
    expect(rpc).toHaveBeenCalledWith("create_garage_session_from_setup_with_baseline", {
      p_source_setup_id: SOURCE_SETUP_ID,
      p_rig: "Gamepad",
      p_setup_values: {
        frontLeftTyrePressure: "26.0 psi",
        brakeBias: "56% front",
      },
      p_note: "From the public setup",
    });
  });

  it("keeps source values out of the baseline unless the user opts in", async () => {
    const { client, rpc } = makeSupabase();
    createClientMock.mockResolvedValue(client);

    await createGarageSession({
      ...validSourceInput,
      copySourceSetupValues: false,
      setupValues: { brakeBias: "manually entered" },
    });

    expect(rpc).toHaveBeenCalledWith("create_garage_session_from_setup_with_baseline", {
      p_source_setup_id: SOURCE_SETUP_ID,
      p_rig: "Gamepad",
      p_setup_values: { brakeBias: "manually entered" },
      p_note: "From the public setup",
    });
  });

  it("rejects invalid or unsupported source setups before creating any Garage rows", async () => {
    const { client, rpc } = makeSupabase();
    createClientMock.mockResolvedValue(client);

    await expect(createGarageSession({
      ...validSourceInput,
      sourceSetupId: "not-a-uuid",
    })).resolves.toMatchObject({ sessionId: null, error: expect.stringMatching(/source setup is invalid/i) });
    expect(getSetupByIdMock).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();

    getSetupByIdMock.mockResolvedValue({ ...sourceSetup, game: "Gran Turismo 7" });
    await expect(createGarageSession(validSourceInput)).resolves.toMatchObject({
      sessionId: null,
      error: expect.stringMatching(/ACC and Le Mans Ultimate/i),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still uses the existing atomic RPC for a manually-created session", async () => {
    const { client, rpc } = makeSupabase();
    createClientMock.mockResolvedValue(client);

    await createGarageSession({
      game: "Assetto Corsa Competizione",
      car: "BMW M4 GT3",
      track: "Monza",
      condition: "Dry",
      rig: null,
      setupValues: { brakeBias: "56% front" },
      baselineNote: "",
    });

    expect(getSetupByIdMock).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("create_garage_session_with_baseline", {
      p_game: "Assetto Corsa Competizione",
      p_car: "BMW M4 GT3",
      p_track: "Monza",
      p_condition: "Dry",
      p_rig: null,
      p_setup_values: { brakeBias: "56% front" },
      p_note: "Baseline",
    });
  });
});
