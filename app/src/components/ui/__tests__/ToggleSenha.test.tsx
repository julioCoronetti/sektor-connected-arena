import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

import { ToggleSenha } from "../ToggleSenha";

// Mock @expo/vector-icons to avoid native module issues in tests
jest.mock("@expo/vector-icons", () => ({
  Feather: ({ name, testID }: { name: string; testID?: string }) => {
    const { Text } = require("react-native");
    return <Text testID={testID ?? `feather-icon-${name}`}>{name}</Text>;
  },
}));

describe("ToggleSenha", () => {
  it("renders eye icon when isVisible=false", () => {
    const { getByTestId } = render(
      <ToggleSenha isVisible={false} onToggle={() => {}} testID="toggle-btn" />
    );
    // The Feather icon should render with name "eye"
    expect(getByTestId("feather-icon-eye")).toBeTruthy();
  });

  it("renders eye-off icon when isVisible=true", () => {
    const { getByTestId } = render(
      <ToggleSenha isVisible={true} onToggle={() => {}} testID="toggle-btn" />
    );
    // The Feather icon should render with name "eye-off"
    expect(getByTestId("feather-icon-eye-off")).toBeTruthy();
  });

  it('has accessibilityLabel "Mostrar senha" when isVisible=false', () => {
    const { getByLabelText } = render(
      <ToggleSenha isVisible={false} onToggle={() => {}} />
    );
    expect(getByLabelText("Mostrar senha")).toBeTruthy();
  });

  it('has accessibilityLabel "Ocultar senha" when isVisible=true', () => {
    const { getByLabelText } = render(
      <ToggleSenha isVisible={true} onToggle={() => {}} />
    );
    expect(getByLabelText("Ocultar senha")).toBeTruthy();
  });

  it("calls onToggle when pressed", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ToggleSenha isVisible={false} onToggle={onToggle} />
    );
    fireEvent.press(getByLabelText("Mostrar senha"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle when pressed in visible state", () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ToggleSenha isVisible={true} onToggle={onToggle} />
    );
    fireEvent.press(getByLabelText("Ocultar senha"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("applies testID to the TouchableOpacity", () => {
    const { getByTestId } = render(
      <ToggleSenha isVisible={false} onToggle={() => {}} testID="my-toggle" />
    );
    expect(getByTestId("my-toggle")).toBeTruthy();
  });

  it("does not require testID prop", () => {
    // Should render without errors when testID is omitted
    expect(() =>
      render(<ToggleSenha isVisible={false} onToggle={() => {}} />)
    ).not.toThrow();
  });
});
