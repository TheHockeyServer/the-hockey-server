const clubStore = require("./clubStore");
const { assignRegistrationRole, ROLE_NAMES } = require("./memberRoleService");
const playerRegistrationStore = require("./playerRegistrationStore");
const ratingStore = require("./ratingStore");

async function registerCorePlayer({ userId, username }) {
  const registration = await playerRegistrationStore.registerPlayer({
    userId,
    username,
  });
  const player = await ratingStore.getOrCreatePlayer(userId, username);
  const roles = await assignRegistrationRole(userId, ROLE_NAMES.player);

  return {
    alreadyRegistered: registration.alreadyRegistered,
    player,
    registration: registration.player,
    roles,
  };
}

async function registerCoreClub({ userId, username, clubId, clubName, alias }) {
  const result = await clubStore.registerClub({
    clubId,
    name: clubName,
    alias,
    registeredBy: userId,
  });

  if (!result.success) {
    return result;
  }

  const player = await ratingStore.getOrCreatePlayer(userId, username);
  const roles = await assignRegistrationRole(userId, ROLE_NAMES.verified);

  return {
    ...result,
    player,
    roles,
  };
}

module.exports = {
  registerCoreClub,
  registerCorePlayer,
};
