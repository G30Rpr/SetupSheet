import type { Game } from "@/lib/types";

export interface InstallGuide {
  /** Whether this game can load a real setup file, vs. manual entry only. */
  supportsFileImport: boolean;
  steps: string[];
}

/**
 * Per-game "how do I actually use this" instructions. Grounded in each
 * game's real setup-file convention (folder layout, file extension) where
 * one exists; several titles (Gran Turismo 7, F1 24/25, and Assetto Corsa
 * EVO as of its early-access setup-sharing status) don't support importing
 * an external file at all, so those guides point back at manual entry
 * instead of inventing an import path that doesn't exist.
 */
export const installGuides: Record<Game, InstallGuide> = {
  iRacing: {
    supportsFileImport: true,
    steps: [
      "Download the setup file (.sto) from the card above.",
      String.raw`Move it into Documents\iRacing\setups\<car name>\ — create the car's folder if it doesn't exist yet.`,
      'In iRacing, open Garage → My Setups and select it from the list.',
    ],
  },
  "Assetto Corsa Competizione": {
    supportsFileImport: true,
    steps: [
      "Download the setup file (.json) from the card above.",
      String.raw`Move it into Documents\Assetto Corsa Competizione\Setups\<car>\<track>\ — create the car/track folders if they don't exist yet.`,
      "In ACC, open the Setup screen for that car and track and select it from the list.",
    ],
  },
  "Assetto Corsa": {
    supportsFileImport: true,
    steps: [
      "Download the setup file (.ini) from the card above.",
      String.raw`Move it into Documents\Assetto Corsa\setups\<car>\<track>\ — create the car/track folders if they don't exist yet.`,
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
    steps: [
      "Download the setup file (.svm) from the card above.",
      String.raw`Move it into [Steam]\steamapps\common\Le Mans Ultimate\UserData\player\Settings\<track>\.`,
      "In LMU, open the garage setup screen for that track and load it from the list.",
    ],
  },
  "Automobilista 2": {
    supportsFileImport: true,
    steps: [
      "Download the setup file (.svm) from the card above.",
      String.raw`Move it into Documents\Automobilista 2\savegame\<your profile>\automobilista2\vehiclesetups_1_6\<track>\.`,
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
  "F1 24": {
    supportsFileImport: false,
    steps: [
      "F1 24 doesn't support importing external setup files.",
      'Open the Setup screen and enter each value from the "Setup values" panel above by hand.',
      "Save it as a preset setup so you can load it again in one click.",
    ],
  },
};
