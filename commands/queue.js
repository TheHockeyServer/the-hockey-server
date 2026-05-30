const { SlashCommandBuilder } = require("discord.js");

const queueManager = require("../services/queueManager");
const { createQueueLogoAttachment } = require("../services/queueBranding");
const { buildQueueEmbed } = require("../services/queueEmbed");
const { getPositionEmojiMap } = require("../services/positionEmojis");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current RANKD queue"),

  async execute(interaction) {
    const queue = queueManager.getQueueSnapshot();
    const positionEmojis = await getPositionEmojiMap(interaction.guild);
    const embed = buildQueueEmbed(queue, { positionEmojis });

    await interaction.reply({
      embeds: [embed],
      files: [createQueueLogoAttachment()],
    });
  },
};
