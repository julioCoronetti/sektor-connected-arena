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

  // ── Novos tipos de mensagem ──────────────────────────────────────────────

  const validPlayerPosition = {
    personId: "DFL-OBJ-000001",
    teamId: "DFL-CLU-000001",
    shirtNumber: 1,
    x: 0.21,
    y: -9.3,
    speed: 0.18,
    frameN: 10001,
    timestamp: "2025-01-01T16:30:17.080Z",
  };

  const validPositionsFrame = {
    frameN: 10001,
    timestamp: "2025-01-01T16:30:17.080Z",
    gameSection: "firstHalf",
    players: [validPlayerPosition],
    ball: { x: 0, y: 0, speed: 0 },
  };

  it("parses a PLAYER_POSITIONS payload", () => {
    const result = parseServerMessage({
      type: "PLAYER_POSITIONS",
      frame: validPositionsFrame,
    });
    expect(result).toEqual({
      type: "PLAYER_POSITIONS",
      frame: validPositionsFrame,
    });
  });

  it("returns null for PLAYER_POSITIONS with invalid frame", () => {
    expect(
      parseServerMessage({
        type: "PLAYER_POSITIONS",
        frame: { ...validPositionsFrame, gameSection: "halftime" },
      }),
    ).toBeNull();

    expect(
      parseServerMessage({
        type: "PLAYER_POSITIONS",
        frame: {
          ...validPositionsFrame,
          players: [{ ...validPlayerPosition, x: "not-a-number" }],
        },
      }),
    ).toBeNull();
  });

  const validMatchEvent = {
    eventId: "18902400000048",
    matchId: "DFL-MAT-111111",
    type: "goal",
    minute: 2,
    second: 40,
    teamId: "DFL-CLU-000001",
    playerId: "DFL-OBJ-000005",
    playerName: "S. Fünf",
    x: 6.11,
    y: 51.65,
    xG: 0.0308,
    currentResult: "1:0",
    gameSection: "firstHalf",
    timestamp: "2025-01-01T16:32:57.129Z",
  };

  it("parses a MATCH_EVENT payload", () => {
    const result = parseServerMessage({
      type: "MATCH_EVENT",
      event: validMatchEvent,
    });
    expect(result).toEqual({ type: "MATCH_EVENT", event: validMatchEvent });
  });

  it("returns null for MATCH_EVENT with unknown event type", () => {
    expect(
      parseServerMessage({
        type: "MATCH_EVENT",
        event: { ...validMatchEvent, type: "offside" },
      }),
    ).toBeNull();
  });

  const validTeamKpis = {
    teamId: "DFL-CLU-000001",
    possession: 60.5,
    totalPasses: 300,
    completedPasses: 250,
    xG: 1.8,
    shotsOnTarget: 4,
    totalShots: 8,
    fouls: 10,
    yellowCards: 1,
    redCards: 0,
  };

  it("parses a TEAM_KPIS payload", () => {
    const guestKpis = { ...validTeamKpis, teamId: "DFL-CLU-000002", possession: 39.5 };
    const result = parseServerMessage({
      type: "TEAM_KPIS",
      home: validTeamKpis,
      guest: guestKpis,
    });
    expect(result).toEqual({
      type: "TEAM_KPIS",
      home: validTeamKpis,
      guest: guestKpis,
    });
  });

  it("returns null for TEAM_KPIS with missing fields", () => {
    expect(
      parseServerMessage({
        type: "TEAM_KPIS",
        home: { ...validTeamKpis, possession: "sixty" },
        guest: validTeamKpis,
      }),
    ).toBeNull();
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
