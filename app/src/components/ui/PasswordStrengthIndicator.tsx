import { Text, View } from "react-native";
import {
  getPasswordStrength,
  type PasswordLevel,
} from "../../utils/validators/password";

interface PasswordStrengthIndicatorProps {
  password: string;
}

const LEVEL_COLORS: Record<PasswordLevel, string> = {
  fraca: "#EF4444",
  razoável: "#F97316",
  boa: "#EAB308",
  forte: "#22C55E",
};

const LEVEL_LABELS: Record<PasswordLevel, string> = {
  fraca: "Fraca",
  razoável: "Razoável",
  boa: "Boa",
  forte: "Forte",
};

/**
 * Exibe a força da senha em tempo real com uma barra de 4 segmentos coloridos
 * e um rótulo textual do nível atual.
 * Oculto quando password.length === 0.
 *
 * Requirements: 4.1, 4.7, 4.8, 4.10
 */
export function PasswordStrengthIndicator({
  password,
}: PasswordStrengthIndicatorProps) {
  if (password.length === 0) return null;

  const { level, score } = getPasswordStrength(password);
  const activeColor = LEVEL_COLORS[level];

  return (
    <View className="mb-3 mt-1" testID="password-strength-indicator">
      {/* 4-segment progress bar */}
      <View className="mb-1 flex-row gap-1">
        {[0, 1, 2, 3].map((segmentIndex) => (
          <View
            key={segmentIndex}
            className="h-1.5 flex-1 rounded-full"
            style={{
              backgroundColor:
                segmentIndex <= score ? activeColor : "#3F3F46",
            }}
            testID={`strength-segment-${segmentIndex}`}
          />
        ))}
      </View>

      {/* Textual label */}
      <Text
        className="text-xs font-medium"
        style={{ color: activeColor }}
        testID="strength-label"
      >
        {LEVEL_LABELS[level]}
      </Text>
    </View>
  );
}
