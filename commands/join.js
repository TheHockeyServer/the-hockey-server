const {
  SlashCommandBuilder,
} = require("discord.js");

const queueManager = require("../services/queueManager");
const matchService = require("../services/matchService");
const { assignMatchRoom } = require("../services/matchLobby");
const { createQueueLogoAttachment } = require("../services/queueBranding");
const { buildQueueEmbed, getTotalQueued } = require("../services/queueEmbed");
const { getPositionEmojiMap } = require("../services/positionEmojis");
const { formatPlayerStats, getPlayerStats } = require("../services/playerStats");

const POSITION_LABELS = {
  c: "Center",
  lw: "Left Wing",
  rw: "Right Wing",
  ld: "Left Defense",
  rd: "Right Defense",
  g: "Goalie",
};
const QUEUE_ACCESS_ROLES = ["RANKD Verified", "RANKD Player"];

function hasQueueAccess(interaction) {
  return QUEUE_ACCESS_ROLES.some(roleName =>
    interaction.member?.roles?.cache?.some(role => role.name === roleName)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("Join the ELO queue")
    .addStringOption(option =>
      option
        .setName("position")
        .setDescription("Choose your position")
        .setRequired(true)
        .addChoices(
          { name: "Center", value: "c" },
          { name: "Left Wing", value: "lw" },
          { name: "Right Wing", value: "rw" },
          { name: "Left Defense", value: "ld" },
          { name: "Right Defense", value: "rd" },
          { name: "Goalie", value: "g" }
        )
    ),

  async execute(interaction) {
    const position = interaction.options.getString("position");
    const userId = interaction.user.id;
    const username = interaction.user.username;

    if (!hasQueueAccess(interaction)) {
      return interaction.reply({
        content: [
          "You must register before joining the RANKD queue.",
          "",
          "Use `/registerclub` if you are registering a club for Core ELO lookup.",
          "Use `/registerplayer` if you are not using a personal club.",
        ].join("\n"),
        ephemeral: true,
      });
    }

    const activeMatch = matchService.getActiveMatchForPlayer(userId);

    if (activeMatch) {
      return interaction.reply({
        content: `You are already in RANKD Match ${activeMatch.id}. Finish or close that match before joining the queue again.`,
        ephemeral: true,
      });
    }

    const result = queueManager.addPlayer(userId, username, position);

    if (!result.success) {
      return interaction.reply({
        content: result.message,
        ephemeral: true,
      });
    }

    const queueSnapshot = queueManager.getQueueSnapshot();
    const matchReady = queueManager.isMatchReady();
    const positionEmojis = await getPositionEmojiMap(interaction.guild);
    const playerStats = getPlayerStats(userId, username);

    if (matchReady) {
      const players = queueManager.getMatchPlayers();
      const match = matchService.createMatch(players);
      const roomAssignment = await assignMatchRoom(interaction, match);

      if (!roomAssignment.success) {
        matchService.closeMatch(match.id);

        return interaction.reply({
          content: roomAssignment.message,
          ephemeral: true,
        });
      }

      const removeResult = queueManager.removeMatchPlayers(players);

      if (!removeResult.success) {
        await matchService.closeMatch(match.id);

        return interaction.reply({
          content: `Match room was created, but queue cleanup failed: ${removeResult.message}`,
          ephemeral: true,
        });
      }

      const matchEmbed = buildQueueEmbed(queueManager.getQueueSnapshot(), {
        title: "RANKD Match Ready",
        positionEmojis,
        description: [
          `<@${userId}> has joined the queue at **${POSITION_LABELS[position]}**.`,
          formatPlayerStats(playerStats),
          `Match ${match.id} has been assigned to ${roomAssignment.channel}.`,
          "The next queue is now open.",
        ].join("\n"),
      });

      return interaction.reply({
        embeds: [matchEmbed],
        files: [createQueueLogoAttachment()],
      });
    }

    const queuedTotal = getTotalQueued(queueSnapshot);
    const queueEmbed = buildQueueEmbed(queueSnapshot, {
      title: `RANKD 6v6 Regulation Match (${queuedTotal})`,
      positionEmojis,
      description: [
        `<@${userId}> has joined the queue at **${POSITION_LABELS[position]}**.`,
        formatPlayerStats(playerStats),
      ].join("\n"),
    });

    await interaction.reply({
      embeds: [queueEmbed],
      files: [createQueueLogoAttachment()],
    });
  },
};
