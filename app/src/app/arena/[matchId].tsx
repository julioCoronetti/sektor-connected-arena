import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";

import { PredictionCard } from "../../components/arena/PredictionCard";
import { PressureBar } from "../../components/arena/PressureBar";
import { API_WS_URL } from "../../constants/config";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  buildAnswerMessage,
  parseServerMessage,
} from "../../services/arenaProtocol";
import {
  MOCK_MATCH,
  startMockSimulator,
} from "../../services/matchSimulator";
import { useArenaStore } from "../../store/arenaStore";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Conectando…",
  open: "Ao vivo",
  reconnecting: "Reconectando…",
  closed: "Desconectado",
};

export default function ArenaScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const match = useArenaStore((s) => s.match);
  const pressureBar = useArenaStore((s) => s.pressureBar);
  const activePrediction = useArenaStore((s) => s.activePrediction);
  const setMatch = useArenaStore((s) => s.setMatch);
  const setActivePrediction = useArenaStore((s) => s.setActivePrediction);
  const updatePressure = useArenaStore((s) => s.updatePressure);
  const reset = useArenaStore((s) => s.reset);

  // Bootstrap com mock enquanto o Plano 04 não conecta. O simulador é parado
  // assim que a tela é desmontada (ou quando o matchId muda).
  useEffect(() => {
    setMatch(MOCK_MATCH);
    const stop = startMockSimulator(setActivePrediction, updatePressure);
    return () => {
      stop();
      reset();
    };
  }, [matchId, setMatch, setActivePrediction, updatePressure, reset]);

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
          // Reservado para Plano 04: feedback visual de acerto/erro.
          break;
      }
    },
    [setMatch, setActivePrediction, updatePressure],
  );

  const wsUrl = useMemo(
    () => `${API_WS_URL}?matchId=${encodeURIComponent(matchId ?? "")}`,
    [matchId],
  );
  const { status, send } = useWebSocket(wsUrl, handleMessage);

  const activePredictionRef = useRef(activePrediction);
  useEffect(() => {
    activePredictionRef.current = activePrediction;
  }, [activePrediction]);

  const handleAnswer = useCallback(
    (optionIndex: number) => {
      const current = activePredictionRef.current;
      if (!current) return;
      send(
        buildAnswerMessage({
          predictionId: current.id,
          selectedOption: optionIndex,
        }),
      );
      setActivePrediction(null);
    },
    [send, setActivePrediction],
  );

  const handleExpire = useCallback(() => {
    setActivePrediction(null);
  }, [setActivePrediction]);

  if (!match) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-950">
        <Text className="text-white">Carregando partida…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-950">
      <Text className="pb-1 pt-12 text-center text-xl font-bold text-white">
        {match.teamA.name} vs {match.teamB.name}
      </Text>
      <Text className="mb-2 text-center text-gray-400">{match.minute}&apos;</Text>
      <Text
        accessibilityRole="text"
        testID="ws-status"
        className={`mb-3 text-center text-xs ${
          status === "open" ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {STATUS_LABEL[status] ?? status}
      </Text>

      <PressureBar pressureBar={pressureBar} match={match} />

      <PredictionCard
        prediction={activePrediction}
        onAnswer={handleAnswer}
        onExpire={handleExpire}
      />
    </View>
  );
}
