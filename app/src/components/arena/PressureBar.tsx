import { Text, View } from "react-native";

import type { Match, PressureBarState } from "../../types";

interface PressureBarProps {
  pressureBar: PressureBarState;
  match: Match;
}

/**
 * Cabo de Guerra entre as duas torcidas. A largura de cada lado é a
 * proporção da pontuação respectiva sobre o total.
 */
export function PressureBar({ pressureBar, match }: PressureBarProps) {
  const safeA = Math.max(0, pressureBar.teamA);
  const safeB = Math.max(0, pressureBar.teamB);
  const total = safeA + safeB;
  const widthA = total > 0 ? (safeA / total) * 100 : 50;
  const widthB = 100 - widthA;

  return (
    <View className="px-4 py-3" testID="pressure-bar">
      <View className="mb-1 flex-row justify-between">
        <Text
          className="text-sm font-bold"
          style={{ color: match.teamA.color }}
        >
          {match.teamA.name}
        </Text>
        <Text
          className="text-sm font-bold"
          style={{ color: match.teamB.color }}
        >
          {match.teamB.name}
        </Text>
      </View>
      <View className="h-6 flex-row overflow-hidden rounded-full bg-gray-800">
        <View
          testID="pressure-bar-team-a"
          style={{ flex: widthA, backgroundColor: match.teamA.color }}
        />
        <View
          testID="pressure-bar-team-b"
          style={{ flex: widthB, backgroundColor: match.teamB.color }}
        />
      </View>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs text-gray-400">
          {Math.round(safeA)} pts
        </Text>
        <Text className="text-xs text-gray-400">
          {Math.round(safeB)} pts
        </Text>
      </View>
    </View>
  );
}
