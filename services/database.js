const { Pool } = require("pg");

const DATABASE_URL_SOURCES = [
  ["RANKD_DATABASE_URL", process.env.RANKD_DATABASE_URL],
  ["DATABASE_PUBLIC_URL", process.env.DATABASE_PUBLIC_URL],
  ["DATABASE_CONNECTION_URL", process.env.DATABASE_CONNECTION_URL],
  ["DATABASE_URL", process.env.DATABASE_URL],
];
const [DATABASE_URL_SOURCE, DATABASE_URL] = DATABASE_URL_SOURCES.find(([, value]) => Boolean(value)) ?? [null, null];
const useDatabase = Boolean(DATABASE_URL);

let pool = null;
let initialized = false;
let initPromise = null;

function getDatabaseHost() {
  if (!DATABASE_URL) return null;

  try {
    return new URL(DATABASE_URL).hostname;
  } catch {
    return "unparseable-host";
  }
}

function getDatabaseSource() {
  return DATABASE_URL_SOURCE;
}

function getPool() {
  if (!useDatabase) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

async function query(text, params = []) {
  const activePool = getPool();

  if (!activePool) {
    throw new Error("Database URL is not configured.");
  }

  await initDatabase();
  return activePool.query(text, params);
}

async function initDatabase() {
  if (!useDatabase) return false;
  if (initialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const activePool = getPool();

    await activePool.query(`
      CREATE TABLE IF NOT EXISTS players (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 2500,
        highest_rating INTEGER NOT NULL DEFAULT 2500,
        preferred_position TEXT,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        goals_for INTEGER NOT NULL DEFAULT 0,
        goals_against INTEGER NOT NULL DEFAULT 0,
        last_played_at BIGINT,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at BIGINT NOT NULL
      );

      ALTER TABLE players
        ADD COLUMN IF NOT EXISTS highest_rating INTEGER NOT NULL DEFAULT 2500;

      ALTER TABLE players
        ADD COLUMN IF NOT EXISTS preferred_position TEXT;

      CREATE TABLE IF NOT EXISTS rating_matches (
        id BIGSERIAL PRIMARY KEY,
        match_id TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        played_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clubs (
        club_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
        registered_by TEXT NOT NULL,
        registered_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner_user_id TEXT,
        manager_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        roster_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_protected BOOLEAN NOT NULL DEFAULT false,
        is_verified BOOLEAN NOT NULL DEFAULT false,
        mode TEXT NOT NULL DEFAULT 'core',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS player_registrations (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        registration_type TEXT NOT NULL DEFAULT 'core_player',
        registered_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chelhead_webhook_events (
        id BIGSERIAL PRIMARY KEY,
        event TEXT NOT NULL,
        chelhead_match_id TEXT UNIQUE,
        chelhead_webhook_id TEXT,
        payload JSONB NOT NULL,
        headers JSONB NOT NULL DEFAULT '{}'::jsonb,
        signature_verified BOOLEAN NOT NULL DEFAULT false,
        received_at BIGINT NOT NULL
      );

      ALTER TABLE chelhead_webhook_events
        ADD COLUMN IF NOT EXISTS processing_status TEXT;

      ALTER TABLE chelhead_webhook_events
        ADD COLUMN IF NOT EXISTS processing_error TEXT;

      ALTER TABLE chelhead_webhook_events
        ADD COLUMN IF NOT EXISTS rankd_match_id TEXT;

      ALTER TABLE chelhead_webhook_events
        ADD COLUMN IF NOT EXISTS processed_at BIGINT;
    `);

    initialized = true;
    return true;
  })();

  return initPromise;
}

module.exports = {
  getDatabaseHost,
  getDatabaseSource,
  initDatabase,
  isDatabaseEnabled: () => useDatabase,
  query,
};
