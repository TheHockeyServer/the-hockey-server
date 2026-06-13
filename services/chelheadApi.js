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
  request,
  searchClubs,
};
