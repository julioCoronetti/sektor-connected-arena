import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../services/api";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  teamId: string | null;
  score: number;
  correctCount: number;
  wrongCount: number;
  currentStreak: number;
  bestStreak: number;
  badges: string[];
}

export function useLeaderboard(matchId: string | null, pollIntervalMs = 30_000) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!matchId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getLeaderboard(matchId, 20);
      setEntries(data.leaderboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar leaderboard");
    } finally {
      setIsLoading(false);
    }
  }, [matchId]);

  // Update a single user's score locally when SCORE_UPDATE arrives via WS
  const updateEntry = useCallback(
    (update: {
      userId: string;
      score: number;
      correctCount: number;
      wrongCount: number;
      currentStreak: number;
      bestStreak: number;
    }) => {
      setEntries((prev) => {
        const idx = prev.findIndex((e) => e.userId === update.userId);
        let updated: LeaderboardEntry[];
        if (idx >= 0) {
          updated = prev.map((e) =>
            e.userId === update.userId ? { ...e, ...update } : e,
          );
        } else {
          // New user — append and re-sort
          updated = [
            ...prev,
            {
              rank: prev.length + 1,
              userId: update.userId,
              userName: "Anônimo",
              teamId: null,
              badges: [],
              ...update,
            },
          ];
        }
        // Re-sort by score desc and re-rank
        updated.sort((a, b) => b.score - a.score);
        return updated.map((e, i) => ({ ...e, rank: i + 1 }));
      });
    },
    [],
  );

  useEffect(() => {
    fetch();
    if (pollIntervalMs > 0) {
      intervalRef.current = setInterval(fetch, pollIntervalMs);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetch, pollIntervalMs]);

  return { entries, isLoading, error, refresh: fetch, updateEntry };
}
