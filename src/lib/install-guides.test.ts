import { describe, expect, it } from "vitest";

import { installGuides, resolveInstallGuide } from "@/lib/install-guides";
import { games } from "@/lib/data";
import type { Game } from "@/lib/types";

describe("resolveInstallGuide", () => {
  it("fills {car} and {track} from the setup", () => {
    const guide = resolveInstallGuide("Assetto Corsa Competizione", {
      car: "Ford Mustang GT3",
      track: "Zandvoort",
    });

    expect(guide.folderPath).toBe(
      String.raw`Documents\Assetto Corsa Competizione\Setups\Ford Mustang GT3\Zandvoort`
    );
    expect(guide.folderIncomplete).toBe(false);
    expect(guide.steps.join(" ")).toContain(String.raw`Setups\Ford Mustang GT3\Zandvoort`);
    // No angle-bracket placeholders left once the values are known.
    expect(guide.steps.join(" ")).not.toMatch(/<car|<track/);
  });

  it("keeps a placeholder the setup can't answer, and flags it", () => {
    const guide = resolveInstallGuide("Automobilista 2", {
      car: "Porsche 911 GT3",
      track: "Monza",
    });

    // {profile} is the user's Windows username -- guessed values here would be
    // worse than leaving it visible.
    expect(guide.folderPath).toContain("{profile}");
    expect(guide.folderPath).toContain("Monza");
    expect(guide.folderNote).toContain("Windows username");
  });

  it("reports the extension the game actually imports", () => {
    expect(resolveInstallGuide("iRacing", { car: "X", track: "Y" }).fileExtension).toBe(".sto");
    expect(resolveInstallGuide("Le Mans Ultimate", { car: "X", track: "Y" }).fileExtension).toBe(
      ".svm"
    );
  });

  it("offers no folder for games that can't import a file", () => {
    for (const game of ["Gran Turismo 7", "F1 25", "Assetto Corsa EVO"] as Game[]) {
      const guide = resolveInstallGuide(game, { car: "X", track: "Y" });
      expect(guide.supportsFileImport).toBe(false);
      expect(guide.folderPath).toBeNull();
      expect(guide.fileExtension).toBeNull();
    }
  });

  it("covers every supported game", () => {
    for (const game of games) {
      expect(installGuides[game]).toBeDefined();
      const resolved = resolveInstallGuide(game, { car: "Car", track: "Track" });
      expect(resolved.steps.length).toBeGreaterThan(0);
      // A guide that claims file import must say where the file goes.
      if (resolved.supportsFileImport) {
        expect(resolved.folderPath).toBeTruthy();
        expect(resolved.fileExtension).toMatch(/^\.\w+$/);
      }
    }
  });
});
