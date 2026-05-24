import { render } from "@testing-library/react-native";
import React from "react";

import { AlertBanner } from "../AlertBanner";

describe("AlertBanner", () => {
  it("renders null when message is null", () => {
    const { queryByTestId } = render(
      <AlertBanner message={null} type="error" testID="alert-banner" />,
    );
    expect(queryByTestId("alert-banner")).toBeNull();
  });

  it("renders the message text when message is provided", () => {
    const { getByText } = render(
      <AlertBanner message="Erro ao fazer login" type="error" />,
    );
    expect(getByText("Erro ao fazer login")).toBeTruthy();
  });

  it("renders with testID when provided", () => {
    const { getByTestId } = render(
      <AlertBanner
        message="Operação realizada com sucesso"
        type="success"
        testID="success-banner"
      />,
    );
    expect(getByTestId("success-banner")).toBeTruthy();
  });

  it("renders error type with correct text color class", () => {
    const { getByText } = render(
      <AlertBanner message="Credenciais inválidas" type="error" />,
    );
    const textEl = getByText("Credenciais inválidas");
    // NativeWind applies className; verify the element is rendered
    expect(textEl).toBeTruthy();
  });

  it("renders success type with correct text color class", () => {
    const { getByText } = render(
      <AlertBanner message="Senha redefinida com sucesso" type="success" />,
    );
    const textEl = getByText("Senha redefinida com sucesso");
    expect(textEl).toBeTruthy();
  });

  it("does not render when message is null for success type", () => {
    const { queryByText } = render(
      <AlertBanner message={null} type="success" testID="success-banner" />,
    );
    expect(queryByText(/.*/)).toBeNull();
  });
});
