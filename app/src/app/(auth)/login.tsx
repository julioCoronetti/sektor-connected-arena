import { Link } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-8 text-2xl font-bold">Entrar no Sektor</Text>

      <TextInput
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3"
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!isLoading}
      />
      <TextInput
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3"
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        editable={!isLoading}
      />

      {error ? (
        <Text className="mb-4 text-red-500" testID="login-error">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className={`items-center rounded-lg py-4 ${
          canSubmit ? "bg-black" : "bg-gray-400"
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
        href="/(auth)/register"
        className="mt-4 text-center text-gray-500"
      >
        Criar conta
      </Link>
    </View>
  );
}
