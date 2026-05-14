import type { Match, Prediction, PressureBarState } from "../types";

export const MOCK_MATCH: Match = {
  id: "match-001",
  teamA: { id: "team-a", name: "Time A", color: "#E63946" },
  teamB: { id: "team-b", name: "Time B", color: "#1D3557" },
  minute: 23,
  status: "live",
};

export const MOCK_PREDICTIONS: Prediction[] = [
  {
    id: "pred-001",
    matchId: "match-001",
    question: "O escanteio vai resultar em gol?",
    options: [
      "Sim, gol direto",
      "Cabeçada na área",
      "Defesa do goleiro",
      "Para fora",
    ],
    expiresAt: new Date(0).toISOString(),
  },
  {
    id: "pred-002",
    matchId: "match-001",
    question: "Quem vai cobrar a falta perigosa?",
    options: [
      "Jogador #10",
      "Jogador #7",
      "Jogador #4",
      "Ninguém (barreira)",
    ],
    expiresAt: new Date(0).toISOString(),
  },
];

export const PREDICTION_INTERVAL_MS = 20_000;
export const PREDICTION_TTL_MS = 15_000;
export const PRESSURE_DELAY_MS = 5_000;

/**
 * Emite predições mockadas e atualizações de pressão para validar o fluxo do
 * Modo Arena sem o Pipeline AWS (Plano 04).
 *
 * Retorna a função para parar o simulador.
 */
export function startMockSimulator(
  onPrediction: (p: Prediction) => void,
  onPressure: (ps: PressureBarState) => void,
): () => void {
  let index = 0;
  const pressureTimers = new Set<ReturnType<typeof setTimeout>>();

  const interval = setInterval(() => {
    const template = MOCK_PREDICTIONS[index % MOCK_PREDICTIONS.length];
    const now = Date.now();
    onPrediction({
      ...template,
      id: `pred-${now}`,
      expiresAt: new Date(now + PREDICTION_TTL_MS).toISOString(),
    });
    index += 1;

    const pressureTimer = setTimeout(() => {
      pressureTimers.delete(pressureTimer);
      onPressure({
        teamA: 40 + Math.random() * 20,
        teamB: 40 + Math.random() * 20,
      });
    }, PRESSURE_DELAY_MS);
    pressureTimers.add(pressureTimer);
  }, PREDICTION_INTERVAL_MS);

  return () => {
    clearInterval(interval);
    for (const timer of pressureTimers) clearTimeout(timer);
    pressureTimers.clear();
  };
}
