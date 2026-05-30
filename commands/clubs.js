const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const clubStore = require("../services/clubStore");

function formatClub(club, index) {
  const aliasText = club.aliases.length > 0 ? ` | Alias: ${club.aliases.join(", ")}` : "";
  return `**${index + 1}. ${club.name}** | ID: \`${club.clubId}\`${aliasText}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clubs")
    .setDescription("Show registered RANKD clubs"),

  async execute(interaction) {
    const clubs = clubStore.getClubs()
      .sort((a, b) => a.name.localeCompare(b.name));

    if (clubs.length === 0) {
      await interaction.reply({
        content: "No clubs are registered yet. Use /registerclub in the club registration channel.",
        ephemeral: true,
      });
      return;
    }

    const visibleClubs = clubs.slice(0, 25);
    const embed = new EmbedBuilder()
      .setTitle("Registered RANKD Clubs")
      .setColor(0x7c3aed)
      .setDescription(visibleClubs.map(formatClub).join("\n"))
      .setFooter({
        text: clubs.length > visibleClubs.length
          ? `Showing ${visibleClubs.length} of ${clubs.length} clubs.`
          : `${clubs.length} club(s) registered.`,
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
