import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { InlineError } from "../../components/ui/InlineError";
import { ToggleSenha } from "../../components/ui/ToggleSenha";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const loginSuccessMessage = useAuthStore((s) => s.loginSuccessMessage);

  const emailValid = email.trim().length === 0 || isValidEmail(email.trim());
  const canSubmit =
    email.trim().length > 0 &&
    isValidEmail(email.trim()) &&
    password.length > 0 &&
    !isLoading;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) setEmailError(null);
    if (error) useAuthStore.setState({ error: null });
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (error) useAuthStore.setState({ error: null });
  };

  const handleEmailBlur = () => {
    if (email.trim().length > 0 && !isValidEmail(email.trim())) {
      setEmailError("Formato de e-mail inválido");
    }
  };

  const handleSubmit = () => {
    if (canSubmit) login(email.trim(), password);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 justify-center bg-sektor-bg px-6"
    >
      <Text className="mb-8 text-2xl font-bold text-sektor-text">
        Entrar no Sektor
      </Text>

      <TextInput
        testID="login-email-input"
        className="mb-1 rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
        placeholder="E-mail"
        placeholderTextColor="#6B6B80"
        value={email}
        onChangeText={handleEmailChange}
        onBlur={handleEmailBlur}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        editable={!isLoading}
      />
      <InlineError message={emailError} />

      <View className="relative mb-4">
        <TextInput
          testID="login-password-input"
          ref={passwordRef}
          className="rounded-xl border border-sektor-border bg-sektor-surface px-4 py-4 pr-14 text-sektor-text"
          placeholder="Senha"
          placeholderTextColor="#6B6B80"
          value={password}
          onChangeText={handlePasswordChange}
          secureTextEntry={!showPassword}
          autoComplete="password"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          editable={!isLoading}
        />
        <ToggleSenha
          isVisible={showPassword}
          onToggle={() => setShowPassword((v) => !v)}
        />
      </View>

      <AlertBanner message={loginSuccessMessage} type="success" testID="login-success-banner" />
      <AlertBanner message={error} type="error" testID="login-error" />

      <TouchableOpacity
        testID="login-submit-button"
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
          <Text className="font-bold text-white">Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        testID="login-forgot-password-link"
        accessibilityRole="link"
        className="mt-4 items-center py-2"
        onPress={() => router.push("/forgot-password" as never)}
      >
        <Text className="text-sektor-muted">Esqueci minha senha</Text>
      </TouchableOpacity>

      <Link href="/register" className="mt-2 text-center text-sektor-muted">
        Criar conta
      </Link>
    </Animated.View>
  );
}
