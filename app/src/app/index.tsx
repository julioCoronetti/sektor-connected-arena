import { Redirect } from "expo-router";

// AuthGuard stub: Plano 02 substituirá por redirect baseado em authStore.
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
