const view = document.querySelector("#view");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const heroStat = document.querySelector("#heroStat");
const accountLink = document.querySelector("#accountLink");
const navLinks = [...document.querySelectorAll("[data-nav]")];

const leaderboardState = {
  position: "all",
  sort: "elo",
};

const routes = {
  "/": renderLeaderboard,
  "/leaderboard": renderLeaderboard,
  "/clubs": renderClubs,
  "/matches": renderMatches,
  "/register": renderRegister,
  "/team-rankd": renderTeamRankd,
};

const positionTabs = [
  ["all", "All"],
  ["forward", "Forward"],
  ["defense", "Defense"],
  ["goalie", "Goalie"],
];

const sortOptions = [
  ["elo", "ELO"],
  ["wins", "Wins"],
  ["winPct", "Win %"],
  ["games", "Games"],
  ["goalDiff", "Goal Diff"],
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return "Not played yet";
  const value = typeof timestamp === "number" || /^\d+$/.test(String(timestamp))
    ? Number(timestamp)
    : timestamp;
  const dateValue = typeof value === "number" && value < 100000000000
    ? value * 1000
    : value;
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function recordText(player) {
  return `${player.wins}-${player.losses}`;
}

function signed(value) {
  return Number(value) > 0 ? `+${value}` : `${value}`;
}

function getPlayerStatus(player) {
  if (player.gamesPlayed <= 0) return "Launch Ready";
  if (player.lastRatingChange > 0) return "Climbing";
  if (player.lastRatingChange < 0) return "Rebound Watch";
  return "Holding";
}

function getPlayerInitials(username) {
  return String(username ?? "R")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "R";
}

function setActiveNav() {
  const path = window.location.pathname;

  for (const link of navLinks) {
    const key = link.dataset.nav;
    link.classList.toggle("active", path.includes(key) || (path === "/" && key === "leaderboard"));
  }
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function postJson(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }

  return payload;
}

function setLoading(title = "Loading") {
  view.innerHTML = `
    <div class="empty-state">
      <h2>${escapeHtml(title)}</h2>
      <p>Pulling the latest RANKD data.</p>
    </div>
  `;
}

function setError(error) {
  view.innerHTML = `
    <div class="empty-state error">
      <h2>Could not load stats</h2>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
}

function playerRow(player) {
  const differentialClass = player.goalDifferential >= 0 ? "good" : "bad";
  const change = player.lastRatingChange;

  return `
    <a class="player-row" href="/players/${encodeURIComponent(player.userId)}">
      <span class="rank">#${player.rank}</span>
      <span class="identity">
        <strong>${escapeHtml(player.username)}</strong>
        <span>${escapeHtml(player.preferredPositionLabel)} | ${escapeHtml(recordText(player))} | ${player.gamesPlayed} games</span>
        <span class="stat-strip">
          <span class="pill">Win ${player.winPercentage}%</span>
          <span class="pill">High ${player.highestRating}</span>
          <span class="pill ${differentialClass}">GD ${signed(player.goalDifferential)}</span>
          ${change === null || change === undefined ? "" : `<span class="pill ${change >= 0 ? "good" : "bad"}">Last ${signed(change)}</span>`}
        </span>
      </span>
      <span class="rating">
        <strong>${player.rating}</strong>
        <span>ELO</span>
      </span>
    </a>
  `;
}

function podiumCard(player, index) {
  const labels = ["Top Rank", "Second", "Third"];

  return `
    <a class="podium-card podium-${index + 1}" href="/players/${encodeURIComponent(player.userId)}">
      <span>${labels[index]}</span>
      <strong>${escapeHtml(player.username)}</strong>
      <em>${player.rating} ELO</em>
      <small>${escapeHtml(player.preferredPositionLabel)} | ${escapeHtml(recordText(player))}</small>
    </a>
  `;
}

function leaderboardControls() {
  return `
    <div class="leaderboard-controls">
      <div class="tabs" role="tablist" aria-label="Position filter">
        ${positionTabs.map(([value, label]) => `
          <button class="tab-button ${leaderboardState.position === value ? "active" : ""}" type="button" data-position="${value}">
            ${label}
          </button>
        `).join("")}
      </div>
      <label class="sort-control">
        <span>Sort</span>
        <select id="sortSelect">
          ${sortOptions.map(([value, label]) => `
            <option value="${value}" ${leaderboardState.sort === value ? "selected" : ""}>${label}</option>
          `).join("")}
        </select>
      </label>
    </div>
  `;
}

function updateHero(overview) {
  const top = overview.topPlayers?.[0];

  heroStat.innerHTML = `
    <span>${top ? "Current #1" : "Live Board"}</span>
    <strong>${top ? escapeHtml(top.rating) : "2500"}</strong>
    <small>${top ? escapeHtml(top.username) : "Launch ELO"}</small>
  `;
}

async function loadOverview() {
  try {
    const overview = await fetchJson("/api/overview");
    updateHero(overview);
  } catch (error) {
    updateHero({ topPlayers: [] });
  }
}

async function loadAccountLink() {
  try {
    const auth = await fetchJson("/api/auth/me");
    accountLink.textContent = auth.authenticated ? auth.user.username : "Register";
  } catch {
    accountLink.textContent = "Register";
  }
}

async function renderLeaderboard() {
  setActiveNav();
  setLoading("Loading leaderboard");

  const params = new URLSearchParams();
  const search = searchInput.value.trim();

  if (search) params.set("search", search);
  params.set("limit", "100");
  params.set("position", leaderboardState.position);
  params.set("sort", leaderboardState.sort);

  try {
    const players = await fetchJson(`/api/leaderboard?${params.toString()}`);
    const podium = players.slice(0, 3);
    const rest = players.slice(3);

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Leaderboard</h2>
          <p>${players.length ? `${players.length} player${players.length === 1 ? "" : "s"} shown` : "No players match this view yet."}</p>
        </div>
      </div>
      ${leaderboardControls()}
      ${podium.length ? `<div class="podium">${podium.map(podiumCard).join("")}</div>` : ""}
      ${rest.length ? `<div class="list">${rest.map(playerRow).join("")}</div>` : ""}
      ${players.length ? "" : empty("Nothing on the board", "Registered players and completed matches will appear here once RANKD activity starts flowing.")}
    `;
  } catch (error) {
    setError(error);
  }
}

async function renderPlayer(userId) {
  setActiveNav();
  setLoading("Loading profile");

  try {
    const player = await fetchJson(`/api/players/${encodeURIComponent(userId)}`);
    const matches = player.recentMatches ?? [];
    const change = player.lastRatingChange;
    const clubs = player.registeredClubs ?? [];
    const primaryClub = clubs[0];
    const winRate = Math.max(0, Math.min(100, Number(player.winPercentage) || 0));
    const goalsForPerGame = player.gamesPlayed > 0 ? (player.goalsFor / player.gamesPlayed).toFixed(1) : "0.0";
    const goalsAgainstPerGame = player.gamesPlayed > 0 ? (player.goalsAgainst / player.gamesPlayed).toFixed(1) : "0.0";

    view.innerHTML = `
      <section class="player-hero-panel">
        <div class="player-mark">${escapeHtml(getPlayerInitials(player.username))}</div>
        <div class="player-hero-copy">
          <p class="eyebrow">RANKD Player Profile</p>
          <h2>${escapeHtml(player.username)}</h2>
          <div class="stat-strip">
            <span class="pill">Rank #${player.rank ?? "-"}</span>
            <span class="pill">${escapeHtml(player.preferredPositionLabel)}</span>
            <span class="pill">${escapeHtml(getPlayerStatus(player))}</span>
            ${primaryClub ? `<span class="pill">${escapeHtml(primaryClub.name)}</span>` : `<span class="pill">No Club Attached</span>`}
          </div>
        </div>
        <div class="profile-score">
          ${player.rating}
          <span>ELO</span>
        </div>
      </section>
      <div class="profile-grid profile-grid-featured">
        ${statCard("Record", recordText(player))}
        ${statCard("Games Played", player.gamesPlayed)}
        ${statCard("Win Rate", `${player.winPercentage}%`, player.winPercentage >= 50 ? "good" : player.gamesPlayed > 0 ? "bad" : "")}
        ${statCard("Highest ELO", player.highestRating)}
      </div>
      <section class="profile-dashboard">
        <article class="profile-card">
          <div class="profile-card-header">
            <span>Performance</span>
            <strong>${escapeHtml(getPlayerStatus(player))}</strong>
          </div>
          <div class="meter">
            <span style="width: ${winRate}%"></span>
          </div>
          <div class="profile-metrics">
            <div>
              <span>Win Rate</span>
              <strong>${player.winPercentage}%</strong>
            </div>
            <div>
              <span>Last Change</span>
              <strong class="${change >= 0 ? "good" : "bad"}">${change === null || change === undefined ? "0" : signed(change)}</strong>
            </div>
            <div>
              <span>Goal Diff</span>
              <strong class="${player.goalDifferential >= 0 ? "good" : "bad"}">${signed(player.goalDifferential)}</strong>
            </div>
          </div>
        </article>
        <article class="profile-card">
          <div class="profile-card-header">
            <span>Scoring Pace</span>
            <strong>${escapeHtml(player.positionGroup)}</strong>
          </div>
          <div class="profile-metrics stacked">
            <div>
              <span>Goals For</span>
              <strong>${player.goalsFor}</strong>
              <small>${goalsForPerGame} per game</small>
            </div>
            <div>
              <span>Goals Against</span>
              <strong>${player.goalsAgainst}</strong>
              <small>${goalsAgainstPerGame} per game</small>
            </div>
          </div>
        </article>
        <article class="profile-card">
          <div class="profile-card-header">
            <span>Club Attachment</span>
            <strong>${primaryClub ? escapeHtml(primaryClub.name) : "Unattached"}</strong>
          </div>
          ${clubs.length ? `
            <div class="profile-club-list">
              ${clubs.map(club => `
                <div>
                  <strong>${escapeHtml(club.name)}</strong>
                  <span>ID ${escapeHtml(club.clubId)} | ${club.isVerified ? "Verified" : "Core"}${club.isProtected ? " | Protected" : ""}</span>
                </div>
              `).join("")}
            </div>
          ` : `<p class="muted-line">This player has not attached a club yet.</p>`}
        </article>
      </section>
      <div class="profile-grid">
        ${statCard("Goals For", player.goalsFor)}
        ${statCard("Goals Against", player.goalsAgainst)}
        ${statCard("Goal Diff", signed(player.goalDifferential), player.goalDifferential >= 0 ? "good" : "bad")}
        ${statCard("Last Played", formatDate(player.lastPlayedAt))}
      </div>
      <div class="section-title">
        <div>
          <h2>Recent Matches</h2>
          <p>${matches.length || "No"} stored match${matches.length === 1 ? "" : "es"}</p>
        </div>
      </div>
      ${matches.length ? `<div class="list">${matches.map(matchRow).join("")}</div>` : empty("No match history", "Completed RANKD matches for this player will show here.")}
    `;
  } catch (error) {
    view.innerHTML = `
      <div class="empty-state error">
        <h2>Player not found</h2>
        <p>This profile is not in the RANKD database yet.</p>
      </div>
    `;
  }
}

function registrationNotice(message, type = "success") {
  return `
    <div class="registration-notice ${type}">
      <strong>${type === "success" ? "Registration Complete" : "Registration Issue"}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

async function renderRegister() {
  setActiveNav();
  setLoading("Loading registration");

  try {
    const auth = await fetchJson("/api/auth/me");

    if (!auth.authenticated) {
      view.innerHTML = `
        <section class="registration-hero">
          <div>
            <p class="eyebrow">RANKD Player Access</p>
            <h2>Register With Discord</h2>
            <p>Connect your Discord account so RANKD can securely create your player profile, initialize your ELO, and assign your server role.</p>
          </div>
          <a class="primary-link ${auth.configured ? "" : "disabled"}" href="${auth.configured ? "/auth/discord" : "#"}" data-auth-link>
            ${auth.configured ? "Continue With Discord" : "Discord Login Not Configured"}
          </a>
        </section>
        <div class="registration-steps">
          ${statCard("1", "Verify Discord")}
          ${statCard("2", "Choose Registration")}
          ${statCard("3", "Enter RANKD")}
        </div>
      `;
      return;
    }

    const playerRegistered = Boolean(auth.registration);
    const clubRegistered = auth.clubs.length > 0;

    view.innerHTML = `
      <section class="registration-hero signed-in">
        <div>
          <p class="eyebrow">Signed In With Discord</p>
          <h2>${escapeHtml(auth.user.username)}</h2>
          <p>Choose the registration that matches how you plan to play Core ELO.</p>
          <div class="stat-strip">
            <span class="pill">${playerRegistered || clubRegistered ? "Registered" : "Registration Needed"}</span>
            ${clubRegistered ? `<span class="pill">${escapeHtml(auth.clubs.map(club => club.name).join(", "))}</span>` : ""}
          </div>
        </div>
        <div class="registration-actions">
          ${playerRegistered || clubRegistered ? `<a class="primary-link" href="${auth.profileUrl}">View My Profile</a>` : ""}
          <a class="secondary-link" href="/auth/logout" data-auth-link>Log Out</a>
        </div>
      </section>
      <div id="registrationNotice"></div>
      <section class="registration-grid">
        <article class="registration-card">
          <span>Option One</span>
          <h3>RANKD Player</h3>
          <p>Choose this if you do not plan to provide a personal EASHL club for Core ELO match lookup.</p>
          <ul>
            <li>Initializes your profile at 2500 ELO</li>
            <li>Assigns the RANKD Player role</li>
            <li>Removes the UNVERIFIED role</li>
          </ul>
          <button type="button" id="registerPlayerButton">${playerRegistered ? "Update Player Registration" : "Register As Player"}</button>
        </article>
        <article class="registration-card">
          <span>Option Two</span>
          <h3>Register A Club</h3>
          <p>Search CHELHead to find your club and automatically fill its exact name and ID.</p>
          <div class="club-finder">
            <label>
              <span>Find Your Club</span>
              <div class="club-search-row">
                <input id="clubSearchInput" minlength="3" placeholder="Enter at least 3 characters">
                <button type="button" id="clubSearchButton">Search</button>
              </div>
            </label>
            <div id="clubSearchResults" class="club-search-results">
              <p class="muted-line">Search results will appear here.</p>
            </div>
          </div>
          <form id="clubRegistrationForm">
            <label>
              <span>Club Name</span>
              <input name="clubName" id="clubNameInput" minlength="2" required placeholder="Choose a search result or enter club name">
            </label>
            <label>
              <span>Club ID</span>
              <input name="clubId" id="clubIdInput" minlength="2" required placeholder="Choose a search result or enter club ID">
            </label>
            <label>
              <span>Alias <small>Optional</small></span>
              <input name="alias" placeholder="Short club name">
            </label>
            <button type="submit">${clubRegistered ? "Attach Another Club" : "Register Club"}</button>
          </form>
        </article>
      </section>
      <section class="setup-next-step">
        <div>
          <span>Optional Competitive Path</span>
          <h3>Building A Team?</h3>
          <p>After attaching your club above, apply for exclusive Team RANKD ownership and enter the organized Team ELO ladder.</p>
        </div>
        <a class="primary-link" href="/team-rankd">Open Team RANKD</a>
      </section>
    `;
  } catch (error) {
    setError(error);
  }
}

function teamApplicationCard(application) {
  const statusClass = application.status === "approved"
    ? "good"
    : application.status === "denied"
      ? "bad"
      : "";

  return `
    <article class="team-application">
      <div>
        <span>Application #${application.id}</span>
        <h3>${escapeHtml(application.clubName)}</h3>
        <p>Club ID ${escapeHtml(application.clubId)} | Submitted ${escapeHtml(formatDate(application.createdAt))}</p>
        ${application.notes ? `<p>${escapeHtml(application.notes)}</p>` : ""}
      </div>
      <strong class="${statusClass}">${escapeHtml(application.status)}</strong>
    </article>
  `;
}

function staffApplicationCard(application) {
  return `
    <article class="team-application staff-review" data-application-id="${application.id}">
      <div>
        <span>Application #${application.id}</span>
        <h3>${escapeHtml(application.clubName)}</h3>
        <p>Club ID ${escapeHtml(application.clubId)} | Applicant ${escapeHtml(application.ownerUsername)}</p>
        <p>${escapeHtml(application.notes || "No notes provided.")}</p>
      </div>
      <div class="review-actions">
        <button type="button" data-team-approve="${application.id}">Approve</button>
        <button class="danger-button" type="button" data-team-deny="${application.id}">Deny</button>
      </div>
    </article>
  `;
}

async function renderTeamRankd() {
  setActiveNav();
  setLoading("Loading Team RANKD");

  try {
    const auth = await fetchJson("/api/auth/me");

    if (!auth.authenticated) {
      view.innerHTML = `
        <section class="registration-hero">
          <div>
            <p class="eyebrow">Protected Team Competition</p>
            <h2>Team RANKD</h2>
            <p>Connect Discord to apply for protected club ownership, manage your future roster, and compete on the Team ELO ladder.</p>
          </div>
          <a class="primary-link" href="/auth/discord" data-auth-link>Continue With Discord</a>
        </section>
      `;
      return;
    }

    const account = await fetchJson("/api/team-rankd/me");
    const pending = account.applications.filter(application => application.status === "pending");
    const approved = account.teams;
    let staffApplications = [];

    if (account.isStaff) {
      staffApplications = await fetchJson("/api/team-rankd/applications/pending");
    }

    view.innerHTML = `
      <section class="registration-hero signed-in">
        <div>
          <p class="eyebrow">Team RANKD Control Center</p>
          <h2>${escapeHtml(auth.user.username)}</h2>
          <p>Apply for exclusive Team RANKD ownership using a club already attached to your Core ELO account.</p>
          <div class="stat-strip">
            <span class="pill">${approved.length} Approved</span>
            <span class="pill">${pending.length} Pending</span>
            ${account.isStaff ? `<span class="pill">Staff Review Access</span>` : ""}
          </div>
        </div>
        <a class="secondary-link" href="/auth/logout" data-auth-link>Log Out</a>
      </section>
      <div id="teamRankdNotice"></div>
      <section class="team-rankd-grid">
        <article class="registration-card team-apply-card">
          <span>Ownership Application</span>
          <h3>Protect Your Club</h3>
          <p>Approved Team RANKD ownership reserves the club ID to you. Core ELO club attachments remain shareable.</p>
          ${account.clubs.length ? `
            <form id="teamApplicationForm">
              <label>
                <span>Attached Club</span>
                <select name="clubId" required>
                  ${account.clubs.map(club => `<option value="${escapeHtml(club.clubId)}">${escapeHtml(club.name)} (${escapeHtml(club.clubId)})</option>`).join("")}
                </select>
              </label>
              <label>
                <span>Notes <small>Optional</small></span>
                <textarea name="notes" maxlength="500" placeholder="Anything staff should know about your ownership request"></textarea>
              </label>
              <button type="submit">Submit Team Application</button>
            </form>
          ` : `
            <div class="empty-state compact">
              <h2>Attach A Club First</h2>
              <p>Register or attach your club through Core ELO before requesting protected Team RANKD ownership.</p>
              <a class="primary-link" href="/register">Go To Registration</a>
            </div>
          `}
        </article>
        <article class="registration-card">
          <span>Your Team RANKD Activity</span>
          <h3>Applications</h3>
          <div class="application-list">
            ${account.applications.length
              ? account.applications.map(teamApplicationCard).join("")
              : `<p class="muted-line">You have not submitted a Team RANKD application yet.</p>`}
          </div>
        </article>
      </section>
      ${account.isStaff ? `
        <section class="staff-approval-panel">
          <div class="section-title">
            <div>
              <h2>Staff Approvals</h2>
              <p>${staffApplications.length} pending Team RANKD application${staffApplications.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <div class="application-list">
            ${staffApplications.length
              ? staffApplications.map(staffApplicationCard).join("")
              : empty("Queue Clear", "There are no Team RANKD applications awaiting review.")}
          </div>
        </section>
      ` : ""}
    `;
  } catch (error) {
    setError(error);
  }
}

function statCard(label, value, className = "") {
  return `
    <article class="stat-card ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

async function renderClubs() {
  setActiveNav();
  setLoading("Loading clubs");

  try {
    const clubs = await fetchJson("/api/clubs");
    const attachedPlayers = clubs.reduce((sum, club) => sum + (club.registeredUserCount ?? 0), 0);
    const verifiedClubs = clubs.filter(club => club.isVerified).length;
    const protectedClubs = clubs.filter(club => club.isProtected).length;
    const featuredClubs = [...clubs]
      .sort((a, b) => (b.registeredUserCount ?? 0) - (a.registeredUserCount ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 3);

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Registered Clubs</h2>
          <p>${clubs.length} club${clubs.length === 1 ? "" : "s"} registered</p>
        </div>
      </div>
      <div class="insight-grid">
        ${statCard("Registered Clubs", clubs.length)}
        ${statCard("Attached Players", attachedPlayers)}
        ${statCard("Verified Clubs", verifiedClubs)}
        ${statCard("Protected Clubs", protectedClubs)}
      </div>
      ${featuredClubs.length ? `
        <section class="feature-panel">
          <div class="feature-panel-header">
            <span>Club Snapshot</span>
            <strong>Most Attached Players</strong>
          </div>
          <div class="feature-grid">
            ${featuredClubs.map(featuredClubCard).join("")}
          </div>
        </section>
      ` : ""}
      ${clubs.length ? `<div class="list">${clubs.map(clubRow).join("")}</div>` : empty("No clubs registered", "Club registrations will show here after players use /registerclub.")}
    `;
  } catch (error) {
    setError(error);
  }
}

function featuredClubCard(club) {
  const topPlayer = club.registeredPlayers?.[0];

  return `
    <article class="feature-card">
      <span>Club ID ${escapeHtml(club.clubId)}</span>
      <strong>${escapeHtml(club.name)}</strong>
      <em>${club.registeredUserCount} attached player${club.registeredUserCount === 1 ? "" : "s"}</em>
      <small>${topPlayer ? `Top attached: ${escapeHtml(topPlayer.username)} (${topPlayer.rating} ELO)` : "Roster details pending"}</small>
    </article>
  `;
}

function clubRow(club) {
  const aliases = club.aliases?.length ? club.aliases.join(", ") : "No aliases";
  const players = club.registeredPlayers ?? [];

  return `
    <article class="club-row club-row-expanded">
      <div>
        <h3>${escapeHtml(club.name)}</h3>
        <p>Club ID ${escapeHtml(club.clubId)} | ${escapeHtml(aliases)}</p>
        ${players.length ? `
          <div class="club-roster">
            ${players.map(player => `
              <a href="/players/${encodeURIComponent(player.userId)}">
                <strong>${escapeHtml(player.username)}</strong>
                <span>${escapeHtml(player.preferredPositionLabel)} | ${escapeHtml(player.record)} | ${player.rating} ELO</span>
              </a>
            `).join("")}
          </div>
        ` : `<p class="muted-line">No attached players found in ratings yet.</p>`}
      </div>
      <div class="rating">
        <strong>${club.registeredUserCount}</strong>
        <span>Players</span>
      </div>
    </article>
  `;
}

async function renderMatches() {
  setActiveNav();
  setLoading("Loading matches");

  try {
    const matches = await fetchJson("/api/matches/recent?limit=50");
    const webhookMatches = matches.filter(match => match.match).length;
    const manualMatches = matches.length - webhookMatches;
    const latestMatch = matches[0];
    const highestScore = matches.reduce((best, match) => {
      const { teamAScore, teamBScore } = getMatchScores(match);
      const total = Number(teamAScore) + Number(teamBScore);

      if (!Number.isFinite(total)) return best;
      return !best || total > best.total ? { match, total } : best;
    }, null);

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Recent Matches</h2>
          <p>${matches.length} completed match${matches.length === 1 ? "" : "es"}</p>
        </div>
      </div>
      <div class="insight-grid">
        ${statCard("Stored Matches", matches.length)}
        ${statCard("Webhook Results", webhookMatches)}
        ${statCard("Manual Reports", manualMatches)}
        ${statCard("Latest Match", latestMatch ? `#${latestMatch.matchId ?? latestMatch.match?.matchId ?? "Pending"}` : "None")}
      </div>
      ${highestScore ? `
        <section class="feature-panel match-feature">
          <div class="feature-panel-header">
            <span>Match Snapshot</span>
            <strong>Highest Combined Score</strong>
          </div>
          ${matchRow(highestScore.match)}
        </section>
      ` : ""}
      ${matches.length ? `<div class="list">${matches.map(matchRow).join("")}</div>` : empty("No completed matches", "Webhook and reported match results will appear here.")}
    `;
  } catch (error) {
    setError(error);
  }
}

function getChelheadScore(match, side) {
  const enhanced = match.match?.["_enhanced"];
  const clubId = side === "home" ? enhanced?.homeClubId : enhanced?.awayClubId;

  return clubId ? enhanced?.result?.[clubId]?.score : undefined;
}

function getMatchScores(match) {
  return {
    teamAScore: match.teamAScore ?? getChelheadScore(match, "home") ?? "-",
    teamBScore: match.teamBScore ?? getChelheadScore(match, "away") ?? "-",
  };
}

function matchRow(match) {
  const { teamAScore, teamBScore } = getMatchScores(match);
  const id = match.matchId ?? match.match?.matchId ?? "Unknown";
  const playedAt = match.playedAt ?? match.match?.timestamp ?? match.timestamp;
  const winner = Number(teamAScore) > Number(teamBScore)
    ? "Team A"
    : Number(teamBScore) > Number(teamAScore)
      ? "Team B"
      : "Pending";
  const source = match.match ? "CHELHead webhook" : "Manual report";

  return `
    <article class="match-row">
      <div>
        <h3>Match ${escapeHtml(id)}</h3>
        <p>${escapeHtml(formatDate(playedAt))} | ${escapeHtml(source)}</p>
      </div>
      <div class="match-result">
        <span>${escapeHtml(winner)} Winner</span>
        <strong>Team A ${escapeHtml(teamAScore)} - Team B ${escapeHtml(teamBScore)}</strong>
      </div>
    </article>
  `;
}

function empty(title, message) {
  return `
    <div class="empty-state">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function navigate(path) {
  window.history.pushState({}, "", path);
  route();
}

function route() {
  const path = window.location.pathname;
  const playerMatch = path.match(/^\/players\/([^/]+)$/);

  if (playerMatch) {
    renderPlayer(decodeURIComponent(playerMatch[1]));
    return;
  }

  const renderer = routes[path] ?? renderLeaderboard;
  renderer();
}

document.addEventListener("click", event => {
  const positionButton = event.target.closest("[data-position]");

  if (positionButton) {
    leaderboardState.position = positionButton.dataset.position;
    navigate("/leaderboard");
    return;
  }

  const link = event.target.closest("a");

  if (!link || link.origin !== window.location.origin) return;
  if (link.hasAttribute("data-auth-link")) return;

  event.preventDefault();
  navigate(link.pathname);
});

document.addEventListener("submit", async event => {
  if (event.target.id === "teamApplicationForm") {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const notice = document.querySelector("#teamRankdNotice");

    button.disabled = true;
    button.textContent = "Submitting...";

    try {
      await postJson("/api/team-rankd/applications", {
        clubId: data.get("clubId"),
        notes: data.get("notes"),
      });
      notice.innerHTML = registrationNotice("Your Team RANKD application was submitted for staff review.");
      setTimeout(renderTeamRankd, 700);
    } catch (error) {
      notice.innerHTML = registrationNotice(error.message, "error");
      button.disabled = false;
      button.textContent = "Submit Team Application";
    }
    return;
  }

  if (event.target.id !== "clubRegistrationForm") return;

  event.preventDefault();
  const form = event.target;
  const notice = document.querySelector("#registrationNotice");
  const button = form.querySelector("button[type='submit']");
  const data = new FormData(form);

  button.disabled = true;
  button.textContent = "Registering...";

  try {
    const result = await postJson("/api/register/club", {
      clubName: data.get("clubName"),
      clubId: data.get("clubId"),
      alias: data.get("alias"),
    });
    notice.innerHTML = registrationNotice(result.message);
    await loadAccountLink();
  } catch (error) {
    notice.innerHTML = registrationNotice(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Register Club";
  }
});

document.addEventListener("click", async event => {
  const clubResult = event.target.closest("[data-club-result]");

  if (clubResult) {
    document.querySelector("#clubNameInput").value = clubResult.dataset.clubName;
    document.querySelector("#clubIdInput").value = clubResult.dataset.clubId;
    document.querySelectorAll("[data-club-result]").forEach(result => {
      result.classList.toggle("selected", result === clubResult);
    });
    return;
  }

  const clubSearchButton = event.target.closest("#clubSearchButton");

  if (clubSearchButton) {
    const input = document.querySelector("#clubSearchInput");
    const results = document.querySelector("#clubSearchResults");
    const query = input.value.trim();

    if (query.length < 3) {
      results.innerHTML = `<p class="muted-line">Enter at least 3 characters.</p>`;
      return;
    }

    clubSearchButton.disabled = true;
    clubSearchButton.textContent = "Searching...";
    results.innerHTML = `<p class="muted-line">Searching CHELHead...</p>`;

    try {
      const clubs = await fetchJson(`/api/chelhead/clubs/search?name=${encodeURIComponent(query)}`);
      results.innerHTML = clubs.length
        ? clubs.map(club => `
          <button
            class="club-search-result"
            type="button"
            data-club-result
            data-club-id="${escapeHtml(club.clubId)}"
            data-club-name="${escapeHtml(club.name)}"
          >
            <strong>${escapeHtml(club.name)}</strong>
            <span>Club ID ${escapeHtml(club.clubId)}${club.platform ? ` | ${escapeHtml(club.platform)}` : ""}</span>
          </button>
        `).join("")
        : `<p class="muted-line">No clubs matched that search.</p>`;
    } catch (error) {
      results.innerHTML = `<p class="muted-line">${escapeHtml(error.message)}</p>`;
    } finally {
      clubSearchButton.disabled = false;
      clubSearchButton.textContent = "Search";
    }
    return;
  }

  const approveButton = event.target.closest("[data-team-approve]");
  const denyButton = event.target.closest("[data-team-deny]");

  if (approveButton || denyButton) {
    const button = approveButton ?? denyButton;
    const applicationId = button.dataset.teamApprove ?? button.dataset.teamDeny;
    let reason = "";

    if (denyButton) {
      reason = window.prompt("Reason for denying this Team RANKD application:");
      if (!reason) return;
    }

    button.disabled = true;
    button.textContent = approveButton ? "Approving..." : "Denying...";

    try {
      await postJson(`/api/team-rankd/applications/${applicationId}/${approveButton ? "approve" : "deny"}`, { reason });
      await renderTeamRankd();
    } catch (error) {
      const notice = document.querySelector("#teamRankdNotice");
      notice.innerHTML = registrationNotice(error.message, "error");
      button.disabled = false;
      button.textContent = approveButton ? "Approve" : "Deny";
    }
    return;
  }

  const button = event.target.closest("#registerPlayerButton");

  if (!button) return;

  const notice = document.querySelector("#registrationNotice");
  button.disabled = true;
  button.textContent = "Registering...";

  try {
    const result = await postJson("/api/register/player");
    notice.innerHTML = registrationNotice(result.message);
    await loadAccountLink();
  } catch (error) {
    notice.innerHTML = registrationNotice(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Update Player Registration";
  }
});

document.addEventListener("change", event => {
  if (event.target.id === "sortSelect") {
    leaderboardState.sort = event.target.value;
    navigate("/leaderboard");
  }
});

searchButton.addEventListener("click", () => {
  navigate("/leaderboard");
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    navigate("/leaderboard");
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Enter" && event.target.id === "clubSearchInput") {
    event.preventDefault();
    document.querySelector("#clubSearchButton")?.click();
  }
});

window.addEventListener("popstate", route);

loadOverview();
loadAccountLink();
route();
