import { Image } from "expo-image";
import { Link, router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertBanner } from "../../components/ui/AlertBanner";
import { InlineError } from "../../components/ui/InlineError";
import { ToggleSenha } from "../../components/ui/ToggleSenha";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";

// logo-dark = texto branco → fundo escuro
// logo-light = texto preto → fundo claro
const LOGO_DARK = require("../../../assets/images/logo-dark.png");
const LOGO_LIGHT = require("../../../assets/images/logo-light.png");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== "light";

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const loginSuccessMessage = useAuthStore((s) => s.loginSuccessMessage);

  // Cores adaptadas ao tema
  const bg = isDark ? "#0F0F0F" : "#F5F5F5";
  const surface = isDark ? "#1A1A1A" : "#FFFFFF";
  const border = isDark ? "#2A2A2A" : "#E0E0E0";
  const textColor = isDark ? "#F5F5F5" : "#111111";
  const mutedColor = isDark ? "#888888" : "#666666";
  const placeholderColor = isDark ? "#666666" : "#AAAAAA";
  const disabledBg = isDark ? "#2A2A2A" : "#CCCCCC";

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
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1, backgroundColor: bg }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 28,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Topo: logo ── */}
          <View style={{ alignItems: "center", marginBottom: 48 }}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              style={{ width: 180, height: 60 }}
              contentFit="contain"
              accessibilityLabel="Sektor logo"
            />
          </View>

          {/* ── Formulário ── */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: textColor, marginBottom: 4 }}>
              Bem-vindo de volta
            </Text>
            <Text style={{ fontSize: 14, color: mutedColor, marginBottom: 28 }}>
              Entre na sua conta para continuar
            </Text>

            {/* E-mail */}
            <TextInput
              testID="login-email-input"
              style={{
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: border,
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 15,
                color: textColor,
                marginBottom: 4,
              }}
              placeholder="E-mail"
              placeholderTextColor={placeholderColor}
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
            <View style={{ position: "relative", marginBottom: 16 }}>
              <TextInput
                testID="login-password-input"
                ref={passwordRef}
                style={{
                  backgroundColor: surface,
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  paddingRight: 52,
                  fontSize: 15,
                  color: textColor,
                }}
                placeholder="Senha"
                placeholderTextColor={placeholderColor}
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
                backgroundColor: canSubmit ? "#CC0000" : disabledBg,
                borderRadius: 14,
                paddingVertical: 15,
                alignItems: "center",
                marginBottom: 16,
                shadowColor: canSubmit ? "#CC0000" : "transparent",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: canSubmit ? 4 : 0,
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

            {/* Links secundários */}
            <TouchableOpacity
              testID="login-forgot-password-link"
              accessibilityRole="link"
              style={{ alignItems: "center", paddingVertical: 8 }}
              onPress={() => router.push("/forgot-password" as never)}
            >
              <Text style={{ color: mutedColor, fontSize: 14 }}>Esqueci minha senha</Text>
            </TouchableOpacity>

            <View style={{ alignItems: "center", marginTop: 8 }}>
              <Text style={{ color: mutedColor, fontSize: 14 }}>
                Não tem conta?{" "}
                <Link href="/register">
                  <Text style={{ color: "#CC0000", fontWeight: "600" }}>Criar conta</Text>
                </Link>
              </Text>
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={{ alignItems: "center", marginTop: 40, paddingBottom: 8 }}>
            <View
              style={{
                width: 32,
                height: 1,
                backgroundColor: border,
                marginBottom: 16,
              }}
            />
            <Text style={{ color: mutedColor, fontSize: 11 }}>
              © {new Date().getFullYear()} Sektor · Todos os direitos reservados
            </Text>
            <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>
              Versão 1.0.0
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
