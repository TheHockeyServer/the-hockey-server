const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const roomManager = require("../services/roomManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setuprooms")
    .setDescription("Admin setup: create or reset the 5 reusable RANKD match rooms")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const result = await roomManager.setupRooms(interaction.guild);
    const roomList = result.createdRooms
      .map(room => `Room ${room.roomNumber}: ${room.channel}`)
      .join("\n");
    const failedList = result.failedRooms
      .map(room => `Room ${room.roomNumber}: ${room.error.message}`)
      .join("\n");

    if (result.failedRooms.length > 0) {
      await interaction.editReply(
`RANKD match room setup partially completed.

Ready:
${roomList || "None"}

Needs attention:
${failedList}`
      );
      return;
    }

    await interaction.editReply(`RANKD match rooms are ready.\n\n${roomList}`);
  },
};
