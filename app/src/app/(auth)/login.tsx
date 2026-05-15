import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useAuthStore } from "../../store/authStore";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !isLoading;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-8 text-2xl font-bold text-sektor-text">
        Entrar no Sektor
      </Text>

      <TextInput
        className="mb-4 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
        placeholder="E-mail"
        placeholderTextColor="#6B6B80"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!isLoading}
      />
      <TextInput
        className="mb-4 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
        placeholder="Senha"
        placeholderTextColor="#6B6B80"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        editable={!isLoading}
      />

      {error ? (
        <Text className="mb-4 text-red-400" testID="login-error">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className={`items-center rounded-xl py-4 ${
          canSubmit ? "bg-sektor-accent" : "bg-sektor-border"
        }`}
        onPress={() => login(email.trim(), password)}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="font-bold text-white">Entrar</Text>
        )}
      </TouchableOpacity>

      <Link
        href="/register"
        className="mt-4 text-center text-sektor-muted"
      >
        Criar conta
      </Link>
    </Animated.View>
  );
}
