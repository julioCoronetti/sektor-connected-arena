import { useEffect, useState } from "react";

import { getBundesligaTeams, type BundesligaTeam } from "../services/bundesligaService";

interface UseBundesligaTeamsResult {
  teams: BundesligaTeam[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBundesligaTeams(): UseBundesligaTeamsResult {
  const [teams, setTeams] = useState<BundesligaTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getBundesligaTeams();
        if (!cancelled) {
          setTeams(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar os times. Tente novamente.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchCount]);

  const refetch = () => setFetchCount((c) => c + 1);

  return { teams, loading, error, refetch };
}
