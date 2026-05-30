const { SlashCommandBuilder } = require("discord.js");

const queueManager = require("../services/queueManager");
const { createQueueLogoAttachment } = require("../services/queueBranding");
const { buildQueueEmbed, getTotalQueued } = require("../services/queueEmbed");
const { getPositionEmojiMap } = require("../services/positionEmojis");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Leave the ELO queue"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const result = queueManager.removePlayer(userId);

    if (!result.success) {
      return interaction.reply({
        content: result.message,
        ephemeral: true,
      });
    }

    const queue = queueManager.getQueueSnapshot();
    const queuedTotal = getTotalQueued(queue);
    const positionEmojis = await getPositionEmojiMap(interaction.guild);
    const embed = buildQueueEmbed(queue, {
      title: `RANKD 6v6 Regulation Match (${queuedTotal})`,
      positionEmojis,
      description: [
        `<@${userId}> left the queue.`,
        "A match starts when every position has 2 players.",
      ].join("\n"),
    });

    await interaction.reply({
      embeds: [embed],
      files: [createQueueLogoAttachment()],
    });
  },
};
