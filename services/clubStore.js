const fs = require("fs");
const path = require("path");

const database = require("./database");

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

function mapDbClub(row) {
  if (!row) return null;

  return {
    clubId: row.club_id,
    name: row.name,
    aliases: row.aliases ?? [],
    registeredBy: row.registered_by,
    registeredUserIds: row.registered_user_ids ?? [],
    ownerUserId: row.owner_user_id,
    managerUserIds: row.manager_user_ids ?? [],
    rosterUserIds: row.roster_user_ids ?? [],
    isProtected: row.is_protected,
    isVerified: row.is_verified,
    mode: row.mode,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function getClubs() {
  if (!database.isDatabaseEnabled()) {
    return readStore().clubs;
  }

  const result = await database.query("SELECT * FROM clubs ORDER BY name ASC");
  return result.rows.map(mapDbClub);
}

async function findClubById(clubId) {
  const normalizedClubId = normalize(clubId);

  if (!database.isDatabaseEnabled()) {
    return readStore().clubs.find(club => normalize(club.clubId) === normalizedClubId) ?? null;
  }

  const result = await database.query("SELECT * FROM clubs WHERE LOWER(club_id) = LOWER($1)", [String(clubId).trim()]);
  return mapDbClub(result.rows[0]);
}

async function findClubByNameOrAlias(query) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) return [];

  if (!database.isDatabaseEnabled()) {
    const clubs = readStore().clubs;
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

  const exact = await database.query(
    `
      SELECT *
      FROM clubs
      WHERE LOWER(name) = LOWER($1)
        OR LOWER(club_id) = LOWER($1)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(aliases) alias
          WHERE LOWER(alias) = LOWER($1)
        )
      ORDER BY name ASC
    `,
    [String(query).trim()]
  );

  if (exact.rows.length > 0) return exact.rows.map(mapDbClub);

  const partial = await database.query(
    `
      SELECT *
      FROM clubs
      WHERE LOWER(name) LIKE LOWER($1)
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(aliases) alias
          WHERE LOWER(alias) LIKE LOWER($1)
        )
      ORDER BY name ASC
    `,
    [`%${String(query).trim()}%`]
  );

  return partial.rows.map(mapDbClub);
}

function mergeAliases(existingAliases, aliases) {
  const nextAliases = [...existingAliases];

  for (const aliasValue of aliases) {
    if (!nextAliases.some(existingAlias => normalize(existingAlias) === normalize(aliasValue))) {
      nextAliases.push(aliasValue);
    }
  }

  return nextAliases;
}

async function registerClub({ clubId, name, alias, registeredBy }) {
  const now = Date.now();
  const trimmedClubId = String(clubId ?? "").trim();
  const trimmedName = String(name ?? "").trim();
  const aliases = parseAlias(alias);

  if (trimmedClubId.length < 2) {
    return { success: false, message: "Club ID must be at least 2 characters." };
  }

  if (trimmedName.length < 2) {
    return { success: false, message: "Club name must be at least 2 characters." };
  }

  if (!database.isDatabaseEnabled()) {
    const store = readStore();
    const existingClubById = store.clubs.find(club => normalize(club.clubId) === normalize(trimmedClubId));

    if (existingClubById) {
      existingClubById.registeredUserIds = existingClubById.registeredUserIds ?? [existingClubById.registeredBy].filter(Boolean);

      if (!existingClubById.registeredUserIds.includes(registeredBy)) {
        existingClubById.registeredUserIds.push(registeredBy);
      }

      existingClubById.aliases = mergeAliases(existingClubById.aliases, aliases);
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

  const existingClubById = await findClubById(trimmedClubId);

  if (existingClubById) {
    const registeredUserIds = existingClubById.registeredUserIds.includes(registeredBy)
      ? existingClubById.registeredUserIds
      : [...existingClubById.registeredUserIds, registeredBy];
    const mergedAliases = mergeAliases(existingClubById.aliases, aliases);

    const result = await database.query(
      `
        UPDATE clubs
        SET aliases = $2::jsonb,
            registered_user_ids = $3::jsonb,
            updated_at = $4
        WHERE club_id = $1
        RETURNING *
      `,
      [
        existingClubById.clubId,
        JSON.stringify(mergedAliases),
        JSON.stringify(registeredUserIds),
        now,
      ]
    );

    return { success: true, club: mapDbClub(result.rows[0]), attachedToExisting: true };
  }

  const nameMatches = await database.query("SELECT * FROM clubs WHERE LOWER(name) = LOWER($1)", [trimmedName]);

  if (nameMatches.rows.length > 0) {
    return { success: false, message: "That club name is already registered with a different club ID. Use the registered club ID or ask staff to review it." };
  }

  const result = await database.query(
    `
      INSERT INTO clubs (
        club_id, name, aliases, registered_by, registered_user_ids,
        owner_user_id, manager_user_ids, roster_user_ids,
        is_protected, is_verified, mode, created_at, updated_at
      )
      VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, NULL, '[]'::jsonb, '[]'::jsonb, false, false, 'core', $6, $6)
      RETURNING *
    `,
    [
      trimmedClubId,
      trimmedName,
      JSON.stringify(aliases),
      registeredBy,
      JSON.stringify([registeredBy]),
      now,
    ]
  );

  return { success: true, club: mapDbClub(result.rows[0]) };
}

async function removeClub(clubId) {
  if (!database.isDatabaseEnabled()) {
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

  const result = await database.query("DELETE FROM clubs WHERE LOWER(club_id) = LOWER($1)", [String(clubId).trim()]);
  return result.rowCount > 0;
}

module.exports = {
  findClubById,
  findClubByNameOrAlias,
  getClubs,
  registerClub,
  removeClub,
};
