const { SlashCommandBuilder } = require("discord.js");

const ratingStore = require("../services/ratingStore");

function formatRecord(player) {
  return `${player.wins}-${player.losses} (${player.gamesPlayed} GP)`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rating")
    .setDescription("Show an ELO rating")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Player to look up")
        .setRequired(false)
    ),

  async execute(interaction) {
    const user = interaction.options.getUser("player") ?? interaction.user;
    const player = await ratingStore.getOrCreatePlayer(user.id, user.username);

    await interaction.reply([
      `**${user.username}**`,
      `ELO: **${player.rating}**`,
      `Record: **${formatRecord(player)}**`,
      `Goals: **${player.goalsFor} For / ${player.goalsAgainst} Against**`,
    ].join("\n"));
  },
};
