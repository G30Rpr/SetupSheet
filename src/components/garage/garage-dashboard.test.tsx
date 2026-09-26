// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createGarageSessionMock } = vi.hoisted(() => ({ createGarageSessionMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/actions/garage", () => ({
  createGarageLap: vi.fn(),
  createGarageRevision: vi.fn(),
  createGarageRunPlanItem: vi.fn(),
  createGarageSession: createGarageSessionMock,
  deleteGarageSession: vi.fn(),
}));
vi.mock("@/lib/actions/field-tests", () => ({
  createFieldTestReport: vi.fn(),
  setFieldTestReportAttribution: vi.fn(),
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
    "aria-label"?: string;
  }) => (
    <input
      {...props}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
    />
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

import { GarageDashboard } from "@/components/garage/garage-dashboard";
import type { GarageSessionDetail, GarageSetupSource } from "@/lib/garage";

afterEach(cleanup);

const sourceSetup: GarageSetupSource = {
  id: "11111111-1111-4111-8111-111111111111",
  game: "Assetto Corsa Competizione",
  car: "BMW M4 GT3",
  track: "Monza",
  condition: "Wet",
  setupValueCount: 2,
};

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

  it("keeps source values unchecked and submits only the source ID plus explicit opt-in", async () => {
    createGarageSessionMock.mockResolvedValue({
      sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      error: null,
    });

    render(
      <GarageDashboard
        sessions={[]}
        detail={null}
        listError={false}
        detailError={false}
        sourceSetup={sourceSetup}
      />
    );

    expect(screen.getByText("Starting from public setup")).toBeInTheDocument();
    expect(screen.getByText("BMW M4 GT3")).toBeInTheDocument();
    expect(screen.getByText("Assetto Corsa Competizione · Wet")).toBeInTheDocument();
    expect(screen.queryByLabelText("Game")).not.toBeInTheDocument();

    const copyCheckbox = screen.getByRole("checkbox", { name: "Copy 2 saved setup values" });
    expect(copyCheckbox).not.toBeChecked();
    fireEvent.click(copyCheckbox);
    expect(copyCheckbox).toBeChecked();

    const form = screen.getByRole("button", { name: "Create session" }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(createGarageSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSetupId: sourceSetup.id,
        copySourceSetupValues: true,
        rig: null,
        baselineNote: "",
      })
    ));
    const submitted = createGarageSessionMock.mock.calls[0][0] as Record<string, unknown>;
    expect(submitted).not.toHaveProperty("game");
    expect(submitted).not.toHaveProperty("car");
    expect(submitted).not.toHaveProperty("track");
    expect(submitted).not.toHaveProperty("condition");
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
