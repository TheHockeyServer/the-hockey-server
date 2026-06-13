const DEFAULT_BASE_URL = "https://api.chelhead.com";
const DEFAULT_TIMEOUT_MS = 15_000;

function getConfig() {
  return {
    apiKey: process.env.CHELHEAD_API_KEY,
    baseUrl: String(process.env.CHELHEAD_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

function isConfigured() {
  return Boolean(getConfig().apiKey);
}

async function request(path, { method = "GET", body, query } = {}) {
  const { apiKey, baseUrl } = getConfig();

  if (!apiKey) {
    throw new Error("CHELHEAD_API_KEY is not configured.");
  }

  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      "X-API-Key": apiKey,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload?.error ?? payload?.message ?? response.statusText;
    throw new Error(`CHELHead API request failed (${response.status}): ${detail}`);
  }

  return payload;
}

async function searchClubs(clubName) {
  const name = String(clubName ?? "").trim();

  if (!name) {
    throw new Error("A club name is required to search CHELHead.");
  }

  return request("/search-clubs", {
    query: { clubName: name },
  });
}

function normalizeClubSearchResult(club) {
  const clubId = club?.clubId
    ?? club?.clubid
    ?? club?.id
    ?? club?.club_id
    ?? club?.clubID;
  const name = club?.name
    ?? club?.clubName
    ?? club?.clubname
    ?? club?.club_name
    ?? club?.club;

  if (!clubId || !name) return null;

  return {
    clubId: String(clubId),
    name: String(name),
    platform: club?.platform ? String(club.platform) : null,
  };
}

function collectClubSearchResults(payload, results = [], context = "", depth = 0) {
  if (depth > 6 || payload === null || payload === undefined) return results;

  if (Array.isArray(payload)) {
    payload.forEach(value => collectClubSearchResults(value, results, context, depth + 1));
    return results;
  }

  if (typeof payload !== "object") return results;

  const normalized = normalizeClubSearchResult(payload);
  if (normalized) results.push(normalized);

  for (const [key, value] of Object.entries(payload)) {
    const keyLooksLikeClubId = /^\d+$/.test(key);
    const contextContainsClubs = /clubs?|results?|data|items?/i.test(context);

    if (keyLooksLikeClubId && typeof value === "string" && contextContainsClubs) {
      results.push({ clubId: key, name: value, platform: null });
      continue;
    }

    if (keyLooksLikeClubId && value && typeof value === "object" && !Array.isArray(value)) {
      collectClubSearchResults({ clubId: key, ...value }, results, key, depth + 1);
      continue;
    }

    collectClubSearchResults(value, results, key, depth + 1);
  }

  return results;
}

function normalizeClubSearchPayload(payload) {
  const unique = new Map();

  for (const club of collectClubSearchResults(payload)) {
    if (!unique.has(club.clubId)) {
      unique.set(club.clubId, club);
    }
  }

  return Array.from(unique.values()).slice(0, 20);
}

function normalizeClubSearchTerm(clubName) {
  return String(clubName ?? "")
    .trim()
    .split(/\s+/)
    .map(word => {
      if (/^(hc|hockey|eashl)$/i.test(word)) {
        return word.toUpperCase();
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

async function searchClubOptions(clubName) {
  const originalTerm = String(clubName ?? "").trim();
  const originalPayload = await searchClubs(originalTerm);
  const originalResults = normalizeClubSearchPayload(originalPayload);

  if (originalResults.length) return originalResults;

  const normalizedTerm = normalizeClubSearchTerm(originalTerm);
  if (!normalizedTerm || normalizedTerm === originalTerm) {
    console.warn("CHELHead club search returned no usable results:", JSON.stringify(originalPayload).slice(0, 2_000));
    return [];
  }

  const normalizedPayload = await searchClubs(normalizedTerm);
  const normalizedResults = normalizeClubSearchPayload(normalizedPayload);

  if (!normalizedResults.length) {
    console.warn("CHELHead club search returned no usable results:", JSON.stringify(normalizedPayload).slice(0, 2_000));
  }

  return normalizedResults;
}

async function checkConnection() {
  if (!isConfigured()) {
    return {
      configured: false,
      ok: false,
    };
  }

  try {
    await searchClubs("RANKD");

    return {
      configured: true,
      ok: true,
    };
  } catch (error) {
    return {
      configured: true,
      error: error.message,
      ok: false,
    };
  }
}

module.exports = {
  checkConnection,
  getConfig,
  isConfigured,
  normalizeClubSearchPayload,
  normalizeClubSearchTerm,
  request,
  searchClubOptions,
  searchClubs,
};
