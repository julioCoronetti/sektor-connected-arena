import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuthStore } from "../../store/authStore";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const router = useRouter();

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    !isLoading;

  const handleSubmit = async () => {
    await register(name.trim(), email.trim(), password);
    // Após register o store popula `user` em caso de sucesso ou `error` em falha.
    const state = useAuthStore.getState();
    if (state.user && !state.error) {
      router.replace("/(auth)/select-team");
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-8 text-2xl font-bold">Criar conta no Sektor</Text>

      <TextInput
        className="mb-4 rounded-lg border border-gray-300 px-4 py-3"
        placeholder="Nome"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!isLoading}
      />
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
        autoComplete="password-new"
        editable={!isLoading}
      />

      {error ? (
        <Text className="mb-4 text-red-500" testID="register-error">
          {error}
        </Text>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className={`items-center rounded-lg py-4 ${
          canSubmit ? "bg-black" : "bg-gray-400"
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

      <Link href="/(auth)/login" className="mt-4 text-center text-gray-500">
        Já tenho conta
      </Link>
    </View>
  );
}
