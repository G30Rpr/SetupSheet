// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { signInWithDiscordMock } = vi.hoisted(() => ({
  signInWithDiscordMock: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ signInWithDiscord: signInWithDiscordMock }),
}));

import { DiscordLoginButton } from "@/components/auth-nav";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DiscordLoginButton", () => {
  it("forwards its safe return path to the auth provider", () => {
    render(<DiscordLoginButton nextPath="/garage?from=setup-id" />);

    fireEvent.click(screen.getByRole("button", { name: /login with discord/i }));

    expect(signInWithDiscordMock).toHaveBeenCalledWith("/garage?from=setup-id");
  });
});
