import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-lg font-bold">Partida {matchId}</Text>
      <Text className="text-gray-500">Plano 03</Text>
    </View>
  );
}
