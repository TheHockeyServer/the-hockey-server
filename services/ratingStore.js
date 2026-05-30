const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");
const DEFAULT_RATING = 2500;

let state = null;

function createEmptyState() {
  return {
    players: {},
    matches: [],
  };
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  if (state) return state;

  ensureDataDir();

  if (!fs.existsSync(RATINGS_PATH)) {
    state = createEmptyState();
    saveState();
    return state;
  }

  try {
    state = {
      ...createEmptyState(),
      ...JSON.parse(fs.readFileSync(RATINGS_PATH, "utf8")),
    };
  } catch (error) {
    console.error("Failed to load ratings data:", error);
    state = createEmptyState();
  }

  state.players ??= {};
  state.matches ??= [];
  return state;
}

function saveState() {
  ensureDataDir();

  const tempPath = `${RATINGS_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state ?? createEmptyState(), null, 2)}\n`);
  fs.renameSync(tempPath, RATINGS_PATH);
}

function getOrCreatePlayer(userId, username) {
  const data = loadState();

  if (!data.players[userId]) {
    data.players[userId] = {
      userId,
      username: username ?? "Unknown",
      rating: DEFAULT_RATING,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      lastPlayedAt: null,
    };
  } else if (username && data.players[userId].username !== username) {
    data.players[userId].username = username;
  }

  return data.players[userId];
}

function getPlayer(userId) {
  return loadState().players[userId] ?? null;
}

function getPlayerRating(userId, username) {
  return getOrCreatePlayer(userId, username).rating;
}

function updatePlayers(players) {
  const data = loadState();

  for (const player of players) {
    data.players[player.userId] = {
      ...getOrCreatePlayer(player.userId, player.username),
      ...player,
    };
  }

  saveState();
}

function recordMatch(matchRecord) {
  const data = loadState();
  data.matches.push(matchRecord);
  saveState();
}

function getLeaderboard(limit = 10) {
  return Object.values(loadState().players)
    .filter(player => player.gamesPlayed > 0)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.losses - b.losses)
    .slice(0, limit);
}

module.exports = {
  DEFAULT_RATING,
  getLeaderboard,
  getOrCreatePlayer,
  getPlayer,
  getPlayerRating,
  recordMatch,
  updatePlayers,
};
