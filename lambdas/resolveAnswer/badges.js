/**
 * Badge catalog and evaluation logic for resolveAnswer Lambda.
 */

const BADGES = [
  {
    id: "first-correct",
    trigger: (s) => s.correctCount === 1,
    label: "Primeira Resposta Certa",
    emoji: "🎯",
  },
  {
    id: "streak-3",
    trigger: (s) => s.currentStreak === 3,
    label: "Sequência de 3",
    emoji: "🔥",
  },
  {
    id: "streak-5",
    trigger: (s) => s.currentStreak === 5,
    label: "Sequência de 5",
    emoji: "🔥🔥",
  },
  {
    id: "streak-10",
    trigger: (s) => s.currentStreak === 10,
    label: "Hot Hand",
    emoji: "🏆",
  },
  {
    id: "in-stadium",
    trigger: (s) => s.multiplierAppliedCount >= 1,
    label: "Na Arena",
    emoji: "📍",
  },
  {
    id: "score-100",
    trigger: (s) => s.score >= 100,
    label: "Centena",
    emoji: "💯",
  },
  {
    id: "perfect-half",
    trigger: (s) => s.correctCount >= 5 && s.wrongCount === 0,
    label: "Primeiro Tempo Perfeito",
    emoji: "⭐",
  },
];

/**
 * Evaluates which badges are newly unlocked given current score state.
 * @param {string[]} currentBadges - badges already owned
 * @param {{ score, correctCount, wrongCount, currentStreak, multiplierAppliedCount }} scoreState
 * @returns {{ owned: string[], newlyUnlocked: string[] }}
 */
function evaluateBadges(currentBadges, scoreState) {
  const owned = new Set(currentBadges ?? []);
  const newlyUnlocked = [];

  for (const badge of BADGES) {
    if (!owned.has(badge.id) && badge.trigger(scoreState)) {
      newlyUnlocked.push(badge.id);
      owned.add(badge.id);
    }
  }

  return { owned: [...owned], newlyUnlocked };
}

module.exports = { BADGES, evaluateBadges };
