const ratingStore = require("./ratingStore");

async function getPlayerStats(userId, username) {
  const player = await ratingStore.getOrCreatePlayer(userId, username);

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
