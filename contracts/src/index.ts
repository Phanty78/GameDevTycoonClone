/**
 * Contrats partagés front <-> back.
 * Types uniquement : aucune logique de jeu ne vit ici (voir docs/DESIGN.md §3, §7).
 * Le back est autoritaire ; ce paquet ne décrit que la forme des inputs et des payloads.
 */

// --- Auth (DESIGN.md §5) ---

export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterResult {
  userId: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
}

// --- Effort : 9 curseurs sur 3 phases (DESIGN.md §5, data/sliders.json) ---
// Chaque phase répartit son temps ; total attendu = 100 par phase.

export interface Phase1Effort {
  engine: number;
  gameplay: number;
  story: number;
}

export interface Phase2Effort {
  dialogue: number;
  levelDesign: number;
  ai: number;
}

export interface Phase3Effort {
  worldDesign: number;
  graphics: number;
  sound: number;
}

export interface Effort {
  phase1: Phase1Effort;
  phase2: Phase2Effort;
  phase3: Phase3Effort;
}

// --- Développement d'un jeu (POST /games) ---

export interface CreateGameInput {
  name: string;
  genre: string;
  topic: string;
  platform: string;
  effort: Effort;
}

/** Payload d'affichage renvoyé par le back. Aucune formule, juste des résultats. */
export interface GameResult {
  gameId: string;
  designScore: number;
  techScore: number;
  reviewScore: number;
  sales: number;
  revenue: number;
  review: string;
  newBalance: number;
}

/** Jeu de la saison en cours (GET /games). */
export interface GameSummary {
  gameId: string;
  name: string;
  genre: string;
  topic: string;
  platform: string;
  reviewScore: number;
  revenue: number;
  createdAt: string;
}

// --- Leaderboard (GET /leaderboard) ---

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  value: number;
}
