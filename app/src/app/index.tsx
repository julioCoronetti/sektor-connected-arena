import { ActivityIndicator, View } from "react-native";

// O auth gate em _layout.tsx redireciona para /login ou /community após
// initialize(). Esta tela apenas exibe um spinner durante esse intervalo,
// evitando retornar <Redirect> aqui (o que conflitaria com o redirect do root
// e geraria loops de navegação).
export default function Index() {
  return (
    <View
      className="flex-1 items-center justify-center bg-sektor-bg"
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <ActivityIndicator color="#6C63FF" />
    </View>
  );
}
