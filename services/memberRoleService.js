const ROLE_NAMES = {
  player: "RANKD Player",
  captain: "Captain",
  team: "RANKD Teams",
  verified: "RANKD Verified",
  unverified: "UNVERIFIED",
};

const DISCORD_READY_TIMEOUT_MS = 20_000;

async function waitForDiscordClient() {
  const client = global.client;

  if (!client) return null;

  const deadline = Date.now() + DISCORD_READY_TIMEOUT_MS;

  while (!client.isReady() && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  return client.isReady() ? client : null;
}

async function getGuild() {
  const guildId = process.env.GUILD_ID ?? process.env.GUID_ID;
  const client = await waitForDiscordClient();

  if (!client) {
    throw new Error("The Discord bot is not ready to assign server roles.");
  }

  if (!guildId) {
    throw new Error("The RANKD Discord server ID is not configured.");
  }

  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);

  if (!guild) {
    throw new Error("The configured Discord server could not be found.");
  }

  return guild;
}

async function assignRegistrationRole(userId, roleName) {
  const guild = await getGuild();
  const role = guild.roles.cache.find(candidate => candidate.name === roleName)
    ?? (await guild.roles.fetch()).find(candidate => candidate.name === roleName);

  if (!role) {
    throw new Error(`The ${roleName} role could not be found.`);
  }

  const member = await guild.members.fetch(userId).catch(() => null);

  if (!member) {
    throw new Error("Join the RANKD Discord server before registering.");
  }

  const assigned = !member.roles.cache.has(role.id);

  if (assigned) {
    await member.roles.add(role);
  }

  const unverifiedRole = guild.roles.cache.find(candidate => candidate.name === ROLE_NAMES.unverified)
    ?? (await guild.roles.fetch()).find(candidate => candidate.name === ROLE_NAMES.unverified);
  const removedUnverified = Boolean(unverifiedRole && member.roles.cache.has(unverifiedRole.id));

  if (removedUnverified) {
    await member.roles.remove(unverifiedRole);
  }

  return {
    assigned,
    removedUnverified,
    roleName,
  };
}

async function assignRoles(userId, roleNames) {
  const results = [];

  for (const roleName of roleNames) {
    results.push(await assignRegistrationRole(userId, roleName));
  }

  return results;
}

module.exports = {
  ROLE_NAMES,
  assignRegistrationRole,
  assignRoles,
};
