import { CameraView, useCameraPermissions } from "expo-camera";
import { Text, TouchableOpacity, View } from "react-native";

import type { Match, PressureBarState } from "../../types";

interface ARViewProps {
  match: Match;
  pressureBar: PressureBarState;
  onClose: () => void;
}

export function ARView({ match, pressureBar, onClose }: ARViewProps) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-sektor-bg">
        <Text className="mb-4 px-8 text-center text-sektor-text">
          Permissão de câmera necessária para o Modo AR
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          className="rounded-xl bg-sektor-accent px-6 py-3"
          onPress={requestPermission}
        >
          <Text className="font-bold text-white">Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          className="mt-4"
          onPress={onClose}
        >
          <Text className="text-sektor-muted">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const safeA = Math.max(0, pressureBar.teamA);
  const safeB = Math.max(0, pressureBar.teamB);
  const total = safeA + safeB;
  const widthA = total > 0 ? (safeA / total) * 100 : 50;

  return (
    <View className="flex-1">
      <CameraView className="flex-1" facing="back">
        <View className="absolute inset-0">
          {/* Barra de pressão no topo */}
          <View className="absolute left-4 right-4 top-16">
            <View className="h-4 flex-row overflow-hidden rounded-full opacity-90">
              <View
                style={{ flex: widthA, backgroundColor: match.teamA.color }}
              />
              <View
                style={{ flex: 100 - widthA, backgroundColor: match.teamB.color }}
              />
            </View>
            <View className="mt-1 flex-row justify-between">
              <Text className="text-xs font-bold text-white">
                {match.teamA.name}
              </Text>
              <Text className="text-xs font-bold text-white">
                {match.teamB.name}
              </Text>
            </View>
          </View>

          {/* Escudos dos times */}
          <View
            className="absolute bottom-24 left-4 h-16 w-16 items-center justify-center rounded-full opacity-80"
            style={{ backgroundColor: match.teamA.color }}
          >
            <Text className="text-lg font-bold text-white">
              {match.teamA.name[0]}
            </Text>
          </View>
          <View
            className="absolute bottom-24 right-4 h-16 w-16 items-center justify-center rounded-full opacity-80"
            style={{ backgroundColor: match.teamB.color }}
          >
            <Text className="text-lg font-bold text-white">
              {match.teamB.name[0]}
            </Text>
          </View>

          {/* Botão fechar */}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fechar modo AR"
            className="absolute right-4 top-16 h-10 w-10 items-center justify-center rounded-full bg-black/50"
            onPress={onClose}
          >
            <Text className="text-white">✕</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}
