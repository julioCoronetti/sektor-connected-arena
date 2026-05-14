import { render } from "@testing-library/react-native";
import React from "react";

import type { Match } from "../../../types";
import { PressureBar } from "../PressureBar";

const match: Match = {
  id: "match-001",
  teamA: { id: "team-a", name: "Time A", color: "#E63946" },
  teamB: { id: "team-b", name: "Time B", color: "#1D3557" },
  minute: 10,
  status: "live",
};

function flexOf(testId: string, tree: ReturnType<typeof render>): number {
  const node = tree.getByTestId(testId);
  const style = Array.isArray(node.props.style)
    ? Object.assign({}, ...node.props.style)
    : node.props.style;
  return style.flex as number;
}

describe("PressureBar", () => {
  it("splits 50/50 when pressure is balanced", () => {
    const tree = render(
      <PressureBar pressureBar={{ teamA: 50, teamB: 50 }} match={match} />,
    );
    expect(flexOf("pressure-bar-team-a", tree)).toBeCloseTo(50);
    expect(flexOf("pressure-bar-team-b", tree)).toBeCloseTo(50);
  });

  it("gives all width to team A when team B has zero pressure", () => {
    const tree = render(
      <PressureBar pressureBar={{ teamA: 80, teamB: 0 }} match={match} />,
    );
    expect(flexOf("pressure-bar-team-a", tree)).toBe(100);
    expect(flexOf("pressure-bar-team-b", tree)).toBe(0);
  });

  it("falls back to 50/50 when total pressure is zero", () => {
    const tree = render(
      <PressureBar pressureBar={{ teamA: 0, teamB: 0 }} match={match} />,
    );
    expect(flexOf("pressure-bar-team-a", tree)).toBe(50);
    expect(flexOf("pressure-bar-team-b", tree)).toBe(50);
  });

  it("clamps negative inputs to zero before computing the ratio", () => {
    const tree = render(
      <PressureBar pressureBar={{ teamA: -10, teamB: 90 }} match={match} />,
    );
    expect(flexOf("pressure-bar-team-a", tree)).toBe(0);
    expect(flexOf("pressure-bar-team-b", tree)).toBe(100);
  });
});
