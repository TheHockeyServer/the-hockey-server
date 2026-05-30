const { SlashCommandBuilder } = require("discord.js");

const playerRegistrationStore = require("../services/playerRegistrationStore");
const ratingStore = require("../services/ratingStore");

const PLAYER_ROLE_NAME = "RANKD Player";
const UNVERIFIED_ROLE_NAME = "UNVERIFIED";

async function removeUnverifiedRole(interaction, member) {
  const role = interaction.guild.roles.cache.find(candidate => candidate.name === UNVERIFIED_ROLE_NAME);

  if (!role || !member.roles.cache.has(role.id)) {
    return null;
  }

  await member.roles.remove(role).catch(error => {
    throw new Error(`I assigned ${PLAYER_ROLE_NAME}, but could not remove ${UNVERIFIED_ROLE_NAME}. (${error.message})`);
  });

  return `Removed the ${UNVERIFIED_ROLE_NAME} role.`;
}

async function assignPlayerRole(interaction) {
  const role = interaction.guild.roles.cache.find(candidate => candidate.name === PLAYER_ROLE_NAME);

  if (!role) {
    return `I registered you, but I could not find the ${PLAYER_ROLE_NAME} role.`;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return `I registered you, but I could not load your server member profile to assign ${PLAYER_ROLE_NAME}.`;
  }

  const messages = [];

  if (member.roles.cache.has(role.id)) {
    messages.push(`You already have the ${PLAYER_ROLE_NAME} role.`);
  } else {
    await member.roles.add(role).catch(error => {
      throw new Error(`You were registered, but I could not assign ${PLAYER_ROLE_NAME}. Make sure my bot role is above that role and I have Manage Roles permission. (${error.message})`);
    });

    messages.push(`You have been given the ${PLAYER_ROLE_NAME} role.`);
  }

  const unverifiedMessage = await removeUnverifiedRole(interaction, member);

  if (unverifiedMessage) {
    messages.push(unverifiedMessage);
  }

  return messages.join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registerplayer")
    .setDescription("Register for RANKD Core ELO without registering a personal club"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.member?.displayName ?? interaction.user.username;
    const result = playerRegistrationStore.registerPlayer({
      userId: interaction.user.id,
      username,
    });

    ratingStore.getOrCreatePlayer(interaction.user.id, username);

    let roleMessage;

    try {
      roleMessage = await assignPlayerRole(interaction);
    } catch (error) {
      roleMessage = error.message;
    }

    await interaction.editReply([
      result.alreadyRegistered
        ? "Your RANKD player registration has been updated."
        : "You are registered for RANKD Core ELO.",
      "",
      roleMessage,
      "",
      "Use this registration if you do not plan to provide a personal club for Core ELO lookup. You will still be able to queue and play in RANKD matches once your server access is set up.",
    ].join("\n"));
  },
};
