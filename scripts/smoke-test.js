const fs = require("fs");
const assert = require("assert");

const { createWebServer } = require("../services/webServer");
const {
  findMatchingRankdMatches,
  parseCompletedResult,
} = require("../services/chelheadResultProcessor");
const { normalizeClubSearchPayload } = require("../services/chelheadApi");
const matchService = require("../services/matchService");

async function checkModules() {
  for (const dir of ["commands", "services"]) {
    const files = fs.readdirSync(dir).filter(file => file.endsWith(".js"));

    for (const file of files) {
      require(`../${dir}/${file}`);
    }
  }
}

async function checkEndpoint(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

async function checkWebServer() {
  const app = createWebServer();
  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });

  try {
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const paths = [
      "/health",
      "/api/auth/me",
      "/api/chelhead/status",
      "/api/overview",
      "/api/leaderboard?limit=5&position=all&sort=elo",
      "/api/clubs",
      "/api/matches/recent?limit=5",
      "/leaderboard",
      "/clubs",
      "/matches",
      "/register",
      "/team-rankd",
    ];

    for (const path of paths) {
      await checkEndpoint(baseUrl, path);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function buildTestPlayers() {
  const positions = ["c", "lw", "rw", "ld", "rd", "g"];

  return Object.fromEntries(positions.map(position => [
    position,
    [1, 2].map(number => ({
      elo: 2500,
      userId: `smoke-${position}-${number}`,
      username: `Smoke ${position.toUpperCase()} ${number}`,
    })),
  ]));
}

function buildChelheadPayload(overrides = {}) {
  return {
    event: "match.completed",
    timestamp: new Date().toISOString(),
    webhook: {
      id: "wh_smoke",
      name: "RANKD smoke test",
    },
    match: {
      matchId: "chelhead-smoke-match",
      matchType: "reg",
      timestamp: Math.floor(Date.now() / 1000) + 1,
      clubs: {
        "12345": { name: "Team A Club", gfraw: "5", garaw: "3" },
        "67890": { name: "Team B Club", gfraw: "3", garaw: "5" },
      },
      _enhanced: {
        result: {
          "12345": { score: 5, result: "W", name: "Team A Club" },
          "67890": { score: 3, result: "L", name: "Team B Club" },
        },
      },
      ...overrides,
    },
  };
}

function checkChelheadResultMatching() {
  const match = matchService.createMatch(buildTestPlayers());

  matchService.setMatchClubSetup(match.id, {
    finalized: true,
    teamAClubId: "12345",
    teamAClubName: "Team A Club",
    teamBClubId: "67890",
    teamBClubName: "Team B Club",
  });

  const validPayload = buildChelheadPayload();
  const parsed = parseCompletedResult(validPayload);

  assert.equal(parsed.valid, true);
  assert.equal(parsed.matchType, "reg");
  assert.deepEqual(findMatchingRankdMatches(validPayload).map(candidate => candidate.id), [match.id]);

  const wrongClubPayload = buildChelheadPayload({
    clubs: {
      "12345": { name: "Team A Club", gfraw: "5" },
      "99999": { name: "Wrong Club", gfraw: "3" },
    },
  });
  assert.equal(findMatchingRankdMatches(wrongClubPayload).length, 0);

  const nonRegulationPayload = buildChelheadPayload({ matchType: "club_private" });
  assert.deepEqual(parseCompletedResult(nonRegulationPayload), {
    valid: false,
    reason: "not_regulation_match",
  });

  matchService.closeMatch(match.id);
}

function checkChelheadClubSearchNormalization() {
  assert.deepEqual(normalizeClubSearchPayload({
    clubs: [
      { clubId: "5760", name: "FlyGuyz HC", platform: "common-gen5" },
    ],
  }), [
    { clubId: "5760", name: "FlyGuyz HC", platform: "common-gen5" },
  ]);

  assert.deepEqual(normalizeClubSearchPayload({
    clubs: {
      "5760": { name: "FlyGuyz HC" },
    },
  }), [
    { clubId: "5760", name: "FlyGuyz HC", platform: null },
  ]);
}

async function main() {
  await checkModules();
  checkChelheadClubSearchNormalization();
  checkChelheadResultMatching();
  await checkWebServer();
  console.log("Smoke tests passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
