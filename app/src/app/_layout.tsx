import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

import "../global.css";
import { useAuthStore } from "../store/authStore";

export default function RootLayout() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auth gate: redireciona via router em vez de retornar <Redirect>, para
  // evitar trocas da árvore raiz que disparam loops de mount/unmount em
  // hooks como usePreventRemove do React Navigation.
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onSelectTeam = inAuthGroup && segments[1] === "select-team";

    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup && !onSelectTeam) {
      router.replace("/community");
    }
  }, [user, isLoading, segments, router]);

  // Sempre retornar o mesmo Stack: declarar grupos é necessário para que o
  // navigator raiz reconheça rotas como "(auth)" durante REPLACE.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="arena/[matchId]" />
    </Stack>
  );
}
