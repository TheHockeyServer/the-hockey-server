const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const clubStore = require("../services/clubStore");
const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teamapply")
    .setDescription("Apply to reserve a club for Team RANKD")
    .addStringOption(option =>
      option.setName("club_id").setDescription("The registered CHELHead/EA club ID").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("notes").setDescription("Optional information for RANKD staff").setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const clubId = interaction.options.getString("club_id", true);
    const club = await clubStore.findClubById(clubId);

    if (!club) {
      await interaction.editReply("Register this club for Core ELO first with `/registerclub`, then submit the Team RANKD application.");
      return;
    }

    if (!(club.registeredUserIds ?? []).includes(interaction.user.id)) {
      await interaction.editReply("You must first attach your Discord account to this club through Core ELO registration.");
      return;
    }

    const result = await teamEloStore.createApplication({
      clubId: club.clubId,
      clubName: club.name,
      ownerUserId: interaction.user.id,
      ownerUsername: interaction.member?.displayName ?? interaction.user.username,
      notes: interaction.options.getString("notes", false),
    });

    if (!result.success) {
      await interaction.editReply(result.message);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`Team RANKD Application #${result.application.id}`)
      .setDescription("Your ownership request is now awaiting staff approval.")
      .addFields(
        { name: "Club", value: `${club.name} (\`${club.clubId}\`)`, inline: true },
        { name: "Requested Owner", value: `<@${interaction.user.id}>`, inline: true },
        { name: "Status", value: "Pending", inline: true }
      )
      .setFooter({ text: "Approval reserves this club ID for Team RANKD. Core ELO registration remains shareable." });

    await interaction.editReply({ embeds: [embed] });
  },
};
