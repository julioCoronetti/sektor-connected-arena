import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Appearance, View } from "react-native";

export type ThemeMode = "dark" | "light";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  isDark: true,
});

const STORAGE_KEY = "@sektor:theme";

const DARK_VARS = vars({
  "--sektor-bg": "#0F0F0F",
  "--sektor-surface": "#1A1A1A",
  "--sektor-border": "#2A2A2A",
  "--sektor-text": "#F5F5F5",
  "--sektor-muted": "#888888",
  "--sektor-card": "#1A1A1A",
});

const LIGHT_VARS = vars({
  "--sektor-bg": "#F5F5F5",
  "--sektor-surface": "#FFFFFF",
  "--sektor-border": "#E0E0E0",
  "--sektor-text": "#111111",
  "--sektor-muted": "#666666",
  "--sektor-card": "#FFFFFF",
});

function getSystemDefault(): ThemeMode {
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(getSystemDefault);

  // Restaura preferência salva
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark") {
          setTheme(saved);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const isDark = theme === "dark";

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
      <View style={[{ flex: 1 }, isDark ? DARK_VARS : LIGHT_VARS]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
