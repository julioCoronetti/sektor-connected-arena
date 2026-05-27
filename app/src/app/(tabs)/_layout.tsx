import { Tabs } from "expo-router";

import { TabBar } from "../../components/ui/TabBar";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="community" options={{ title: "Home" }} />
      <Tabs.Screen name="arena" options={{ title: "Arena" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Ranking" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
