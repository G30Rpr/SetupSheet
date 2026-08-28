import { describe, expect, it } from "vitest";

import { getActionError } from "@/lib/actions/action-errors";

describe("getActionError", () => {
  it("uses the stable fallback for unknown backend errors", () => {
    expect(
      getActionError(
        { code: "PGRST123", message: "relation private_table does not exist" },
        "Please try again."
      )
    ).toBe("Please try again.");
  });

  it("maps stable database codes without exposing SQL details", () => {
    expect(getActionError({ code: "23505", message: "duplicate key" }, "fallback")).toBe(
      "That action has already been applied."
    );
    expect(getActionError({ code: "42501", message: "permission denied" }, "fallback")).toBe(
      "You are not allowed to perform that action."
    );
  });

  it("allows a small explicit list of expected action messages", () => {
    expect(
      getActionError(
        { code: "P0001", message: "This request has already been fulfilled" },
        "fallback",
        ["This request has already been fulfilled"]
      )
    ).toBe("This request has already been fulfilled");
  });
});
