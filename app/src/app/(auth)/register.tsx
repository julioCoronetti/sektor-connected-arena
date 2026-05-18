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

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !isLoading;

  const handleSubmit = async () => {
    await register(name.trim(), email.trim(), password);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-8 text-2xl font-bold text-sektor-text">
        Criar conta no Sektor
      </Text>

      <TextInput
        className="mb-4 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
        placeholder="Nome"
        placeholderTextColor="#6B6B80"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!isLoading}
      />
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
        autoComplete="password-new"
        editable={!isLoading}
      />

      {error ? (
        <Text className="mb-4 text-red-400" testID="register-error">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className={`items-center rounded-xl py-4 ${
          canSubmit ? "bg-sektor-accent" : "bg-sektor-border"
        }`}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="font-bold text-white">Criar conta</Text>
        )}
      </TouchableOpacity>

      <Link href="/login" className="mt-4 text-center text-sektor-muted">
        Já tenho conta
      </Link>
    </Animated.View>
  );
}
