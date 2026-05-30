const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const clubStore = require("../services/clubStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clubinfo")
    .setDescription("Show details for a registered RANKD club")
    .addStringOption(option =>
      option
        .setName("club")
        .setDescription("Club name, alias, or club ID")
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString("club", true);
    const matches = await clubStore.findClubByNameOrAlias(query);

    if (matches.length === 0) {
      await interaction.reply({
        content: "I could not find a registered club matching that name, alias, or ID.",
        ephemeral: true,
      });
      return;
    }

    if (matches.length > 1) {
      await interaction.reply({
        content: [
          "I found multiple clubs. Try a more exact name or use the club ID.",
          "",
          ...matches.slice(0, 10).map(club => `- ${club.name} (${club.clubId})`),
        ].join("\n"),
        ephemeral: true,
      });
      return;
    }

    const club = matches[0];
    const registeredUserIds = club.registeredUserIds ?? [club.registeredBy].filter(Boolean);
    const embed = new EmbedBuilder()
      .setTitle(club.name)
      .setColor(0x7c3aed)
      .addFields(
        { name: "Club ID", value: `\`${club.clubId}\``, inline: true },
        { name: "First Registered By", value: `<@${club.registeredBy}>`, inline: true },
        {
          name: "Core ELO Registrants",
          value: registeredUserIds.length > 0
            ? registeredUserIds.map(userId => `<@${userId}>`).join(", ")
            : "None",
          inline: false,
        },
        { name: "Aliases", value: club.aliases.length > 0 ? club.aliases.join(", ") : "None", inline: false },
        { name: "Core ELO Use", value: "Available for match result lookup.", inline: true },
        { name: "Team ELO Protected", value: club.isProtected ? "Yes" : "No", inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
