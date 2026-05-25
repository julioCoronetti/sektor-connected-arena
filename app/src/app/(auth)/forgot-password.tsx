import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { InlineError } from "../../components/ui/InlineError";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.error !== null ? () => useAuthStore.setState({ error: null }) : null);

  const emailValid = isValidEmail(email.trim());
  const canSubmit = emailValid && !isLoading;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Limpa erro inline ao editar
    if (emailError) setEmailError(null);
    // Limpa erro do AuthStore ao editar
    if (error) useAuthStore.setState({ error: null });
  };

  const handleEmailBlur = () => {
    if (email.trim().length > 0 && !isValidEmail(email.trim())) {
      setEmailError("Formato de e-mail inválido");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await forgotPassword(email.trim());
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-2 text-2xl font-bold text-sektor-text">
        Recuperar senha
      </Text>
      <Text className="mb-8 text-sektor-muted">
        Informe seu e-mail para receber o código de redefinição.
      </Text>

      <TextInput
        testID="forgot-email-input"
        className="mb-1 rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
        placeholder="E-mail"
        placeholderTextColor="#888888"
        value={email}
        onChangeText={handleEmailChange}
        onBlur={handleEmailBlur}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
        editable={!isLoading}
      />

      <InlineError message={emailError} testID="forgot-email-error" />

      <AlertBanner message={error} type="error" testID="forgot-alert-error" />

      <TouchableOpacity
        testID="forgot-submit-button"
        accessibilityRole="button"
        style={{
          backgroundColor: canSubmit ? "#CC0000" : "#2A2A2A",
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          marginBottom: 12,
        }}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Enviar código</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        className="items-center py-2"
        onPress={() => router.back()}
        disabled={isLoading}
      >
        <Text className="text-sektor-muted">Voltar</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
