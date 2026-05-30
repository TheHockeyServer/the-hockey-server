const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const matchService = require("../services/matchService");
const queueManager = require("../services/queueManager");
const ratingStore = require("../services/ratingStore");
const { assignMatchRoom } = require("../services/matchLobby");

const TEAM_OPTIONS = [
  ["team_a_c", "Team A Center"],
  ["team_a_lw", "Team A Left Wing"],
  ["team_a_rw", "Team A Right Wing"],
  ["team_a_ld", "Team A Left Defenseman"],
  ["team_a_rd", "Team A Right Defenseman"],
  ["team_a_g", "Team A Goalie"],
  ["team_b_c", "Team B Center"],
  ["team_b_lw", "Team B Left Wing"],
  ["team_b_rw", "Team B Right Wing"],
  ["team_b_ld", "Team B Left Defenseman"],
  ["team_b_rd", "Team B Right Defenseman"],
  ["team_b_g", "Team B Goalie"],
];

async function playerFromUser(user, position) {
  return {
    userId: user.id,
    username: user.username,
    position,
    elo: await ratingStore.getPlayerRating(user.id, user.username),
    joinedAt: Date.now(),
  };
}

async function buildPlayers(interaction) {
  return {
    c: [
      await playerFromUser(interaction.options.getUser("team_a_c"), "c"),
      await playerFromUser(interaction.options.getUser("team_b_c"), "c"),
    ],
    lw: [
      await playerFromUser(interaction.options.getUser("team_a_lw"), "lw"),
      await playerFromUser(interaction.options.getUser("team_b_lw"), "lw"),
    ],
    rw: [
      await playerFromUser(interaction.options.getUser("team_a_rw"), "rw"),
      await playerFromUser(interaction.options.getUser("team_b_rw"), "rw"),
    ],
    ld: [
      await playerFromUser(interaction.options.getUser("team_a_ld"), "ld"),
      await playerFromUser(interaction.options.getUser("team_b_ld"), "ld"),
    ],
    rd: [
      await playerFromUser(interaction.options.getUser("team_a_rd"), "rd"),
      await playerFromUser(interaction.options.getUser("team_b_rd"), "rd"),
    ],
    g: [
      await playerFromUser(interaction.options.getUser("team_a_g"), "g"),
      await playerFromUser(interaction.options.getUser("team_b_g"), "g"),
    ],
  };
}

function getDuplicateUsers(players) {
  const seen = new Set();
  const duplicates = new Set();

  for (const positionPlayers of Object.values(players)) {
    for (const player of positionPlayers) {
      if (seen.has(player.userId)) {
        duplicates.add(`<@${player.userId}>`);
      }

      seen.add(player.userId);
    }
  }

  return [...duplicates];
}

function getUnavailableUsers(players) {
  const unavailableUsers = [];
  const checkedUserIds = new Set();

  for (const positionPlayers of Object.values(players)) {
    for (const player of positionPlayers) {
      if (checkedUserIds.has(player.userId)) continue;
      checkedUserIds.add(player.userId);

      const activeMatch = matchService.getActiveMatchForPlayer(player.userId);

      if (activeMatch) {
        unavailableUsers.push(`<@${player.userId}> is already in Match ${activeMatch.id}`);
        continue;
      }

      if (queueManager.isPlayerInQueue(player.userId)) {
        unavailableUsers.push(`<@${player.userId}> is currently queued`);
      }
    }
  }

  return unavailableUsers;
}

const commandBuilder = new SlashCommandBuilder()
  .setName("testmatch")
  .setDescription("Admin test: create a temporary RANKD match text channel")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

for (const [name, description] of TEAM_OPTIONS) {
  commandBuilder.addUserOption(option =>
    option
      .setName(name)
      .setDescription(description)
      .setRequired(true)
  );
}

module.exports = {
  data: commandBuilder,

  async execute(interaction) {
    const players = await buildPlayers(interaction);
    const duplicateUsers = getDuplicateUsers(players);

    if (duplicateUsers.length > 0) {
      return interaction.reply({
        content: `Each match slot must use a different player. Duplicate users: ${duplicateUsers.join(", ")}`,
        ephemeral: true,
      });
    }

    const unavailableUsers = getUnavailableUsers(players);

    if (unavailableUsers.length > 0) {
      return interaction.reply({
        content: `These players cannot be used in a test match:\n${unavailableUsers.join("\n")}`,
        ephemeral: true,
      });
    }

    const match = matchService.createMatch(players);
    const roomAssignment = await assignMatchRoom(interaction, match);

    if (!roomAssignment.success) {
      return interaction.reply({
        content: roomAssignment.message,
        ephemeral: true,
      });
    }

    await interaction.reply({
      content: `Test match created.\nMatch ID: ${match.id}\nRANKD room: ${roomAssignment.channel}`,
      ephemeral: true,
    });
  },
};
