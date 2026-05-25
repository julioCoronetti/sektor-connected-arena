import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { ToggleSenha } from "../../components/ui/ToggleSenha";
import { useAuthStore } from "../../store/authStore";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const confirmForgotPassword = useAuthStore((s) => s.confirmForgotPassword);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const canSubmit = code.trim().length > 0 && newPassword.length > 0 && !isLoading;

  const handleChange = (setter: (v: string) => void) => (value: string) => {
    if (error) useAuthStore.setState({ error: null });
    setter(value);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !email) return;
    await confirmForgotPassword(email, code.trim(), newPassword);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-2 text-2xl font-bold text-sektor-text">
        Redefinir senha
      </Text>
      <Text className="mb-8 text-sektor-muted">
        Insira o código enviado para{" "}
        <Text className="text-sektor-text">{email}</Text> e escolha uma nova senha.
      </Text>

      <TextInput
        testID="reset-code-input"
        className="mb-4 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-center text-2xl tracking-widest text-sektor-text"
        placeholder="000000"
        placeholderTextColor="#6B6B80"
        value={code}
        onChangeText={handleChange(setCode)}
        keyboardType="number-pad"
        maxLength={6}
        returnKeyType="next"
        editable={!isLoading}
      />

      <View className="relative mb-4">
        <TextInput
          testID="reset-password-input"
          className="rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 pr-14 text-sektor-text"
          placeholder="Nova senha"
          placeholderTextColor="#6B6B80"
          value={newPassword}
          onChangeText={handleChange(setNewPassword)}
          secureTextEntry={!showPassword}
          autoComplete="password-new"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!isLoading}
        />
        <ToggleSenha
          isVisible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
      </View>

      <AlertBanner message={error} type="error" testID="reset-alert-error" />

      <TouchableOpacity
        testID="reset-submit-button"
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
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Redefinir senha</Text>
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
