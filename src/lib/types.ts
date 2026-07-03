export type Game =
  | "iRacing"
  | "Assetto Corsa EVO"
  | "Assetto Corsa Competizione"
  | "Assetto Corsa"
  | "Le Mans Ultimate"
  | "Automobilista 2"
  | "Gran Turismo 7"
  | "F1 25"
  | "F1 24";

export type Condition = "Dry" | "Wet" | "Mixed";

export type SetupTag = "Safe" | "Beginner" | "Quali" | "Race" | "Aggressive" | "Wet Weather";

export type RigProfile =
  | "Wheel + 3 Pedals"
  | "Wheel + Handbrake"
  | "Direct Drive + Load Cell"
  | "Gamepad";

/**
 * Free-form field-key -> value map. Deliberately not a fixed interface:
 * every game has a genuinely different setup screen (a Gran Turismo 7
 * tuning sheet has nothing in common with F1 25's Suspension Geometry
 * tab), so the actual field set for a given setup is driven by
 * setupSchemas[game] in lib/setup-schemas.ts, not by this type.
 */
export type SetupValues = Record<string, string>;

export interface Rating {
  pace: number;
  predictability: number;
}

export interface Setup {
  id: string;
  game: Game;
  car: string;
  track: string;
  condition: Condition;
  lapTime: string;
  description: string;
  tags: SetupTag[];
  rigProfile: RigProfile;
  author: string;
  uploadedAt: string;
  upvotes: number;
  hasUpvoted: boolean;
  /** Community average (1-5, one decimal), not a fixed uploader rating. */
  pace: number;
  predictability: number;
  ratingCount: number;
  /** The current viewer's own rating, if they've rated this setup. */
  myRating: Rating | null;
  /** Whether the current viewer uploaded this setup (can edit/delete it). */
  isOwner: boolean;
  downloads: number;
  setupValues?: SetupValues;
  /** Original filename of the uploaded setup file, if any. */
  fileName: string | null;
  /** Public download URL for the uploaded setup file, if any. */
  fileUrl: string | null;
}
