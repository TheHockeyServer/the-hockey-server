const crypto = require("crypto");
const express = require("express");
const path = require("path");

const chelheadWebhookStore = require("./chelheadWebhookStore");
const clubStore = require("./clubStore");
const playerRegistrationStore = require("./playerRegistrationStore");
const { registerCoreClub, registerCorePlayer } = require("./registrationService");
const statsService = require("./statsService");
const webAuth = require("./webAuth");

const DEFAULT_PORT = 8080;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const ASSETS_DIR = path.join(__dirname, "..", "assets");

function getSignatureDigest(signature) {
  const value = String(signature ?? "").trim();
  return value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
}

function safeCompareHex(a, b) {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function verifyChelheadSignature(rawBody, signature, timestamp, secret) {
  if (!secret) {
    return { verified: false, skipped: true };
  }

  if (!rawBody || !signature || !timestamp) {
    return { verified: false, skipped: false };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    verified: safeCompareHex(getSignatureDigest(signature), expected),
    skipped: false,
  };
}

function createWebServer() {
  const app = express();

  app.use(express.static(PUBLIC_DIR));
  app.use("/assets", express.static(ASSETS_DIR));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "RANKD bot",
    });
  });

  app.get("/auth/discord", webAuth.beginDiscordLogin);
  app.get("/auth/discord/callback", async (req, res) => {
    try {
      await webAuth.completeDiscordLogin(req, res);
    } catch (error) {
      console.error("Discord website login failed:", error);
      res.status(500).send("Discord login could not be completed. Please try again.");
    }
  });
  app.get("/auth/logout", webAuth.logout);

  app.get("/api/auth/me", async (req, res) => {
    const session = webAuth.getSession(req);

    if (!session) {
      return res.json({
        authenticated: false,
        configured: Boolean(process.env.CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.SESSION_SECRET),
      });
    }

    try {
      const [registration, clubs] = await Promise.all([
        playerRegistrationStore.getRegisteredPlayer(session.user.id),
        clubStore.getClubs(),
      ]);

      return res.json({
        authenticated: true,
        user: session.user,
        registration,
        clubs: clubs
          .filter(club => (club.registeredUserIds ?? []).includes(session.user.id))
          .map(club => ({
            clubId: club.clubId,
            name: club.name,
            aliases: club.aliases ?? [],
          })),
        profileUrl: `/players/${session.user.id}`,
      });
    } catch (error) {
      console.error("Failed to load website registration status:", error);
      return res.status(500).json({ error: "Failed to load registration status." });
    }
  });

  app.post("/api/register/player", express.json(), webAuth.requireSession, async (req, res) => {
    try {
      const result = await registerCorePlayer({
        userId: req.rankdUser.id,
        username: req.rankdUser.username,
      });

      return res.json({
        ok: true,
        message: result.alreadyRegistered
          ? "Your RANKD player registration has been updated."
          : "You are registered for RANKD Core ELO.",
        profileUrl: `/players/${req.rankdUser.id}`,
        roles: result.roles,
      });
    } catch (error) {
      console.error("Website player registration failed:", error);
      return res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/register/club", express.json(), webAuth.requireSession, async (req, res) => {
    try {
      const result = await registerCoreClub({
        userId: req.rankdUser.id,
        username: req.rankdUser.username,
        clubId: req.body.clubId,
        clubName: req.body.clubName,
        alias: req.body.alias,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      return res.json({
        ok: true,
        message: result.attachedToExisting
          ? `You are now attached to ${result.club.name}.`
          : `${result.club.name} has been registered.`,
        club: result.club,
        profileUrl: `/players/${req.rankdUser.id}`,
        roles: result.roles,
      });
    } catch (error) {
      console.error("Website club registration failed:", error);
      return res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/overview", async (_req, res) => {
    try {
      res.json(await statsService.getOverview());
    } catch (error) {
      console.error("Failed to load stats overview:", error);
      res.status(500).json({ error: "Failed to load stats overview" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      res.json(await statsService.getLeaderboard({
        limit: req.query.limit,
        position: req.query.position,
        search: req.query.search,
        sort: req.query.sort,
      }));
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      res.status(500).json({ error: "Failed to load leaderboard" });
    }
  });

  app.get("/api/players", async (req, res) => {
    try {
      res.json(await statsService.searchPlayers(req.query.search ?? "", req.query.limit));
    } catch (error) {
      console.error("Failed to search players:", error);
      res.status(500).json({ error: "Failed to search players" });
    }
  });

  app.get("/api/players/:userId", async (req, res) => {
    try {
      const player = await statsService.getPlayerProfile(req.params.userId);

      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      return res.json(player);
    } catch (error) {
      console.error("Failed to load player profile:", error);
      return res.status(500).json({ error: "Failed to load player profile" });
    }
  });

  app.get("/api/clubs", async (_req, res) => {
    try {
      res.json(await statsService.getRegisteredClubs());
    } catch (error) {
      console.error("Failed to load clubs:", error);
      res.status(500).json({ error: "Failed to load clubs" });
    }
  });

  app.get("/api/matches/recent", async (req, res) => {
    try {
      res.json(await statsService.getRecentMatches(req.query.limit));
    } catch (error) {
      console.error("Failed to load recent matches:", error);
      res.status(500).json({ error: "Failed to load recent matches" });
    }
  });

  app.post("/webhooks/chelhead", express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = req.body?.toString("utf8") ?? "";
    const signature = req.headers["x-chelhead-signature"];
    const timestamp = req.headers["x-chelhead-timestamp"];
    const signatureResult = verifyChelheadSignature(
      rawBody,
      signature,
      timestamp,
      process.env.CHELHEAD_WEBHOOK_SECRET
    );

    if (!signatureResult.skipped && !signatureResult.verified) {
      return res.status(401).send("Invalid signature");
    }

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return res.status(400).send("Invalid JSON payload");
    }

    try {
      const result = await chelheadWebhookStore.recordWebhookEvent({
        payload,
        headers: req.headers,
        signatureVerified: signatureResult.verified,
      });

      if (result.duplicate) {
        console.log(`Duplicate CHELHead webhook ignored for match ${result.matchId ?? "unknown"}`);
      } else {
        console.log(`CHELHead webhook stored for match ${result.matchId ?? "unknown"}`);
      }

      return res.status(200).json({
        ok: true,
        duplicate: result.duplicate,
      });
    } catch (error) {
      console.error("Failed to process CHELHead webhook:", error);
      return res.status(500).send("Webhook processing failed");
    }
  });

  app.get(["/", "/leaderboard", "/clubs", "/matches", "/register", "/players/:userId"], (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  return app;
}

function startWebServer() {
  const app = createWebServer();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  return app.listen(port, "0.0.0.0", () => {
    console.log(`RANKD web server listening on port ${port}`);
  });
}

module.exports = {
  createWebServer,
  startWebServer,
  verifyChelheadSignature,
};
