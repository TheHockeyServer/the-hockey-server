const ROLE_NAMES = {
  player: "RANKD Player",
  verified: "RANKD Verified",
  unverified: "UNVERIFIED",
};

async function getGuild() {
  const client = global.client;
  const guildId = process.env.GUILD_ID;

  if (!client?.isReady() || !guildId) {
    throw new Error("The Discord bot is not ready to assign server roles.");
  }

  return client.guilds.cache.get(guildId) ?? client.guilds.fetch(guildId);
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

module.exports = {
  ROLE_NAMES,
  assignRegistrationRole,
};
