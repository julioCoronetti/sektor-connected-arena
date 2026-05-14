import type { Match, Prediction, PressureBarState } from "../types";

export type ServerMessage =
  | { type: "MATCH_STATE"; match: Match; pressureBar: PressureBarState }
  | { type: "PREDICTION"; prediction: Prediction }
  | { type: "PRESSURE_UPDATE"; pressureBar: PressureBarState }
  | { type: "PREDICTION_RESULT"; predictionId: string; correctOption: number };

export type ClientMessage = {
  type: "ANSWER";
  predictionId: string;
  selectedOption: number;
  gpsMultiplier: number;
};

export type ServerMessageType = ServerMessage["type"];

const SERVER_MESSAGE_TYPES: ServerMessageType[] = [
  "MATCH_STATE",
  "PREDICTION",
  "PRESSURE_UPDATE",
  "PREDICTION_RESULT",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPressureBar(value: unknown): value is PressureBarState {
  return (
    isObject(value) &&
    typeof value.teamA === "number" &&
    typeof value.teamB === "number"
  );
}

function isMatch(value: unknown): value is Match {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.minute !== "number") return false;
  if (
    value.status !== "upcoming" &&
    value.status !== "live" &&
    value.status !== "finished"
  ) {
    return false;
  }
  const teamA = value.teamA;
  const teamB = value.teamB;
  return (
    isObject(teamA) &&
    typeof teamA.id === "string" &&
    typeof teamA.name === "string" &&
    typeof teamA.color === "string" &&
    isObject(teamB) &&
    typeof teamB.id === "string" &&
    typeof teamB.name === "string" &&
    typeof teamB.color === "string"
  );
}

function isPrediction(value: unknown): value is Prediction {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string") return false;
  if (typeof value.matchId !== "string") return false;
  if (typeof value.question !== "string") return false;
  if (typeof value.expiresAt !== "string") return false;
  if (!Array.isArray(value.options)) return false;
  if (!value.options.every((option) => typeof option === "string")) return false;
  if (
    value.correctOption !== undefined &&
    typeof value.correctOption !== "number"
  ) {
    return false;
  }
  return true;
}

/**
 * Valida e estreita uma mensagem JSON arbitrária para o tipo `ServerMessage`.
 * Retorna `null` quando a mensagem não respeita o contrato.
 */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (!isObject(raw)) return null;
  const type = raw.type;
  if (typeof type !== "string") return null;
  if (!SERVER_MESSAGE_TYPES.includes(type as ServerMessageType)) return null;

  switch (type as ServerMessageType) {
    case "MATCH_STATE":
      if (!isMatch(raw.match) || !isPressureBar(raw.pressureBar)) return null;
      return {
        type: "MATCH_STATE",
        match: raw.match,
        pressureBar: raw.pressureBar,
      };
    case "PREDICTION":
      if (!isPrediction(raw.prediction)) return null;
      return { type: "PREDICTION", prediction: raw.prediction };
    case "PRESSURE_UPDATE":
      if (!isPressureBar(raw.pressureBar)) return null;
      return { type: "PRESSURE_UPDATE", pressureBar: raw.pressureBar };
    case "PREDICTION_RESULT":
      if (
        typeof raw.predictionId !== "string" ||
        typeof raw.correctOption !== "number"
      ) {
        return null;
      }
      return {
        type: "PREDICTION_RESULT",
        predictionId: raw.predictionId,
        correctOption: raw.correctOption,
      };
  }
}

export function buildAnswerMessage(input: {
  predictionId: string;
  selectedOption: number;
  gpsMultiplier?: number;
}): ClientMessage {
  return {
    type: "ANSWER",
    predictionId: input.predictionId,
    selectedOption: input.selectedOption,
    gpsMultiplier: input.gpsMultiplier ?? 1,
  };
}
