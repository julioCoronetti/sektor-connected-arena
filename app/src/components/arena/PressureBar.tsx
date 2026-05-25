import { Text, View } from "react-native";

import type { Match, PressureBarState, TeamKpis } from "../../types";

interface PressureBarProps {
  pressureBar: PressureBarState;
  match: Match;
  homeKpis?: TeamKpis | null;
  guestKpis?: TeamKpis | null;
}

/**
 * Barra de posse de bola entre os dois times.
 * Quando KPIs reais estão disponíveis, exibe métricas adicionais (xG, passes, chutes).
 * A largura de cada lado é proporcional à posse de bola recebida via WebSocket.
 */
export function PressureBar({
  pressureBar,
  match,
  homeKpis,
  guestKpis,
}: PressureBarProps) {
  const safeA = Math.max(0, pressureBar.teamA);
  const safeB = Math.max(0, pressureBar.teamB);
  const total = safeA + safeB;
  const widthA = total > 0 ? (safeA / total) * 100 : 50;
  const widthB = 100 - widthA;

  const hasKpis = homeKpis != null && guestKpis != null;

  return (
    <View className="px-4 py-3" testID="pressure-bar">
      {/* Nomes dos times */}
      <View className="mb-1 flex-row justify-between">
        <Text
          className="text-sm font-bold"
          style={{ color: match.teamA.color }}
        >
          {match.teamA.name}
        </Text>
        <Text className="text-xs text-gray-400">Posse</Text>
        <Text
          className="text-sm font-bold"
          style={{ color: match.teamB.color }}
        >
          {match.teamB.name}
        </Text>
      </View>

      {/* Barra principal de posse */}
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

      {/* Percentuais de posse */}
      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs font-semibold" style={{ color: match.teamA.color }}>
          {Math.round(widthA)}%
        </Text>
        <Text className="text-xs font-semibold" style={{ color: match.teamB.color }}>
          {Math.round(widthB)}%
        </Text>
      </View>

      {/* KPIs reais quando disponíveis */}
      {hasKpis ? (
        <View className="mt-3 flex-row justify-between rounded-xl bg-gray-900/60 px-3 py-2">
          {/* Time A */}
          <View className="items-start gap-1">
            <KpiRow
              label="xG"
              value={homeKpis.xG.toFixed(2)}
              color={match.teamA.color}
            />
            <KpiRow
              label="Chutes"
              value={`${homeKpis.shotsOnTarget}/${homeKpis.totalShots}`}
              color={match.teamA.color}
            />
            <KpiRow
              label="Passes"
              value={`${homeKpis.completedPasses}/${homeKpis.totalPasses}`}
              color={match.teamA.color}
            />
            <KpiRow
              label="Faltas"
              value={String(homeKpis.fouls)}
              color={match.teamA.color}
            />
          </View>

          {/* Separador */}
          <View className="w-px bg-gray-700" />

          {/* Time B */}
          <View className="items-end gap-1">
            <KpiRow
              label="xG"
              value={guestKpis.xG.toFixed(2)}
              color={match.teamB.color}
              reverse
            />
            <KpiRow
              label="Chutes"
              value={`${guestKpis.shotsOnTarget}/${guestKpis.totalShots}`}
              color={match.teamB.color}
              reverse
            />
            <KpiRow
              label="Passes"
              value={`${guestKpis.completedPasses}/${guestKpis.totalPasses}`}
              color={match.teamB.color}
              reverse
            />
            <KpiRow
              label="Faltas"
              value={String(guestKpis.fouls)}
              color={match.teamB.color}
              reverse
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente auxiliar
// ---------------------------------------------------------------------------

interface KpiRowProps {
  label: string;
  value: string;
  color: string;
  reverse?: boolean;
}

function KpiRow({ label, value, color, reverse = false }: KpiRowProps) {
  return (
    <View className={`flex-row items-center gap-1 ${reverse ? "flex-row-reverse" : ""}`}>
      <Text className="text-xs text-gray-400">{label}</Text>
      <Text className="text-xs font-bold" style={{ color }}>
        {value}
      </Text>
    </View>
  );
}
