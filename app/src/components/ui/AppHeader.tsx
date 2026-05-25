import { Image } from "expo-image";
import { useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LOGO_DARK = require("../../../assets/images/logo-dark.png");
const LOGO_LIGHT = require("../../../assets/images/logo-light.png");

interface AppHeaderProps {
  /** Altura extra abaixo do logo. Default: 0 */
  paddingBottom?: number;
}

export function AppHeader({ paddingBottom = 0 }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  // logo-dark = texto branco → usar em fundo escuro
  // logo-light = texto preto → usar em fundo claro
  const isDark = colorScheme !== "light";

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: paddingBottom + 8,
        paddingHorizontal: 20,
        alignItems: "flex-start",
      }}
    >
      <Image
        source={isDark ? LOGO_DARK : LOGO_LIGHT}
        style={{ width: 110, height: 36 }}
        contentFit="contain"
        accessibilityLabel="Sektor logo"
      />
    </View>
  );
}
