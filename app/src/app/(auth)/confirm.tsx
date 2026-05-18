import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useAuthStore } from "../../store/authStore";

export default function ConfirmScreen() {
  const { email, password } = useLocalSearchParams<{ email: string; password?: string }>();
  const [code, setCode] = useState("");

  const confirmSignUp = useAuthStore((s) => s.confirmSignUp);
  const resendCode = useAuthStore((s) => s.resendCode);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  // Clear any stale error when the screen mounts
  useEffect(() => {
    useAuthStore.setState({ error: null });
  }, []);

  const handleCodeChange = (text: string) => {
    // Clear error as user types
    if (error) {
      useAuthStore.setState({ error: null });
    }
    setCode(text);
  };

  const handleConfirm = async () => {
    if (!email) return;
    await confirmSignUp(email, code, password);
  };

  const handleResend = async () => {
    if (!email) return;
    await resendCode(email);
  };

  const canConfirm = code.length >= 6 && !isLoading;

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
        className="mb-4 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-center text-2xl tracking-widest text-sektor-text"
        placeholder="000000"
        placeholderTextColor="#6B6B80"
        value={code}
        onChangeText={handleCodeChange}
        keyboardType="number-pad"
        maxLength={6}
        editable={!isLoading}
        testID="confirm-code-input"
      />

      {error ? (
        <Text className="mb-4 text-red-400" testID="confirm-message">
          {error}
        </Text>
      ) : null}

      {isLoading ? (
        <ActivityIndicator
          color="#ffffff"
          className="mb-4"
          testID="confirm-loading"
        />
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className={`mb-3 items-center rounded-xl py-4 ${
          canConfirm ? "bg-sektor-accent" : "bg-sektor-border"
        }`}
        onPress={handleConfirm}
        disabled={!canConfirm}
        testID="confirm-submit"
      >
        <Text className="font-bold text-white">Confirmar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        className={`items-center rounded-xl border border-sektor-border py-4 ${
          isLoading ? "opacity-50" : "opacity-100"
        }`}
        onPress={handleResend}
        disabled={isLoading}
        testID="confirm-resend"
      >
        <Text className="text-sektor-muted">Reenviar código</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
