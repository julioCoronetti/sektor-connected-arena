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
    <View className="flex-1 bg-white px-6 py-12">
      <Text className="mb-2 text-2xl font-bold">Perfil</Text>
      <Text className="mb-8 text-gray-500">Plano 02</Text>

      {user ? (
        <View className="mb-8">
          <Text className="text-base text-gray-700">
            Nome: <Text className="font-bold">{user.name || "—"}</Text>
          </Text>
          <Text className="text-base text-gray-700">
            E-mail: <Text className="font-bold">{user.email}</Text>
          </Text>
          <Text className="text-base text-gray-700">
            Time: <Text className="font-bold">{user.teamId || "—"}</Text>
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        className="items-center rounded-lg bg-black py-4"
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
