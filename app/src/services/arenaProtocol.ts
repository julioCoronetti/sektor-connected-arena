import type { Match, Prediction, PressureBarState } from "../types";

export interface UserScore {
  userId: string;
  score: number;
  correctCount: number;
  wrongCount: number;
}

export type AnswerRejectReason =
  | "UNAUTHORIZED"
  | "DUPLICATE"
  | "INVALID_OPTION";

export type ServerMessage =
  | { type: "MATCH_STATE"; match: Match; pressureBar: PressureBarState }
  | { type: "PREDICTION"; prediction: Prediction }
  | { type: "PRESSURE_UPDATE"; pressureBar: PressureBarState }
  | { type: "PREDICTION_RESULT"; predictionId: string; correctOption: number }
  | { type: "SCORE_UPDATE"; userId: string; score: number; correctCount: number; wrongCount: number }
  | { type: "ANSWER_ACCEPTED"; predictionId: string }
  | { type: "ANSWER_REJECTED"; predictionId?: string; reason: AnswerRejectReason };

export type ClientMessage = {
  type: "ANSWER";
  predictionId: string;
  selectedOption: number;
  gpsMultiplier: 1 | 2;
};

export type ServerMessageType = ServerMessage["type"];

const SERVER_MESSAGE_TYPES: ServerMessageType[] = [
  "MATCH_STATE",
  "PREDICTION",
  "PRESSURE_UPDATE",
  "PREDICTION_RESULT",
  "SCORE_UPDATE",
  "ANSWER_ACCEPTED",
  "ANSWER_REJECTED",
];

const ANSWER_REJECT_REASONS: AnswerRejectReason[] = [
  "UNAUTHORIZED",
  "DUPLICATE",
  "INVALID_OPTION",
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
    case "SCORE_UPDATE":
      if (
        typeof raw.userId !== "string" ||
        typeof raw.score !== "number" ||
        typeof raw.correctCount !== "number" ||
        typeof raw.wrongCount !== "number"
      ) {
        return null;
      }
      return {
        type: "SCORE_UPDATE",
        userId: raw.userId,
        score: raw.score,
        correctCount: raw.correctCount,
        wrongCount: raw.wrongCount,
      };
    case "ANSWER_ACCEPTED":
      if (typeof raw.predictionId !== "string") return null;
      return { type: "ANSWER_ACCEPTED", predictionId: raw.predictionId };
    case "ANSWER_REJECTED": {
      if (
        typeof raw.reason !== "string" ||
        !ANSWER_REJECT_REASONS.includes(raw.reason as AnswerRejectReason)
      ) {
        return null;
      }
      const predictionId =
        typeof raw.predictionId === "string" ? raw.predictionId : undefined;
      return {
        type: "ANSWER_REJECTED",
        predictionId,
        reason: raw.reason as AnswerRejectReason,
      };
    }
  }
}

export function buildAnswerMessage(input: {
  predictionId: string;
  selectedOption: number;
  gpsMultiplier?: 1 | 2;
}): ClientMessage {
  return {
    type: "ANSWER",
    predictionId: input.predictionId,
    selectedOption: input.selectedOption,
    gpsMultiplier: input.gpsMultiplier ?? 1,
  };
}
