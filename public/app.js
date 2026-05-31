const view = document.querySelector("#view");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const heroStat = document.querySelector("#heroStat");
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

    view.innerHTML = `
      <section class="profile-panel">
        <div>
          <p class="eyebrow">RANKD Player</p>
          <h2>${escapeHtml(player.username)}</h2>
          <div class="stat-strip">
            <span class="pill">Rank #${player.rank ?? "-"}</span>
            <span class="pill">${escapeHtml(player.preferredPositionLabel)}</span>
            <span class="pill">${escapeHtml(recordText(player))}</span>
            <span class="pill">${player.gamesPlayed} games</span>
            <span class="pill">Win ${player.winPercentage}%</span>
            <span class="pill">High ${player.highestRating}</span>
            ${change === null || change === undefined ? "" : `<span class="pill ${change >= 0 ? "good" : "bad"}">Last ${signed(change)}</span>`}
          </div>
        </div>
        <div class="profile-score">
          ${player.rating}
          <span>ELO</span>
        </div>
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

  event.preventDefault();
  navigate(link.pathname);
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

window.addEventListener("popstate", route);

loadOverview();
route();
