import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Setup } from "@/lib/types";

const {
  createClientMock,
  getCurrentUserMock,
  getGarageSessionsMock,
  getGarageSessionDetailMock,
  getSetupByIdMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getGarageSessionsMock: vi.fn(),
  getGarageSessionDetailMock: vi.fn(),
  getSetupByIdMock: vi.fn(),
}));

vi.mock("@/components/garage/garage-dashboard", () => ({
  GarageDashboard: () => null,
}));
vi.mock("@/components/auth-nav", () => ({ DiscordLoginButton: () => null }));
vi.mock("@/components/ui/card", () => ({ Card: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/supabase/auth", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/supabase/garage", () => ({
  getGarageSessions: getGarageSessionsMock,
  getGarageSessionDetail: getGarageSessionDetailMock,
}));
vi.mock("@/lib/supabase/setups", () => ({ getSetupById: getSetupByIdMock }));

import GaragePage from "@/app/garage/page";

const SOURCE_SETUP_ID = "11111111-1111-4111-8111-111111111111";

const sourceSetup = {
  id: SOURCE_SETUP_ID,
  game: "Assetto Corsa Competizione",
  car: "BMW M4 GT3",
  track: "Monza",
  condition: "Wet",
  setupValues: {
    frontLeftTyrePressure: "26.0 psi",
    brakeBias: "56% front",
    notAnAccField: "not copied",
  },
} as unknown as Setup;

function getDashboardProps(element: unknown): Record<string, unknown> {
  if (!isValidElement(element)) throw new Error("Expected a dashboard element");
  return (element as ReactElement<Record<string, unknown>>).props;
}

describe("GaragePage start-from-setup source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockResolvedValue({});
    getCurrentUserMock.mockResolvedValue({ id: "user-1" });
    getGarageSessionsMock.mockResolvedValue({ sessions: [], error: false });
    getGarageSessionDetailMock.mockResolvedValue({ detail: null, error: false });
    getSetupByIdMock.mockResolvedValue(sourceSetup);
  });

  it("validates and reads a public setup through the normal reader, passing only server-derived metadata", async () => {
    const element = await GaragePage({ searchParams: Promise.resolve({ from: SOURCE_SETUP_ID }) });
    const props = getDashboardProps(element);

    expect(getSetupByIdMock).toHaveBeenCalledWith(SOURCE_SETUP_ID);
    expect(props.sourceSetup).toEqual({
      id: SOURCE_SETUP_ID,
      game: "Assetto Corsa Competizione",
      car: "BMW M4 GT3",
      track: "Monza",
      condition: "Wet",
      setupValueCount: 2,
    });
    expect(props.sourceSetupError).toBeNull();
    expect(props.sourceSetup).not.toHaveProperty("setupValues");
    expect(props.sourceSetup).not.toHaveProperty("authorId");
  });

  it("does not query malformed setup IDs", async () => {
    const element = await GaragePage({ searchParams: Promise.resolve({ from: "not-a-uuid" }) });
    const props = getDashboardProps(element);

    expect(getSetupByIdMock).not.toHaveBeenCalled();
    expect(props.sourceSetup).toBeNull();
    expect(props.sourceSetupError).toMatch(/link is invalid/i);
  });

  it("does not read public setup data before authentication", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await GaragePage({ searchParams: Promise.resolve({ from: SOURCE_SETUP_ID }) });

    expect(getSetupByIdMock).not.toHaveBeenCalled();
    expect(getGarageSessionsMock).not.toHaveBeenCalled();
  });
});
