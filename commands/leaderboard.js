const { SlashCommandBuilder } = require("discord.js");

const ratingStore = require("../services/ratingStore");

function formatLeaderboardLine(player, index) {
  return [
    `**${index + 1}.** <@${player.userId}>`,
    `ELO: **${player.rating}**`,
    `Record: ${player.wins}-${player.losses}`,
  ].join(" - ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the RANKD ELO leaderboard"),

  async execute(interaction) {
    const leaderboard = ratingStore.getLeaderboard(10);

    if (leaderboard.length === 0) {
      return interaction.reply("No completed RANKD matches yet.");
    }

    await interaction.reply([
      "**RANKD ELO Leaderboard**",
      "",
      ...leaderboard.map(formatLeaderboardLine),
    ].join("\n"));
  },
};
