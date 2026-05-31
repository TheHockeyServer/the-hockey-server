const fs = require("fs");
const path = require("path");

const clubStore = require("./clubStore");
const database = require("./database");
const ratingStore = require("./ratingStore");

const DATA_DIR = path.join(__dirname, "..", "data");
const RATINGS_PATH = path.join(DATA_DIR, "ratings.json");

const POSITION_GROUPS = {
  all: null,
  forward: ["c", "lw", "rw"],
  defense: ["ld", "rd"],
  goalie: ["g"],
};

const POSITION_LABELS = {
  c: "Center",
  lw: "Left Wing",
  rw: "Right Wing",
  ld: "Left Defense",
  rd: "Right Defense",
  g: "Goalie",
};

const SORTS = {
  elo: (a, b) => b.rating - a.rating || b.wins - a.wins || a.losses - b.losses,
  wins: (a, b) => b.wins - a.wins || b.rating - a.rating,
  winPct: (a, b) => b.winPercentage - a.winPercentage || b.gamesPlayed - a.gamesPlayed || b.rating - a.rating,
  games: (a, b) => b.gamesPlayed - a.gamesPlayed || b.rating - a.rating,
  goalDiff: (a, b) => b.goalDifferential - a.goalDifferential || b.rating - a.rating,
};

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
    return fallback;
  }
}

function normalizePosition(position) {
  const normalized = String(position ?? "").trim().toLowerCase();
  return POSITION_LABELS[normalized] ? normalized : null;
}

function getPositionGroup(position) {
  const normalized = normalizePosition(position);

  if (!normalized) return "Unassigned";
  if (POSITION_GROUPS.forward.includes(normalized)) return "Forward";
  if (POSITION_GROUPS.defense.includes(normalized)) return "Defense";
  if (POSITION_GROUPS.goalie.includes(normalized)) return "Goalie";
  return "Unassigned";
}

function mapPlayer(row) {
  const gamesPlayed = Number(row.games_played ?? row.gamesPlayed ?? 0);
  const wins = Number(row.wins ?? 0);
  const losses = Number(row.losses ?? 0);
  const goalsFor = Number(row.goals_for ?? row.goalsFor ?? 0);
  const goalsAgainst = Number(row.goals_against ?? row.goalsAgainst ?? 0);
  const preferredPosition = normalizePosition(row.preferred_position ?? row.preferredPosition);
  const rating = Number(row.rating ?? 2500);
  const highestRating = Number(row.highest_rating ?? row.highestRating ?? rating);

  return {
    userId: row.user_id ?? row.userId,
    username: row.username ?? "Unknown",
    rating,
    highestRating,
    preferredPosition,
    preferredPositionLabel: preferredPosition ? POSITION_LABELS[preferredPosition] : "Unassigned",
    positionGroup: getPositionGroup(preferredPosition),
    wins,
    losses,
    gamesPlayed,
    goalsFor,
    goalsAgainst,
    goalDifferential: goalsFor - goalsAgainst,
    winPercentage: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 1000) / 10 : 0,
    lastPlayedAt: row.last_played_at ? Number(row.last_played_at) : row.lastPlayedAt ?? null,
    lastRatingChange: row.lastRatingChange ?? row.data?.lastRatingChange ?? null,
    previousRating: row.previousRating ?? row.data?.previousRating ?? null,
  };
}

function filterPlayers(players, { search = "", position = "all" } = {}) {
  const normalizedSearch = String(search ?? "").trim().toLowerCase();
  const positions = POSITION_GROUPS[position] ?? null;

  return players.filter(player => {
    const matchesSearch = !normalizedSearch || player.username.toLowerCase().includes(normalizedSearch);
    const matchesPosition = !positions || positions.includes(player.preferredPosition);

    return matchesSearch && matchesPosition;
  });
}

function rankPlayers(players, sort = "elo") {
  const sorter = SORTS[sort] ?? SORTS.elo;

  return [...players]
    .sort((a, b) => sorter(a, b) || a.username.localeCompare(b.username))
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

async function getAllPlayers() {
  if (!database.isDatabaseEnabled()) {
    const data = readJsonFile(RATINGS_PATH, { players: {} });
    return Object.values(data.players ?? {}).map(mapPlayer);
  }

  const result = await database.query("SELECT * FROM players");
  return result.rows.map(mapPlayer);
}

async function getLeaderboard({ limit = 100, search = "", position = "all", sort = "elo" } = {}) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const allPlayers = await getAllPlayers();
  const filtered = filterPlayers(allPlayers, { search, position });

  return rankPlayers(filtered, sort).slice(0, normalizedLimit);
}

async function searchPlayers(search, limit = 25) {
  return getLeaderboard({ search, limit });
}

function playerIdsFromMatch(match) {
  return [...(match.teamA ?? []), ...(match.teamB ?? [])]
    .map(player => player.userId)
    .filter(Boolean);
}

async function getPlayerProfile(userId) {
  const allPlayers = await getAllPlayers();
  const player = allPlayers.find(item => item.userId === userId);

  if (!player) return null;

  const rankedPlayer = rankPlayers(allPlayers).find(item => item.userId === userId);

  if (!database.isDatabaseEnabled()) {
    const data = readJsonFile(RATINGS_PATH, { matches: [] });
    const recentMatches = (data.matches ?? [])
      .filter(match => playerIdsFromMatch(match).includes(userId))
      .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0))
      .slice(0, 10);

    return {
      ...player,
      rank: rankedPlayer?.rank ?? null,
      recentMatches,
    };
  }

  const matchesResult = await database.query(
    `
      SELECT payload
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

  return Promise.all(clubs.map(async club => {
    const registeredUserIds = club.registeredUserIds ?? [];
    const players = [];

    for (const userId of registeredUserIds) {
      const player = await ratingStore.getPlayer(userId);

      players.push(player
        ? mapPlayer(player)
        : {
            userId,
            username: `Discord ${userId}`,
            rating: 2500,
            highestRating: 2500,
            preferredPosition: null,
            preferredPositionLabel: "Unassigned",
            positionGroup: "Unassigned",
            wins: 0,
            losses: 0,
            gamesPlayed: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifferential: 0,
            winPercentage: 0,
            lastPlayedAt: null,
            lastRatingChange: null,
            previousRating: null,
          });
    }

    return {
      clubId: club.clubId,
      name: club.name,
      aliases: club.aliases ?? [],
      registeredUserCount: registeredUserIds.length,
      registeredPlayers: rankPlayers(players).map(player => ({
        userId: player.userId,
        username: player.username,
        rating: player.rating,
        record: `${player.wins}-${player.losses}`,
        preferredPositionLabel: player.preferredPositionLabel,
      })),
      isProtected: Boolean(club.isProtected),
      isVerified: Boolean(club.isVerified),
      mode: club.mode ?? "core",
      updatedAt: club.updatedAt ?? null,
    };
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
    getRecentMatches(50),
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
