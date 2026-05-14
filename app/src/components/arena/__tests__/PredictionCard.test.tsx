import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";

import type { Prediction } from "../../../types";
import { PredictionCard } from "../PredictionCard";

const prediction: Prediction = {
  id: "pred-001",
  matchId: "match-001",
  question: "Sai gol?",
  options: ["Sim", "Não"],
  expiresAt: "2025-01-01T00:00:00.000Z",
};

describe("PredictionCard", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders nothing when prediction is null", () => {
    const tree = render(
      <PredictionCard
        prediction={null}
        onAnswer={jest.fn()}
        onExpire={jest.fn()}
      />,
    );
    expect(tree.queryByTestId("prediction-timer")).toBeNull();
  });

  it("decrements the timer every second", () => {
    const tree = render(
      <PredictionCard
        prediction={prediction}
        onAnswer={jest.fn()}
        onExpire={jest.fn()}
        durationSeconds={5}
      />,
    );
    expect(tree.getByTestId("prediction-timer")).toHaveTextContent("5");
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(tree.getByTestId("prediction-timer")).toHaveTextContent("4");
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(tree.getByTestId("prediction-timer")).toHaveTextContent("2");
  });

  it("calls onExpire exactly once when the timer hits zero", () => {
    const onExpire = jest.fn();
    render(
      <PredictionCard
        prediction={prediction}
        onAnswer={jest.fn()}
        onExpire={onExpire}
        durationSeconds={3}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("invokes onAnswer with the selected option index", () => {
    const onAnswer = jest.fn();
    const tree = render(
      <PredictionCard
        prediction={prediction}
        onAnswer={onAnswer}
        onExpire={jest.fn()}
        durationSeconds={10}
      />,
    );
    fireEvent.press(tree.getByTestId("prediction-option-1"));
    expect(onAnswer).toHaveBeenCalledWith(1);
  });

  it("resets the timer when prediction id changes", () => {
    const tree = render(
      <PredictionCard
        prediction={prediction}
        onAnswer={jest.fn()}
        onExpire={jest.fn()}
        durationSeconds={5}
      />,
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(tree.getByTestId("prediction-timer")).toHaveTextContent("3");

    tree.rerender(
      <PredictionCard
        prediction={{ ...prediction, id: "pred-002" }}
        onAnswer={jest.fn()}
        onExpire={jest.fn()}
        durationSeconds={5}
      />,
    );
    expect(tree.getByTestId("prediction-timer")).toHaveTextContent("5");
  });
});
