let matchCounter = 1;
const activeMatches = [];
const completedMatchIds = new Set();

function buildTeams(players) {
  return {
    teamA: {
      c: players.c[0],
      lw: players.lw[0],
      rw: players.rw[0],
      ld: players.ld[0],
      rd: players.rd[0],
      g: players.g[0],
    },
    teamB: {
      c: players.c[1],
      lw: players.lw[1],
      rw: players.rw[1],
      ld: players.ld[1],
      rd: players.rd[1],
      g: players.g[1],
    },
  };
}

function createMatch(players) {
  const teams = buildTeams(players);

  const match = {
    id: matchCounter++,
    players,
    teams,
    createdAt: Date.now(),
    status: "setup",
    textChannelId: null,
    roomNumber: null,
    isOverflowChannel: false,
    closedAt: null,
  };

  activeMatches.push(match);
  return match;
}

function getActiveMatches() {
  return activeMatches;
}

function getMatch(matchId) {
  return activeMatches.find(m => m.id === matchId) ?? null;
}

function isOpenMatch(match) {
  return match.status !== "closed" && match.status !== "completed";
}

function getMatchPlayers(match) {
  return [
    ...Object.values(match.teams.teamA),
    ...Object.values(match.teams.teamB),
  ];
}

function getActiveMatchForPlayer(userId) {
  return activeMatches.find(match => {
    if (!isOpenMatch(match)) return false;

    return getMatchPlayers(match).some(player => player.userId === userId);
  }) ?? null;
}

function setMatchTextChannel(matchId, channelId) {
  const match = activeMatches.find(m => m.id === matchId);
  if (!match) return false;

  match.textChannelId = channelId;
  return true;
}

function setMatchRoom(matchId, roomNumber, channelId) {
  const match = activeMatches.find(m => m.id === matchId);
  if (!match) return false;

  match.roomNumber = roomNumber;
  match.textChannelId = channelId;
  return true;
}

function setMatchServer(matchId, serverVote) {
  const match = activeMatches.find(m => m.id === matchId);
  if (!match) return false;

  match.serverVote = serverVote;
  return true;
}

function setMatchClubSetup(matchId, clubSetup) {
  const match = activeMatches.find(m => m.id === matchId);
  if (!match) return false;

  match.clubSetup = clubSetup;
  return true;
}

function closeMatch(matchId) {
  const match = activeMatches.find(m => m.id === matchId);
  if (!match) return null;

  match.status = "closed";
  match.closedAt = Date.now();
  return match;
}

function completeMatch(matchId, teamAScore, teamBScore) {
  const match = getMatch(matchId);

  if (!match || match.status === "closed" || match.status === "completed") {
    return null;
  }

  if (completedMatchIds.has(matchId)) {
    return null;
  }

  completedMatchIds.add(matchId);
  match.status = "completed";
  match.teamAScore = teamAScore;
  match.teamBScore = teamBScore;
  match.closedAt = Date.now();

  return match;
}

module.exports = {
  closeMatch,
  completeMatch,
  createMatch,
  getActiveMatches,
  getActiveMatchForPlayer,
  getMatch,
  setMatchClubSetup,
  setMatchRoom,
  setMatchServer,
  setMatchTextChannel,
};
