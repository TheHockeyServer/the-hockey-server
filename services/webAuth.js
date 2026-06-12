const crypto = require("crypto");

const DISCORD_API_BASE = "https://discord.com/api/v10";
const SESSION_COOKIE = "rankd_session";
const STATE_COOKIE = "rankd_oauth_state";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_DURATION_MS = 10 * 60 * 1000;

function getSessionSecret() {
  return process.env.SESSION_SECRET;
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function encodeSignedPayload(payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${value}.${sign(value)}`;
}

function decodeSignedPayload(value) {
  if (!value || !getSessionSecret()) return null;

  const [payload, signature] = String(value).split(".");

  if (!payload || !signature) return null;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

    return decoded.expiresAt > Date.now() ? decoded : null;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  return String(req.headers.cookie ?? "")
    .split(";")
    .map(cookie => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separator = cookie.indexOf("=");

      if (separator === -1) return cookies;
      cookies[decodeURIComponent(cookie.slice(0, separator))] = decodeURIComponent(cookie.slice(separator + 1));
      return cookies;
    }, {});
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    maxAge,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.RAILWAY_ENVIRONMENT),
  };
}

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL
    ?? `${req.headers["x-forwarded-proto"] ?? req.protocol}://${req.headers["x-forwarded-host"] ?? req.get("host")}`;
}

function getRedirectUri(req) {
  return process.env.DISCORD_REDIRECT_URI ?? `${getBaseUrl(req)}/auth/discord/callback`;
}

function getSession(req) {
  return decodeSignedPayload(parseCookies(req)[SESSION_COOKIE]);
}

function requireSession(req, res, next) {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({ error: "Login with Discord to continue." });
  }

  req.rankdUser = session.user;
  return next();
}

function beginDiscordLogin(req, res) {
  const clientId = process.env.CLIENT_ID;

  if (!clientId || !process.env.DISCORD_CLIENT_SECRET || !getSessionSecret()) {
    return res.status(503).send("Discord website login is not configured yet.");
  }

  const state = crypto.randomBytes(24).toString("base64url");
  res.cookie(STATE_COOKIE, encodeSignedPayload({
    state,
    expiresAt: Date.now() + STATE_DURATION_MS,
  }), cookieOptions(STATE_DURATION_MS));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(req),
    response_type: "code",
    scope: "identify",
    state,
  });

  return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}

async function exchangeCode(req, code) {
  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(req),
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord token exchange failed with ${response.status}.`);
  }

  return response.json();
}

async function fetchDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Discord user lookup failed with ${response.status}.`);
  }

  return response.json();
}

async function completeDiscordLogin(req, res) {
  const statePayload = decodeSignedPayload(parseCookies(req)[STATE_COOKIE]);

  if (!statePayload || !req.query.state || statePayload.state !== req.query.state) {
    return res.status(400).send("Discord login expired or could not be verified. Please try again.");
  }

  if (!req.query.code) {
    return res.status(400).send("Discord did not return an authorization code.");
  }

  const token = await exchangeCode(req, req.query.code);
  const user = await fetchDiscordUser(token.access_token);

  res.clearCookie(STATE_COOKIE);
  res.cookie(SESSION_COOKIE, encodeSignedPayload({
    expiresAt: Date.now() + SESSION_DURATION_MS,
    user: {
      id: user.id,
      username: user.global_name || user.username,
      discordUsername: user.username,
      avatar: user.avatar,
    },
  }), cookieOptions(SESSION_DURATION_MS));

  return res.redirect("/register");
}

function logout(_req, res) {
  res.clearCookie(SESSION_COOKIE);
  res.redirect("/");
}

module.exports = {
  beginDiscordLogin,
  completeDiscordLogin,
  getSession,
  logout,
  requireSession,
};
