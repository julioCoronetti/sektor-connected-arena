import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

import { AppHeader } from "../../components/ui/AppHeader";
import { DEMO_MATCH_ID } from "../../constants/config";

export default function ArenaTabScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-sektor-bg">
      <AppHeader paddingBottom={4} />
      <View className="h-px bg-sektor-border" />

      <View className="flex-1 items-center justify-center px-6">
        {/* Icon */}
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: "#CC000018",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Ionicons name="shield-half" size={40} color="#CC0000" />
        </View>

        <Text className="mb-2 text-2xl font-bold text-sektor-text">Arena</Text>
        <Text className="mb-10 text-center text-sektor-muted leading-5">
          Entre em uma partida ao vivo para{"\n"}participar das predições em tempo real
        </Text>

        <TouchableOpacity
          accessibilityRole="button"
          style={{
            backgroundColor: "#CC0000",
            paddingHorizontal: 32,
            paddingVertical: 14,
            borderRadius: 14,
            shadowColor: "#CC0000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
          }}
          onPress={() =>
            router.push({
              pathname: "/arena/[matchId]",
              params: { matchId: DEMO_MATCH_ID },
            })
          }
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>
            Entrar na Partida Demo
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
