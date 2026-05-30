const ratingStore = require("./ratingStore");

const K_FACTOR = 32;

function getTeamPlayers(team) {
  return Object.values(team);
}

async function getAverageRating(players) {
  let total = 0;

  for (const player of players) {
    total += await ratingStore.getPlayerRating(player.userId, player.username);
  }

  return Math.round(total / players.length);
}

function getExpectedScore(playerRating, opponentAverageRating) {
  return 1 / (1 + 10 ** ((opponentAverageRating - playerRating) / 400));
}

function getScoreOutcome(teamScore, opponentScore) {
  if (teamScore > opponentScore) return 1;
  if (teamScore < opponentScore) return 0;
  return 0.5;
}

async function updateTeamPlayers(players, opponentAverageRating, outcome, goalsFor, goalsAgainst, playedAt) {
  const updatedPlayers = [];

  for (const player of players) {
    const storedPlayer = await ratingStore.getOrCreatePlayer(player.userId, player.username);
    const oldRating = storedPlayer.rating;
    const expectedScore = getExpectedScore(oldRating, opponentAverageRating);
    const ratingChange = Math.round(K_FACTOR * (outcome - expectedScore));
    const newRating = oldRating + ratingChange;

    updatedPlayers.push({
      ...storedPlayer,
      username: player.username,
      rating: newRating,
      wins: storedPlayer.wins + (outcome === 1 ? 1 : 0),
      losses: storedPlayer.losses + (outcome === 0 ? 1 : 0),
      gamesPlayed: storedPlayer.gamesPlayed + 1,
      goalsFor: storedPlayer.goalsFor + goalsFor,
      goalsAgainst: storedPlayer.goalsAgainst + goalsAgainst,
      lastPlayedAt: playedAt,
      lastRatingChange: ratingChange,
      previousRating: oldRating,
    });
  }

  return updatedPlayers;
}

async function recordMatchResult(match, teamAScore, teamBScore) {
  const teamAPlayers = getTeamPlayers(match.teams.teamA);
  const teamBPlayers = getTeamPlayers(match.teams.teamB);
  const teamAAverageRating = await getAverageRating(teamAPlayers);
  const teamBAverageRating = await getAverageRating(teamBPlayers);
  const teamAOutcome = getScoreOutcome(teamAScore, teamBScore);
  const teamBOutcome = getScoreOutcome(teamBScore, teamAScore);
  const playedAt = Date.now();

  const updatedTeamA = await updateTeamPlayers(
    teamAPlayers,
    teamBAverageRating,
    teamAOutcome,
    teamAScore,
    teamBScore,
    playedAt
  );
  const updatedTeamB = await updateTeamPlayers(
    teamBPlayers,
    teamAAverageRating,
    teamBOutcome,
    teamBScore,
    teamAScore,
    playedAt
  );

  await ratingStore.updatePlayers([...updatedTeamA, ...updatedTeamB]);

  const record = {
    matchId: match.id,
    teamAScore,
    teamBScore,
    teamAAverageRating,
    teamBAverageRating,
    playedAt,
    teamA: updatedTeamA.map(player => ({
      userId: player.userId,
      ratingBefore: player.previousRating,
      ratingAfter: player.rating,
      ratingChange: player.lastRatingChange,
    })),
    teamB: updatedTeamB.map(player => ({
      userId: player.userId,
      ratingBefore: player.previousRating,
      ratingAfter: player.rating,
      ratingChange: player.lastRatingChange,
    })),
  };

  await ratingStore.recordMatch(record);

  return {
    ...record,
    updatedTeamA,
    updatedTeamB,
  };
}

module.exports = {
  K_FACTOR,
  getAverageRating,
  recordMatchResult,
};
