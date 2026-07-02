export type Game = "iRacing" | "ACC" | "F1 24" | "rFactor 2" | "Automobilista 2" | "Gran Turismo 7";

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
