const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const { assignRoles, ROLE_NAMES } = require("../services/memberRoleService");
const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teamapprove")
    .setDescription("Staff: approve a pending Team RANKD application")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName("application_id").setDescription("The Team RANKD application number").setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const result = await teamEloStore.approveApplication(
      interaction.options.getInteger("application_id", true),
      interaction.user.id
    );

    if (!result.success) {
      await interaction.editReply(result.message);
      return;
    }

    let roleMessage = "Captain roles could not be assigned automatically.";

    try {
      await assignRoles(result.team.ownerUserId, [ROLE_NAMES.captain, ROLE_NAMES.team]);
      roleMessage = "The owner received the Captain and RANKD Teams roles.";
    } catch (error) {
      roleMessage = `The team was approved, but role assignment needs attention: ${error.message}`;
    }

    await interaction.editReply([
      `Approved Team RANKD Application #${result.application.id}.`,
      `**${result.team.clubName}** (\`${result.team.clubId}\`) is now protected for <@${result.team.ownerUserId}>.`,
      `Starting Team ELO: **${result.team.rating}**`,
      roleMessage,
    ].join("\n"));
  },
};
