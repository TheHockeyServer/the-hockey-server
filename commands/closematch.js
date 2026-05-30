const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const { closeMatchRoom } = require("../services/matchLobby");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("closematch")
    .setDescription("Admin: close a RANKD match and free its room")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option
        .setName("match_id")
        .setDescription("The match ID to close")
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction) {
    const matchId = interaction.options.getInteger("match_id");
    const closedMatch = await closeMatchRoom(matchId, "Room closed by admin.");

    if (!closedMatch) {
      return interaction.reply({
        content: `No active room found for Match ${matchId}.`,
        ephemeral: true,
      });
    }

    const roomLabel = closedMatch.isOverflowChannel
      ? "Temporary overflow channel"
      : `Room ${closedMatch.roomNumber}`;

    await interaction.reply({
      content: `Match ${matchId} closed. ${roomLabel} is now closed.`,
      ephemeral: true,
    });
  },
};
