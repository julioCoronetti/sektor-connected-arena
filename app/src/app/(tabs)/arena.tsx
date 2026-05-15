import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

import { DEMO_MATCH_ID } from "../../constants/config";

export default function ArenaTabScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 items-center justify-center bg-sektor-bg px-6">
      <Text className="mb-2 text-2xl font-bold text-sektor-text">Arena</Text>
      <Text className="mb-8 text-center text-sektor-muted">
        Entre em uma partida ao vivo para participar das predições
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        className="rounded-xl bg-sektor-accent px-8 py-4"
        onPress={() =>
          router.push({
            pathname: "/arena/[matchId]",
            params: { matchId: DEMO_MATCH_ID },
          })
        }
      >
        <Text className="font-bold text-white">Entrar na Partida Demo</Text>
      </TouchableOpacity>
    </View>
  );
}
