const { SlashCommandBuilder } = require("discord.js");

const { registerCorePlayer } = require("../services/registrationService");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("registerplayer")
    .setDescription("Register for RANKD Core ELO without registering a personal club"),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.member?.displayName ?? interaction.user.username;
    let result;

    try {
      result = await registerCorePlayer({
        userId: interaction.user.id,
        username,
      });
    } catch (error) {
      await interaction.editReply(`Registration could not be completed: ${error.message}`);
      return;
    }

    await interaction.editReply([
      result.alreadyRegistered
        ? "Your RANKD player registration has been updated."
        : "You are registered for RANKD Core ELO.",
      "",
      result.roles.assigned
        ? `You have been given the ${result.roles.roleName} role.`
        : `You already have the ${result.roles.roleName} role.`,
      result.roles.removedUnverified ? "Your UNVERIFIED role has been removed." : null,
      "",
      "Use this registration if you do not plan to provide a personal club for Core ELO lookup. You will still be able to queue and play in RANKD matches once your server access is set up.",
    ].filter(Boolean).join("\n"));
  },
};
