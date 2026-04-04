export const EMPTY_STATS_DTO = Object.freeze({
  race_avg: 0,
  race_last: 0,
  race_best: 0,
  race_won: 0,
  race_completed: 0,
});

function toNumber(value) {
  return Number(value ?? 0);
}

export function toStatsDto(stats) {
  if (!stats) {
    return { ...EMPTY_STATS_DTO };
  }

  return {
    race_avg: toNumber(stats.race_avg),
    race_last: toNumber(stats.race_last),
    race_best: toNumber(stats.race_best),
    race_won: toNumber(stats.race_won),
    race_completed: toNumber(stats.race_completed),
  };
}

export function toStatsResponseDto(stats) {
  return {
    stats: toStatsDto(stats),
  };
}

export function toLeaderboardEntryDto(entry) {
  return {
    username: entry.username,
    race_best: toNumber(entry.race_best),
    race_avg: toNumber(entry.race_avg),
    race_won: toNumber(entry.race_won),
    race_completed: toNumber(entry.race_completed),
  };
}

export function toLeaderboardResponseDto(entries) {
  return {
    leaderboard: entries.map(toLeaderboardEntryDto),
  };
}
