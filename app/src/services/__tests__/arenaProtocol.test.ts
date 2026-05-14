import {
  buildAnswerMessage,
  parseServerMessage,
} from "../arenaProtocol";

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
    const result = parseServerMessage({
      type: "MATCH_STATE",
      match: validMatch,
      pressureBar: { teamA: 60, teamB: 40 },
    });
    expect(result).toEqual({
      type: "MATCH_STATE",
      match: validMatch,
      pressureBar: { teamA: 60, teamB: 40 },
    });
  });

  it("parses a PREDICTION payload", () => {
    const result = parseServerMessage({
      type: "PREDICTION",
      prediction: validPrediction,
    });
    expect(result).toEqual({
      type: "PREDICTION",
      prediction: validPrediction,
    });
  });

  it("parses a PRESSURE_UPDATE payload", () => {
    const result = parseServerMessage({
      type: "PRESSURE_UPDATE",
      pressureBar: { teamA: 30, teamB: 70 },
    });
    expect(result).toEqual({
      type: "PRESSURE_UPDATE",
      pressureBar: { teamA: 30, teamB: 70 },
    });
  });

  it("parses a PREDICTION_RESULT payload", () => {
    const result = parseServerMessage({
      type: "PREDICTION_RESULT",
      predictionId: "pred-001",
      correctOption: 2,
    });
    expect(result).toEqual({
      type: "PREDICTION_RESULT",
      predictionId: "pred-001",
      correctOption: 2,
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
    { type: "PREDICTION" }, // sem prediction
    { type: "PRESSURE_UPDATE", pressureBar: { teamA: "x", teamB: 10 } },
    { type: "MATCH_STATE", match: validMatch }, // sem pressureBar
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
      // correctOption ausente
    },
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
