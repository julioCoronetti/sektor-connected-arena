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
  const router = useRouter();

  const handleSelect = async (teamId: string) => {
    setSubmittingId(teamId);
    try {
      await setTeam(teamId);
      router.replace("/(tabs)/community");
    } catch {
      // error fica no store
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <View className="flex-1 justify-center bg-sektor-bg px-6">
      <Text className="mb-8 text-2xl font-bold text-sektor-text">
        Escolha seu time
      </Text>

      {TEAMS.map((team) => {
        const submitting = submittingId === team.id;
        return (
          <TouchableOpacity
            key={team.id}
            accessibilityRole="button"
            className="mb-4 items-center rounded-xl border-2 px-6 py-5"
            style={{ borderColor: team.color }}
            onPress={() => handleSelect(team.id)}
            disabled={submittingId !== null}
          >
            {submitting ? (
              <ActivityIndicator color={team.color} />
            ) : (
              <Text
                className="text-lg font-bold"
                style={{ color: team.color }}
              >
                {team.name}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {error ? (
        <Text className="mt-4 text-center text-red-400">{error}</Text>
      ) : null}
    </View>
  );
}
