const queue = {
  c: [],
  lw: [],
  rw: [],
  ld: [],
  rd: [],
  g: [],
};

const ratingStore = require("./ratingStore");

function isPlayerInQueue(userId) {
  for (const position in queue) {
    if (queue[position].some(player => player.userId === userId)) {
      return true;
    }
  }
  return false;
}

function addPlayer(userId, username, position) {
  if (!queue[position]) {
    return {
      success: false,
      message: `Invalid position received: ${position}`,
    };
  }

  if (isPlayerInQueue(userId)) {
    return { success: false, message: "You are already in the queue." };
  }

  queue[position].push({
    userId,
    username,
    position,
    elo: ratingStore.getPlayerRating(userId, username),
    joinedAt: Date.now(),
  });

  return { success: true };
}

function removePlayer(userId) {
  for (const position in queue) {
    const index = queue[position].findIndex(player => player.userId === userId);

    if (index !== -1) {
      queue[position].splice(index, 1);
      return { success: true };
    }
  }

  return { success: false, message: "You are not currently in the queue." };
}

function getQueueStatus() {
  return {
    c: queue.c.length,
    lw: queue.lw.length,
    rw: queue.rw.length,
    ld: queue.ld.length,
    rd: queue.rd.length,
    g: queue.g.length,
  };
}

function getQueueSnapshot() {
  return {
    c: [...queue.c],
    lw: [...queue.lw],
    rw: [...queue.rw],
    ld: [...queue.ld],
    rd: [...queue.rd],
    g: [...queue.g],
  };
}

function isMatchReady() {
  return (
    queue.c.length >= 2 &&
    queue.lw.length >= 2 &&
    queue.rw.length >= 2 &&
    queue.ld.length >= 2 &&
    queue.rd.length >= 2 &&
    queue.g.length >= 2
  );
}

function getMatchPlayers() {
  if (!isMatchReady()) return null;

  return {
    c: queue.c.slice(0, 2),
    lw: queue.lw.slice(0, 2),
    rw: queue.rw.slice(0, 2),
    ld: queue.ld.slice(0, 2),
    rd: queue.rd.slice(0, 2),
    g: queue.g.slice(0, 2),
  };
}

function removeMatchPlayers(players) {
  for (const [position, positionPlayers] of Object.entries(players)) {
    for (const player of positionPlayers) {
      const index = queue[position].findIndex(queuedPlayer => queuedPlayer.userId === player.userId);

      if (index === -1) {
        return {
          success: false,
          message: `<@${player.userId}> is no longer queued at ${position}.`,
        };
      }
    }
  }

  for (const [position, positionPlayers] of Object.entries(players)) {
    for (const player of positionPlayers) {
      const index = queue[position].findIndex(queuedPlayer => queuedPlayer.userId === player.userId);
      queue[position].splice(index, 1);
    }
  }

  return { success: true };
}

module.exports = {
  addPlayer,
  removePlayer,
  getQueueStatus,
  getQueueSnapshot,
  isPlayerInQueue,
  isMatchReady,
  getMatchPlayers,
  removeMatchPlayers,
};
