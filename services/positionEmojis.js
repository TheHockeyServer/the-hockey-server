const POSITION_EMOJI_NAMES = {
  c: "center",
  lw: "leftwing",
  rw: "rightwing",
  ld: "leftdefense",
  rd: "rd",
  g: "goalie",
};

async function getPositionEmojiMap(guild) {
  const emojis = await guild.emojis.fetch().catch(() => guild.emojis.cache);
  const emojiMap = {};

  for (const [position, emojiName] of Object.entries(POSITION_EMOJI_NAMES)) {
    const emoji = emojis.find(serverEmoji => serverEmoji.name === emojiName);

    if (emoji) {
      emojiMap[position] = emoji.toString();
    }
  }

  return emojiMap;
}

module.exports = {
  getPositionEmojiMap,
};
