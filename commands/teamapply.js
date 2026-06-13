const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const clubStore = require("../services/clubStore");
const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teamapply")
    .setDescription("Apply to reserve a club for Team RANKD")
    .addStringOption(option =>
      option.setName("club").setDescription("Registered club name, alias, or CHELHead/EA club ID").setRequired(true)
    )
    .addStringOption(option =>
      option.setName("notes").setDescription("Optional information for RANKD staff").setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const clubQuery = interaction.options.getString("club", true);
    const matches = await clubStore.findClubByNameOrAlias(clubQuery);

    if (matches.length === 0) {
      await interaction.editReply([
        `I could not find a Core ELO club matching **${clubQuery}**.`,
        "Use its exact registered club name or numeric club ID, or register it first with `/registerclub`.",
      ].join("\n"));
      return;
    }

    if (matches.length > 1) {
      await interaction.editReply([
        "I found multiple registered clubs. Run `/teamapply` again using the exact numeric club ID:",
        "",
        ...matches.slice(0, 10).map(club => `- ${club.name} (\`${club.clubId}\`)`),
      ].join("\n"));
      return;
    }

    const club = matches[0];

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
