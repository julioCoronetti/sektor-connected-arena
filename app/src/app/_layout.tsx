import "react-native-get-random-values";
import "@aws-amplify/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { LogBox } from "react-native";

import "../global.css";
import { ThemeProvider } from "../context/ThemeContext";
import { useAuthStore } from "../store/authStore";

// Suprime warnings de props deprecadas originados por dependências de terceiros.
// Candidatos: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
// expo-router ~6.0.23. Remover quando as dependências forem atualizadas.
LogBox.ignoreLogs([
  "props.pointerEvents is deprecated",
  '"shadow*" style props are deprecated',
]);

export default function RootLayout() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const segments = useSegments();
  const router = useRouter();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onSelectTeam = inAuthGroup && segments[1] === "select-team";
    const inTabsGroup = segments[0] === "(tabs)";

    if (!user) {
      // Não logado — vai para login
      if (!inAuthGroup) router.replace("/login");
    } else if (!user.teamId) {
      // Logado mas sem time — vai para seleção de time
      if (!onSelectTeam) router.replace("/select-team");
    } else {
      // Logado com time — vai para community se estiver em auth ou na raiz
      if (inAuthGroup || segments.length < 1 || (!inTabsGroup && segments[0] !== "arena")) {
        router.replace("/community");
      }
    }
  }, [user, isLoading, segments, router]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="arena/[matchId]" />
      </Stack>
    </ThemeProvider>
  );
}
