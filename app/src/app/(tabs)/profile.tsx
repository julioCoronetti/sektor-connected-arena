import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { AppHeader } from "../../components/ui/AppHeader";
import { useAuthStore } from "../../store/authStore";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isLoading = useAuthStore((s) => s.isLoading);

  return (
    <View className="flex-1 bg-sektor-bg">
      <AppHeader paddingBottom={4} />
      <View className="h-px bg-sektor-border" />

      <View className="flex-1 px-5 pt-6">
        {/* Avatar */}
        <View className="mb-6 items-center">
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
            <Text className="text-lg font-bold text-sektor-text">{user.name}</Text>
          ) : null}
          {user?.email ? (
            <Text className="text-sm text-sektor-muted">{user.email}</Text>
          ) : null}
        </View>

        {/* Info card */}
        {user ? (
          <View
            className="mb-6 rounded-2xl bg-sektor-surface p-4"
            style={{ borderWidth: 1, borderColor: "#2A2A2A" }}
          >
            <InfoRow icon="person-outline" label="Nome" value={user.name || "—"} />
            <View className="my-3 h-px bg-sektor-border" />
            <InfoRow icon="mail-outline" label="E-mail" value={user.email} />
            <View className="my-3 h-px bg-sektor-border" />
            <InfoRow icon="shield-half-outline" label="Time" value={user.teamId || "—"} />
          </View>
        ) : null}

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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons name={icon} size={18} color="#888888" style={{ marginRight: 10 }} />
      <Text className="text-sektor-muted text-sm" style={{ width: 52 }}>
        {label}
      </Text>
      <Text className="text-sektor-text text-sm font-semibold flex-1" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
