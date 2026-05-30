const fs = require("fs");
const path = require("path");

const clubStore = require("./clubStore");
const database = require("./database");

const DATA_DIR = path.join(__dirname, "..", "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function mapPlayer(row) {
  const gamesPlayed = Number(row.games_played ?? row.gamesPlayed ?? 0);
  const wins = Number(row.wins ?? 0);
  const losses = Number(row.losses ?? 0);
  const goalsFor = Number(row.goals_for ?? row.goalsFor ?? 0);
  const goalsAgainst = Number(row.goals_against ?? row.goalsAgainst ?? 0);

  return {
    userId: row.user_id ?? row.userId,
    username: row.username ?? "Unknown",
    rating: Number(row.rating ?? 2500),
    wins,
    losses,
    gamesPlayed,
    goalsFor,
    goalsAgainst,
    goalDifferential: goalsFor - goalsAgainst,
    winPercentage: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
    lastPlayedAt: row.last_played_at ? Number(row.last_played_at) : row.lastPlayedAt ?? null,
  };
}

function rankPlayers(players) {
  return players
    .sort((a, b) =>
      b.rating - a.rating ||
      b.wins - a.wins ||
      b.gamesPlayed - a.gamesPlayed ||
      a.losses - b.losses ||
      a.username.localeCompare(b.username)
    )
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

async function getLeaderboard({ limit = 100, search = "" } = {}) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const normalizedSearch = String(search ?? "").trim();

  if (!database.isDatabaseEnabled()) {
    const data = readJsonFile(RATINGS_PATH, { players: {} });
    const players = rankPlayers(Object.values(data.players ?? {}).map(mapPlayer));
    const filtered = normalizedSearch
      ? players.filter(player => player.username.toLowerCase().includes(normalizedSearch.toLowerCase()))
      : players;

    return filtered.slice(0, normalizedLimit);
  }

  const params = [];
  let where = "";

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    where = "WHERE username ILIKE $1";
  }

  params.push(normalizedLimit);

  const result = await database.query(
    `
      SELECT *
      FROM players
      ${where}
      ORDER BY rating DESC, wins DESC, games_played DESC, losses ASC, username ASC
      LIMIT $${params.length}
    `,
    params
  );

  return rankPlayers(result.rows.map(mapPlayer));
}

async function searchPlayers(search, limit = 25) {
  return getLeaderboard({ search, limit });
}

async function getPlayerProfile(userId) {
  if (!database.isDatabaseEnabled()) {
    const data = readJsonFile(RATINGS_PATH, { players: {}, matches: [] });
    const player = data.players?.[userId];

    if (!player) return null;

    const rankedPlayers = rankPlayers(Object.values(data.players ?? {}).map(mapPlayer));
    const rankedPlayer = rankedPlayers.find(item => item.userId === userId);
    const recentMatches = (data.matches ?? [])
      .filter(match =>
        [...(match.teamA ?? []), ...(match.teamB ?? [])]
          .some(matchPlayer => matchPlayer.userId === userId)
      )
      .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
      .slice(0, 10);

    return {
      ...mapPlayer(player),
      rank: rankedPlayer?.rank ?? null,
      recentMatches,
    };
  }

  const playerResult = await database.query("SELECT * FROM players WHERE user_id = $1", [userId]);

  if (playerResult.rows.length === 0) return null;

  const player = mapPlayer(playerResult.rows[0]);
  const leaderboard = await getLeaderboard({ limit: 100 });
  const rankedPlayer = leaderboard.find(item => item.userId === userId);
  const matchesResult = await database.query(
    `
      SELECT payload, played_at
      FROM rating_matches
      WHERE payload::text LIKE $1
      ORDER BY played_at DESC
      LIMIT 10
    `,
    [`%${userId}%`]
  );

  return {
    ...player,
    rank: rankedPlayer?.rank ?? null,
    recentMatches: matchesResult.rows.map(row => row.payload),
  };
}

async function getRegisteredClubs() {
  const clubs = await clubStore.getClubs();

  return clubs.map(club => ({
    clubId: club.clubId,
    name: club.name,
    aliases: club.aliases ?? [],
    registeredUserCount: club.registeredUserIds?.length ?? 0,
    isProtected: Boolean(club.isProtected),
    isVerified: Boolean(club.isVerified),
    mode: club.mode ?? "core",
    updatedAt: club.updatedAt ?? null,
  }));
}

async function getRecentMatches(limit = 25) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 25, 1), 50);

  if (!database.isDatabaseEnabled()) {
    const data = readJsonFile(RATINGS_PATH, { matches: [] });

    return (data.matches ?? [])
      .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
      .slice(0, normalizedLimit);
  }

  const result = await database.query(
    `
      SELECT payload
      FROM rating_matches
      ORDER BY played_at DESC
      LIMIT $1
    `,
    [normalizedLimit]
  );

  return result.rows.map(row => row.payload);
}

async function getOverview() {
  const [leaderboard, clubs, recentMatches] = await Promise.all([
    getLeaderboard({ limit: 100 }),
    getRegisteredClubs(),
    getRecentMatches(10),
  ]);

  return {
    playerCount: leaderboard.length,
    clubCount: clubs.length,
    completedMatchCount: recentMatches.length,
    topPlayers: leaderboard.slice(0, 5),
  };
}

module.exports = {
  getLeaderboard,
  getOverview,
  getPlayerProfile,
  getRecentMatches,
  getRegisteredClubs,
  searchPlayers,
};
