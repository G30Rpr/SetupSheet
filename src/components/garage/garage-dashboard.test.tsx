// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/garage", () => ({
  createGarageLap: vi.fn(),
  createGarageRevision: vi.fn(),
  createGarageRunPlanItem: vi.fn(),
  createGarageSession: vi.fn(),
  deleteGarageSession: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { GarageDashboard } from "@/components/garage/garage-dashboard";
import type { GarageSessionDetail } from "@/lib/garage";

afterEach(cleanup);

const detail: GarageSessionDetail = {
  session: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    game: "Assetto Corsa Competizione",
    car: "BMW M4 GT3",
    track: "Monza",
    condition: "Dry",
    rig: "Wheel + 3 Pedals",
    sourceSetupId: null,
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: "2026-09-20T10:00:00.000Z",
  },
  revisions: [{
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    setupValues: { brakeBias: "56.0% front" },
    note: "Baseline setup",
    createdAt: "2026-09-20T10:00:00.000Z",
  }],
  runPlanItems: [{
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    parameter: "Rear wing",
    direction: "increase",
    amount: "1 click",
    verdict: "better",
    note: "More settled through fast corners",
    createdAt: "2026-09-20T10:30:00.000Z",
  }],
  laps: [{
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revisionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    lapTimeMs: 102350,
    condition: "Dry",
    note: "Clean lap",
    createdAt: "2026-09-20T10:45:00.000Z",
  }],
};

describe("GarageDashboard", () => {
  it("explains the private empty state and offers a session form", () => {
    render(<GarageDashboard sessions={[]} detail={null} listError={false} detailError={false} />);

    expect(screen.getByRole("heading", { name: "Garage" })).toBeInTheDocument();
    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start your first session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create session" })).toBeInTheDocument();
  });

  it("shows revisions, one-change results, and lap times for the selected private session", () => {
    render(
      <GarageDashboard
        sessions={[detail.session]}
        detail={detail}
        listError={false}
        detailError={false}
      />
    );

    expect(screen.getByRole("heading", { name: "BMW M4 GT3" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Setup revisions" })).toBeInTheDocument();
    expect(screen.getByText("Baseline setup")).toBeInTheDocument();
    expect(screen.getByText("More settled through fast corners")).toBeInTheDocument();
    expect(screen.getAllByText("1:42.350")).toHaveLength(2);
    expect(screen.getByText("Wheel + 3 Pedals")).toBeInTheDocument();
  });
});
