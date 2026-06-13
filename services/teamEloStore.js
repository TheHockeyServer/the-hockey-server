const fs = require("fs");
const path = require("path");

const database = require("./database");

const DATA_PATH = path.join(__dirname, "..", "data", "teamElo.json");
const DEFAULT_TEAM_RATING = 2500;

function getStartingRating() {
  const value = Number(process.env.TEAM_ELO_STARTING_RATING ?? DEFAULT_TEAM_RATING);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : DEFAULT_TEAM_RATING;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function ensureStore() {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });

  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ applications: [], teams: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  const store = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  store.applications ??= [];
  store.teams ??= [];
  return store;
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(DATA_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function mapApplication(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    clubId: row.club_id,
    clubName: row.club_name,
    ownerUserId: row.owner_user_id,
    ownerUsername: row.owner_username,
    status: row.status,
    notes: row.notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? Number(row.reviewed_at) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function mapTeam(row) {
  if (!row) return null;

  return {
    clubId: row.club_id,
    clubName: row.club_name,
    ownerUserId: row.owner_user_id,
    captainUserIds: row.captain_user_ids ?? [],
    rosterUserIds: row.roster_user_ids ?? [],
    rating: row.rating,
    highestRating: row.highest_rating,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    goalsFor: row.goals_for,
    goalsAgainst: row.goals_against,
    approvedBy: row.approved_by,
    approvedAt: Number(row.approved_at),
    updatedAt: Number(row.updated_at),
  };
}

async function getTeamByClubId(clubId) {
  if (!database.isDatabaseEnabled()) {
    return readStore().teams.find(team => normalize(team.clubId) === normalize(clubId)) ?? null;
  }

  const result = await database.query(
    "SELECT * FROM team_elo_clubs WHERE LOWER(club_id) = LOWER($1)",
    [String(clubId).trim()]
  );
  return mapTeam(result.rows[0]);
}

async function findTeams(query) {
  const value = String(query ?? "").trim();

  if (!value) return [];

  if (!database.isDatabaseEnabled()) {
    return readStore().teams.filter(team =>
      normalize(team.clubId) === normalize(value) ||
      normalize(team.clubName).includes(normalize(value))
    );
  }

  const result = await database.query(
    `
      SELECT *
      FROM team_elo_clubs
      WHERE LOWER(club_id) = LOWER($1)
         OR LOWER(club_name) LIKE LOWER($2)
      ORDER BY club_name ASC
    `,
    [value, `%${value}%`]
  );
  return result.rows.map(mapTeam);
}

async function getApplication(applicationId) {
  if (!database.isDatabaseEnabled()) {
    return readStore().applications.find(application => application.id === Number(applicationId)) ?? null;
  }

  const result = await database.query("SELECT * FROM team_elo_applications WHERE id = $1", [applicationId]);
  return mapApplication(result.rows[0]);
}

async function getPendingApplications() {
  if (!database.isDatabaseEnabled()) {
    return readStore().applications
      .filter(application => application.status === "pending")
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  const result = await database.query(
    "SELECT * FROM team_elo_applications WHERE status = 'pending' ORDER BY created_at ASC"
  );
  return result.rows.map(mapApplication);
}

async function createApplication({ clubId, clubName, ownerUserId, ownerUsername, notes }) {
  const trimmedClubId = String(clubId ?? "").trim();
  const trimmedClubName = String(clubName ?? "").trim();
  const trimmedNotes = String(notes ?? "").trim() || null;
  const now = Date.now();

  if (trimmedClubId.length < 2 || trimmedClubName.length < 2) {
    return { success: false, message: "Club name and club ID must each be at least 2 characters." };
  }

  const existingTeam = await getTeamByClubId(trimmedClubId);

  if (existingTeam) {
    return {
      success: false,
      message: existingTeam.ownerUserId === ownerUserId
        ? "That club is already approved for Team RANKD under your ownership."
        : "That club ID is already protected by an approved Team RANKD owner.",
    };
  }

  if (!database.isDatabaseEnabled()) {
    const store = readStore();
    const pending = store.applications.find(application =>
      application.status === "pending" && normalize(application.clubId) === normalize(trimmedClubId)
    );

    if (pending) {
      return {
        success: false,
        message: pending.ownerUserId === ownerUserId
          ? `Your application for this club is already pending as Application #${pending.id}.`
          : "A Team RANKD application for that club ID is already awaiting staff review.",
      };
    }

    const application = {
      id: Math.max(0, ...store.applications.map(item => Number(item.id) || 0)) + 1,
      clubId: trimmedClubId,
      clubName: trimmedClubName,
      ownerUserId,
      ownerUsername,
      status: "pending",
      notes: trimmedNotes,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    store.applications.push(application);
    writeStore(store);
    return { success: true, application };
  }

  const pending = await database.query(
    "SELECT * FROM team_elo_applications WHERE LOWER(club_id) = LOWER($1) AND status = 'pending'",
    [trimmedClubId]
  );

  if (pending.rows.length > 0) {
    const application = mapApplication(pending.rows[0]);
    return {
      success: false,
      message: application.ownerUserId === ownerUserId
        ? `Your application for this club is already pending as Application #${application.id}.`
        : "A Team RANKD application for that club ID is already awaiting staff review.",
    };
  }

  const result = await database.query(
    `
      INSERT INTO team_elo_applications (
        club_id, club_name, owner_user_id, owner_username,
        status, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'pending', $5, $6, $6)
      RETURNING *
    `,
    [trimmedClubId, trimmedClubName, ownerUserId, ownerUsername, trimmedNotes, now]
  );

  return { success: true, application: mapApplication(result.rows[0]) };
}

async function approveApplication(applicationId, reviewedBy) {
  const application = await getApplication(applicationId);

  if (!application || application.status !== "pending") {
    return { success: false, message: "That pending Team RANKD application could not be found." };
  }

  const existingTeam = await getTeamByClubId(application.clubId);

  if (existingTeam) {
    return { success: false, message: "That club ID is already protected by an approved Team RANKD team." };
  }

  const now = Date.now();
  const rating = getStartingRating();

  if (!database.isDatabaseEnabled()) {
    const store = readStore();
    const storedApplication = store.applications.find(item => item.id === application.id);
    const team = {
      clubId: application.clubId,
      clubName: application.clubName,
      ownerUserId: application.ownerUserId,
      captainUserIds: [application.ownerUserId],
      rosterUserIds: [application.ownerUserId],
      rating,
      highestRating: rating,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      approvedBy: reviewedBy,
      approvedAt: now,
      updatedAt: now,
    };

    storedApplication.status = "approved";
    storedApplication.reviewedBy = reviewedBy;
    storedApplication.reviewedAt = now;
    storedApplication.updatedAt = now;
    store.teams.push(team);
    writeStore(store);
    return { success: true, application: storedApplication, team };
  }

  return database.transaction(async query => {
    const teamResult = await query(
      `
        INSERT INTO team_elo_clubs (
          club_id, club_name, owner_user_id, captain_user_ids, roster_user_ids,
          rating, highest_rating, approved_by, approved_at, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $4::jsonb, $5, $5, $6, $7, $7)
        RETURNING *
      `,
      [
        application.clubId,
        application.clubName,
        application.ownerUserId,
        JSON.stringify([application.ownerUserId]),
        rating,
        reviewedBy,
        now,
      ]
    );
    const applicationResult = await query(
      `
        UPDATE team_elo_applications
        SET status = 'approved', reviewed_by = $2, reviewed_at = $3, updated_at = $3
        WHERE id = $1 AND status = 'pending'
        RETURNING *
      `,
      [application.id, reviewedBy, now]
    );

    return {
      success: true,
      application: mapApplication(applicationResult.rows[0]),
      team: mapTeam(teamResult.rows[0]),
    };
  });
}

async function denyApplication(applicationId, reviewedBy, reason) {
  const application = await getApplication(applicationId);

  if (!application || application.status !== "pending") {
    return { success: false, message: "That pending Team RANKD application could not be found." };
  }

  const now = Date.now();
  const notes = String(reason ?? "").trim() || "No reason provided.";

  if (!database.isDatabaseEnabled()) {
    const store = readStore();
    const storedApplication = store.applications.find(item => item.id === application.id);
    storedApplication.status = "denied";
    storedApplication.notes = notes;
    storedApplication.reviewedBy = reviewedBy;
    storedApplication.reviewedAt = now;
    storedApplication.updatedAt = now;
    writeStore(store);
    return { success: true, application: storedApplication };
  }

  const result = await database.query(
    `
      UPDATE team_elo_applications
      SET status = 'denied', notes = $2, reviewed_by = $3, reviewed_at = $4, updated_at = $4
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `,
    [application.id, notes, reviewedBy, now]
  );
  return { success: true, application: mapApplication(result.rows[0]) };
}

module.exports = {
  DEFAULT_TEAM_RATING,
  approveApplication,
  createApplication,
  denyApplication,
  findTeams,
  getApplication,
  getPendingApplications,
  getStartingRating,
  getTeamByClubId,
};
