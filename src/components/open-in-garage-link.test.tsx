// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { OpenInGarageLink } from "@/components/open-in-garage-link";

afterEach(cleanup);

describe("OpenInGarageLink", () => {
  it("links a reviewed-game setup into the server-derived Garage start flow", () => {
    render(
      <OpenInGarageLink
        setupId="11111111-1111-4111-8111-111111111111"
        game="Assetto Corsa Competizione"
      />
    );

    expect(screen.getByRole("link", { name: "Open in Garage" })).toHaveAttribute(
      "href",
      "/garage?from=11111111-1111-4111-8111-111111111111"
    );
    expect(screen.getByText(/setup values are copied only if you opt in/i)).toBeInTheDocument();
  });

  it("does not advertise the Garage flow for unreviewed games", () => {
    const { container } = render(
      <OpenInGarageLink setupId="11111111-1111-4111-8111-111111111111" game="iRacing" />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
