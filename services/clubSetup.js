const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const clubStore = require("./clubStore");
const matchService = require("./matchService");
const { buildStaffAlertButton } = require("./staffAlert");

const activeClubSetups = new Map();

function getTeamPlayers(match, teamKey) {
  return Object.values(match.teams[teamKey]);
}

function getAllPlayers(match) {
  return [
    ...getTeamPlayers(match, "teamA"),
    ...getTeamPlayers(match, "teamB"),
  ];
}

function getPlayerTeam(match, userId) {
  if (getTeamPlayers(match, "teamA").some(player => player.userId === userId)) return "teamA";
  if (getTeamPlayers(match, "teamB").some(player => player.userId === userId)) return "teamB";
  return null;
}

function formatTeamName(teamKey) {
  return teamKey === "teamA" ? "Team A" : "Team B";
}

function formatRoster(team) {
  return [
    `Center: <@${team.c.userId}>`,
    `Left Wing: <@${team.lw.userId}>`,
    `Right Wing: <@${team.rw.userId}>`,
    `Left Defense: <@${team.ld.userId}>`,
    `Right Defense: <@${team.rd.userId}>`,
    `Goalie: <@${team.g.userId}>`,
  ].join("\n");
}

function getServerLabel(match) {
  return match.serverVote?.serverLabel ?? "Not selected";
}

function buildClubSetupEmbed(match, state, finalized = false) {
  const teamAClub = state.teamAClubName
    ? `${state.teamAClubName} (${state.teamAClubId})`
    : "Not set";
  const teamBClub = state.teamBClubName
    ? `${state.teamBClubName} (${state.teamBClubId})`
    : "Not set";
  const readyCount = state.readyUserIds.size;
  const totalPlayers = state.eligibleUserIds.size;

  return new EmbedBuilder()
    .setColor(finalized ? 0xfbed32 : 0x7c3aed)
    .setTitle(finalized ? `RANKD Match ${match.id} Setup Complete` : `RANKD Match ${match.id} Club Setup`)
    .setDescription([
      `Server: **${getServerLabel(match)}**`,
      "",
      finalized
        ? "Both clubs are set and all players have confirmed ready."
        : "Use the buttons below to enter your team's club name. Team selection is locked by the bot and cannot be changed here.",
    ].join("\n"))
    .addFields(
      {
        name: "Team A Club",
        value: `**${teamAClub}**`,
        inline: true,
      },
      {
        name: "Team B Club",
        value: `**${teamBClub}**`,
        inline: true,
      },
      {
        name: `Ready (${readyCount}/${totalPlayers})`,
        value: readyCount > 0
          ? Array.from(state.readyUserIds).map(userId => `<@${userId}>`).join(", ")
          : "No players ready yet.",
        inline: false,
      },
      {
        name: "Team A",
        value: formatRoster(match.teams.teamA),
        inline: true,
      },
      {
        name: "Team B",
        value: formatRoster(match.teams.teamB),
        inline: true,
      }
    )
    .setFooter({ text: "Any player can only set the club for their assigned team. No captains. No drafting." });
}

function buildClubSetupComponents(matchId, state, disabled = false) {
  const clubsAreSet = Boolean(state.teamAClubId && state.teamBClubId);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`club_setup:set:${matchId}:teamA`)
        .setLabel("Set Team A Club")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`club_setup:set:${matchId}:teamB`)
        .setLabel("Set Team B Club")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`club_setup:ready:${matchId}`)
        .setLabel("Confirm Ready")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled || !clubsAreSet),
      buildStaffAlertButton(matchId, disabled)
    ),
  ];
}

async function editClubSetupMessage(match, state, finalized = false) {
  const channel = await global.client?.channels.fetch(state.channelId).catch(() => null);
  const message = channel
    ? await channel.messages.fetch(state.messageId).catch(() => null)
    : null;

  if (!message) return;

  await message.edit({
    embeds: [buildClubSetupEmbed(match, state, finalized)],
    components: buildClubSetupComponents(match.id, state, finalized),
  });
}

function saveClubSetupToMatch(matchId, state, finalized = false) {
  matchService.setMatchClubSetup(matchId, {
    teamAClubId: state.teamAClubId,
    teamAClubName: state.teamAClubName,
    teamBClubId: state.teamBClubId,
    teamBClubName: state.teamBClubName,
    readyUserIds: Array.from(state.readyUserIds),
    finalized,
    updatedAt: Date.now(),
  });
}

async function finalizeIfReady(match, state) {
  if (!state.teamAClubId || !state.teamBClubId) return false;
  if (state.readyUserIds.size < state.eligibleUserIds.size) return false;

  state.finalized = true;
  saveClubSetupToMatch(match.id, state, true);
  await editClubSetupMessage(match, state, true);

  const channel = await global.client?.channels.fetch(state.channelId).catch(() => null);

  if (channel) {
    await channel.send([
      `RANKD Match ${match.id} setup complete.`,
      `Server: **${getServerLabel(match)}**`,
      `Team A Club: **${state.teamAClubName}** (${state.teamAClubId})`,
      `Team B Club: **${state.teamBClubName}** (${state.teamBClubId})`,
    ].join("\n"));
  }

  return true;
}

async function startClubSetup(channel, match) {
  cancelClubSetup(match.id);

  const state = {
    channelId: channel.id,
    eligibleUserIds: new Set(getAllPlayers(match).map(player => player.userId)),
    finalized: false,
    messageId: null,
    readyUserIds: new Set(),
    teamAClubId: null,
    teamAClubName: null,
    teamBClubId: null,
    teamBClubName: null,
  };

  const message = await channel.send({
    embeds: [buildClubSetupEmbed(match, state)],
    components: buildClubSetupComponents(match.id, state),
  });

  state.messageId = message.id;
  activeClubSetups.set(match.id, state);
  saveClubSetupToMatch(match.id, state);

  return message;
}

function cancelClubSetup(matchId) {
  return activeClubSetups.delete(matchId);
}

async function handleClubSetupButton(interaction) {
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const matchId = Number(parts[2]);
  const teamKey = parts[3];
  const match = matchService.getMatch(matchId);
  const state = activeClubSetups.get(matchId);

  if (!match || !state || state.finalized || match.status === "closed" || match.status === "completed") {
    await interaction.reply({
      content: "This club setup is no longer open.",
      ephemeral: true,
    });
    return;
  }

  const playerTeam = getPlayerTeam(match, interaction.user.id);

  if (!playerTeam) {
    await interaction.reply({
      content: "Only players assigned to this match can use club setup.",
      ephemeral: true,
    });
    return;
  }

  if (action === "set") {
    if (teamKey !== playerTeam) {
      await interaction.reply({
        content: `You can only set the club for ${formatTeamName(playerTeam)}.`,
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`club_setup_modal:${matchId}:${teamKey}`)
      .setTitle(`${formatTeamName(teamKey)} Club`);

    const input = new TextInputBuilder()
      .setCustomId("club_name")
      .setLabel("Club name")
      .setPlaceholder("Enter the EASHL club name")
      .setRequired(true)
      .setMaxLength(80)
      .setStyle(TextInputStyle.Short);

    const currentClubName = teamKey === "teamA" ? state.teamAClubName : state.teamBClubName;

    if (currentClubName) {
      input.setValue(currentClubName);
    }

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return;
  }

  if (action === "ready") {
    if (!state.teamAClubId || !state.teamBClubId) {
      await interaction.reply({
        content: "Both team clubs must be set before players can confirm ready.",
        ephemeral: true,
      });
      return;
    }

    state.readyUserIds.add(interaction.user.id);
    saveClubSetupToMatch(matchId, state);

    await interaction.update({
      embeds: [buildClubSetupEmbed(match, state)],
      components: buildClubSetupComponents(matchId, state),
    });

    await finalizeIfReady(match, state);
  }
}

async function handleClubSetupModal(interaction) {
  const [, matchIdText, teamKey] = interaction.customId.split(":");
  const matchId = Number(matchIdText);
  const match = matchService.getMatch(matchId);
  const state = activeClubSetups.get(matchId);

  if (!match || !state || state.finalized || match.status === "closed" || match.status === "completed") {
    await interaction.reply({
      content: "This club setup is no longer open.",
      ephemeral: true,
    });
    return;
  }

  const playerTeam = getPlayerTeam(match, interaction.user.id);

  if (!playerTeam) {
    await interaction.reply({
      content: "Only players assigned to this match can set a club name.",
      ephemeral: true,
    });
    return;
  }

  if (playerTeam !== teamKey) {
    await interaction.reply({
      content: `You can only set the club for ${formatTeamName(playerTeam)}.`,
      ephemeral: true,
    });
    return;
  }

  const clubName = interaction.fields.getTextInputValue("club_name").trim();

  if (clubName.length < 2) {
    await interaction.reply({
      content: "Club name must be at least 2 characters.",
      ephemeral: true,
    });
    return;
  }

  const matches = clubStore.findClubByNameOrAlias(clubName);

  if (matches.length === 0) {
    await interaction.reply({
      content: "That club is not registered yet. Please register it with /registerclub first, then try again.",
      ephemeral: true,
    });
    return;
  }

  if (matches.length > 1) {
    await interaction.reply({
      content: [
        "I found multiple registered clubs. Please enter a more exact club name or club ID.",
        "",
        ...matches.slice(0, 10).map(club => `- ${club.name} (${club.clubId})`),
      ].join("\n"),
      ephemeral: true,
    });
    return;
  }

  const club = matches[0];

  if (teamKey === "teamA") {
    state.teamAClubId = club.clubId;
    state.teamAClubName = club.name;
  } else {
    state.teamBClubId = club.clubId;
    state.teamBClubName = club.name;
  }

  state.readyUserIds.clear();
  saveClubSetupToMatch(matchId, state);

  await editClubSetupMessage(match, state);
  await interaction.reply({
    content: `${formatTeamName(teamKey)} club set to **${club.name}** (${club.clubId}).`,
    ephemeral: true,
  });
}

module.exports = {
  cancelClubSetup,
  handleClubSetupButton,
  handleClubSetupModal,
  startClubSetup,
};
