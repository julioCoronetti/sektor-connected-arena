/**
 * Mock User Preferences — team-level personalization.
 * Replace with real data from the challenge's Mock User Preferences JSON when available.
 */

const TEAM_PREFERENCES = {
  "team-a": {
    teamName: "FC Bayern München",
    style: "estatístico",
    tone: "técnico e apaixonado",
    rivalTeamId: "team-b",
  },
  "team-b": {
    teamName: "Hamburger SV",
    style: "casual",
    tone: "descontraído e animado",
    rivalTeamId: "team-a",
  },
};

/**
 * Returns preferences for a given teamId.
 * Falls back to team-a preferences if teamId not found.
 * @param {string} teamId
 */
function getTeamPreferences(teamId) {
  return TEAM_PREFERENCES[teamId] ?? TEAM_PREFERENCES["team-a"];
}

module.exports = { getTeamPreferences, TEAM_PREFERENCES };
