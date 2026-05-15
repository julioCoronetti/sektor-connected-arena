import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { ARView } from "../../components/arena/ARView";
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

  const match = useArenaStore((s) => s.match);
  const pressureBar = useArenaStore((s) => s.pressureBar);
  const activePrediction = useArenaStore((s) => s.activePrediction);
  const answeredIds = useArenaStore((s) => s.answeredPredictionIds);
  const lastSendFailure = useArenaStore((s) => s.lastSendFailure);
  const myScore = useArenaStore((s) => s.myScore);
  const setMatch = useArenaStore((s) => s.setMatch);
  const setActivePrediction = useArenaStore((s) => s.setActivePrediction);
  const updatePressure = useArenaStore((s) => s.updatePressure);
  const markAnswered = useArenaStore((s) => s.markAnswered);
  const markSendFailure = useArenaStore((s) => s.markSendFailure);
  const clearSendFailure = useArenaStore((s) => s.clearSendFailure);
  const setMyScore = useArenaStore((s) => s.setMyScore);
  const reset = useArenaStore((s) => s.reset);

  const userId = useAuthStore((s) => s.user?.id ?? null);

  const { isInStadium, multiplier } = useLocation();

  useEffect(() => {
    setMatch({
      id: matchId ?? "unknown",
      teamA: TEAMS[0],
      teamB: TEAMS[1],
      minute: 0,
      status: "live",
    });
    return () => {
      reset();
    };
  }, [matchId, setMatch, reset]);

  // Anexa o ID Token Cognito como query string para o $connect autenticar.
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
          // Mantém estado; UI poderia exibir um toast com o motivo.
          break;
      }
    },
    [setMatch, setActivePrediction, updatePressure, setMyScore, clearSendFailure],
  );

  const { status, send } = useWebSocket(wsUrl ?? "", handleMessage);

  const activePredictionRef = useRef(activePrediction);
  useEffect(() => {
    activePredictionRef.current = activePrediction;
  }, [activePrediction]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      const current = activePredictionRef.current;
      if (!current) return;

      // Bloqueia respostas duplicadas no cliente.
      if (answeredIds.includes(current.id)) {
        setActivePrediction(null);
        return;
      }

      // Bloqueia se já expirou no momento da seleção.
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
        onClose={() => setArMode(false)}
      />
    );
  }

  return (
    <View className="flex-1 bg-sektor-bg">
      {/* Badge GPS */}
      {isInStadium ? (
        <View className="absolute right-4 top-16 z-10 flex-row items-center gap-1 rounded-full bg-green-500 px-3 py-1">
          <Text className="text-xs font-bold text-white">📍 Na Arena 2x</Text>
        </View>
      ) : null}

      <Text className="pb-1 pt-12 text-center text-xl font-bold text-sektor-text">
        {match.teamA.name} vs {match.teamB.name}
      </Text>
      <Text className="mb-2 text-center text-sektor-muted">
        {match.minute}&apos;
      </Text>
      <Text
        testID="ws-status"
        className={`mb-3 text-center text-xs ${
          status === "open" ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {STATUS_LABEL[status] ?? status}
      </Text>

      {/* Score do usuário */}
      <View className="mx-4 mb-3 flex-row items-center justify-between rounded-xl bg-sektor-surface px-4 py-2">
        <Text className="text-sektor-muted">Seus pontos</Text>
        <Text className="text-base font-bold text-sektor-text">
          {myScore.score}{" "}
          <Text className="text-xs text-sektor-muted">
            ({myScore.correctCount}/{myScore.correctCount + myScore.wrongCount})
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

      <PressureBar pressureBar={pressureBar} match={match} />

      {/* Botão AR */}
      <TouchableOpacity
        accessibilityRole="button"
        className="absolute bottom-8 right-6 rounded-full bg-white/20 px-4 py-2"
        onPress={() => setArMode(true)}
      >
        <Text className="font-bold text-white">📷 Modo AR</Text>
      </TouchableOpacity>

      <PredictionCard
        prediction={activePrediction}
        onAnswer={handleAnswer}
        onExpire={handleExpire}
      />
    </View>
  );
}
