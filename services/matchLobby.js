const { ChannelType, PermissionFlagsBits } = require("discord.js");

const matchService = require("./matchService");
const clubSetup = require("./clubSetup");
const roomManager = require("./roomManager");
const serverVote = require("./serverVote");

function getAllMatchPlayers(players) {
  return [
    ...players.c,
    ...players.lw,
    ...players.rw,
    ...players.ld,
    ...players.rd,
    ...players.g,
  ];
}

function formatTeam(team) {
  return [
    `Center: <@${team.c.userId}> (${team.c.elo})`,
    `Left Wing: <@${team.lw.userId}> (${team.lw.elo})`,
    `Right Wing: <@${team.rw.userId}> (${team.rw.elo})`,
    `Left Defense: <@${team.ld.userId}> (${team.ld.elo})`,
    `Right Defense: <@${team.rd.userId}> (${team.rd.elo})`,
    `Goalie: <@${team.g.userId}> (${team.g.elo})`,
  ].join("\n");
}

function buildMatchLobbyMessage(match) {
  const roomLine = match.isOverflowChannel
    ? `Room: temporary overflow channel`
    : `Room: rankd-match-${match.roomNumber}`;

  return [
    `**RANKD Match ${match.id} is ready**`,
    "",
    roomLine,
    "Use this text channel to set up your EA NHL 26 EASHL 6v6 game.",
    "This room auto-closes after 90 minutes.",
    "",
    "**Team A**",
    formatTeam(match.teams.teamA),
    "",
    "**Team B**",
    formatTeam(match.teams.teamB),
  ].join("\n");
}

async function createOverflowMatchChannel(interaction, match) {
  const channel = await interaction.guild.channels.create({
    name: `rankd-overflow-${match.id}`,
    type: ChannelType.GuildText,
    topic: `Temporary overflow setup channel for RANKD Match ${match.id}`,
    permissionOverwrites: [
      {
        id: interaction.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  match.isOverflowChannel = true;
  match.textChannelId = channel.id;
  matchService.setMatchRoom(match.id, null, channel.id);

  return channel;
}

async function clearRecentBotMessages(channel) {
  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);

  if (!messages) return;

  const botMessages = messages.filter(message => message.author.id === channel.client.user.id);

  if (botMessages.size > 0) {
    await channel.bulkDelete(botMessages, true).catch(() => null);
  }
}

async function setMatchRoomPermissions(channel, match) {
  const permissionOverwrites = [
    {
      id: channel.guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: channel.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  for (const player of getAllMatchPlayers(match.players)) {
    permissionOverwrites.push({
      id: player.userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  await channel.permissionOverwrites.set(permissionOverwrites);
}

async function closeMatchRoom(matchId, reason) {
  serverVote.cancelServerVote(matchId);
  clubSetup.cancelClubSetup(matchId);

  const releasedRoom = roomManager.releaseRoomByMatch(matchId);
  const match = matchService.closeMatch(matchId);

  if (!match) return null;

  if (match.isOverflowChannel && match.textChannelId) {
    const channel = await global.client?.channels.fetch(match.textChannelId).catch(() => null);

    if (channel) {
      await channel.send(reason).catch(() => null);
      await channel.delete(`RANKD Match ${matchId} closed`).catch(() => null);
    }

    return match;
  }

  if (!releasedRoom) return match;

  const channel = await global.client?.channels.fetch(releasedRoom.channelId).catch(() => null);

  if (!channel) return match;

  await roomManager.resetRoomPermissions(channel);
  await clearRecentBotMessages(channel);
  await channel.send(`RANKD room available. ${reason}`);

  return match;
}

async function releaseMatchRoom(matchId, reason) {
  serverVote.cancelServerVote(matchId);
  clubSetup.cancelClubSetup(matchId);

  const releasedRoom = roomManager.releaseRoomByMatch(matchId);
  const match = matchService.getMatch(matchId);

  if (match?.isOverflowChannel && match.textChannelId) {
    const channel = await global.client?.channels.fetch(match.textChannelId).catch(() => null);

    if (channel) {
      await channel.send(reason).catch(() => null);
      await channel.delete(`RANKD Match ${matchId} released`).catch(() => null);
    }

    return { channelId: match.textChannelId, overflow: true };
  }

  if (!releasedRoom) return null;

  const channel = await global.client?.channels.fetch(releasedRoom.channelId).catch(() => null);

  if (channel) {
    await roomManager.resetRoomPermissions(channel);
    await clearRecentBotMessages(channel);
    await channel.send(`RANKD room available. ${reason}`);
  }

  return releasedRoom;
}

async function assignMatchRoom(interaction, match) {
  const roomAssignment = await roomManager.assignRoom(interaction, match);

  if (!roomAssignment.success) {
    if (!roomAssignment.message.startsWith("All 5 RANKD match rooms are currently in use")) {
      return roomAssignment;
    }

    const overflowChannel = await createOverflowMatchChannel(interaction, match);

    await setMatchRoomPermissions(overflowChannel, match);
    await overflowChannel.send(buildMatchLobbyMessage(match));
    await serverVote.startServerVote(overflowChannel, match);

    roomManager.scheduleAutoClose(match.id, closeMatchRoom);

    return {
      success: true,
      overflow: true,
      roomNumber: null,
      channel: overflowChannel,
    };
  }

  matchService.setMatchRoom(match.id, roomAssignment.roomNumber, roomAssignment.channel.id);
  match.roomNumber = roomAssignment.roomNumber;
  match.textChannelId = roomAssignment.channel.id;

  await setMatchRoomPermissions(roomAssignment.channel, match);
  await clearRecentBotMessages(roomAssignment.channel);
  await roomAssignment.channel.send(buildMatchLobbyMessage(match));
  await serverVote.startServerVote(roomAssignment.channel, match);

  roomManager.scheduleAutoClose(match.id, closeMatchRoom);

  return {
    success: true,
    roomNumber: roomAssignment.roomNumber,
    channel: roomAssignment.channel,
  };
}

module.exports = {
  assignMatchRoom,
  closeMatchRoom,
  releaseMatchRoom,
};
