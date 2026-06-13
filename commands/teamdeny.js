const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const { notifyReview } = require("../services/teamApprovalNotifier");
const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teamdeny")
    .setDescription("Staff: deny a pending Team RANKD application")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName("application_id").setDescription("The Team RANKD application number").setRequired(true).setMinValue(1)
    )
    .addStringOption(option =>
      option.setName("reason").setDescription("Reason for denial").setRequired(true)
    ),

  async execute(interaction) {
    const result = await teamEloStore.denyApplication(
      interaction.options.getInteger("application_id", true),
      interaction.user.id,
      interaction.options.getString("reason", true)
    );

    if (result.success) {
      await notifyReview(result.application).catch(error => {
        console.error("Failed to post Team RANKD denial notification:", error);
      });
    }

    await interaction.reply({
      content: result.success
        ? `Denied Team RANKD Application #${result.application.id}: ${result.application.notes}`
        : result.message,
      ephemeral: true,
    });
  },
};
