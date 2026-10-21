// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GameVersionBadge } from "@/components/game-version-badge";

afterEach(cleanup);

describe("GameVersionBadge", () => {
  it("renders nothing without a reported version", () => {
    const { container } = render(
      <GameVersionBadge gameVersion={null} currentVersion="1.6" />
    );
    expect(container.textContent).toBe("");
  });

  it("shows the reported version without a staleness claim", () => {
    render(<GameVersionBadge gameVersion="1.6" currentVersion={null} />);
    expect(screen.getByTestId("game-version")).toHaveTextContent("Built for 1.6");
    expect(screen.queryByTestId("game-version-stale")).toBeNull();
  });

  it("notes the current patch on an exact match", () => {
    render(<GameVersionBadge gameVersion="1.6" currentVersion="1.6" />);
    expect(screen.getByTestId("game-version")).toHaveTextContent(
      "Built for 1.6 · current patch"
    );
  });

  it("flags a stale setup with both versions and the behavior hint", () => {
    render(<GameVersionBadge gameVersion="1.5" currentVersion="1.6" />);
    const stale = screen.getByTestId("game-version-stale");
    expect(stale).toHaveTextContent("Built for 1.5 — current patch is 1.6");
    expect(stale.getAttribute("title")).toBe(
      "Gameplay updates can change how a setup behaves."
    );
  });
});
