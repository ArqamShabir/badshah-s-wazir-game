export type Role = 'badshah' | 'vizier' | 'qazi' | 'chor';

export type GameStage = 
  | 'waiting' 
  | 'dealing' 
  | 'badshah_reveal' 
  | 'vizier_reveal' 
  | 'vizier_guess' 
  | 'final_reveal' 
  | 'scoring';

export interface Player {
  uid: string;
  displayName: string;
  avatar: string;
  privateRole: Role | null;
  publicRole: Role | null;
  revealed: boolean;
  score: number;
  createdAt: number;
}

export interface Room {
  roomId: string;
  stage: GameStage;
  timerEndsAt: number | null;
  hostId: string;
  guessTarget: string | null;
  round: number;
  createdAt: number;
}

export const ROLE_SCORES: Record<Role, number> = {
  badshah: 100,
  vizier: 50,
  qazi: 25,
  chor: 0,
};

export const ROLE_NAMES: Record<Role, string> = {
  badshah: 'Badshah',
  vizier: 'Vizier',
  qazi: 'Qazi',
  chor: 'Chor',
};

export const ROLE_COLORS: Record<Role, string> = {
  badshah: 'bg-badshah text-primary-foreground',
  vizier: 'bg-vizier text-primary-foreground',
  qazi: 'bg-accent text-accent-foreground',
  chor: 'bg-chor text-primary-foreground',
};
