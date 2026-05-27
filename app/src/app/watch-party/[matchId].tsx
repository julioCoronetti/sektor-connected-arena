/**
 * Watch Party — read-only fullscreen view for TV/projector/laptop.
 * No auth required. Connects as spectator via WebSocket.
 * Shows: scoreboard, pressure bar, live leaderboard top 5, sentiment alert, active prediction.
 */
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Platform, Text, View } from "react-native";

import { API_WS_URL } from "../../constants/config";
import { useWebSocket } from "../../hooks/useWebSocket";
import { parseServerMessage } from "../../services/arenaProtocol";
import type { Match, PressureBarState } from "../../types";

interface LeaderboardEntry {
  userId: string;
  userName: string;
  teamId: string | null;
  score: number;
  currentStreak: number;
}

const TEAM_COLORS: Record<string, string> = {
  "team-a": "#E63946",
  "team-b": "#1D3557",
};

const SENTIMENT_COLORS: Record<string, string> = {
  eufórica: "#22c55e",
  confiante: "#3b82f6",
  ansiosa: "#f59e0b",
  decepcionada: "#ef4444",
  neutra: "#6b7280",
};

export default function WatchPartyScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const [match, setMatch] = useState<Match | null>(null);
  const [pressureBar, setPressureBar] = useState<PressureBarState>({ teamA: 50, teamB: 50 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activePrediction, setActivePrediction] = useState<string | null>(null);
  const [sentimentAlert, setSentimentAlert] = useState<{
    teamId: string;
    sentiment: string;
    summary: string;
  } | null>(null);

  // Spectator WS URL — no token, mode=spectator
  const wsUrl = `${API_WS_URL}?matchId=${matchId ?? ""}&mode=spectator`;

  const handleMessage = useCallback((raw: unknown) => {
    const message = parseServerMessage(raw);
    if (!message) return;

    switch (message.type) {
      case "MATCH_STATE":
        setMatch(message.match);
        setPressureBar(message.pressureBar);
        break;
      case "PRESSURE_UPDATE":
        setPressureBar(message.pressureBar);
        break;
      case "PREDICTION":
        setActivePrediction(message.prediction.question);
        setTimeout(() => setActivePrediction(null), 15_000);
        break;
      case "PREDICTION_RESULT":
        setActivePrediction(null);
        break;
      case "SCORE_UPDATE":
        setLeaderboard((prev) => {
          const idx = prev.findIndex((e) => e.userId === message.userId);
          let updated: LeaderboardEntry[];
          if (idx >= 0) {
            updated = prev.map((e) =>
              e.userId === message.userId
                ? { ...e, score: message.score, currentStreak: message.currentStreak }
                : e,
            );
          } else {
            updated = [
              ...prev,
              {
                userId: message.userId,
                userName: "Fã",
                teamId: null,
                score: message.score,
                currentStreak: message.currentStreak,
              },
            ];
          }
          return updated.sort((a, b) => b.score - a.score).slice(0, 5);
        });
        break;
      case "TEAM_KPIS":
        setPressureBar({
          teamA: message.home.possession,
          teamB: message.guest.possession,
        });
        break;
      case "SENTIMENT_ALERT":
        if (message.intensity >= 60) {
          setSentimentAlert({
            teamId: message.teamId,
            sentiment: message.sentiment,
            summary: message.summary,
          });
          setTimeout(() => setSentimentAlert(null), 30_000);
        }
        break;
    }
  }, []);

  const { status } = useWebSocket(wsUrl, handleMessage);

  const isWeb = Platform.OS === "web";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0A0A0A",
        padding: isWeb ? 40 : 20,
      }}
    >
      {/* Header — match title + status */}
      <View style={{ alignItems: "center", marginBottom: 24 }}>
        <Text
          style={{
            fontSize: isWeb ? 14 : 11,
            color: status === "open" ? "#22c55e" : "#f59e0b",
            fontWeight: "600",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {status === "open" ? "● AO VIVO" : "● CONECTANDO…"}
        </Text>

        {match ? (
          <>
            <Text
              style={{
                fontSize: isWeb ? 28 : 20,
                fontWeight: "700",
                color: "#F5F5F5",
                textAlign: "center",
              }}
            >
              {match.teamA.name} vs {match.teamB.name}
            </Text>
            {match.score != null ? (
              <Text
                style={{
                  fontSize: isWeb ? 72 : 48,
                  fontWeight: "900",
                  color: "#FFFFFF",
                  marginTop: 8,
                  letterSpacing: -2,
                }}
              >
                {match.score.home} – {match.score.guest}
              </Text>
            ) : null}
            <Text style={{ fontSize: isWeb ? 18 : 14, color: "#888888", marginTop: 4 }}>
              {match.minute}&apos;
              {match.gameSection === "secondHalf" ? " · 2º Tempo" : " · 1º Tempo"}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 20, color: "#888888" }}>Aguardando partida…</Text>
        )}
      </View>

      {/* Sentiment alert */}
      {sentimentAlert ? (
        <View
          style={{
            marginBottom: 16,
            borderRadius: 10,
            padding: 12,
            backgroundColor:
              (SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280") + "22",
            borderLeftWidth: 4,
            borderLeftColor: SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280",
          }}
        >
          <Text
            style={{
              color: SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280",
              fontSize: isWeb ? 16 : 13,
              fontWeight: "700",
            }}
          >
            💬 Torcida {sentimentAlert.teamId === "team-a" ? "A" : "B"} está{" "}
            {sentimentAlert.sentiment}
          </Text>
          <Text style={{ color: "#888888", fontSize: isWeb ? 14 : 11, marginTop: 4 }}>
            {sentimentAlert.summary}
          </Text>
        </View>
      ) : null}

      {/* Active prediction */}
      {activePrediction ? (
        <View
          style={{
            marginBottom: 20,
            borderRadius: 14,
            padding: 16,
            backgroundColor: "#1A1A1A",
            borderWidth: 1,
            borderColor: "#CC0000",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#CC0000", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
            PREDIÇÃO AO VIVO
          </Text>
          <Text
            style={{
              color: "#F5F5F5",
              fontSize: isWeb ? 20 : 15,
              fontWeight: "600",
              textAlign: "center",
              marginTop: 8,
            }}
          >
            {activePrediction}
          </Text>
        </View>
      ) : null}

      {/* Pressure bar */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: isWeb ? 16 : 13 }}>
            {match?.teamA.name ?? "Time A"}
          </Text>
          <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: isWeb ? 16 : 13 }}>
            {match?.teamB.name ?? "Time B"}
          </Text>
        </View>
        <View
          style={{
            height: isWeb ? 28 : 18,
            borderRadius: 14,
            overflow: "hidden",
            flexDirection: "row",
            backgroundColor: "#1A1A1A",
          }}
        >
          <View
            style={{
              flex: pressureBar.teamA,
              backgroundColor: match?.teamA.color ?? "#E63946",
            }}
          />
          <View
            style={{
              flex: pressureBar.teamB,
              backgroundColor: match?.teamB.color ?? "#1D3557",
            }}
          />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: "#888888", fontSize: isWeb ? 14 : 11 }}>
            {pressureBar.teamA.toFixed(0)}%
          </Text>
          <Text style={{ color: "#888888", fontSize: isWeb ? 14 : 11 }}>
            {pressureBar.teamB.toFixed(0)}%
          </Text>
        </View>
      </View>

      {/* Leaderboard top 5 */}
      <View>
        <Text
          style={{
            color: "#888888",
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1.5,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Top 5 Fãs
        </Text>
        {leaderboard.length === 0 ? (
          <Text style={{ color: "#444444", fontSize: 13 }}>
            Aguardando respostas…
          </Text>
        ) : (
          leaderboard.map((entry, idx) => (
            <View
              key={entry.userId}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: "#1A1A1A",
              }}
            >
              <Text style={{ color: "#888888", width: 24, fontSize: isWeb ? 16 : 13 }}>
                {idx + 1}
              </Text>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: (TEAM_COLORS[entry.teamId ?? ""] ?? "#CC0000") + "33",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                }}
              >
                <Text style={{ color: TEAM_COLORS[entry.teamId ?? ""] ?? "#CC0000", fontWeight: "700" }}>
                  {(entry.userName[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <Text style={{ flex: 1, color: "#F5F5F5", fontSize: isWeb ? 16 : 13 }}>
                {entry.userName}
                {entry.currentStreak >= 3 ? " 🔥" : ""}
              </Text>
              <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: isWeb ? 18 : 14 }}>
                {entry.score}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
