const { ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const matchService = require("./matchService");

const STAFF_ALERT_CHANNEL_NAME = "staff-user-alerts";

function buildStaffAlertButton(matchId, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(`staff_alert:${matchId}`)
    .setLabel("CALL STAFF")
    .setStyle(ButtonStyle.Danger)
    .setDisabled(disabled);
}

function getMatchPlayers(match) {
  return [
    ...Object.values(match.teams.teamA),
    ...Object.values(match.teams.teamB),
  ];
}

function isAssignedPlayer(match, userId) {
  return getMatchPlayers(match).some(player => player.userId === userId);
}

function formatTeam(team) {
  return [
    `Center: <@${team.c.userId}>`,
    `Left Wing: <@${team.lw.userId}>`,
    `Right Wing: <@${team.rw.userId}>`,
    `Left Defense: <@${team.ld.userId}>`,
    `Right Defense: <@${team.rd.userId}>`,
    `Goalie: <@${team.g.userId}>`,
  ].join("\n");
}

function getRoomValue(match, interaction) {
  if (match.textChannelId) return `<#${match.textChannelId}>`;
  return interaction.channel ? `<#${interaction.channel.id}>` : "Unknown room";
}

async function findStaffAlertChannel(guild) {
  const channel = guild.channels.cache.find(candidate =>
    candidate.name === STAFF_ALERT_CHANNEL_NAME && candidate.isTextBased()
  );

  return channel ?? null;
}

async function handleStaffAlertInteraction(interaction) {
  const [, matchIdText] = interaction.customId.split(":");
  const matchId = Number(matchIdText);
  const match = matchService.getMatch(matchId);

  if (!match || match.status === "closed" || match.status === "completed") {
    await interaction.reply({
      content: "This match is no longer open for staff alerts.",
      ephemeral: true,
    });
    return;
  }

  if (!isAssignedPlayer(match, interaction.user.id)) {
    await interaction.reply({
      content: "Only players assigned to this match can call staff from this room.",
      ephemeral: true,
    });
    return;
  }

  const alertChannel = await findStaffAlertChannel(interaction.guild);

  if (!alertChannel) {
    await interaction.reply({
      content: `I could not find #${STAFF_ALERT_CHANNEL_NAME}. Please make sure that channel exists and I can see it.`,
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xfbed32)
    .setTitle(`Staff Requested: RANKD Match ${match.id}`)
    .setDescription(`${interaction.user} requested staff help from ${getRoomValue(match, interaction)}.`)
    .addFields(
      {
        name: "Requested By",
        value: `${interaction.user}`,
        inline: true,
      },
      {
        name: "Room",
        value: getRoomValue(match, interaction),
        inline: true,
      },
      {
        name: "Team A",
        value: formatTeam(match.teams.teamA),
        inline: true,
      },
      {
        name: "Team B",
        value: formatTeam(match.teams.teamB),
        inline: true,
      }
    )
    .setTimestamp();

  await alertChannel.send({
    content: "@here RANKD staff help requested.",
    embeds: [embed],
  });

  await interaction.reply({
    content: "Staff has been alerted.",
    ephemeral: true,
  });

  await interaction.channel?.send(`${interaction.user} called staff for RANKD Match ${match.id}.`).catch(() => null);
}

module.exports = {
  buildStaffAlertButton,
  handleStaffAlertInteraction,
};
