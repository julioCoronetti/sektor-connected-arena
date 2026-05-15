import { buildAnswerMessage, parseServerMessage } from "../arenaProtocol";

const validMatch = {
  id: "match-001",
  teamA: { id: "team-a", name: "Time A", color: "#E63946" },
  teamB: { id: "team-b", name: "Time B", color: "#1D3557" },
  minute: 10,
  status: "live",
};

const validPrediction = {
  id: "pred-001",
  matchId: "match-001",
  question: "Vai sair gol?",
  options: ["Sim", "Não"],
  expiresAt: "2025-01-01T00:00:00.000Z",
};

describe("arenaProtocol.parseServerMessage", () => {
  it("parses a MATCH_STATE payload", () => {
    expect(
      parseServerMessage({
        type: "MATCH_STATE",
        match: validMatch,
        pressureBar: { teamA: 60, teamB: 40 },
      }),
    ).toEqual({
      type: "MATCH_STATE",
      match: validMatch,
      pressureBar: { teamA: 60, teamB: 40 },
    });
  });

  it("parses a PREDICTION payload", () => {
    expect(
      parseServerMessage({
        type: "PREDICTION",
        prediction: validPrediction,
      }),
    ).toEqual({
      type: "PREDICTION",
      prediction: validPrediction,
    });
  });

  it("parses a PRESSURE_UPDATE payload", () => {
    expect(
      parseServerMessage({
        type: "PRESSURE_UPDATE",
        pressureBar: { teamA: 30, teamB: 70 },
      }),
    ).toEqual({
      type: "PRESSURE_UPDATE",
      pressureBar: { teamA: 30, teamB: 70 },
    });
  });

  it("parses a PREDICTION_RESULT payload", () => {
    expect(
      parseServerMessage({
        type: "PREDICTION_RESULT",
        predictionId: "pred-001",
        correctOption: 2,
      }),
    ).toEqual({
      type: "PREDICTION_RESULT",
      predictionId: "pred-001",
      correctOption: 2,
    });
  });

  it("parses a SCORE_UPDATE payload", () => {
    expect(
      parseServerMessage({
        type: "SCORE_UPDATE",
        userId: "user-1",
        score: 30,
        correctCount: 3,
        wrongCount: 1,
      }),
    ).toEqual({
      type: "SCORE_UPDATE",
      userId: "user-1",
      score: 30,
      correctCount: 3,
      wrongCount: 1,
    });
  });

  it("parses ANSWER_ACCEPTED and ANSWER_REJECTED payloads", () => {
    expect(
      parseServerMessage({ type: "ANSWER_ACCEPTED", predictionId: "pred-1" }),
    ).toEqual({ type: "ANSWER_ACCEPTED", predictionId: "pred-1" });

    expect(
      parseServerMessage({
        type: "ANSWER_REJECTED",
        predictionId: "pred-1",
        reason: "DUPLICATE",
      }),
    ).toEqual({
      type: "ANSWER_REJECTED",
      predictionId: "pred-1",
      reason: "DUPLICATE",
    });

    expect(
      parseServerMessage({ type: "ANSWER_REJECTED", reason: "UNAUTHORIZED" }),
    ).toEqual({
      type: "ANSWER_REJECTED",
      predictionId: undefined,
      reason: "UNAUTHORIZED",
    });
  });

  it.each([
    null,
    undefined,
    "string",
    42,
    [],
    {},
    { type: "UNKNOWN" },
    { type: "PREDICTION" },
    { type: "PRESSURE_UPDATE", pressureBar: { teamA: "x", teamB: 10 } },
    { type: "MATCH_STATE", match: validMatch },
    {
      type: "MATCH_STATE",
      match: { ...validMatch, status: "broken" },
      pressureBar: { teamA: 1, teamB: 1 },
    },
    {
      type: "PREDICTION",
      prediction: { ...validPrediction, options: ["ok", 42] },
    },
    {
      type: "PREDICTION_RESULT",
      predictionId: "pred-001",
    },
    { type: "SCORE_UPDATE", userId: "u", score: 1, correctCount: 1 },
    { type: "ANSWER_REJECTED", reason: "WHAT" },
    { type: "ANSWER_ACCEPTED" },
  ])("returns null for invalid payload: %p", (payload) => {
    expect(parseServerMessage(payload as unknown)).toBeNull();
  });
});

describe("arenaProtocol.buildAnswerMessage", () => {
  it("defaults gpsMultiplier to 1", () => {
    expect(
      buildAnswerMessage({ predictionId: "pred-001", selectedOption: 0 }),
    ).toEqual({
      type: "ANSWER",
      predictionId: "pred-001",
      selectedOption: 0,
      gpsMultiplier: 1,
    });
  });

  it("preserves explicit gpsMultiplier", () => {
    expect(
      buildAnswerMessage({
        predictionId: "pred-001",
        selectedOption: 2,
        gpsMultiplier: 2,
      }),
    ).toEqual({
      type: "ANSWER",
      predictionId: "pred-001",
      selectedOption: 2,
      gpsMultiplier: 2,
    });
  });
});
