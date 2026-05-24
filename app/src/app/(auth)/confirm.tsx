import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { useCooldown } from "../../hooks/useCooldown";
import { useAuthStore } from "../../store/authStore";

export default function ConfirmScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");

  const confirmSignUp = useAuthStore((s) => s.confirmSignUp);
  const resendCode = useAuthStore((s) => s.resendCode);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const resendSuccessMessage = useAuthStore((s) => s.resendSuccessMessage);

  const { remaining, isActive: cooldownActive, start: startCooldown } = useCooldown(60);

  // Limpa erros ao montar
  useEffect(() => {
    useAuthStore.setState({ error: null, resendSuccessMessage: null });
  }, []);

  // Limpa pendingPassword ao sair da tela sem confirmar
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup ao desmontar/perder foco
        useAuthStore.setState({ pendingPassword: null });
      };
    }, [])
  );

  const handleCodeChange = (text: string) => {
    if (error) useAuthStore.setState({ error: null });
    setCode(text);
  };

  const handleConfirm = async () => {
    if (!email || isLoading) return;
    await confirmSignUp(email, code);
  };

  // Auto-submit ao completar 6 dígitos
  useEffect(() => {
    if (code.length === 6 && /^\d{6}$/.test(code) && !isLoading) {
      handleConfirm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handleResend = async () => {
    if (!email || isLoading) return;
    await resendCode(email);
    // Inicia cooldown apenas se não houve erro
    if (!useAuthStore.getState().error) {
      startCooldown();
    }
  };

  // Verifica se é ExpiredCodeException para forçar botão de reenvio habilitado
  const isExpiredCode = error?.includes("expirado") ?? false;
  const resendDisabled = isLoading || (cooldownActive && !isExpiredCode);
  const resendLabel = cooldownActive && !isExpiredCode
    ? `Reenviar em ${remaining}s`
    : "Reenviar código";

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-2 text-2xl font-bold text-sektor-text">
        Confirmar e-mail
      </Text>

      <Text className="mb-8 text-sektor-muted">
        Enviamos um código de 6 dígitos para{" "}
        <Text className="text-sektor-text">{email}</Text>
      </Text>

      <TextInput
        testID="confirm-code-input"
        className="mb-1 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-center text-2xl tracking-widest text-sektor-text"
        placeholder="000000"
        placeholderTextColor="#6B6B80"
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isLoading}
      />

      <Text className="mb-4 text-xs text-sektor-muted">
        O código expira em 24 horas
      </Text>

      <AlertBanner message={resendSuccessMessage} type="success" testID="confirm-resend-success" />
      <AlertBanner message={error} type="error" testID="confirm-message" />

      <TouchableOpacity
        testID="confirm-submit"
        accessibilityRole="button"
        className={`mb-3 items-center rounded-xl py-4 ${
          code.length === 6 && !isLoading ? "bg-sektor-accent" : "bg-sektor-border"
        }`}
        onPress={handleConfirm}
        disabled={code.length < 6 || isLoading}
      >
        <Text className="font-bold text-white">
          {isLoading ? "Confirmando..." : "Confirmar"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="confirm-resend"
        accessibilityRole="button"
        className={`items-center rounded-xl border border-sektor-border py-4 ${
          resendDisabled ? "opacity-50" : "opacity-100"
        }`}
        onPress={handleResend}
        disabled={resendDisabled}
      >
        <Text className="text-sektor-muted">{resendLabel}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
