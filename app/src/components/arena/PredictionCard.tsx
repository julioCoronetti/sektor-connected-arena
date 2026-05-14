import { useEffect, useRef, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

import type { Prediction } from "../../types";

interface PredictionCardProps {
  prediction: Prediction | null;
  onAnswer: (optionIndex: number) => void;
  onExpire: () => void;
  durationSeconds?: number;
}

/**
 * Modal de palpite com timer regressivo. Fecha automaticamente quando o timer
 * zera (chamando `onExpire`) ou quando o usuário escolhe uma opção.
 */
export function PredictionCard({
  prediction,
  onAnswer,
  onExpire,
  durationSeconds = 15,
}: PredictionCardProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!prediction) {
      setTimeLeft(durationSeconds);
      return;
    }
    setTimeLeft(durationSeconds);
    const interval = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [prediction?.id, durationSeconds, prediction]);

  if (!prediction) return null;

  return (
    <Modal transparent animationType="slide" visible>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl bg-white p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="mr-4 flex-1 text-lg font-bold">
              {prediction.question}
            </Text>
            <View
              accessibilityLabel="Tempo restante"
              testID="prediction-timer"
              className="h-10 w-10 items-center justify-center rounded-full bg-red-100"
            >
              <Text className="font-bold text-red-600">{timeLeft}</Text>
            </View>
          </View>
          {prediction.options.map((option, index) => (
            <TouchableOpacity
              key={`${prediction.id}-${index}`}
              accessibilityRole="button"
              testID={`prediction-option-${index}`}
              className="mb-3 rounded-xl border border-gray-200 px-5 py-4"
              onPress={() => onAnswer(index)}
            >
              <Text className="text-base">{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
