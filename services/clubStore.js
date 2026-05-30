const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "..", "data", "clubs.json");

function ensureStore() {
  const dir = path.dirname(dataPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ clubs: [] }, null, 2));
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

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseAlias(alias) {
  const trimmed = String(alias ?? "").trim();
  return trimmed ? [trimmed] : [];
}

function getClubs() {
  return readStore().clubs;
}

function findClubById(clubId) {
  const normalizedClubId = normalize(clubId);
  return getClubs().find(club => normalize(club.clubId) === normalizedClubId) ?? null;
}

function findClubByNameOrAlias(query) {
  const normalizedQuery = normalize(query);
  const clubs = getClubs();

  if (!normalizedQuery) return [];

  const exactMatches = clubs.filter(club =>
    normalize(club.name) === normalizedQuery ||
    club.aliases.some(alias => normalize(alias) === normalizedQuery) ||
    normalize(club.clubId) === normalizedQuery
  );

  if (exactMatches.length > 0) return exactMatches;

  return clubs.filter(club =>
    normalize(club.name).includes(normalizedQuery) ||
    club.aliases.some(alias => normalize(alias).includes(normalizedQuery))
  );
}

function registerClub({ clubId, name, alias, registeredBy }) {
  const store = readStore();
  const now = Date.now();
  const trimmedClubId = String(clubId).trim();
  const trimmedName = String(name).trim();
  const aliases = parseAlias(alias);

  if (trimmedClubId.length < 2) {
    return { success: false, message: "Club ID must be at least 2 characters." };
  }

  if (trimmedName.length < 2) {
    return { success: false, message: "Club name must be at least 2 characters." };
  }

  const existingClubById = store.clubs.find(club => normalize(club.clubId) === normalize(trimmedClubId));

  if (existingClubById) {
    existingClubById.registeredUserIds = existingClubById.registeredUserIds ?? [existingClubById.registeredBy].filter(Boolean);

    if (!existingClubById.registeredUserIds.includes(registeredBy)) {
      existingClubById.registeredUserIds.push(registeredBy);
    }

    for (const aliasValue of aliases) {
      if (!existingClubById.aliases.some(existingAlias => normalize(existingAlias) === normalize(aliasValue))) {
        existingClubById.aliases.push(aliasValue);
      }
    }

    existingClubById.updatedAt = now;
    writeStore(store);

    return { success: true, club: existingClubById, attachedToExisting: true };
  }

  if (store.clubs.some(club => normalize(club.name) === normalize(trimmedName))) {
    return { success: false, message: "That club name is already registered with a different club ID. Use the registered club ID or ask staff to review it." };
  }

  const club = {
    clubId: trimmedClubId,
    name: trimmedName,
    aliases,
    registeredBy,
    registeredUserIds: [registeredBy],
    ownerUserId: null,
    managerUserIds: [],
    rosterUserIds: [],
    isProtected: false,
    isVerified: false,
    mode: "core",
    createdAt: now,
    updatedAt: now,
  };

  store.clubs.push(club);
  writeStore(store);

  return { success: true, club };
}

function removeClub(clubId) {
  const store = readStore();
  const beforeCount = store.clubs.length;
  const normalizedClubId = normalize(clubId);

  store.clubs = store.clubs.filter(club => normalize(club.clubId) !== normalizedClubId);

  if (store.clubs.length === beforeCount) {
    return null;
  }

  writeStore(store);
  return true;
}

module.exports = {
  findClubById,
  findClubByNameOrAlias,
  getClubs,
  registerClub,
  removeClub,
};
