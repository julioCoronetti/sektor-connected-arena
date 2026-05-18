import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuthStore } from "../../store/authStore";

export default function AuthLayout() {
  const router = useRouter();

  useEffect(() => {
    useAuthStore.getState()._setNavigate((path) => router.replace(path as never));
  }, [router]);

  return <Stack screenOptions={{ headerShown: false }} />;
}
