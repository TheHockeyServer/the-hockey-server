const { SlashCommandBuilder } = require("discord.js");

const { registerCoreClub } = require("../services/registrationService");

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

    let result;

    try {
      result = await registerCoreClub({
        clubName: interaction.options.getString("club_name", true),
        clubId: interaction.options.getString("club_id", true),
        alias: interaction.options.getString("alias", false),
        userId: interaction.user.id,
        username: interaction.member?.displayName ?? interaction.user.username,
      });
    } catch (error) {
      await interaction.editReply(`Registration could not be completed: ${error.message}`);
      return;
    }

    if (!result.success) {
      await interaction.editReply(result.message);
      return;
    }

    await interaction.editReply([
      result.attachedToExisting
        ? `Attached you to existing club: **${result.club.name}**`
        : `Registered club: **${result.club.name}**`,
      `Club ID: **${result.club.clubId}**`,
      result.club.aliases.length > 0 ? `Alias: **${result.club.aliases.join(", ")}**` : null,
      "",
      result.roles.assigned
        ? `You have been given the ${result.roles.roleName} role.`
        : `You already have the ${result.roles.roleName} role.`,
      result.roles.removedUnverified ? "Your UNVERIFIED role has been removed." : null,
      "",
      "Core ELO club registration helps RANKD identify completed games. It does not reserve ownership for future Team ELO. Team ELO club ownership will be handled separately.",
    ].filter(Boolean).join("\n"));
  },
};
