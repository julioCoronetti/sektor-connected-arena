export type TeamId = string;

export interface User {
  id: string;
  email: string;
  name: string;
  teamId: TeamId;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  teamId: TeamId;
  text: string;
  imageUrl?: string;
  likes: number;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface MatchScore {
  home: number;
  guest: number;
}

export interface Match {
  id: string;
  teamA: { id: TeamId; name: string; color: string };
  teamB: { id: TeamId; name: string; color: string };
  minute: number;
  /** Segundos adicionais dentro do minuto (0–59). */
  second?: number;
  status: "upcoming" | "live" | "finished";
  /** Seção da partida: primeiro tempo, segundo tempo, prorrogação. */
  gameSection?: "firstHalf" | "secondHalf" | "extraTimeFirstHalf" | "extraTimeSecondHalf";
  score?: MatchScore;
}

export interface Prediction {
  id: string;
  matchId: string;
  question: string;
  options: string[];
  correctOption?: number;
  expiresAt: string;
}

export interface PressureBarState {
  /** Posse de bola do time A em % (0–100). */
  teamA: number;
  /** Posse de bola do time B em % (0–100). */
  teamB: number;
}

// ---------------------------------------------------------------------------
// Dados de tracking posicional (Positions_Bayern_Hamburg.xml)
// ---------------------------------------------------------------------------

/**
 * Posição de um jogador ou da bola em um frame de tracking.
 * Coordenadas em metros, origem no centro do campo.
 * X: -52.5 (gol esquerdo) → +52.5 (gol direito)
 * Y: -34 (linha inferior) → +34 (linha superior)
 */
export interface PlayerPosition {
  /** ID do jogador (ex.: "DFL-OBJ-000001") ou "ball" para a bola. */
  personId: string;
  /** ID do time ao qual o jogador pertence. */
  teamId: string;
  /** Número da camisa (para exibição). */
  shirtNumber?: number;
  /** Posição X em metros (centro do campo = 0). */
  x: number;
  /** Posição Y em metros (centro do campo = 0). */
  y: number;
  /** Velocidade em m/s. */
  speed: number;
  /** Número do frame de tracking. */
  frameN: number;
  /** Timestamp ISO do frame. */
  timestamp: string;
}

/**
 * Snapshot de posições de todos os jogadores em campo em um dado frame.
 */
export interface PositionsFrame {
  frameN: number;
  timestamp: string;
  gameSection: "firstHalf" | "secondHalf";
  players: PlayerPosition[];
  /** Posição da bola, se disponível. */
  ball?: { x: number; y: number; speed: number };
}

// ---------------------------------------------------------------------------
// Eventos de partida (Events_Anonym.xml / kpi_data_Bayern_Hamburg.xml)
// ---------------------------------------------------------------------------

export type MatchEventType =
  | "goal"
  | "shot"
  | "foul"
  | "yellowCard"
  | "redCard"
  | "corner"
  | "freeKick"
  | "throwIn"
  | "kickOff"
  | "substitution"
  | "other";

export interface MatchEvent {
  /** ID único do evento (ex.: "18902400000048"). */
  eventId: string;
  matchId: string;
  type: MatchEventType;
  /** Minuto da partida em que ocorreu. */
  minute: number;
  /** Segundo dentro do minuto. */
  second?: number;
  /** ID do time que originou o evento. */
  teamId: string;
  /** ID do jogador principal do evento. */
  playerId?: string;
  /** Nome curto do jogador para exibição. */
  playerName?: string;
  /** Posição X no campo em metros. */
  x?: number;
  /** Posição Y no campo em metros. */
  y?: number;
  /** xG (expected goals) para chutes. */
  xG?: number;
  /** Resultado atual após o evento (ex.: "1:0"). */
  currentResult?: string;
  /** Seção da partida. */
  gameSection?: "firstHalf" | "secondHalf";
  /** Timestamp ISO do evento. */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// KPIs agregados por time (calculados a partir do kpi_data)
// ---------------------------------------------------------------------------

export interface TeamKpis {
  teamId: string;
  /** Posse de bola em % (0–100). */
  possession: number;
  /** Total de passes tentados. */
  totalPasses: number;
  /** Passes completados. */
  completedPasses: number;
  /** xG acumulado (expected goals). */
  xG: number;
  /** Chutes ao gol. */
  shotsOnTarget: number;
  /** Total de chutes. */
  totalShots: number;
  /** Faltas cometidas. */
  fouls: number;
  /** Cartões amarelos. */
  yellowCards: number;
  /** Cartões vermelhos. */
  redCards: number;
}
