const fs = require("fs");
const path = require("path");

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

function registerPlayer({ userId, username, registrationType = "core_player" }) {
  const store = readStore();
  const now = Date.now();
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

function getRegisteredPlayer(userId) {
  return readStore().players[userId] ?? null;
}

function getRegisteredPlayers() {
  return Object.values(readStore().players);
}

module.exports = {
  getRegisteredPlayer,
  getRegisteredPlayers,
  registerPlayer,
};
