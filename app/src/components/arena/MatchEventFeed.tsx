import { ScrollView, Text, View } from "react-native";

import type { Match, MatchEvent, MatchEventType } from "../../types";

interface MatchEventFeedProps {
  events: MatchEvent[];
  match: Match;
}

const EVENT_ICON: Record<MatchEventType, string> = {
  goal: "⚽",
  shot: "🎯",
  foul: "🟡",
  yellowCard: "🟨",
  redCard: "🟥",
  corner: "🚩",
  freeKick: "🦵",
  throwIn: "🤾",
  kickOff: "🏁",
  substitution: "🔄",
  other: "•",
};

const EVENT_LABEL: Record<MatchEventType, string> = {
  goal: "Gol",
  shot: "Chute",
  foul: "Falta",
  yellowCard: "Cartão Amarelo",
  redCard: "Cartão Vermelho",
  corner: "Escanteio",
  freeKick: "Falta",
  throwIn: "Lateral",
  kickOff: "Início",
  substitution: "Substituição",
  other: "Evento",
};

/**
 * Feed compacto dos últimos eventos da partida.
 * Exibe os eventos mais recentes no topo (ordem reversa).
 */
export function MatchEventFeed({ events, match }: MatchEventFeedProps) {
  if (events.length === 0) return null;

  // Mais recentes primeiro
  const sorted = [...events].reverse();

  return (
    <View className="mx-4 mb-3">
      <Text className="mb-1 text-xs font-semibold text-sektor-muted">
        Eventos recentes
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row"
      >
        {sorted.map((event) => {
          const isTeamA = event.teamId === match.teamA.id;
          const teamColor = isTeamA ? match.teamA.color : match.teamB.color;
          const teamName = isTeamA ? match.teamA.name : match.teamB.name;
          const isHighlight = event.type === "goal" || event.type === "redCard";

          return (
            <View
              key={event.eventId}
              className={`mr-2 rounded-xl px-3 py-2 ${
                isHighlight ? "border border-yellow-400/40 bg-yellow-900/30" : "bg-sektor-surface"
              }`}
              style={{ minWidth: 100 }}
            >
              <View className="flex-row items-center gap-1">
                <Text className="text-base">
                  {EVENT_ICON[event.type]}
                </Text>
                <Text className="text-xs font-bold text-sektor-text">
                  {event.minute}&apos;
                </Text>
              </View>
              <Text className="mt-0.5 text-xs text-sektor-muted">
                {EVENT_LABEL[event.type]}
              </Text>
              <Text
                className="text-xs font-semibold"
                style={{ color: teamColor }}
                numberOfLines={1}
              >
                {event.playerName ?? teamName}
              </Text>
              {event.xG != null ? (
                <Text className="text-xs text-gray-500">
                  xG {event.xG.toFixed(2)}
                </Text>
              ) : null}
              {event.currentResult != null ? (
                <Text className="text-xs font-bold text-yellow-300">
                  {event.currentResult}
                </Text>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
