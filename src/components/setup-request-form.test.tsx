// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createSetupRequestMock, refreshMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  createSetupRequestMock: vi.fn(),
  refreshMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, isLoading: false }),
}));
vi.mock("@/lib/actions/setup-requests", () => ({ createSetupRequest: createSetupRequestMock }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccessMock, error: toastErrorMock }),
}));

import { SetupRequestForm } from "@/components/setup-request-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SetupRequestForm", () => {
  it("confirms a successful post and refreshes the board after the async action", async () => {
    createSetupRequestMock.mockResolvedValue({ error: null });
    render(<SetupRequestForm />);

    const car = screen.getByLabelText("Car");
    fireEvent.change(car, { target: { value: "BMW M4 GT3" } });
    const form = screen.getByRole("button", { name: "Post request" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);

    await waitFor(() => expect(createSetupRequestMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Request posted"));
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(car).toHaveValue("");
  });

  it("keeps the form and announces a server-side failure", async () => {
    createSetupRequestMock.mockResolvedValue({ error: "Choose a game." });
    render(<SetupRequestForm />);

    const car = screen.getByLabelText("Car");
    fireEvent.change(car, { target: { value: "BMW M4 GT3" } });
    const form = screen.getByRole("button", { name: "Post request" }).closest("form");
    fireEvent.submit(form!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a game.");
    expect(car).toHaveValue("BMW M4 GT3");
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
