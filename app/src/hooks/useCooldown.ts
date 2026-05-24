import { useCallback, useEffect, useState } from "react";

/**
 * Hook de contagem regressiva para o Cooldown_Reenvio.
 *
 * @param durationSeconds - Duração total do cooldown em segundos.
 * @returns `remaining` — segundos restantes; `isActive` — se o cooldown está ativo; `start` — inicia o cooldown.
 *
 * Requirements: 8.2, 8.3, 8.4
 */
export function useCooldown(durationSeconds: number) {
  const [remaining, setRemaining] = useState(0);
  const isActive = remaining > 0;

  const start = useCallback(() => {
    setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (!isActive) return;

    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [isActive]);

  return { remaining, isActive, start };
}
