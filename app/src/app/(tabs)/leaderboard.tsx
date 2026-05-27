import { Ionicons } from "@expo/vector-icons";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { AppHeader } from "../../components/ui/AppHeader";
import { useLeaderboard } from "../../hooks/useLeaderboard";
import { useAuthStore } from "../../store/authStore";
import { DEMO_MATCH_ID } from "../../constants/config";

const BADGE_EMOJIS: Record<string, string> = {
  "first-correct": "🎯",
  "streak-3": "🔥",
  "streak-5": "🔥🔥",
  "streak-10": "🏆",
  "in-stadium": "📍",
  "score-100": "💯",
  "perfect-half": "⭐",
};

const TEAM_COLORS: Record<string, string> = {
  "team-a": "#E63946",
  "team-b": "#1D3557",
};

export default function LeaderboardScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { entries, isLoading, refresh } = useLeaderboard(DEMO_MATCH_ID, 30_000);

  return (
    <View style={{ flex: 1, backgroundColor: "#0F0F0F" }}>
      <AppHeader paddingBottom={4} />
      <View style={{ height: 1, backgroundColor: "#2A2A2A" }} />

      <FlatList
        data={entries}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor="#CC0000"
          />
        }
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#F5F5F5",
                marginBottom: 4,
              }}
            >
              Leaderboard
            </Text>
            <Text style={{ fontSize: 13, color: "#888888" }}>
              Partida ao vivo · atualiza a cada 30s
            </Text>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Ionicons name="trophy-outline" size={40} color="#888888" />
              <Text style={{ color: "#888888", marginTop: 12 }}>
                Nenhum jogador ainda
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isMe = item.userId === userId;
          const teamColor = TEAM_COLORS[item.teamId ?? ""] ?? "#CC0000";

          return (
            <View
              accessibilityRole="text"
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: isMe ? "#CC000015" : "transparent",
                borderBottomWidth: 1,
                borderBottomColor: "#1A1A1A",
              }}
            >
              {/* Rank */}
              <View style={{ width: 32, alignItems: "center" }}>
                {item.rank <= 3 ? (
                  <Text style={{ fontSize: 18 }}>
                    {item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉"}
                  </Text>
                ) : (
                  <Text style={{ fontSize: 14, color: "#888888", fontWeight: "600" }}>
                    {item.rank}
                  </Text>
                )}
              </View>

              {/* Avatar */}
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: teamColor + "33",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: 8,
                  marginRight: 12,
                  borderWidth: 1.5,
                  borderColor: teamColor,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: teamColor }}>
                  {(item.userName[0] ?? "?").toUpperCase()}
                </Text>
              </View>

              {/* Name + badges */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isMe ? "700" : "500",
                      color: isMe ? "#CC0000" : "#F5F5F5",
                    }}
                    numberOfLines={1}
                  >
                    {item.userName}
                    {isMe ? " (você)" : ""}
                  </Text>
                  {item.currentStreak >= 3 ? (
                    <Text style={{ fontSize: 12 }}>🔥</Text>
                  ) : null}
                </View>
                {item.badges.length > 0 ? (
                  <Text style={{ fontSize: 11, marginTop: 2 }}>
                    {item.badges
                      .slice(0, 4)
                      .map((b) => BADGE_EMOJIS[b] ?? "🏅")
                      .join(" ")}
                  </Text>
                ) : null}
              </View>

              {/* Score */}
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#F5F5F5" }}
                >
                  {item.score}
                </Text>
                <Text style={{ fontSize: 11, color: "#888888" }}>
                  {item.correctCount}/{item.correctCount + item.wrongCount} ✓
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={{ paddingBottom: 32 }}
      />
    </View>
  );
}
