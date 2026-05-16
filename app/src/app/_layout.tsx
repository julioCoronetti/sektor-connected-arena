import "react-native-get-random-values";
import "@aws-amplify/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { LogBox } from "react-native";

import "../global.css";
import { useAuthStore } from "../store/authStore";

// Suprime warning de prop deprecada originado por dependência de terceiros.
// Candidatos: react-native-reanimated ~4.1.1, @react-navigation/elements ^2.6.3,
// expo-router ~6.0.23. Remover quando a dependência for atualizada.
LogBox.ignoreLogs(["props.pointerEvents is deprecated"]);

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
    console.log("[layout] calling initialize (once)");
    initialize();
  }, [initialize]);

  useEffect(() => {
    console.log("[layout] auth effect — isLoading:", isLoading, "user:", user?.email ?? null, "teamId:", user?.teamId ?? null, "segments:", segments);
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="arena/[matchId]" />
    </Stack>
  );
}
