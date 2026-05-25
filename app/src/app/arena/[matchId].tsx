import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  const setMatch = useArenaStore((s) => s.setMatch);
  const setActivePrediction = useArenaStore((s) => s.setActivePrediction);
  const updatePressure = useArenaStore((s) => s.updatePressure);
  const markAnswered = useArenaStore((s) => s.markAnswered);
  const markSendFailure = useArenaStore((s) => s.markSendFailure);
  const clearSendFailure = useArenaStore((s) => s.clearSendFailure);
  const setMyScore = useArenaStore((s) => s.setMyScore);
  const setPositionsFrame = useArenaStore((s) => s.setPositionsFrame);
  const addMatchEvent = useArenaStore((s) => s.addMatchEvent);
  const setTeamKpis = useArenaStore((s) => s.setTeamKpis);
  const reset = useArenaStore((s) => s.reset);

  const userId = useAuthStore((s) => s.user?.id ?? null);

  const { isInStadium, multiplier } = useLocation();

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
            });
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
          // Sincroniza a barra de posse com os KPIs reais.
          updatePressure({
            teamA: message.home.possession,
            teamB: message.guest.possession,
          });
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
      <View className="flex-1 items-center justify-center bg-sektor-bg">
        <Text className="text-sektor-text">Carregando partida…</Text>
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
    <View className="flex-1 bg-sektor-bg">
      {/* Badge GPS */}
      {isInStadium ? (
        <View className="absolute right-4 top-16 z-10 flex-row items-center gap-1 rounded-full bg-green-500 px-3 py-1">
          <Text className="text-xs font-bold text-white">📍 Na Arena 2x</Text>
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cabeçalho da partida */}
        <View className="items-center pb-1 pt-12">
          <Text className="text-xl font-bold text-sektor-text">
            {match.teamA.name} vs {match.teamB.name}
          </Text>

          {/* Placar */}
          {match.score != null ? (
            <View className="mt-1 flex-row items-center gap-3">
              <Text className="text-3xl font-bold text-sektor-text">
                {match.score.home} – {match.score.guest}
              </Text>
            </View>
          ) : null}

          <Text className="mt-1 text-sektor-muted">
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

        {/* Score do usuário */}
        <View className="mx-4 mb-3 mt-3 flex-row items-center justify-between rounded-xl bg-sektor-surface px-4 py-2">
          <Text className="text-sektor-muted">Seus pontos</Text>
          <Text className="text-base font-bold text-sektor-text">
            {myScore.score}{" "}
            <Text className="text-xs text-sektor-muted">
              ({myScore.correctCount}/
              {myScore.correctCount + myScore.wrongCount})
            </Text>
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
        />

        {/* Feed de eventos recentes */}
        <MatchEventFeed events={recentEvents} match={match} />

        {/* Indicador de tracking ativo */}
        {positionsFrame != null ? (
          <View className="mx-4 mb-3 flex-row items-center gap-2 rounded-xl bg-sektor-surface px-4 py-2">
            <View className="h-2 w-2 rounded-full bg-green-400" />
            <Text className="text-xs text-sektor-muted">
              Tracking ao vivo · Frame {positionsFrame.frameN}
            </Text>
            <Text className="ml-auto text-xs text-sektor-muted">
              {positionsFrame.players.length} jogadores
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Botão AR — fixo sobre o scroll */}
      <TouchableOpacity
        accessibilityRole="button"
        className="absolute bottom-8 right-6 flex-row items-center gap-2 rounded-full bg-white/20 px-4 py-3"
        onPress={() => setArMode(true)}
      >
        <Text className="font-bold text-white">
          📷 {positionsFrame != null ? "AR + Tracking" : "Modo AR"}
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
