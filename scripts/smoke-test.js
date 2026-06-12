const fs = require("fs");

const { createWebServer } = require("../services/webServer");

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
      "/api/overview",
      "/api/leaderboard?limit=5&position=all&sort=elo",
      "/api/clubs",
      "/api/matches/recent?limit=5",
      "/leaderboard",
      "/clubs",
      "/matches",
      "/register",
    ];

    for (const path of paths) {
      await checkEndpoint(baseUrl, path);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function main() {
  await checkModules();
  await checkWebServer();
  console.log("Smoke tests passed");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
