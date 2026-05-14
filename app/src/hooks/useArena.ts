import type { Match, Prediction, PressureBarState } from "../types";

export interface UseArenaResult {
  match: Match | null;
  pressure: PressureBarState;
  activePrediction: Prediction | null;
  submitAnswer: (predictionId: string, optionIndex: number) => void;
}

export function useArena(_matchId: string): UseArenaResult {
  throw new Error("[useArena] não implementado — responsável: Plano 03");
}
