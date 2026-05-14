import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { ARView } from "../../components/arena/ARView";
import { PredictionCard } from "../../components/arena/PredictionCard";
import { PressureBar } from "../../components/arena/PressureBar";
import { API_WS_URL } from "../../constants/config";
import { useLocation } from "../../hooks/useLocation";
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
  const [arMode, setArMode] = useState(false);

  const match = useArenaStore((s) => s.match);
  const pressureBar = useArenaStore((s) => s.pressureBar);
  const activePrediction = useArenaStore((s) => s.activePrediction);
  const setMatch = useArenaStore((s) => s.setMatch);
  const setActivePrediction = useArenaStore((s) => s.setActivePrediction);
  const updatePressure = useArenaStore((s) => s.updatePressure);
  const reset = useArenaStore((s) => s.reset);

  const { isInStadium, multiplier } = useLocation();

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
          gpsMultiplier: multiplier,
        }),
      );
      setActivePrediction(null);
    },
    [send, setActivePrediction, multiplier],
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
