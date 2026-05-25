import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useColorScheme } from "nativewind";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { InlineError } from "../../components/ui/InlineError";
import { ToggleSenha } from "../../components/ui/ToggleSenha";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";

const LOGO_DARK = require("../../../assets/images/logo-dark.png");
const LOGO_LIGHT = require("../../../assets/images/logo-light.png");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const loginSuccessMessage = useAuthStore((s) => s.loginSuccessMessage);

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-1 bg-sektor-bg"
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              style={{ width: 140, height: 46 }}
              contentFit="contain"
              accessibilityLabel="Sektor logo"
            />
          </View>

          <Text className="mb-1 text-2xl font-bold text-sektor-text">
            Bem-vindo de volta
          </Text>
          <Text className="mb-8 text-sektor-muted">
            Entre na sua conta para continuar
          </Text>

          {/* E-mail */}
          <TextInput
            testID="login-email-input"
            className="mb-1 rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
            placeholder="E-mail"
            placeholderTextColor="#888888"
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

          {/* Senha */}
          <View className="relative mb-4">
            <TextInput
              testID="login-password-input"
              ref={passwordRef}
              className="rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 pr-14 text-sektor-text"
              placeholder="Senha"
              placeholderTextColor="#888888"
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

          {/* Botão entrar */}
          <TouchableOpacity
            testID="login-submit-button"
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
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-forgot-password-link"
            accessibilityRole="link"
            className="items-center py-2"
            onPress={() => router.push("/forgot-password" as never)}
          >
            <Text className="text-sektor-muted text-sm">Esqueci minha senha</Text>
          </TouchableOpacity>

          <Link href="/register" className="mt-2 text-center text-sm text-sektor-muted">
            Não tem conta?{" "}
            <Text style={{ color: "#CC0000", fontWeight: "600" }}>Criar conta</Text>
          </Link>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
