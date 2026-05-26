import { Ionicons } from "@expo/vector-icons";
import { useRef, useEffect } from "react";
import { ActivityIndicator, Animated, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";
import { AppHeader } from "../../components/ui/AppHeader";
import { useBundesligaTeams } from "../../hooks/useBundesligaTeams";
import { useAuthStore } from "../../store/authStore";

function CustomSwitch({ value, onValueChange }: { value: boolean; onValueChange: () => void }) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onValueChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Alternar tema claro/escuro"
      style={{
        width: 48,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#CC0000",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          transform: [{ translateX }],
        }}
      />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { isDark, toggleTheme } = useTheme();

  // Busca os times para resolver o nome a partir do teamId numérico
  const { teams } = useBundesligaTeams();
  const teamName = user?.teamId
    ? (teams.find((t) => String(t.teamId) === user.teamId)?.teamName ?? user.teamId)
    : "—";

  // Cores dinâmicas baseadas no tema
  const colors = {
    bg: isDark ? "#0F0F0F" : "#F5F5F5",
    surface: isDark ? "#1A1A1A" : "#FFFFFF",
    border: isDark ? "#2A2A2A" : "#E0E0E0",
    text: isDark ? "#F5F5F5" : "#111111",
    muted: isDark ? "#888888" : "#666666",
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader paddingBottom={4} />
      <View style={{ height: 1, backgroundColor: colors.border }} />

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
        {/* Avatar */}
        <View style={{ marginBottom: 24, alignItems: "center" }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#CC000020",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="person" size={36} color="#CC0000" />
          </View>
          {user?.name ? (
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
              {user.name}
            </Text>
          ) : null}
          {user?.email ? (
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
              {user.email}
            </Text>
          ) : null}
        </View>

        {/* Info card */}
        {user ? (
          <View
            style={{
              marginBottom: 16,
              borderRadius: 16,
              backgroundColor: colors.surface,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <InfoRow
              icon="person-outline"
              label="Nome"
              value={user.name || "—"}
              colors={colors}
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
            <InfoRow
              icon="mail-outline"
              label="E-mail"
              value={user.email}
              colors={colors}
            />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
            <InfoRow
              icon="shield-half-outline"
              label="Time"
              value={teamName}
              colors={colors}
            />
          </View>
        ) : null}

        {/* Card de preferências */}
        <View
          style={{
            marginBottom: 24,
            borderRadius: 16,
            backgroundColor: colors.surface,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 12,
            }}
          >
            Preferências
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={isDark ? "moon" : "sunny"}
                size={18}
                color={colors.muted}
                style={{ marginRight: 10 }}
              />
              <Text style={{ fontSize: 14, color: colors.text }}>
                {isDark ? "Tema escuro" : "Tema claro"}
              </Text>
            </View>
            <CustomSwitch value={!isDark} onValueChange={toggleTheme} />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          accessibilityRole="button"
          style={{
            backgroundColor: "#CC0000",
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
          }}
          onPress={() => logout()}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
              Sair da conta
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: { muted: string; text: string };
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons name={icon} size={18} color={colors.muted} style={{ marginRight: 10 }} />
      <Text style={{ fontSize: 14, color: colors.muted, width: 52 }}>{label}</Text>
      <Text
        style={{ fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
