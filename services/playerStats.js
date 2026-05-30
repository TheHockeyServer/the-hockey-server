const ratingStore = require("./ratingStore");

function getPlayerStats(userId, username) {
  const player = ratingStore.getOrCreatePlayer(userId, username);

  return {
    elo: player.rating,
    wins: player.wins,
    losses: player.losses,
  };
}

function formatPlayerStats(stats) {
  return `Current Elo: **${stats.elo}** | Record: **${stats.wins}-${stats.losses}**`;
}

module.exports = {
  formatPlayerStats,
  getPlayerStats,
};
