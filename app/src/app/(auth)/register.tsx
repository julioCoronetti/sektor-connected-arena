import { Image } from "expo-image";
import { Link } from "expo-router";
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
import { useTheme } from "../../context/ThemeContext";
import { useAuthStore } from "../../store/authStore";
import { isValidEmail } from "../../utils/validators/email";
import { getPasswordStrength } from "../../utils/validators/password";

// logo-dark = texto branco → fundo escuro | logo-light = texto preto → fundo claro
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
  const { isDark } = useTheme();

  // Cores adaptadas ao tema
  const bg = isDark ? "#0F0F0F" : "#F5F5F5";
  const surface = isDark ? "#1A1A1A" : "#FFFFFF";
  const border = isDark ? "#2A2A2A" : "#E0E0E0";
  const textColor = isDark ? "#F5F5F5" : "#111111";
  const mutedColor = isDark ? "#888888" : "#666666";
  const placeholderColor = isDark ? "#666666" : "#AAAAAA";
  const disabledBg = isDark ? "#2A2A2A" : "#CCCCCC";

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

  const inputStyle = {
    backgroundColor: surface,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: textColor,
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
          {/* Logo */}
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <Image
              source={isDark ? LOGO_DARK : LOGO_LIGHT}
              style={{ width: 160, height: 52 }}
              contentFit="contain"
              accessibilityLabel="Sektor logo"
            />
          </View>

          <Text style={{ fontSize: 24, fontWeight: "700", color: textColor, marginBottom: 4 }}>
            Criar conta
          </Text>
          <Text style={{ fontSize: 14, color: mutedColor, marginBottom: 24 }}>
            Junte-se à arena
          </Text>

          {/* Nome */}
          <TextInput
            testID="register-name-input"
            style={{ ...inputStyle, marginBottom: 12 }}
            placeholder="Nome"
            placeholderTextColor={placeholderColor}
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
            style={{ ...inputStyle, marginBottom: 4 }}
            placeholder="E-mail"
            placeholderTextColor={placeholderColor}
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
          <View style={{ position: "relative", marginBottom: 4 }}>
            <TextInput
              testID="register-password-input"
              ref={passwordRef}
              style={{ ...inputStyle, paddingRight: 52 }}
              placeholder="Senha"
              placeholderTextColor={placeholderColor}
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
          <View style={{ position: "relative", marginBottom: 4 }}>
            <TextInput
              testID="register-confirm-password-input"
              ref={confirmRef}
              style={{ ...inputStyle, paddingRight: 52 }}
              placeholder="Confirmar senha"
              placeholderTextColor={placeholderColor}
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

          {/* Botão criar conta */}
          <TouchableOpacity
            testID="register-submit-button"
            accessibilityRole="button"
            style={{
              backgroundColor: canSubmit ? "#CC0000" : disabledBg,
              borderRadius: 14,
              paddingVertical: 15,
              alignItems: "center",
              marginTop: 8,
              marginBottom: 12,
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
                Criar conta
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ alignItems: "center" }}>
            <Text style={{ color: mutedColor, fontSize: 14 }}>
              Já tem conta?{" "}
              <Link href="/login">
                <Text style={{ color: "#CC0000", fontWeight: "600" }}>Entrar</Text>
              </Link>
            </Text>
          </View>

          {/* Footer */}
          <View style={{ alignItems: "center", marginTop: 40, paddingBottom: 8 }}>
            <View style={{ width: 32, height: 1, backgroundColor: border, marginBottom: 16 }} />
            <Text style={{ color: mutedColor, fontSize: 11 }}>
              © {new Date().getFullYear()} Sektor · Todos os direitos reservados
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
