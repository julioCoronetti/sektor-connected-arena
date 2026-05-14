import { Slot, useRouter, useSegments } from "expo-router";
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

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const onSelectTeam = inAuthGroup && segments[1] === "select-team";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup && !onSelectTeam) {
      router.replace("/(tabs)/community");
    }
  }, [user, segments, isLoading, router]);

  return <Slot />;
}
