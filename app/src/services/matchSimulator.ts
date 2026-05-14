import type { Match, Prediction } from "../types";

function notImplemented(fn: string, plano: string): never {
  throw new Error(
    `[matchSimulator.${fn}] não implementado — responsável: ${plano}`,
  );
}

export function startMockMatch(_matchId: string): Match {
  return notImplemented("startMockMatch", "Plano 03/04");
}

export function emitMockPrediction(_matchId: string): Prediction {
  return notImplemented("emitMockPrediction", "Plano 03/04");
}
