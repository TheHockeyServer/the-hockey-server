const path = require("path");
const { AttachmentBuilder } = require("discord.js");

const QUEUE_LOGO_FILE_NAME = "rankd-bot-padded-40.png";
const QUEUE_LOGO_PATH = path.join(__dirname, "..", "assets", QUEUE_LOGO_FILE_NAME);

function createQueueLogoAttachment() {
  return new AttachmentBuilder(QUEUE_LOGO_PATH, {
    name: QUEUE_LOGO_FILE_NAME,
  });
}

module.exports = {
  QUEUE_LOGO_FILE_NAME,
  createQueueLogoAttachment,
};
