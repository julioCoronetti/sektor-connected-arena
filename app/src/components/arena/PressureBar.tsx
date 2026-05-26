import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { Match, PressureBarState, TeamKpis } from "../../types";

interface PressureBarProps {
  pressureBar: PressureBarState;
  match: Match;
  homeKpis?: TeamKpis | null;
  guestKpis?: TeamKpis | null;
  /** ID do time do usuário logado (ex: "team-a" ou "team-b"). */
  userTeamId?: string | null;
}

/**
 * Barra de pressão/posse entre os dois times.
 * Destaca o lado do time do usuário com badge "Sua Torcida".
 * Quando KPIs reais estão disponíveis, exibe métricas adicionais (xG, passes, chutes).
 */
export function PressureBar({
  pressureBar,
  match,
  homeKpis,
  guestKpis,
  userTeamId,
}: PressureBarProps) {
  const safeA = Math.max(0, pressureBar.teamA);
  const safeB = Math.max(0, pressureBar.teamB);
  const total = safeA + safeB;
  const widthA = total > 0 ? (safeA / total) * 100 : 50;
  const widthB = 100 - widthA;

  const hasKpis = homeKpis != null && guestKpis != null;

  const isUserTeamA = userTeamId === match.teamA.id;
  const isUserTeamB = userTeamId === match.teamB.id;

  return (
    <View className="px-4 py-3" testID="pressure-bar">
      {/* Nomes dos times + badge "Sua Torcida" */}
      <View className="mb-1 flex-row justify-between items-end">
        <View className="items-start gap-0.5">
          <Text
            className="text-sm font-bold"
            style={{ color: match.teamA.color }}
          >
            {match.teamA.name}
          </Text>
          {isUserTeamA ? (
            <Text className="text-xs font-semibold" style={{ color: match.teamA.color }}>
              ⚡ Sua Torcida
            </Text>
          ) : null}
        </View>

        <Text className="text-xs text-gray-400">Pressão</Text>

        <View className="items-end gap-0.5">
          <Text
            className="text-sm font-bold"
            style={{ color: match.teamB.color }}
          >
            {match.teamB.name}
          </Text>
          {isUserTeamB ? (
            <Text className="text-xs font-semibold" style={{ color: match.teamB.color }}>
              Sua Torcida ⚡
            </Text>
          ) : null}
        </View>
      </View>

      {/* Barra principal de pressão */}
      <View
        className="h-6 flex-row overflow-hidden rounded-full bg-gray-800"
        style={
          isUserTeamA
            ? { borderWidth: 2, borderColor: match.teamA.color }
            : isUserTeamB
              ? { borderWidth: 2, borderColor: match.teamB.color }
              : undefined
        }
      >
        <View
          testID="pressure-bar-team-a"
          style={{ flex: widthA, backgroundColor: match.teamA.color }}
        />
        <View
          testID="pressure-bar-team-b"
          style={{ flex: widthB, backgroundColor: match.teamB.color }}
        />
      </View>

      {/* Percentuais */}
      <View className="mt-1 flex-row justify-between">
        <Text className="text-xs font-semibold" style={{ color: match.teamA.color }}>
          {Math.round(widthA)}%{isUserTeamA ? (
            <> <MaterialCommunityIcons name="fire" size={12} color={match.teamA.color} /></>
          ) : ""}
        </Text>
        <Text className="text-xs font-semibold" style={{ color: match.teamB.color }}>
          {isUserTeamB ? (
            <><MaterialCommunityIcons name="fire" size={12} color={match.teamB.color} /> </>
          ) : ""}{Math.round(widthB)}%
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
