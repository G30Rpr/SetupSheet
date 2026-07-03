export type Game =
  | "iRacing"
  | "Assetto Corsa EVO"
  | "Assetto Corsa Competizione"
  | "Assetto Corsa"
  | "Le Mans Ultimate"
  | "Automobilista 2"
  | "F1 24"
  | "F1 23"
  | "F1 22"
  | "F1 21"
  | "F1 2020"
  | "F1 2019";

export type Condition = "Dry" | "Wet" | "Mixed";

export type SetupTag = "Safe" | "Beginner" | "Quali" | "Race" | "Aggressive" | "Wet Weather";

export type RigProfile =
  | "Wheel + 3 Pedals"
  | "Wheel + Handbrake"
  | "Direct Drive + Load Cell"
  | "Gamepad";

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
  pace: number;
  predictability: number;
  downloads: number;
}
