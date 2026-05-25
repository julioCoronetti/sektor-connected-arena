import { Image } from "expo-image";
import { Link } from "expo-router";
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
import { PasswordStrengthIndicator } from "../../components/ui/PasswordStrengthIndicator";
import { ToggleSenha } from "../../components/ui/ToggleSenha";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";
import { getPasswordStrength } from "../../utils/validators/password";

const LOGO_DARK = require("../../../assets/images/logo-dark.png");
const LOGO_LIGHT = require("../../../assets/images/logo-light.png");

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  const passwordStrength = getPasswordStrength(password);
  const passwordOk = passwordStrength.level !== "fraca";
  const passwordsMatch = password === confirmPassword;

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    isValidEmail(email.trim()) &&
    password.length > 0 &&
    passwordOk &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    !isLoading;

  const clearStoreError = () => {
    if (error) useAuthStore.setState({ error: null });
  };

  const handleEmailBlur = () => {
    if (email.trim().length > 0 && !isValidEmail(email.trim())) {
      setEmailError("Formato de e-mail inválido");
    }
  };

  const handleConfirmBlur = () => {
    if (confirmPassword.length > 0 && password !== confirmPassword) {
      setConfirmError("As senhas não coincidem");
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await register(name.trim(), email.trim(), password);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View entering={FadeIn.duration(300)} className="flex-1 bg-sektor-bg">
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
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              style={{ width: 140, height: 46 }}
              contentFit="contain"
              accessibilityLabel="Sektor logo"
            />
          </View>

          <Text className="mb-1 text-2xl font-bold text-sektor-text">
            Criar conta
          </Text>
          <Text className="mb-8 text-sektor-muted">
            Junte-se à arena
          </Text>

          {/* Nome */}
          <TextInput
            testID="register-name-input"
            className="mb-4 rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
            placeholder="Nome"
            placeholderTextColor="#888888"
            value={name}
            onChangeText={(v) => { setName(v); clearStoreError(); }}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            editable={!isLoading}
          />

          {/* E-mail */}
          <TextInput
            testID="register-email-input"
            ref={emailRef}
            className="mb-1 rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 text-sektor-text"
            placeholder="E-mail"
            placeholderTextColor="#888888"
            value={email}
            onChangeText={(v) => { setEmail(v); if (emailError) setEmailError(null); clearStoreError(); }}
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
          <View className="relative mb-1">
            <TextInput
              testID="register-password-input"
              ref={passwordRef}
              className="rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 pr-14 text-sektor-text"
              placeholder="Senha"
              placeholderTextColor="#888888"
              value={password}
              onChangeText={(v) => { setPassword(v); clearStoreError(); }}
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              editable={!isLoading}
            />
            <ToggleSenha
              isVisible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          </View>
          <PasswordStrengthIndicator password={password} />

          {/* Confirmar senha */}
          <View className="relative mb-1">
            <TextInput
              testID="register-confirm-password-input"
              ref={confirmRef}
              className="rounded-2xl border border-sektor-border bg-sektor-surface px-4 py-4 pr-14 text-sektor-text"
              placeholder="Confirmar senha"
              placeholderTextColor="#888888"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); if (confirmError) setConfirmError(null); clearStoreError(); }}
              onBlur={handleConfirmBlur}
              secureTextEntry={!showConfirm}
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!isLoading}
            />
            <ToggleSenha
              isVisible={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
            />
          </View>
          <InlineError message={confirmError} />

          <AlertBanner message={error} type="error" testID="register-error" />

          <TouchableOpacity
            testID="register-submit-button"
            accessibilityRole="button"
            style={{
              backgroundColor: canSubmit ? "#CC0000" : "#2A2A2A",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 12,
            }}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
                Criar conta
              </Text>
            )}
          </TouchableOpacity>

          <Link href="/login" className="text-center text-sm text-sektor-muted">
            Já tem conta?{" "}
            <Text style={{ color: "#CC0000", fontWeight: "600" }}>Entrar</Text>
          </Link>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
