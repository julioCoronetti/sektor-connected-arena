import { Text, View } from "react-native";

interface AlertBannerProps {
  message: string | null;
  type: "error" | "success";
  testID?: string;
}

/**
 * AlertBanner — exibe uma mensagem de alerta inline acima do botão de submissão.
 * Renderiza null quando message é null.
 *
 * Requirements: 11.1, 11.2, 11.3, 8.5
 */
export function AlertBanner({ message, type, testID }: AlertBannerProps) {
  if (!message) return null;

  const containerClass =
    type === "error"
      ? "mb-4 rounded-xl border border-red-500 bg-red-900/30 px-4 py-3"
      : "mb-4 rounded-xl border border-green-500 bg-green-900/30 px-4 py-3";

  const textClass = type === "error" ? "text-red-400" : "text-green-400";

  return (
    <View className={containerClass} testID={testID}>
      <Text className={textClass}>{message}</Text>
    </View>
  );
}
