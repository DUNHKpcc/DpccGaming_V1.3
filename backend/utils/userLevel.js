const LEVEL_RULES = {
  registrationDaysPerPoint: 14,
  publishedGamePoints: 10,
  scorePerLevel: 8,
  maxLevel: 99
};

const LEVEL_TIERS = [
  { maxLevel: 4, tier: 'rookie', label: 'Rookie', color: '#8d98ab' },
  { maxLevel: 9, tier: 'explorer', label: 'Explorer', color: '#63a7ff' },
  { maxLevel: 19, tier: 'builder', label: 'Builder', color: '#6bc56d' },
  { maxLevel: 34, tier: 'master', label: 'Master', color: '#e3b34f' },
  { maxLevel: Number.POSITIVE_INFINITY, tier: 'legend', label: 'Legend', color: '#d676ff' }
];

function normalizeNonNegativeInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
}

function resolveTierByLevel(level) {
  return LEVEL_TIERS.find((item) => level <= item.maxLevel) || LEVEL_TIERS[0];
}

function computeUserLevel(payload = {}) {
  const registrationDays = normalizeNonNegativeInt(payload.registrationDays);
  const publishedGames = normalizeNonNegativeInt(payload.publishedGames);

  const registrationScore = Math.floor(registrationDays / LEVEL_RULES.registrationDaysPerPoint);
  const gameScore = publishedGames * LEVEL_RULES.publishedGamePoints;
  const score = registrationScore + gameScore;
  const level = Math.max(
    1,
    Math.min(
      LEVEL_RULES.maxLevel,
      Math.floor(score / LEVEL_RULES.scorePerLevel) + 1
    )
  );
  const tierMeta = resolveTierByLevel(level);
  const nextLevelScore = Math.min(level * LEVEL_RULES.scorePerLevel, LEVEL_RULES.maxLevel * LEVEL_RULES.scorePerLevel);

  return {
    level,
    score,
    tier: tierMeta.tier,
    tier_label: tierMeta.label,
    tier_color: tierMeta.color,
    next_level_score: nextLevelScore
  };
}

module.exports = {
  LEVEL_RULES,
  computeUserLevel
};
