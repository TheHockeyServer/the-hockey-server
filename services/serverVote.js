const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const matchService = require("./matchService");
const { buildStaffAlertButton } = require("./staffAlert");
const { startClubSetup } = require("./clubSetup");

const VOTE_DURATION_MS = 2 * 60 * 1000;
const SERVER_OPTIONS = [
  { id: "east", label: "East" },
  { id: "central", label: "Central" },
  { id: "west", label: "West" },
];

const activeVotes = new Map();

function getMatchPlayers(match) {
  return [
    ...Object.values(match.teams.teamA),
    ...Object.values(match.teams.teamB),
  ];
}

function getEligibleUserIds(match) {
  return new Set(getMatchPlayers(match).map(player => player.userId));
}

function getRoomLabel(match) {
  if (match.isOverflowChannel) return "Temporary overflow room";
  if (match.roomNumber) return `Room ${match.roomNumber}`;
  return "Match room";
}

function formatVoteSummary(votes) {
  const lines = SERVER_OPTIONS.map(option => {
    const count = Array.from(votes.values()).filter(vote => vote === option.id).length;
    return `**${option.label}:** ${count}`;
  });

  return lines.join("\n");
}

function buildVoteEmbed(match, state, finalized = false) {
  const voteCount = state.votes.size;
  const totalPlayers = state.eligibleUserIds.size;
  const title = finalized
    ? `RANKD Match ${match.id} Server Selected`
    : `RANKD Match ${match.id} Server Vote`;

  const embed = new EmbedBuilder()
    .setColor(finalized ? 0xfbed32 : 0x7c3aed)
    .setTitle(title)
    .setDescription([
      `${getRoomLabel(match)} is selecting the game server.`,
      "",
      finalized
        ? `Selected server: **${state.selectedServerLabel}**`
        : "Vote for the server you want to play on. The vote closes after 2 minutes or when all 12 players have voted.",
    ].join("\n"))
    .addFields(
      {
        name: `Votes Submitted (${voteCount}/${totalPlayers})`,
        value: formatVoteSummary(state.votes),
        inline: true,
      },
      {
        name: "Tie Rule",
        value: "East wins all ties. If no one votes, East is selected.",
        inline: true,
      }
    );

  if (!finalized) {
    const closesAt = Math.floor(state.expiresAt / 1000);
    embed.setFooter({ text: "Only assigned players can vote. You can change your vote before the timer ends." });
    embed.addFields({
      name: "Voting Ends",
      value: `<t:${closesAt}:R>`,
      inline: false,
    });
  }

  return embed;
}

function buildVoteComponents(matchId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      SERVER_OPTIONS.map(option =>
        new ButtonBuilder()
          .setCustomId(`server_vote:${matchId}:${option.id}`)
          .setLabel(option.label)
          .setStyle(option.id === "east" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    ),
    new ActionRowBuilder().addComponents(
      buildStaffAlertButton(matchId)
    ),
  ];
}

function chooseWinningServer(votes) {
  const counts = new Map(SERVER_OPTIONS.map(option => [option.id, 0]));

  for (const vote of votes.values()) {
    counts.set(vote, (counts.get(vote) ?? 0) + 1);
  }

  const eastCount = counts.get("east") ?? 0;
  const centralCount = counts.get("central") ?? 0;
  const westCount = counts.get("west") ?? 0;

  if (eastCount >= centralCount && eastCount >= westCount) return "east";
  if (centralCount > eastCount && centralCount > westCount) return "central";
  if (westCount > eastCount && westCount > centralCount) return "west";

  return "east";
}

function getServerLabel(serverId) {
  return SERVER_OPTIONS.find(option => option.id === serverId)?.label ?? "East";
}

async function finalizeServerVote(matchId, reason = "timer") {
  const state = activeVotes.get(matchId);
  if (!state || state.finalized) return null;

  const match = matchService.getMatch(matchId);
  if (!match || match.status === "closed" || match.status === "completed") {
    cancelServerVote(matchId);
    return null;
  }

  state.finalized = true;
  clearTimeout(state.timer);

  const selectedServer = chooseWinningServer(state.votes);
  const selectedServerLabel = getServerLabel(selectedServer);
  state.selectedServer = selectedServer;
  state.selectedServerLabel = selectedServerLabel;

  matchService.setMatchServer(matchId, {
    server: selectedServer,
    serverLabel: selectedServerLabel,
    votes: Object.fromEntries(state.votes.entries()),
    finalizedAt: Date.now(),
    finalizedBy: reason,
  });

  const channel = await global.client?.channels.fetch(state.channelId).catch(() => null);
  const message = channel
    ? await channel.messages.fetch(state.messageId).catch(() => null)
    : null;

  if (message) {
    await message.edit({
      embeds: [buildVoteEmbed(match, state, true)],
      components: buildVoteComponents(matchId, true),
    }).catch(() => null);
  }

  if (channel) {
    await channel.send(`Server vote complete. **${selectedServerLabel}** has been selected for RANKD Match ${matchId}.`);
    await startClubSetup(channel, match).catch(error => {
      console.error(`Failed to start club setup for match ${matchId}:`, error);
    });
  }

  activeVotes.delete(matchId);
  return selectedServer;
}

function cancelServerVote(matchId) {
  const state = activeVotes.get(matchId);
  if (!state) return false;

  clearTimeout(state.timer);
  activeVotes.delete(matchId);
  return true;
}

async function startServerVote(channel, match) {
  cancelServerVote(match.id);

  const eligibleUserIds = getEligibleUserIds(match);
  const state = {
    channelId: channel.id,
    eligibleUserIds,
    expiresAt: Date.now() + VOTE_DURATION_MS,
    finalized: false,
    messageId: null,
    timer: null,
    votes: new Map(),
  };

  const message = await channel.send({
    embeds: [buildVoteEmbed(match, state)],
    components: buildVoteComponents(match.id),
  });

  state.messageId = message.id;
  state.timer = setTimeout(() => {
    finalizeServerVote(match.id, "timer").catch(error => {
      console.error(`Failed to finalize server vote for match ${match.id}:`, error);
    });
  }, VOTE_DURATION_MS);

  activeVotes.set(match.id, state);
  return message;
}

async function handleServerVoteInteraction(interaction) {
  const [, matchIdText, serverId] = interaction.customId.split(":");
  const matchId = Number(matchIdText);
  const state = activeVotes.get(matchId);

  if (!state || state.finalized) {
    await interaction.reply({
      content: "This server vote is already closed.",
      ephemeral: true,
    });
    return;
  }

  const match = matchService.getMatch(matchId);

  if (!match || match.status === "closed" || match.status === "completed") {
    cancelServerVote(matchId);
    await interaction.reply({
      content: "This match is no longer open for server voting.",
      ephemeral: true,
    });
    return;
  }

  if (!SERVER_OPTIONS.some(option => option.id === serverId)) {
    await interaction.reply({
      content: "That server option is not available.",
      ephemeral: true,
    });
    return;
  }

  if (!state.eligibleUserIds.has(interaction.user.id)) {
    await interaction.reply({
      content: "Only players assigned to this match can vote on the server.",
      ephemeral: true,
    });
    return;
  }

  state.votes.set(interaction.user.id, serverId);

  await interaction.update({
    embeds: [buildVoteEmbed(match, state)],
    components: buildVoteComponents(matchId),
  });

  if (state.votes.size >= state.eligibleUserIds.size) {
    await finalizeServerVote(matchId, "all_players_voted");
  }
}

module.exports = {
  VOTE_DURATION_MS,
  cancelServerVote,
  handleServerVoteInteraction,
  startServerVote,
};
