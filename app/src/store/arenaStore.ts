import { create } from "zustand";

import type { Match, Prediction, PressureBarState } from "../types";

export interface ArenaState {
  match: Match | null;
  pressureBar: PressureBarState;
  activePrediction: Prediction | null;
  setMatch: (match: Match) => void;
  setActivePrediction: (prediction: Prediction | null) => void;
  updatePressure: (pressureBar: PressureBarState) => void;
  reset: () => void;
}

export const INITIAL_PRESSURE: PressureBarState = { teamA: 50, teamB: 50 };

export const useArenaStore = create<ArenaState>((set) => ({
  match: null,
  pressureBar: INITIAL_PRESSURE,
  activePrediction: null,

  setMatch: (match) => set({ match }),
  setActivePrediction: (prediction) => set({ activePrediction: prediction }),
  updatePressure: (pressureBar) => set({ pressureBar }),
  reset: () =>
    set({
      match: null,
      pressureBar: INITIAL_PRESSURE,
      activePrediction: null,
    }),
}));
