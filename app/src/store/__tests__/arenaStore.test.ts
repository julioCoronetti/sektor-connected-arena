import {
  INITIAL_PRESSURE,
  INITIAL_SCORE,
  useArenaStore,
} from "../arenaStore";
import type { Match, Prediction } from "../../types";

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
  });
});
