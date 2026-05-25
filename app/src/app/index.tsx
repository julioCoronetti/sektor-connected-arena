import { Image } from "expo-image";
import { useColorScheme } from "nativewind";
import { ActivityIndicator, View } from "react-native";

const LOGO_DARK = require("../../assets/images/logo-dark.png");
const LOGO_LIGHT = require("../../assets/images/logo-light.png");

// O auth gate em _layout.tsx redireciona para /login ou /community após
// initialize(). Esta tela exibe logo + spinner durante esse intervalo.
export default function Index() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme !== "light";

  return (
    <View
      className="flex-1 items-center justify-center bg-sektor-bg"
      style={{ gap: 24 }}
    >
      <Image
        source={isDark ? LOGO_DARK : LOGO_LIGHT}
        style={{ width: 160, height: 52 }}
        contentFit="contain"
        accessibilityLabel="Sektor logo"
      />
      <ActivityIndicator color="#CC0000" size="small" />
    </View>
  );
}
