import {
  PREDICTION_INTERVAL_MS,
  PREDICTION_TTL_MS,
  PRESSURE_DELAY_MS,
  startMockSimulator,
} from "../matchSimulator";

describe("startMockSimulator", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("emits predictions on the configured interval with a fresh expiry", () => {
    const onPrediction = jest.fn();
    const onPressure = jest.fn();

    const stop = startMockSimulator(onPrediction, onPressure);

    jest.advanceTimersByTime(PREDICTION_INTERVAL_MS);
    expect(onPrediction).toHaveBeenCalledTimes(1);
    const first = onPrediction.mock.calls[0][0];
    expect(typeof first.id).toBe("string");
    expect(first.id.startsWith("pred-")).toBe(true);
    expect(new Date(first.expiresAt).getTime()).toBe(
      Date.now() + PREDICTION_TTL_MS,
    );

    jest.advanceTimersByTime(PREDICTION_INTERVAL_MS);
    expect(onPrediction).toHaveBeenCalledTimes(2);
    const second = onPrediction.mock.calls[1][0];
    expect(second.id).not.toBe(first.id);

    stop();
  });

  it("emits a pressure update PRESSURE_DELAY_MS after each prediction", () => {
    const onPrediction = jest.fn();
    const onPressure = jest.fn();

    const stop = startMockSimulator(onPrediction, onPressure);

    jest.advanceTimersByTime(PREDICTION_INTERVAL_MS);
    expect(onPressure).not.toHaveBeenCalled();

    jest.advanceTimersByTime(PRESSURE_DELAY_MS);
    expect(onPressure).toHaveBeenCalledTimes(1);
    const ps = onPressure.mock.calls[0][0];
    expect(typeof ps.teamA).toBe("number");
    expect(typeof ps.teamB).toBe("number");
    expect(ps.teamA).toBeGreaterThanOrEqual(40);
    expect(ps.teamA).toBeLessThanOrEqual(60);

    stop();
  });

  it("stop() cancels future emissions and pending pressure updates", () => {
    const onPrediction = jest.fn();
    const onPressure = jest.fn();

    const stop = startMockSimulator(onPrediction, onPressure);

    jest.advanceTimersByTime(PREDICTION_INTERVAL_MS);
    expect(onPrediction).toHaveBeenCalledTimes(1);

    stop();

    jest.advanceTimersByTime(
      PREDICTION_INTERVAL_MS + PRESSURE_DELAY_MS + 1_000,
    );
    expect(onPrediction).toHaveBeenCalledTimes(1);
    expect(onPressure).not.toHaveBeenCalled();
  });
});
