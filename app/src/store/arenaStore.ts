import { create } from "zustand";

import type {
  Match,
  MatchEvent,
  PositionsFrame,
  Prediction,
  PressureBarState,
  TeamKpis,
} from "../types";

export type AnswerSendState =
  | { state: "idle" }
  | { state: "sent"; predictionId: string }
  | { state: "accepted"; predictionId: string }
  | { state: "rejected"; predictionId: string; reason: string }
  | { state: "transport-failed"; predictionId: string };

export interface UserScore {
  score: number;
  correctCount: number;
  wrongCount: number;
}

export interface ArenaState {
  match: Match | null;
  pressureBar: PressureBarState;
  activePrediction: Prediction | null;
  /** Predições já respondidas com sucesso de transporte nesta sessão. */
  answeredPredictionIds: string[];
  /** Última predição cuja entrega falhou no transporte (WS desconectado). */
  lastSendFailure: { predictionId: string } | null;
  myScore: UserScore;

  /** Frame de posições mais recente recebido via PLAYER_POSITIONS. */
  positionsFrame: PositionsFrame | null;
  /**
   * Fila dos últimos eventos de partida (máx. MAX_EVENTS_HISTORY).
   * Ordenada do mais antigo para o mais recente.
   */
  recentEvents: MatchEvent[];
  /** KPIs do time da casa (home). */
  homeKpis: TeamKpis | null;
  /** KPIs do time visitante (guest). */
  guestKpis: TeamKpis | null;

  setMatch: (match: Match) => void;
  setActivePrediction: (prediction: Prediction | null) => void;
  updatePressure: (pressureBar: PressureBarState) => void;
  markAnswered: (predictionId: string) => void;
  markSendFailure: (predictionId: string) => void;
  clearSendFailure: () => void;
  setMyScore: (score: UserScore) => void;
  setPositionsFrame: (frame: PositionsFrame) => void;
  addMatchEvent: (event: MatchEvent) => void;
  setTeamKpis: (home: TeamKpis, guest: TeamKpis) => void;
  reset: () => void;
}

export const INITIAL_PRESSURE: PressureBarState = { teamA: 50, teamB: 50 };
export const INITIAL_SCORE: UserScore = {
  score: 0,
  correctCount: 0,
  wrongCount: 0,
};

/** Quantos eventos recentes manter no histórico. */
const MAX_EVENTS_HISTORY = 20;

export const useArenaStore = create<ArenaState>((set) => ({
  match: null,
  pressureBar: INITIAL_PRESSURE,
  activePrediction: null,
  answeredPredictionIds: [],
  lastSendFailure: null,
  myScore: INITIAL_SCORE,
  positionsFrame: null,
  recentEvents: [],
  homeKpis: null,
  guestKpis: null,

  setMatch: (match) => set({ match }),
  setActivePrediction: (prediction) => set({ activePrediction: prediction }),
  updatePressure: (pressureBar) => set({ pressureBar }),

  markAnswered: (predictionId) =>
    set((s) =>
      s.answeredPredictionIds.includes(predictionId)
        ? s
        : { answeredPredictionIds: [...s.answeredPredictionIds, predictionId] },
    ),

  markSendFailure: (predictionId) =>
    set({ lastSendFailure: { predictionId } }),

  clearSendFailure: () => set({ lastSendFailure: null }),

  setMyScore: (myScore) => set({ myScore }),

  setPositionsFrame: (frame) => set({ positionsFrame: frame }),

  addMatchEvent: (event) =>
    set((s) => {
      const updated = [...s.recentEvents, event];
      return {
        recentEvents:
          updated.length > MAX_EVENTS_HISTORY
            ? updated.slice(updated.length - MAX_EVENTS_HISTORY)
            : updated,
      };
    }),

  setTeamKpis: (home, guest) => set({ homeKpis: home, guestKpis: guest }),

  reset: () =>
    set({
      match: null,
      pressureBar: INITIAL_PRESSURE,
      activePrediction: null,
      answeredPredictionIds: [],
      lastSendFailure: null,
      myScore: INITIAL_SCORE,
      positionsFrame: null,
      recentEvents: [],
      homeKpis: null,
      guestKpis: null,
    }),
}));
