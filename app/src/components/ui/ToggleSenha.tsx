import { Feather } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";

interface ToggleSenhaProps {
  isVisible: boolean;
  onToggle: () => void;
  testID?: string;
}

/**
 * Botão que alterna a visibilidade do campo de senha.
 * Posicionado absolutamente à direita do campo via wrapper View externo.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8
 */
export function ToggleSenha({ isVisible, onToggle, testID }: ToggleSenhaProps) {
  return (
    <View className="absolute right-0 top-0 bottom-0 justify-center pr-4">
      <TouchableOpacity
        onPress={onToggle}
        accessibilityLabel={isVisible ? "Ocultar senha" : "Mostrar senha"}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={testID}
      >
        <Feather
          name={isVisible ? "eye-off" : "eye"}
          size={20}
          color="#6B6B80"
        />
      </TouchableOpacity>
    </View>
  );
}
