const fs = require("fs");
const path = require("path");

const database = require("./database");

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

function mapDbPlayer(row) {
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    rating: row.rating,
    highestRating: row.highest_rating,
    preferredPosition: row.preferred_position,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    lastPlayedAt: row.last_played_at ? Number(row.last_played_at) : null,
    ...(row.data ?? {}),
  };
}

function createPlayer(userId, username) {
  return {
    userId,
    username: username ?? "Unknown",
    rating: DEFAULT_RATING,
    highestRating: DEFAULT_RATING,
    preferredPosition: null,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    lastPlayedAt: null,
  };
}

async function getOrCreatePlayer(userId, username) {
  if (!database.isDatabaseEnabled()) {
    const data = loadState();

    if (!data.players[userId]) {
      data.players[userId] = createPlayer(userId, username);
      saveState();
    } else if (username && data.players[userId].username !== username) {
      data.players[userId].username = username;
      saveState();
    }

    return data.players[userId];
  }

  const now = Date.now();
  const result = await database.query(
    `
      INSERT INTO players (
        user_id, username, rating, highest_rating, preferred_position,
        wins, losses, games_played,
        goals_for, goals_against, last_played_at, data, updated_at
      )
      VALUES ($1, $2, $3, $3, NULL, 0, 0, 0, 0, 0, NULL, '{}'::jsonb, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `,
    [userId, username ?? "Unknown", DEFAULT_RATING, now]
  );

  return mapDbPlayer(result.rows[0]);
}

async function getPlayer(userId) {
  if (!database.isDatabaseEnabled()) {
    return loadState().players[userId] ?? null;
  }

  const result = await database.query("SELECT * FROM players WHERE user_id = $1", [userId]);
  return mapDbPlayer(result.rows[0]);
}

async function getPlayerRating(userId, username) {
  return (await getOrCreatePlayer(userId, username)).rating;
}

async function updatePlayers(players) {
  if (!database.isDatabaseEnabled()) {
    const data = loadState();

    for (const player of players) {
      data.players[player.userId] = {
        ...await getOrCreatePlayer(player.userId, player.username),
        ...player,
        highestRating: Math.max(player.highestRating ?? DEFAULT_RATING, player.rating ?? DEFAULT_RATING),
      };
    }

    saveState();
    return;
  }

  const now = Date.now();

  for (const player of players) {
    await database.query(
      `
        INSERT INTO players (
          user_id, username, rating, highest_rating, preferred_position,
          wins, losses, games_played,
          goals_for, goals_against, last_played_at, data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
        ON CONFLICT (user_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          rating = EXCLUDED.rating,
          highest_rating = GREATEST(players.highest_rating, EXCLUDED.highest_rating),
          preferred_position = COALESCE(EXCLUDED.preferred_position, players.preferred_position),
          wins = EXCLUDED.wins,
          losses = EXCLUDED.losses,
          games_played = EXCLUDED.games_played,
          goals_for = EXCLUDED.goals_for,
          goals_against = EXCLUDED.goals_against,
          last_played_at = EXCLUDED.last_played_at,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `,
      [
        player.userId,
        player.username ?? "Unknown",
        player.rating,
        Math.max(player.highestRating ?? DEFAULT_RATING, player.rating ?? DEFAULT_RATING),
        player.preferredPosition ?? null,
        player.wins,
        player.losses,
        player.gamesPlayed,
        player.goalsFor,
        player.goalsAgainst,
        player.lastPlayedAt,
        JSON.stringify({
          lastRatingChange: player.lastRatingChange,
          previousRating: player.previousRating,
        }),
        now,
      ]
    );
  }
}

async function setPreferredPosition(userId, username, position) {
  const normalizedPosition = String(position ?? "").trim().toLowerCase() || null;

  if (!database.isDatabaseEnabled()) {
    const data = loadState();
    const player = await getOrCreatePlayer(userId, username);

    data.players[userId] = {
      ...player,
      preferredPosition: normalizedPosition,
    };

    saveState();
    return data.players[userId];
  }

  const now = Date.now();
  const result = await database.query(
    `
      INSERT INTO players (
        user_id, username, rating, highest_rating, preferred_position,
        wins, losses, games_played, goals_for, goals_against,
        last_played_at, data, updated_at
      )
      VALUES ($1, $2, $3, $3, $4, 0, 0, 0, 0, 0, NULL, '{}'::jsonb, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        preferred_position = EXCLUDED.preferred_position,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `,
    [userId, username ?? "Unknown", DEFAULT_RATING, normalizedPosition, now]
  );

  return mapDbPlayer(result.rows[0]);
}

async function recordMatch(matchRecord) {
  if (!database.isDatabaseEnabled()) {
    const data = loadState();
    data.matches.push(matchRecord);
    saveState();
    return;
  }

  await database.query(
    `
      INSERT INTO rating_matches (match_id, payload, played_at, created_at)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (match_id) DO NOTHING
    `,
    [
      String(matchRecord.matchId),
      JSON.stringify(matchRecord),
      matchRecord.playedAt ?? Date.now(),
      Date.now(),
    ]
  );
}

async function getLeaderboard(limit = 10) {
  if (!database.isDatabaseEnabled()) {
    return Object.values(loadState().players)
      .filter(player => player.gamesPlayed > 0)
      .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.losses - b.losses)
      .slice(0, limit);
  }

  const result = await database.query(
    `
      SELECT *
      FROM players
      WHERE games_played > 0
      ORDER BY rating DESC, wins DESC, losses ASC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows.map(mapDbPlayer);
}

module.exports = {
  DEFAULT_RATING,
  getLeaderboard,
  getOrCreatePlayer,
  getPlayer,
  getPlayerRating,
  recordMatch,
  setPreferredPosition,
  updatePlayers,
};
