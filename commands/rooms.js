const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const roomManager = require("../services/roomManager");

function formatRoomStatus(room) {
  const channel = room.channelId ? `<#${room.channelId}>` : "Not set up";

  if (room.occupied) {
    return `🔒 **Room ${room.roomNumber}:** ${channel} - Match ${room.matchId}`;
  }

  return `✅ **Room ${room.roomNumber}:** ${channel} - Available`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rooms")
    .setDescription("Show reusable RANKD match room status"),

  async execute(interaction) {
    await roomManager.discoverRooms(interaction.guild);

    const rooms = roomManager.getRoomList();
    const openRooms = rooms.filter(room => !room.occupied).length;
    const occupiedRooms = rooms.length - openRooms;
    const roomList = rooms.map(formatRoomStatus).join("\n");
    const embed = new EmbedBuilder()
      .setTitle("RANKD Match Rooms")
      .setDescription(`✅ ${openRooms} Available | 🔒 ${occupiedRooms} Occupied`)
      .setColor(0x7c3aed)
      .addFields({
        name: "Room Status",
        value: roomList,
        inline: false,
      });

    await interaction.reply({ embeds: [embed] });
  },
};
