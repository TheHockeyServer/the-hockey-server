const view = document.querySelector("#view");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const heroStat = document.querySelector("#heroStat");
const navLinks = [...document.querySelectorAll("[data-nav]")];

const routes = {
  "/": renderLeaderboard,
  "/leaderboard": renderLeaderboard,
  "/clubs": renderClubs,
  "/matches": renderMatches,
};

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

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function recordText(player) {
  return `${player.wins}-${player.losses}`;
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
  const differentialSign = player.goalDifferential > 0 ? "+" : "";

  return `
    <a class="player-row" href="/players/${encodeURIComponent(player.userId)}">
      <span class="rank">#${player.rank}</span>
      <span class="identity">
        <strong>${escapeHtml(player.username)}</strong>
        <span>${escapeHtml(recordText(player))} record | ${player.gamesPlayed} games</span>
        <span class="stat-strip">
          <span class="pill">Win ${player.winPercentage}%</span>
          <span class="pill">GF ${player.goalsFor}</span>
          <span class="pill">GA ${player.goalsAgainst}</span>
          <span class="pill ${differentialClass}">GD ${differentialSign}${player.goalDifferential}</span>
        </span>
      </span>
      <span class="rating">
        <strong>${player.rating}</strong>
        <span>ELO</span>
      </span>
    </a>
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

  try {
    const players = await fetchJson(`/api/leaderboard?${params.toString()}`);

    if (players.length === 0) {
      view.innerHTML = `
        <div class="section-title">
          <div>
            <h2>Leaderboard</h2>
            <p>No players match this search yet.</p>
          </div>
        </div>
        <div class="empty-state">
          <h2>Nothing on the board</h2>
          <p>Registered players and completed matches will appear here once RANKD activity starts flowing.</p>
        </div>
      `;
      return;
    }

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Leaderboard</h2>
          <p>${players.length} player${players.length === 1 ? "" : "s"} shown</p>
        </div>
      </div>
      <div class="list">${players.map(playerRow).join("")}</div>
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

    view.innerHTML = `
      <section class="profile-panel">
        <div>
          <p class="eyebrow">RANKD Player</p>
          <h2>${escapeHtml(player.username)}</h2>
          <div class="stat-strip">
            <span class="pill">Rank #${player.rank ?? "-"}</span>
            <span class="pill">${escapeHtml(recordText(player))}</span>
            <span class="pill">${player.gamesPlayed} games</span>
            <span class="pill">Win ${player.winPercentage}%</span>
            <span class="pill">GD ${player.goalDifferential}</span>
          </div>
        </div>
        <div class="profile-score">${player.rating}</div>
      </section>
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

async function renderClubs() {
  setActiveNav();
  setLoading("Loading clubs");

  try {
    const clubs = await fetchJson("/api/clubs");

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Registered Clubs</h2>
          <p>${clubs.length} club${clubs.length === 1 ? "" : "s"} registered</p>
        </div>
      </div>
      ${clubs.length ? `<div class="list">${clubs.map(clubRow).join("")}</div>` : empty("No clubs registered", "Club registrations will show here after players use /registerclub.")}
    `;
  } catch (error) {
    setError(error);
  }
}

function clubRow(club) {
  const aliases = club.aliases?.length ? club.aliases.join(", ") : "No aliases";

  return `
    <article class="club-row">
      <div>
        <h3>${escapeHtml(club.name)}</h3>
        <p>Club ID ${escapeHtml(club.clubId)} | ${escapeHtml(aliases)}</p>
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

    view.innerHTML = `
      <div class="section-title">
        <div>
          <h2>Recent Matches</h2>
          <p>${matches.length} completed match${matches.length === 1 ? "" : "es"}</p>
        </div>
      </div>
      ${matches.length ? `<div class="list">${matches.map(matchRow).join("")}</div>` : empty("No completed matches", "Webhook and reported match results will appear here.")}
    `;
  } catch (error) {
    setError(error);
  }
}

function matchRow(match) {
  const teamAScore = match.teamAScore ?? match.match?.["_enhanced"]?.result?.[match.match?.["_enhanced"]?.homeClubId]?.score ?? "-";
  const teamBScore = match.teamBScore ?? match.match?.["_enhanced"]?.result?.[match.match?.["_enhanced"]?.awayClubId]?.score ?? "-";
  const id = match.matchId ?? match.match?.matchId ?? "Unknown";
  const playedAt = match.playedAt ?? match.match?.timestamp ?? match.timestamp;

  return `
    <article class="match-row">
      <h3>Match ${escapeHtml(id)}</h3>
      <p class="match-score">Team A ${escapeHtml(teamAScore)} - Team B ${escapeHtml(teamBScore)}</p>
      <p>${escapeHtml(formatDate(playedAt))}</p>
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
  const link = event.target.closest("a");

  if (!link || link.origin !== window.location.origin) return;

  event.preventDefault();
  navigate(link.pathname);
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
