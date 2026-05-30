const { ChannelType, PermissionFlagsBits } = require("discord.js");

const ROOM_COUNT = 5;
const AUTO_CLOSE_MS = 90 * 60 * 1000;
const rooms = new Map();
const autoCloseTimers = new Map();

function getRoomName(roomNumber) {
  return `rankd-match-${roomNumber}`;
}

function getRoomList() {
  return Array.from({ length: ROOM_COUNT }, (_, index) => {
    const roomNumber = index + 1;
    const room = rooms.get(roomNumber);

    return {
      roomNumber,
      channelId: room?.channelId ?? null,
      matchId: room?.matchId ?? null,
      occupied: Boolean(room?.matchId),
    };
  });
}

function markRoomChannel(roomNumber, channelId) {
  const existingRoom = rooms.get(roomNumber) ?? {};

  rooms.set(roomNumber, {
    ...existingRoom,
    channelId,
    matchId: existingRoom.matchId ?? null,
  });
}

async function getOrCreateRoomChannel(guild, roomNumber) {
  const roomName = getRoomName(roomNumber);
  const existingRoom = rooms.get(roomNumber);

  if (existingRoom?.channelId) {
    const cachedChannel = await guild.channels.fetch(existingRoom.channelId).catch(() => null);

    if (cachedChannel) {
      return cachedChannel;
    }
  }

  const existingChannel = guild.channels.cache.find(channel =>
    channel.type === ChannelType.GuildText && channel.name === roomName
  );

  if (existingChannel) {
    markRoomChannel(roomNumber, existingChannel.id);
    return existingChannel;
  }

  const createdChannel = await guild.channels.create({
    name: roomName,
    type: ChannelType.GuildText,
    topic: `Reusable RANKD match room ${roomNumber}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  markRoomChannel(roomNumber, createdChannel.id);
  return createdChannel;
}

async function setupRooms(guild) {
  const createdRooms = [];
  const failedRooms = [];

  for (let roomNumber = 1; roomNumber <= ROOM_COUNT; roomNumber++) {
    try {
      const channel = await getOrCreateRoomChannel(guild, roomNumber);
      await resetRoomPermissions(channel);
      createdRooms.push({ roomNumber, channel });
    } catch (error) {
      console.error(`Failed to set up RANKD room ${roomNumber}:`, error);
      failedRooms.push({ roomNumber, error });
    }
  }

  return { createdRooms, failedRooms };
}

async function discoverRooms(guild) {
  const discoveredRooms = [];
  const failedRooms = [];

  for (let roomNumber = 1; roomNumber <= ROOM_COUNT; roomNumber++) {
    try {
      const channel = await getOrCreateRoomChannel(guild, roomNumber);
      discoveredRooms.push({ roomNumber, channel });
    } catch (error) {
      console.error(`Failed to discover RANKD room ${roomNumber}:`, error);
      failedRooms.push({ roomNumber, error });
    }
  }

  return { discoveredRooms, failedRooms };
}

function findAvailableRoom() {
  for (let roomNumber = 1; roomNumber <= ROOM_COUNT; roomNumber++) {
    const room = rooms.get(roomNumber);

    if (room?.channelId && !room.matchId) {
      return { roomNumber, channelId: room.channelId };
    }
  }

  return null;
}

async function resetRoomPermissions(channel) {
  await channel.permissionOverwrites.set([
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
  ]);
}

async function assignRoom(interaction, match) {
  const setupResult = await discoverRooms(interaction.guild);

  if (setupResult.failedRooms.length === ROOM_COUNT) {
    return {
      success: false,
      message: "I could not access any RANKD match rooms. Please make sure the bot has View Channel and Manage Channels permissions.",
    };
  }

  const availableRoom = findAvailableRoom();

  if (!availableRoom) {
    return {
      success: false,
      message: "All 5 RANKD match rooms are currently in use. Please wait for one to auto-close.",
    };
  }

  const channel = await interaction.guild.channels.fetch(availableRoom.channelId);

  rooms.set(availableRoom.roomNumber, {
    channelId: channel.id,
    matchId: match.id,
    assignedAt: Date.now(),
  });

  return {
    success: true,
    roomNumber: availableRoom.roomNumber,
    channel,
  };
}

function scheduleAutoClose(matchId, closeRoom) {
  const existingTimer = autoCloseTimers.get(matchId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    closeRoom(matchId, "Auto-closed after 90 minutes.").catch(error => {
      console.error(`Failed to auto-close match ${matchId}:`, error);
    });
  }, AUTO_CLOSE_MS);

  autoCloseTimers.set(matchId, timer);
}

function clearAutoClose(matchId) {
  const timer = autoCloseTimers.get(matchId);

  if (timer) {
    clearTimeout(timer);
    autoCloseTimers.delete(matchId);
  }
}

function releaseRoomByMatch(matchId) {
  for (const [roomNumber, room] of rooms.entries()) {
    if (room.matchId === matchId) {
      rooms.set(roomNumber, {
        channelId: room.channelId,
        matchId: null,
        assignedAt: null,
      });

      clearAutoClose(matchId);
      return room;
    }
  }

  clearAutoClose(matchId);
  return null;
}

module.exports = {
  AUTO_CLOSE_MS,
  ROOM_COUNT,
  assignRoom,
  discoverRooms,
  getRoomList,
  releaseRoomByMatch,
  resetRoomPermissions,
  scheduleAutoClose,
  setupRooms,
};
