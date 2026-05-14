import type { Match, Prediction, PressureBarState } from "../types";

export interface ArenaState {
  match: Match | null;
  pressureBar: PressureBarState;
  activePrediction: Prediction | null;
  submitAnswer: (predictionId: string, optionIndex: number) => void;
  updatePressure: (next: PressureBarState) => void;
}

export function useArenaStore(): ArenaState {
  throw new Error("[useArenaStore] não implementado — responsável: Plano 03");
}
