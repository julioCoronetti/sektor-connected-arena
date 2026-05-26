import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";

type TabConfig = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabConfig[] = [
  { name: "community", label: "Home", icon: "home" },
  { name: "arena", label: "Arena", icon: "shield-half" },
  { name: "profile", label: "Perfil", icon: "person" },
];

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  return (
    <View
      style={{
        paddingBottom: insets.bottom + 8,
        paddingTop: 8,
        paddingHorizontal: 16,
        backgroundColor: isDark ? "#0F0F0F" : "#F5F5F5",
      }}
    >
      {/* Pill container */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#CC0000",
          borderRadius: 24,
          paddingVertical: 10,
          paddingHorizontal: 8,
          shadowColor: "#CC0000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        {TABS.map((tab, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: state.routes[index]?.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          };

          return (
            <Pressable
              key={tab.name}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isFocused }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 6,
                opacity: isFocused ? 1 : 0.65,
              }}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color="#FFFFFF"
              />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: isFocused ? "700" : "500",
                  marginTop: 3,
                  letterSpacing: 0.2,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
