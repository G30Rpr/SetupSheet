// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteFooter } from "@/components/site-footer";

const mocks = vi.hoisted(() => ({
  getContributorCount: vi.fn<() => Promise<number>>(),
}));

vi.mock("@/lib/supabase/leaderboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/leaderboard")>();
  return {
    ...actual,
    getContributorCount: mocks.getContributorCount,
  };
});

describe("SiteFooter", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.getContributorCount.mockReset();
    mocks.getContributorCount.mockResolvedValue(0);
  });

  it("uses the matched-to-your-rig tagline and primary nav", async () => {
    render(await SiteFooter());

    expect(screen.getByText("Free setups, matched to your rig.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse" })).toHaveAttribute("href", "/setups");
    expect(screen.getByRole("link", { name: "Engineer" })).toHaveAttribute("href", "/engineer");
    expect(screen.getByRole("link", { name: "Requests" })).toHaveAttribute("href", "/requests");
  });

  it("hides the Leaderboard link until 10 contributors have shared", async () => {
    mocks.getContributorCount.mockResolvedValue(9);
    const { unmount } = render(await SiteFooter());
    expect(screen.queryByRole("link", { name: "Leaderboard" })).not.toBeInTheDocument();
    unmount();

    mocks.getContributorCount.mockResolvedValue(10);
    render(await SiteFooter());
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute(
      "href",
      "/leaderboard"
    );
  });

  it("fails closed: a broken contributor count hides the link instead of erroring", async () => {
    mocks.getContributorCount.mockRejectedValue(new Error("db down"));
    render(await SiteFooter());
    expect(screen.queryByRole("link", { name: "Leaderboard" })).not.toBeInTheDocument();
  });
});
