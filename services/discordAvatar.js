function getDefaultAvatarIndex(userId, discriminator) {
  if (discriminator && discriminator !== "0") {
    return Number(discriminator) % 5;
  }

  try {
    return Number((BigInt(userId) >> 22n) % 6n);
  } catch {
    return 0;
  }
}

function getDiscordAvatarUrl({ id, avatar, discriminator }) {
  if (!id) return null;

  if (avatar) {
    const extension = String(avatar).startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${extension}?size=256`;
  }

  return `https://cdn.discordapp.com/embed/avatars/${getDefaultAvatarIndex(id, discriminator)}.png`;
}

module.exports = {
  getDiscordAvatarUrl,
};
