const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

const teamEloStore = require("../services/teamEloStore");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("teampending")
    .setDescription("Staff: list pending Team RANKD applications")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const applications = await teamEloStore.getPendingApplications();

    if (applications.length === 0) {
      await interaction.reply({ content: "There are no pending Team RANKD applications.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle("Pending Team RANKD Applications")
      .setDescription(applications.slice(0, 25).map(application => [
        `**#${application.id} - ${application.clubName}**`,
        `Club ID: \`${application.clubId}\` | Owner: <@${application.ownerUserId}>`,
        application.notes ? `Notes: ${application.notes}` : null,
      ].filter(Boolean).join("\n")).join("\n\n"))
      .setFooter({
        text: applications.length > 25
          ? `Showing 25 of ${applications.length} pending applications.`
          : `${applications.length} pending application(s).`,
      });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
