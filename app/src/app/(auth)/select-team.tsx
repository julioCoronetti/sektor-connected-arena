import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useBundesligaTeams } from "../../hooks/useBundesligaTeams";
import { getCurrentBundesligaSeason } from "../../services/bundesligaService";
import { useAuthStore } from "../../store/authStore";

export default function SelectTeamScreen() {
  const setTeam = useAuthStore((s) => s.setTeam);
  const storeError = useAuthStore((s) => s.error);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  const { teams, loading, error: fetchError, refetch } = useBundesligaTeams();

  const season = getCurrentBundesligaSeason();
  const seasonLabel = `${season}/${season + 1}`;

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
    <View className="flex-1 bg-sektor-bg">
      {/* Header fixo */}
      <View className="px-6 pb-4 pt-12">
        <Text className="mb-2 text-2xl font-bold text-sektor-text">
          Escolha seu time
        </Text>
        <Text className="text-sektor-muted">
          Bundesliga {seasonLabel} · Você poderá trocar depois no seu perfil.
        </Text>
      </View>

      {/* Estado de carregamento */}
      {loading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#E63946" />
          <Text className="mt-4 text-sektor-muted">
            Carregando times da Bundesliga…
          </Text>
        </View>
      )}

      {/* Estado de erro */}
      {!loading && fetchError && (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="cloud-offline-outline" size={48} color="#6B7280" />
          <Text className="mt-4 text-center text-sektor-muted">{fetchError}</Text>
          <TouchableOpacity
            className="mt-6 rounded-xl bg-sektor-accent px-8 py-3"
            onPress={refetch}
          >
            <Text className="font-semibold text-white">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Lista de times */}
      {!loading && !fetchError && (
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {teams.map((team) => {
            const teamIdStr = String(team.teamId);
            const submitting = submittingId === teamIdStr;
            const isSelected = selectedId === teamIdStr;

            return (
              <TouchableOpacity
                key={team.teamId}
                accessibilityRole="button"
                accessibilityLabel={`Selecionar ${team.teamName}`}
                className="mb-3 rounded-xl border-2 px-4 py-4"
                style={{
                  borderColor: isSelected ? "#E63946" : "#374151",
                  borderWidth: isSelected ? 2 : 1,
                  backgroundColor: isSelected ? "#E6394618" : "transparent",
                }}
                onPress={() => handleSelect(teamIdStr)}
                disabled={submittingId !== null}
              >
                <View className="flex-row items-center">
                  {/* Logo do time */}
                  <View className="mr-4 h-12 w-12 items-center justify-center">
                    {team.teamIconUrl ? (
                      <Image
                        source={{ uri: team.teamIconUrl }}
                        style={{ width: 44, height: 44 }}
                        contentFit="contain"
                        accessibilityLabel={`Escudo do ${team.teamName}`}
                      />
                    ) : (
                      <View className="h-12 w-12 items-center justify-center rounded-full bg-gray-700">
                        <Ionicons name="shield" size={24} color="#9CA3AF" />
                      </View>
                    )}
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text
                        className="text-base font-bold text-sektor-text"
                        numberOfLines={1}
                      >
                        {team.teamName}
                      </Text>
                      {isSelected && !submitting && (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color="#E63946"
                        />
                      )}
                      {submitting && (
                        <ActivityIndicator color="#E63946" size="small" />
                      )}
                    </View>
                    <Text className="mt-0.5 text-sm text-sektor-muted">
                      {team.shortName}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Erro do store (ex.: falha ao salvar no Cognito) */}
      {storeError ? (
        <Text className="px-6 pb-4 text-center text-sm text-red-400">
          {storeError}
        </Text>
      ) : null}
    </View>
  );
}
