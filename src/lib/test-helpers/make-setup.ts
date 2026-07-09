import type { Setup } from "@/lib/types";

/** Builds a fully-populated Setup fixture for tests, with sensible defaults overridable per field. */
export function makeSetup(overrides: Partial<Setup> = {}): Setup {
  return {
    id: "setup-1",
    game: "Assetto Corsa Competizione",
    car: "BMW M4 GT3 2021",
    track: "Spa-Francorchamps",
    condition: "Dry",
    lapTime: "2:19.104",
    description: "",
    tags: [],
    rigProfile: "Direct Drive + Load Cell",
    author: "racer1",
    authorId: "user-1",
    authorAvatarUrl: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    upvotes: 0,
    hasUpvoted: false,
    pace: 0,
    predictability: 0,
    ratingCount: 0,
    myRating: null,
    isOwner: false,
    downloads: 0,
    fileName: null,
    fileUrl: null,
    ...overrides,
  };
}
