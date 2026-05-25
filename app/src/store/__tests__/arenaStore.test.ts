import {
  INITIAL_PRESSURE,
  INITIAL_SCORE,
  useArenaStore,
} from "../arenaStore";
import type { Match, MatchEvent, PositionsFrame, Prediction, TeamKpis } from "../../types";

const matchFixture: Match = {
  id: "match-001",
  teamA: { id: "team-a", name: "Time A", color: "#E63946" },
  teamB: { id: "team-b", name: "Time B", color: "#1D3557" },
  minute: 12,
  status: "live",
};

const predictionFixture: Prediction = {
  id: "pred-001",
  matchId: "match-001",
  question: "Vai sair gol?",
  options: ["Sim", "Não"],
  expiresAt: "2025-01-01T00:00:00.000Z",
};

describe("arenaStore", () => {
  beforeEach(() => {
    useArenaStore.getState().reset();
  });

  it("starts with neutral pressure, no match and zeroed score", () => {
    const state = useArenaStore.getState();
    expect(state.match).toBeNull();
    expect(state.activePrediction).toBeNull();
    expect(state.pressureBar).toEqual(INITIAL_PRESSURE);
    expect(state.answeredPredictionIds).toEqual([]);
    expect(state.lastSendFailure).toBeNull();
    expect(state.myScore).toEqual(INITIAL_SCORE);
  });

  it("setMatch updates only the match field", () => {
    useArenaStore.getState().setMatch(matchFixture);
    const state = useArenaStore.getState();
    expect(state.match).toBe(matchFixture);
    expect(state.pressureBar).toEqual(INITIAL_PRESSURE);
  });

  it("setActivePrediction toggles the modal payload", () => {
    useArenaStore.getState().setActivePrediction(predictionFixture);
    expect(useArenaStore.getState().activePrediction).toBe(predictionFixture);
    useArenaStore.getState().setActivePrediction(null);
    expect(useArenaStore.getState().activePrediction).toBeNull();
  });

  it("updatePressure replaces pressure bar values", () => {
    useArenaStore.getState().updatePressure({ teamA: 70, teamB: 30 });
    expect(useArenaStore.getState().pressureBar).toEqual({
      teamA: 70,
      teamB: 30,
    });
  });

  it("markAnswered keeps only one entry per predictionId", () => {
    const store = useArenaStore.getState();
    store.markAnswered("pred-001");
    store.markAnswered("pred-001");
    store.markAnswered("pred-002");
    expect(useArenaStore.getState().answeredPredictionIds).toEqual([
      "pred-001",
      "pred-002",
    ]);
  });

  it("markSendFailure / clearSendFailure round-trips the failed prediction", () => {
    useArenaStore.getState().markSendFailure("pred-001");
    expect(useArenaStore.getState().lastSendFailure).toEqual({
      predictionId: "pred-001",
    });
    useArenaStore.getState().clearSendFailure();
    expect(useArenaStore.getState().lastSendFailure).toBeNull();
  });

  it("setMyScore replaces the cached user score", () => {
    useArenaStore.getState().setMyScore({
      score: 30,
      correctCount: 3,
      wrongCount: 1,
    });
    expect(useArenaStore.getState().myScore).toEqual({
      score: 30,
      correctCount: 3,
      wrongCount: 1,
    });
  });

  it("reset wipes match, prediction, score and restores neutral pressure", () => {
    const store = useArenaStore.getState();
    store.setMatch(matchFixture);
    store.setActivePrediction(predictionFixture);
    store.updatePressure({ teamA: 99, teamB: 1 });
    store.markAnswered("pred-001");
    store.markSendFailure("pred-001");
    store.setMyScore({ score: 50, correctCount: 5, wrongCount: 0 });

    store.reset();

    const state = useArenaStore.getState();
    expect(state.match).toBeNull();
    expect(state.activePrediction).toBeNull();
    expect(state.pressureBar).toEqual(INITIAL_PRESSURE);
    expect(state.answeredPredictionIds).toEqual([]);
    expect(state.lastSendFailure).toBeNull();
    expect(state.myScore).toEqual(INITIAL_SCORE);
    expect(state.positionsFrame).toBeNull();
    expect(state.recentEvents).toEqual([]);
    expect(state.homeKpis).toBeNull();
    expect(state.guestKpis).toBeNull();
  });

  // ── Novos campos: tracking posicional ──────────────────────────────────

  it("setPositionsFrame stores the latest frame", () => {
    const frame: PositionsFrame = {
      frameN: 10001,
      timestamp: "2025-01-01T16:30:17.080Z",
      gameSection: "firstHalf",
      players: [
        {
          personId: "DFL-OBJ-000001",
          teamId: "DFL-CLU-000001",
          shirtNumber: 1,
          x: 0.21,
          y: -9.3,
          speed: 0.18,
          frameN: 10001,
          timestamp: "2025-01-01T16:30:17.080Z",
        },
      ],
      ball: { x: 0, y: 0, speed: 0 },
    };
    useArenaStore.getState().setPositionsFrame(frame);
    expect(useArenaStore.getState().positionsFrame).toBe(frame);
  });

  it("addMatchEvent appends events and caps at MAX_EVENTS_HISTORY (20)", () => {
    const store = useArenaStore.getState();
    for (let i = 0; i < 25; i++) {
      const event: MatchEvent = {
        eventId: `ev-${i}`,
        matchId: "match-001",
        type: "foul",
        minute: i,
        teamId: "team-a",
        timestamp: new Date().toISOString(),
      };
      store.addMatchEvent(event);
    }
    const { recentEvents } = useArenaStore.getState();
    expect(recentEvents.length).toBe(20);
    // Os 20 mais recentes devem ser os últimos 20 inseridos (ev-5 a ev-24)
    expect(recentEvents[0].eventId).toBe("ev-5");
    expect(recentEvents[19].eventId).toBe("ev-24");
  });

  it("setTeamKpis stores home and guest KPIs", () => {
    const homeKpis: TeamKpis = {
      teamId: "team-a",
      possession: 60,
      totalPasses: 300,
      completedPasses: 250,
      xG: 1.8,
      shotsOnTarget: 4,
      totalShots: 8,
      fouls: 10,
      yellowCards: 1,
      redCards: 0,
    };
    const guestKpis: TeamKpis = {
      teamId: "team-b",
      possession: 40,
      totalPasses: 200,
      completedPasses: 160,
      xG: 0.6,
      shotsOnTarget: 2,
      totalShots: 5,
      fouls: 14,
      yellowCards: 2,
      redCards: 0,
    };
    useArenaStore.getState().setTeamKpis(homeKpis, guestKpis);
    expect(useArenaStore.getState().homeKpis).toEqual(homeKpis);
    expect(useArenaStore.getState().guestKpis).toEqual(guestKpis);
  });
});
