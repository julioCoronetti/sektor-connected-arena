/**
 * Serviço para buscar os times da Bundesliga 1 via OpenLigaDB.
 *
 * Lógica de temporada:
 * - A Bundesliga começa em agosto e termina em maio do ano seguinte.
 * - O "ano de início" da temporada é o que a API usa como identificador.
 *   Ex.: temporada 2025/2026 → ano "2025".
 * - Se estamos entre janeiro e junho (mês ≤ 6), a temporada em andamento
 *   começou no ano anterior (ex.: em março de 2026 → temporada 2025).
 * - Se estamos entre julho e dezembro (mês ≥ 7), a temporada em andamento
 *   começou no ano corrente (ex.: em setembro de 2025 → temporada 2025).
 *
 * Fallback: se a temporada calculada não retornar times (ainda não cadastrada),
 * tenta a temporada anterior automaticamente.
 */

const OPENLIGADB_BASE = "https://api.openligadb.de";
const LEAGUE_SHORTCUT = "bl1";

export interface BundesligaTeam {
  teamId: number;
  teamName: string;
  shortName: string;
  teamIconUrl: string;
}

/**
 * Calcula o ano de início da temporada atual da Bundesliga.
 * A temporada começa em agosto (mês 8), então:
 * - Jan–Jun (mês ≤ 6): temporada iniciou no ano anterior
 * - Jul–Dez (mês ≥ 7): temporada iniciou no ano corrente
 */
export function getCurrentBundesligaSeason(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // getMonth() é 0-indexed
  const year = now.getFullYear();
  return month <= 6 ? year - 1 : year;
}

async function fetchTeamsForSeason(season: number): Promise<BundesligaTeam[]> {
  const url = `${OPENLIGADB_BASE}/getavailableteams/${LEAGUE_SHORTCUT}/${season}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`OpenLigaDB error: ${response.status}`);
  }

  const data = (await response.json()) as BundesligaTeam[];
  return data;
}

/**
 * Retorna os 18 times da Bundesliga 1 da temporada mais recente disponível.
 * Tenta a temporada atual e, se não encontrar dados, faz fallback para a anterior.
 */
export async function getBundesligaTeams(): Promise<BundesligaTeam[]> {
  const currentSeason = getCurrentBundesligaSeason();

  try {
    const teams = await fetchTeamsForSeason(currentSeason);
    if (teams && teams.length > 0) {
      return teams;
    }
    // Temporada ainda sem dados — tenta a anterior
    return await fetchTeamsForSeason(currentSeason - 1);
  } catch {
    // Qualquer erro na temporada atual → fallback para a anterior
    return await fetchTeamsForSeason(currentSeason - 1);
  }
}
