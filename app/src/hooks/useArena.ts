import type { Match, Prediction, PressureBarState } from "../types";

export interface UseArenaResult {
  match: Match | null;
  pressure: PressureBarState;
  activePrediction: Prediction | null;
  submitAnswer: (predictionId: string, optionIndex: number) => void;
}

// O Plano 03 utiliza o hook integrado em arena/[matchId].tsx + arenaStore.
// Esta função permanece disponível como API de conveniência para os planos
// seguintes; ainda não há consumidor no Plano 03.
export function useArena(_matchId: string): UseArenaResult {
  throw new Error(
    "[useArena] não implementado neste plano — consumir useArenaStore diretamente.",
  );
}
