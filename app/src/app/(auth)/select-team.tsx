import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { TEAMS } from "../../constants/config";
import { useAuthStore } from "../../store/authStore";

export default function SelectTeamScreen() {
  const setTeam = useAuthStore((s) => s.setTeam);
  const error = useAuthStore((s) => s.error);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const handleSelect = async (teamId: string) => {
    setSelectedId(teamId);
    setSubmittingId(teamId);
    try {
      await setTeam(teamId);
      router.replace("/community");
    } catch {
      setSelectedId(null);
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <View className="flex-1 justify-center bg-sektor-bg px-6">
      <Text className="mb-2 text-2xl font-bold text-sektor-text">
        Escolha seu time
      </Text>
      <Text className="mb-8 text-sektor-muted">
        Você poderá trocar depois no seu perfil.
      </Text>

      {TEAMS.map((team) => {
        const submitting = submittingId === team.id;
        const isSelected = selectedId === team.id;

        return (
          <TouchableOpacity
            key={team.id}
            accessibilityRole="button"
            className="mb-4 rounded-xl border-2 px-6 py-5"
            style={{
              borderColor: team.color,
              borderWidth: isSelected ? 3 : 2,
              backgroundColor: isSelected ? `${team.color}18` : "transparent",
            }}
            onPress={() => handleSelect(team.id)}
            disabled={submittingId !== null}
          >
            <View className="flex-row items-center">
              {/* Logo placeholder */}
              <View
                className="mr-4 h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${team.color}30` }}
              >
                <Ionicons name="shield" size={24} color={team.color} />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-lg font-bold"
                    style={{ color: team.color }}
                  >
                    {team.name}
                  </Text>
                  {isSelected && !submitting && (
                    <Ionicons name="checkmark-circle" size={22} color={team.color} />
                  )}
                  {submitting && (
                    <ActivityIndicator color={team.color} size="small" />
                  )}
                </View>
                <Text className="mt-1 text-sm text-sektor-muted">
                  {team.description}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {error ? (
        <Text className="mt-4 text-center text-red-400">{error}</Text>
      ) : null}
    </View>
  );
}
