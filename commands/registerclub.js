const { SlashCommandBuilder } = require("discord.js");

const clubStore = require("../services/clubStore");
const ratingStore = require("../services/ratingStore");

const VERIFIED_ROLE_NAME = "RANKD Verified";
const UNVERIFIED_ROLE_NAME = "UNVERIFIED";

async function removeUnverifiedRole(interaction, member) {
  const role = interaction.guild.roles.cache.find(candidate => candidate.name === UNVERIFIED_ROLE_NAME);

  if (!role || !member.roles.cache.has(role.id)) {
    return null;
  }

  await member.roles.remove(role).catch(error => {
    throw new Error(`I assigned ${VERIFIED_ROLE_NAME}, but could not remove ${UNVERIFIED_ROLE_NAME}. (${error.message})`);
  });

  return `Removed the ${UNVERIFIED_ROLE_NAME} role.`;
}

async function assignVerifiedRole(interaction) {
  const role = interaction.guild.roles.cache.find(candidate => candidate.name === VERIFIED_ROLE_NAME);

  if (!role) {
    return `I registered the club, but I could not find the ${VERIFIED_ROLE_NAME} role.`;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return `I registered the club, but I could not load your server member profile to assign ${VERIFIED_ROLE_NAME}.`;
  }

  const messages = [];

  if (member.roles.cache.has(role.id)) {
    messages.push(`You already have the ${VERIFIED_ROLE_NAME} role.`);
  } else {
    await member.roles.add(role).catch(error => {
      throw new Error(`Club registered, but I could not assign ${VERIFIED_ROLE_NAME}. Make sure my bot role is above that role and I have Manage Roles permission. (${error.message})`);
    });

    messages.push(`You have been given the ${VERIFIED_ROLE_NAME} role.`);
  }

  const unverifiedMessage = await removeUnverifiedRole(interaction, member);

  if (unverifiedMessage) {
    messages.push(unverifiedMessage);
  }

  return messages.join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registerclub")
    .setDescription("Register an EASHL club for RANKD Core ELO lookup")
    .addStringOption(option =>
      option
        .setName("club_name")
        .setDescription("The EASHL club name")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("club_id")
        .setDescription("The CHELHEAD/EA club ID")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("alias")
        .setDescription("Optional short name players may type later")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const clubName = interaction.options.getString("club_name", true);
    const clubId = interaction.options.getString("club_id", true);
    const alias = interaction.options.getString("alias", false);
    const username = interaction.member?.displayName ?? interaction.user.username;
    const result = clubStore.registerClub({
      clubId,
      name: clubName,
      alias,
      registeredBy: interaction.user.id,
    });

    if (!result.success) {
      await interaction.editReply(result.message);
      return;
    }

    ratingStore.getOrCreatePlayer(interaction.user.id, username);

    let roleMessage;

    try {
      roleMessage = await assignVerifiedRole(interaction);
    } catch (error) {
      roleMessage = error.message;
    }

    await interaction.editReply([
      result.attachedToExisting
        ? `Attached you to existing club: **${result.club.name}**`
        : `Registered club: **${result.club.name}**`,
      `Club ID: **${result.club.clubId}**`,
      result.club.aliases.length > 0 ? `Alias: **${result.club.aliases.join(", ")}**` : null,
      "",
      roleMessage,
      "",
      "Core ELO club registration helps RANKD identify completed games. It does not reserve ownership for future Team ELO. Team ELO club ownership will be handled separately.",
    ].filter(Boolean).join("\n"));
  },
};
