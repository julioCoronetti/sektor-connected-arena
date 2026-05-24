import Animated, { FadeIn } from "react-native-reanimated";

interface InlineErrorProps {
  message: string | null;
  testID?: string;
}

/**
 * Exibe uma mensagem de erro inline com animação FadeIn.
 * Renderiza null quando message é nulo ou vazio.
 *
 * Requirements: 3.2, 5.2
 */
export function InlineError({ message, testID }: InlineErrorProps) {
  if (!message) return null;

  return (
    <Animated.Text
      entering={FadeIn.duration(200)}
      className="mb-2 text-red-400"
      testID={testID}
    >
      {message}
    </Animated.Text>
  );
}
