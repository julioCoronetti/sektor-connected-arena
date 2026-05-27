import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { ARView } from "../../components/arena/ARView";
import { MatchEventFeed } from "../../components/arena/MatchEventFeed";
import { PredictionCard } from "../../components/arena/PredictionCard";
import { PressureBar } from "../../components/arena/PressureBar";
import { API_WS_URL, TEAMS } from "../../constants/config";
import { useLocation } from "../../hooks/useLocation";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getIdToken } from "../../services/auth";
import {
  buildAnswerMessage,
  parseServerMessage,
} from "../../services/arenaProtocol";
import { useArenaStore } from "../../store/arenaStore";
import { useAuthStore } from "../../store/authStore";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Conectando…",
  open: "Ao vivo",
  reconnecting: "Reconectando…",
  closed: "Desconectado",
};

const SENTIMENT_COLORS: Record<string, string> = {
  eufórica: "#22c55e",
  confiante: "#3b82f6",
  ansiosa: "#f59e0b",
  decepcionada: "#ef4444",
  neutra: "#6b7280",
};

const BADGE_LABELS: Record<string, string> = {
  "first-correct": "🎯 Primeira Resposta Certa",
  "streak-3": "🔥 Sequência de 3",
  "streak-5": "🔥🔥 Sequência de 5",
  "streak-10": "🏆 Hot Hand",
  "in-stadium": "📍 Na Arena",
  "score-100": "💯 Centena",
  "perfect-half": "⭐ Primeiro Tempo Perfeito",
};

export default function ArenaScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [arMode, setArMode] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // ── Store selectors ──────────────────────────────────────────────────────
  const match = useArenaStore((s) => s.match);
  const pressureBar = useArenaStore((s) => s.pressureBar);
  const activePrediction = useArenaStore((s) => s.activePrediction);
  const answeredIds = useArenaStore((s) => s.answeredPredictionIds);
  const lastSendFailure = useArenaStore((s) => s.lastSendFailure);
  const myScore = useArenaStore((s) => s.myScore);
  const positionsFrame = useArenaStore((s) => s.positionsFrame);
  const recentEvents = useArenaStore((s) => s.recentEvents);
  const homeKpis = useArenaStore((s) => s.homeKpis);
  const guestKpis = useArenaStore((s) => s.guestKpis);
  const sentimentAlert = useArenaStore((s) => s.sentimentAlert);
  const pendingBadges = useArenaStore((s) => s.pendingBadges);

  const setMatch = useArenaStore((s) => s.setMatch);
  const setActivePrediction = useArenaStore((s) => s.setActivePrediction);
  const updatePressure = useArenaStore((s) => s.updatePressure);
  const markAnswered = useArenaStore((s) => s.markAnswered);
  const markSendFailure = useArenaStore((s) => s.markSendFailure);
  const clearSendFailure = useArenaStore((s) => s.clearSendFailure);  const setMyScore = useArenaStore((s) => s.setMyScore);
  const setPositionsFrame = useArenaStore((s) => s.setPositionsFrame);
  const addMatchEvent = useArenaStore((s) => s.addMatchEvent);
  const setTeamKpis = useArenaStore((s) => s.setTeamKpis);
  const setSentimentAlert = useArenaStore((s) => s.setSentimentAlert);
  const addPendingBadges = useArenaStore((s) => s.addPendingBadges);
  const clearPendingBadges = useArenaStore((s) => s.clearPendingBadges);
  const reset = useArenaStore((s) => s.reset);

  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userTeamId = useAuthStore((s) => s.user?.teamId ?? null);

  const { isInStadium, permissionDenied, multiplier } = useLocation();

  // ── Inicialização da partida ─────────────────────────────────────────────
  useEffect(() => {
    setMatch({
      id: matchId ?? "unknown",
      teamA: TEAMS[0],
      teamB: TEAMS[1],
      minute: 0,
      status: "live",
      gameSection: "firstHalf",
      score: { home: 0, guest: 0 },
    });
    return () => {
      reset();
    };
  }, [matchId, setMatch, reset]);

  // ── URL do WebSocket com token Cognito ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getIdToken();
      if (cancelled) return;
      const params = new URLSearchParams({ matchId: matchId ?? "" });
      if (token) params.set("token", token);
      setWsUrl(`${API_WS_URL}?${params.toString()}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // ── Handler de mensagens WebSocket ──────────────────────────────────────
  const handleMessage = useCallback(
    (raw: unknown) => {
      const message = parseServerMessage(raw);
      if (!message) return;

      switch (message.type) {
        case "MATCH_STATE":
          setMatch(message.match);
          updatePressure(message.pressureBar);
          break;

        case "PREDICTION":
          setActivePrediction(message.prediction);
          break;

        case "PRESSURE_UPDATE":
          updatePressure(message.pressureBar);
          break;

        case "PREDICTION_RESULT":
          // O modal já é fechado localmente ao expirar; nada a fazer aqui.
          break;

        case "SCORE_UPDATE":
          if (message.userId === userIdRef.current) {
            setMyScore({
              score: message.score,
              correctCount: message.correctCount,
              wrongCount: message.wrongCount,
              currentStreak: message.currentStreak,
              bestStreak: message.bestStreak,
              badges: [],
            });
            if (message.badgesUnlocked && message.badgesUnlocked.length > 0) {
              addPendingBadges(message.badgesUnlocked);
            }
          }
          break;

        case "ANSWER_ACCEPTED":
          clearSendFailure();
          break;

        case "ANSWER_REJECTED":
          // UI poderia exibir um toast com o motivo.
          break;

        case "PLAYER_POSITIONS":
          // Atualiza o frame de posições — usado pelo ARView e mini-mapa.
          setPositionsFrame(message.frame);
          break;

        case "MATCH_EVENT":
          // Adiciona ao feed de eventos e atualiza placar se for gol.
          addMatchEvent(message.event);
          if (message.event.type === "goal" && message.event.currentResult) {
            const parts = message.event.currentResult.split(":");
            if (parts.length === 2) {
              const home = parseInt(parts[0], 10);
              const guest = parseInt(parts[1], 10);
              if (!isNaN(home) && !isNaN(guest)) {
                setMatch({
                  ...(match ?? {
                    id: matchId ?? "unknown",
                    teamA: TEAMS[0],
                    teamB: TEAMS[1],
                    minute: message.event.minute,
                    status: "live" as const,
                  }),
                  score: { home, guest },
                  minute: message.event.minute,
                });
              }
            }
          }
          break;

        case "TEAM_KPIS":
          setTeamKpis(message.home, message.guest);
          // Sync pressure bar with real possession KPIs
          updatePressure({
            teamA: message.home.possession,
            teamB: message.guest.possession,
          });
          break;

        case "SENTIMENT_ALERT":
          setSentimentAlert({
            teamId: message.teamId,
            sentiment: message.sentiment,
            intensity: message.intensity,
            summary: message.summary,
            receivedAt: Date.now(),
          });
          // Auto-dismiss after 30s
          setTimeout(() => setSentimentAlert(null), 30_000);
          break;
      }
    },
    [
      setMatch,
      setActivePrediction,
      updatePressure,
      setMyScore,
      clearSendFailure,
      setPositionsFrame,
      addMatchEvent,
      setTeamKpis,
      setSentimentAlert,
      addPendingBadges,
      match,
      matchId,
    ],
  );

  const { status, send } = useWebSocket(wsUrl ?? "", handleMessage);

  // ── Resposta a predições ─────────────────────────────────────────────────
  const activePredictionRef = useRef(activePrediction);
  useEffect(() => {
    activePredictionRef.current = activePrediction;
  }, [activePrediction]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      const current = activePredictionRef.current;
      if (!current) return;

      if (answeredIds.includes(current.id)) {
        setActivePrediction(null);
        return;
      }

      const now = Date.now();
      const expiresAt = new Date(current.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && now >= expiresAt) {
        setActivePrediction(null);
        return;
      }

      const ok = send(
        buildAnswerMessage({
          predictionId: current.id,
          selectedOption: optionIndex,
          gpsMultiplier: multiplier,
        }),
      );

      if (ok) {
        markAnswered(current.id);
        clearSendFailure();
      } else {
        markSendFailure(current.id);
      }
      setActivePrediction(null);
    },
    [
      answeredIds,
      send,
      multiplier,
      markAnswered,
      markSendFailure,
      clearSendFailure,
      setActivePrediction,
    ],
  );

  const handleExpire = useCallback(() => {
    setActivePrediction(null);
  }, [setActivePrediction]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (!match) {
    return (
      <View className="flex-1 items-center justify-center bg-sektor-bg dark:bg-sektor-dark-bg">
        <Text className="text-sektor-text dark:text-sektor-dark-text">Carregando partida…</Text>
      </View>
    );
  }

  if (arMode) {
    return (
      <ARView
        match={match}
        pressureBar={pressureBar}
        positionsFrame={positionsFrame}
        onClose={() => setArMode(false)}
      />
    );
  }

  // ── Render principal ─────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-sektor-bg dark:bg-sektor-dark-bg">
      {/* Badge GPS */}
      {isInStadium ? (
        <View className="absolute right-4 top-16 z-10 flex-row items-center gap-1 rounded-full bg-green-500 px-3 py-1">
          <Text className="text-xs font-bold text-white">📍 Na Arena 2x</Text>
        </View>
      ) : permissionDenied ? (
        <View className="absolute right-4 top-16 z-10 flex-row items-center gap-1 rounded-full bg-gray-600 px-3 py-1">
          <Text className="text-xs font-bold text-white">📍 1x (sem GPS)</Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho da partida */}
        <View className="items-center pb-1 pt-12">
          <View className="flex-row items-center gap-2">
            <Text className="text-xl font-bold text-sektor-text dark:text-sektor-dark-text">
              {match.teamA.name} vs {match.teamB.name}
            </Text>
          </View>

          {/* Badge do time do usuário */}
          {userTeamId ? (
            <View className="mt-1 flex-row items-center gap-1 rounded-full px-3 py-0.5"
              style={{
                backgroundColor:
                  userTeamId === match.teamA.id
                    ? match.teamA.color + "33"
                    : match.teamB.color + "33",
              }}
            >
              <MaterialCommunityIcons
                name="stadium"
                size={12}
                color={userTeamId === match.teamA.id ? match.teamA.color : match.teamB.color}
              />
              <Text
                className="text-xs font-bold"
                style={{
                  color:
                    userTeamId === match.teamA.id
                      ? match.teamA.color
                      : match.teamB.color,
                }}
              >
                {" "}Sua Torcida:{" "}
                {userTeamId === match.teamA.id
                  ? match.teamA.name
                  : match.teamB.name}
              </Text>
            </View>
          ) : null}

          {/* Placar */}
          {match.score != null ? (
            <View className="mt-1 flex-row items-center gap-3">
              <Text className="text-3xl font-bold text-sektor-text dark:text-sektor-dark-text">
                {match.score.home} – {match.score.guest}
              </Text>
            </View>
          ) : null}

          <Text className="mt-1 text-sektor-muted dark:text-sektor-dark-muted">
            {match.minute}&apos;
            {match.gameSection === "secondHalf" ? " · 2º Tempo" : " · 1º Tempo"}
          </Text>

          <Text
            testID="ws-status"
            className={`mt-1 text-xs ${
              status === "open" ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {STATUS_LABEL[status] ?? status}
          </Text>
        </View>

        {/* Badge toast */}
        {pendingBadges.length > 0 ? (
          <View
            style={{
              position: "absolute",
              top: 60,
              left: 16,
              right: 16,
              zIndex: 20,
              backgroundColor: "#1A1A1A",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "#CC0000",
            }}
          >
            <Text style={{ color: "#F5F5F5", fontWeight: "700", fontSize: 13 }}>
              🏅 Conquista desbloqueada!
            </Text>
            {pendingBadges.map((b) => (
              <Text key={b} style={{ color: "#CC0000", fontSize: 13, marginTop: 2 }}>
                {BADGE_LABELS[b] ?? b}
              </Text>
            ))}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar notificação de conquista"
              onPress={clearPendingBadges}
              style={{ marginTop: 8 }}
            >
              <Text style={{ color: "#888888", fontSize: 12 }}>Fechar</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Sentiment alert banner */}
        {sentimentAlert && sentimentAlert.intensity >= 60 ? (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 10,
              padding: 10,
              backgroundColor:
                (SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280") + "22",
              borderLeftWidth: 3,
              borderLeftColor:
                SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280",
            }}
          >
            <Text
              style={{
                color: SENTIMENT_COLORS[sentimentAlert.sentiment] ?? "#6b7280",
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              💬 Torcida {sentimentAlert.teamId === "team-a" ? "A" : "B"} está{" "}
              {sentimentAlert.sentiment}
            </Text>
            <Text style={{ color: "#888888", fontSize: 11, marginTop: 2 }}>
              {sentimentAlert.summary}
            </Text>
          </View>
        ) : null}

        {/* Score do usuário */}
        <View className="mx-4 mb-3 mt-3 flex-row items-center justify-between rounded-xl bg-sektor-surface dark:bg-sektor-dark-surface px-4 py-2">
          <Text className="text-sektor-muted dark:text-sektor-dark-muted">Seus pontos</Text>
          <Text className="text-base font-bold text-sektor-text dark:text-sektor-dark-text">
            {myScore.score}{" "}
            <Text className="text-xs text-sektor-muted dark:text-sektor-dark-muted">
              ({myScore.correctCount}/
              {myScore.correctCount + myScore.wrongCount})
            </Text>
            {myScore.currentStreak >= 3 ? (
              <Text> 🔥{myScore.currentStreak}</Text>
            ) : null}
          </Text>
        </View>

        {/* Indicação de falha de envio */}
        {lastSendFailure ? (
          <View
            testID="answer-send-failure"
            className="mx-4 mb-3 rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-2"
          >
            <Text className="text-xs font-bold text-red-300">
              ⚠️ Falha ao enviar resposta — verifique a conexão
            </Text>
          </View>
        ) : null}

        {/* Barra de posse + KPIs */}
        <PressureBar
          pressureBar={pressureBar}
          match={match}
          homeKpis={homeKpis}
          guestKpis={guestKpis}
          userTeamId={userTeamId}
        />

        {/* Feed de eventos recentes */}
        <MatchEventFeed events={recentEvents} match={match} />

        {/* Indicador de tracking ativo */}
        {positionsFrame != null ? (
          <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-xl bg-sektor-surface dark:bg-sektor-dark-surface px-4 py-2">
            <View className="h-2 w-2 rounded-full bg-green-400" />
            <Text className="text-xs text-sektor-muted dark:text-sektor-dark-muted">
              Tracking ao vivo · Frame {positionsFrame.frameN}
            </Text>
            <Text className="ml-auto text-xs text-sektor-muted dark:text-sektor-dark-muted">
              {positionsFrame.players.length} jogadores
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Botão AR — fixo sobre o scroll */}
      <TouchableOpacity
        accessibilityRole="button"
        className="absolute bottom-8 right-6 flex-row items-center gap-2 rounded-full px-4 py-3"
        style={{ backgroundColor: "#1a1a2e", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}
        onPress={() => setArMode(true)}
      >
        <Ionicons name="camera" size={18} color="white" />
        <Text className="font-bold text-white">
          {positionsFrame != null ? "AR + Tracking" : "Modo AR"}
        </Text>
      </TouchableOpacity>

      {/* Modal de predição */}
      <PredictionCard
        prediction={activePrediction}
        onAnswer={handleAnswer}
        onExpire={handleExpire}
      />
    </View>
  );
}
