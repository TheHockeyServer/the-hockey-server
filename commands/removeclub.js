const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const clubStore = require("../services/clubStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removeclub")
    .setDescription("Staff only: remove a registered RANKD club")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option
        .setName("club_id")
        .setDescription("The club ID to remove")
        .setRequired(true)
    ),

  async execute(interaction) {
    const clubId = interaction.options.getString("club_id", true);
    const club = clubStore.findClubById(clubId);

    if (!club) {
      await interaction.reply({
        content: "I could not find a registered club with that ID.",
        ephemeral: true,
      });
      return;
    }

    clubStore.removeClub(clubId);

    await interaction.reply({
      content: `Removed registered club **${club.name}** (${club.clubId}).`,
      ephemeral: true,
    });
  },
};
