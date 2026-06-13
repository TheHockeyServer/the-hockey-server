const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teaminfo")
    .setDescription("Show an approved Team RANKD team")
    .addStringOption(option =>
      option.setName("team").setDescription("Team name or club ID").setRequired(true)
    ),

  async execute(interaction) {
    const matches = await teamEloStore.findTeams(interaction.options.getString("team", true));

    if (matches.length !== 1) {
      await interaction.reply({
        content: matches.length === 0
          ? "I could not find an approved Team RANKD team matching that name or club ID."
          : `Multiple teams matched: ${matches.slice(0, 10).map(team => `${team.clubName} (${team.clubId})`).join(", ")}`,
        ephemeral: true,
      });
      return;
    }

    const team = matches[0];
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(team.clubName)
      .setDescription("Approved and protected Team RANKD club")
      .addFields(
        { name: "Team ELO", value: String(team.rating), inline: true },
        { name: "Record", value: `${team.wins}-${team.losses}`, inline: true },
        { name: "Club ID", value: `\`${team.clubId}\``, inline: true },
        { name: "Owner", value: `<@${team.ownerUserId}>`, inline: true },
        {
          name: "Captains",
          value: team.captainUserIds.length > 0
            ? team.captainUserIds.map(userId => `<@${userId}>`).join(", ")
            : "None",
          inline: true,
        },
        { name: "Roster Size", value: String(team.rosterUserIds.length), inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};
