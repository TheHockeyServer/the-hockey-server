const { EmbedBuilder } = require("discord.js");
const { QUEUE_LOGO_FILE_NAME } = require("./queueBranding");

const POSITIONS = [
  ["c", "Center"],
  ["lw", "Left Wing"],
  ["rw", "Right Wing"],
  ["ld", "Left Defense"],
  ["rd", "Right Defense"],
  ["g", "Goalie"],
];

const GROUPS = [
  {
    label: "Forward",
    max: 6,
    positions: [
      ["c", "CENTER", "🔴"],
      ["lw", "LEFT WING", "🟢"],
      ["rw", "RIGHT WING", "🔵"],
    ],
  },
  {
    label: "Defender",
    max: 4,
    positions: [
      ["ld", "LEFT DEFENSE", "🟦"],
      ["rd", "RIGHT DEFENSE", "🟡"],
    ],
  },
  {
    label: "Goalie",
    max: 2,
    positions: [
      ["g", "GOALIE", "🟣"],
    ],
  },
];

function getTotalQueued(queue) {
  return POSITIONS.reduce((total, [position]) => total + queue[position].length, 0);
}

function getGroupTotal(queue, group) {
  return group.positions.reduce((total, [position]) => total + queue[position].length, 0);
}

function formatPlayerLine(player) {
  return player ? `<@${player.userId}> ✅` : "- OPEN -";
}

function formatPositionSlots(queue, position, label, marker) {
  const players = queue[position];
  const extraPlayers = players.slice(2);
  const lines = [
    `**${marker} ${label}:**`,
    formatPlayerLine(players[0]),
    formatPlayerLine(players[1]),
  ];

  if (extraPlayers.length > 0) {
    lines.push(
      ...extraPlayers.map((player, index) => `Next ${index + 1}: <@${player.userId}>`)
    );
  }

  return lines.join("\n");
}

function formatGroup(queue, group) {
  return group.positions
    .map(([position, label, marker]) => formatPositionSlots(queue, position, label, marker))
    .join("\n\n");
}

function buildQueueEmbed(queue, options = {}) {
  const totalQueued = getTotalQueued(queue);
  const title = options.title ?? `RANKD 6v6 Regulation Match (${totalQueued})`;
  const positionEmojis = options.positionEmojis ?? {};

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x7c3aed)
    .setImage(`attachment://${QUEUE_LOGO_FILE_NAME}`)
    .setFooter({ text: "RANKD, What's Your Rank?" });

  if (options.description) {
    embed.setDescription(options.description);
  }

  for (const group of GROUPS) {
    embed.addFields({
      name: `${group.label} (${getGroupTotal(queue, group)}/${group.max})`,
      value: formatGroupWithEmojis(queue, group, positionEmojis),
      inline: false,
    });
  }

  return embed;
}

function formatGroupWithEmojis(queue, group, positionEmojis) {
  return group.positions
    .map(([position, label, fallbackMarker]) => {
      const marker = positionEmojis[position] ?? fallbackMarker;
      return formatPositionSlots(queue, position, label, marker);
    })
    .join("\n\n");
}

module.exports = {
  POSITIONS,
  buildQueueEmbed,
  getTotalQueued,
};
