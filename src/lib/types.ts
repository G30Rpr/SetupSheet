export type Game =
  | "iRacing"
  | "Assetto Corsa EVO"
  | "Assetto Corsa Competizione"
  | "Assetto Corsa"
  | "Le Mans Ultimate"
  | "Automobilista 2"
  | "Gran Turismo 7"
  | "F1 25";

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
  authorId: string;
  authorAvatarUrl: string | null;
  uploadedAt: string;
  upvotes: number;
  hasUpvoted: boolean;
  /** Whether the current viewer has saved this setup to their private favorites list. */
  hasFavorited: boolean;
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
  /** Optional hotlap video link (YouTube / Twitch) proving lap time. */
  videoUrl?: string | null;
  /** Original filename of the attached telemetry file, if any. */
  telemetryFileName?: string | null;
  /** Public download URL for the attached telemetry file, if any. */
  telemetryFileUrl?: string | null;
  /** Derived: true if either video proof or telemetry proof is attached. */
  isVerifiedLap?: boolean;
}

export interface SetupComment {
  id: string;
  setupId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
  /** Whether the current viewer posted this comment (can delete it). */
  isOwner: boolean;
}

/**
 * A snapshot of a setup's fields captured immediately before an edit that
 * changed them -- see the on_setup_update_snapshot trigger in
 * 0012_setup_versions.sql. `editedBy` is always the setup's own current
 * author under today's RLS (only owners can edit), so callers already have
 * that name from the parent Setup rather than needing a join here.
 */
export interface SetupVersion {
  id: string;
  createdAt: string;
  game: Game;
  car: string;
  track: string;
  condition: Condition;
  lapTime: string;
  description: string;
  tags: SetupTag[];
  rigProfile: RigProfile;
  setupValues: SetupValues | null;
  fileName: string | null;
  videoUrl?: string | null;
  telemetryFileName?: string | null;
}

export interface SetupRequest {
  id: string;
  requesterId: string;
  requesterUsername: string;
  requesterAvatarUrl: string | null;
  game: Game;
  car: string;
  track: string;
  notes: string;
  createdAt: string;
  fulfilledSetupId: string | null;
  fulfilledCar: string | null;
  fulfilledTrack: string | null;
  fulfilledByUsername: string | null;
  fulfilledAt: string | null;
}

/** One row of the "Most wanted" gap-finder -- an open (game, car, track)
 * combo grouped across every request asking for it. */
export interface MostWantedEntry {
  game: Game;
  car: string;
  track: string;
  requestCount: number;
  oldestRequestAt: string;
}
