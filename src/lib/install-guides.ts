import type { Game } from "@/lib/types";

export interface InstallGuide {
  /** Whether this game can load a real setup file, vs. manual entry only. */
  supportsFileImport: boolean;
  /** Extension the game expects, e.g. ".sto". Absent for manual-entry titles. */
  fileExtension?: string;
  /**
   * Destination folder, relative to the user's Documents folder or Steam
   * library. `{car}` and `{track}` are substituted from the setup when the
   * guide is resolved for a specific setup.
   *
   * Deliberately a *suggestion* rather than a guarantee: games name their own
   * car/track folders, so every guide that has a folder also carries a
   * `folderNote` spelling out what the user may still have to adjust.
   */
  folder?: string;
  folderNote?: string;
  steps: string[];
}

/**
 * Per-game "how do I actually use this" instructions. Grounded in each
 * game's real setup-file convention (folder layout, file extension) where
 * one exists; several titles (Gran Turismo 7, F1 25, and Assetto Corsa EVO
 * as of its early-access setup-sharing status) don't support importing an
 * external file at all, so those guides point back at manual entry instead
 * of inventing an import path that doesn't exist.
 */
export const installGuides: Record<Game, InstallGuide> = {
  iRacing: {
    supportsFileImport: true,
    fileExtension: ".sto",
    folder: String.raw`Documents\iRacing\setups\{car}`,
    folderNote:
      "The car folder has to match the name iRacing uses for that car — if the sim doesn't list the setup, check the folder name against the car's folder on disk.",
    steps: [
      "Download the setup file (.sto) from the card above.",
      String.raw`Move it into Documents\iRacing\setups\{car}\ — create the car's folder if it doesn't exist yet.`,
      "In iRacing, open Garage → My Setups and select it from the list.",
    ],
  },
  "Assetto Corsa Competizione": {
    supportsFileImport: true,
    fileExtension: ".json",
    folder: String.raw`Documents\Assetto Corsa Competizione\Setups\{car}\{track}`,
    folderNote:
      "Car and track folders must match ACC's own naming — create them if they don't exist yet.",
    steps: [
      "Download the setup file (.json) from the card above.",
      String.raw`Move it into Documents\Assetto Corsa Competizione\Setups\{car}\{track}\ — create the car/track folders if they don't exist yet.`,
      "In ACC, open the Setup screen for that car and track and select it from the list.",
    ],
  },
  "Assetto Corsa": {
    supportsFileImport: true,
    fileExtension: ".ini",
    folder: String.raw`Documents\Assetto Corsa\setups\{car}\{track}`,
    folderNote:
      "Car and track folders must match Assetto Corsa's own naming — create them if they don't exist yet.",
    steps: [
      "Download the setup file (.ini) from the card above.",
      String.raw`Move it into Documents\Assetto Corsa\setups\{car}\{track}\ — create the car/track folders if they don't exist yet.`,
      "In AC, open the Setup screen for that car and track and load it from the list.",
    ],
  },
  "Assetto Corsa EVO": {
    supportsFileImport: false,
    steps: [
      "Assetto Corsa EVO is still in early access and doesn't have a confirmed community setup-file import yet.",
      'Open the in-game Setup screen for your car and enter each value from the "Setup values" panel above by hand.',
      "Save it as an in-game preset so you don't have to re-enter it next time.",
    ],
  },
  "Le Mans Ultimate": {
    supportsFileImport: true,
    fileExtension: ".svm",
    folder: String.raw`[Steam]\steamapps\common\Le Mans Ultimate\UserData\player\Settings\{track}`,
    folderNote:
      "[Steam] is whichever Steam library the game is installed in — open it via Steam → right-click the game → Manage → Browse local files.",
    steps: [
      "Download the setup file (.svm) from the card above.",
      String.raw`Move it into [Steam]\steamapps\common\Le Mans Ultimate\UserData\player\Settings\{track}\.`,
      "In LMU, open the garage setup screen for that track and load it from the list.",
    ],
  },
  "Automobilista 2": {
    supportsFileImport: true,
    fileExtension: ".svm",
    folder: String.raw`Documents\Automobilista 2\savegame\{profile}\automobilista2\vehiclesetups_1_6\{track}`,
    folderNote:
      "{profile} is your Windows username — replace it if you've moved your AMS2 save folder.",
    steps: [
      "Download the setup file (.svm) from the card above.",
      String.raw`Move it into Documents\Automobilista 2\savegame\{profile}\automobilista2\vehiclesetups_1_6\{track}\.`,
      "In AMS2, open Garage → Setup → Load and select it from the list.",
    ],
  },
  "Gran Turismo 7": {
    supportsFileImport: false,
    steps: [
      "GT7 is a closed console platform and doesn't support importing external setup files.",
      'Open Car Settings from the garage and enter each value from the "Setup values" panel above by hand.',
      "Save it as a settings sheet so you can switch back to it instantly next time.",
    ],
  },
  "F1 25": {
    supportsFileImport: false,
    steps: [
      "F1 25 doesn't support importing external setup files.",
      'Open the Setup screen and enter each value from the "Setup values" panel above by hand.',
      "Save it as a preset setup so you can load it again in one click.",
    ],
  },
};

export interface ResolvedInstallGuide {
  supportsFileImport: boolean;
  fileExtension: string | null;
  /** Folder with {car}/{track} filled in, or null for manual-entry games. */
  folderPath: string | null;
  /** Whatever the guide still expects the user to fill in (e.g. their profile name). */
  folderNote: string | null;
  /** True when a placeholder could not be filled from the setup itself. */
  folderIncomplete: boolean;
  steps: string[];
}

/**
 * Fills a guide's `{car}`/`{track}` placeholders from the setup so the
 * instructions and the copy-button carry real paths instead of angle
 * brackets. Placeholders the setup can't answer (a Windows username, the
 * Steam library) are left as-is and flagged, rather than guessed at.
 */
export function resolveInstallGuide(
  game: Game,
  setup: { car: string; track: string }
): ResolvedInstallGuide {
  const guide = installGuides[game];
  const replacements: Record<string, string> = {
    car: setup.car.trim(),
    track: setup.track.trim(),
  };

  const substitute = (text: string): { text: string; incomplete: boolean } => {
    let incomplete = false;
    const rendered = text.replace(/\{(\w+)\}/g, (match, token: string) => {
      const value = replacements[token];
      if (!value) {
        incomplete = true;
        return match;
      }
      return value;
    });
    return { text: rendered, incomplete };
  };

  const folder = guide.folder ? substitute(guide.folder) : null;
  const steps = guide.steps.map((step) => substitute(step).text);

  return {
    supportsFileImport: guide.supportsFileImport,
    fileExtension: guide.fileExtension ?? null,
    folderPath: folder?.text ?? null,
    folderNote: guide.folderNote ?? null,
    folderIncomplete: folder?.incomplete ?? false,
    steps,
  };
}
