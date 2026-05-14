import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuthStore } from "../../store/authStore";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isLoading = useAuthStore((s) => s.isLoading);

  return (
    <View className="flex-1 bg-sektor-bg px-6 py-12">
      <Text className="mb-2 text-2xl font-bold text-sektor-text">Perfil</Text>

      {user ? (
        <View className="mb-8 rounded-xl bg-sektor-surface p-4">
          <Text className="text-base text-sektor-muted">
            Nome:{" "}
            <Text className="font-bold text-sektor-text">
              {user.name || "—"}
            </Text>
          </Text>
          <Text className="text-base text-sektor-muted">
            E-mail:{" "}
            <Text className="font-bold text-sektor-text">{user.email}</Text>
          </Text>
          <Text className="text-base text-sektor-muted">
            Time:{" "}
            <Text className="font-bold text-sektor-text">
              {user.teamId || "—"}
            </Text>
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className="items-center rounded-xl bg-sektor-accent py-4"
        onPress={() => logout()}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="font-bold text-white">Sair</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
