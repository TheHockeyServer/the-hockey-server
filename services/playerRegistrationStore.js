const fs = require("fs");
const path = require("path");

const database = require("./database");

const dataPath = path.join(__dirname, "..", "data", "playerRegistrations.json");

function ensureStore() {
  const dir = path.dirname(dataPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ players: {} }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
}

function mapDbRegistration(row) {
  if (!row) return null;

  return {
    userId: row.user_id,
    username: row.username,
    registrationType: row.registration_type,
    registeredAt: Number(row.registered_at),
    updatedAt: Number(row.updated_at),
  };
}

async function registerPlayer({ userId, username, registrationType = "core_player" }) {
  const now = Date.now();

  if (!database.isDatabaseEnabled()) {
    const store = readStore();
    const existing = store.players[userId];

    store.players[userId] = {
      userId,
      username,
      registrationType,
      registeredAt: existing?.registeredAt ?? now,
      updatedAt: now,
    };

    writeStore(store);

    return {
      alreadyRegistered: Boolean(existing),
      player: store.players[userId],
    };
  }

  const existing = await getRegisteredPlayer(userId);
  const result = await database.query(
    `
      INSERT INTO player_registrations (user_id, username, registration_type, registered_at, updated_at)
      VALUES ($1, $2, $3, $4, $4)
      ON CONFLICT (user_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        registration_type = EXCLUDED.registration_type,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `,
    [userId, username, registrationType, now]
  );

  return {
    alreadyRegistered: Boolean(existing),
    player: mapDbRegistration(result.rows[0]),
  };
}

async function getRegisteredPlayer(userId) {
  if (!database.isDatabaseEnabled()) {
    return readStore().players[userId] ?? null;
  }

  const result = await database.query("SELECT * FROM player_registrations WHERE user_id = $1", [userId]);
  return mapDbRegistration(result.rows[0]);
}

async function getRegisteredPlayers() {
  if (!database.isDatabaseEnabled()) {
    return Object.values(readStore().players);
  }

  const result = await database.query("SELECT * FROM player_registrations ORDER BY username ASC");
  return result.rows.map(mapDbRegistration);
}

module.exports = {
  getRegisteredPlayer,
  getRegisteredPlayers,
  registerPlayer,
};
