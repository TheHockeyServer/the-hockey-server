const { SlashCommandBuilder } = require("discord.js");
const matchService = require("../services/matchService");

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("matches")
    .setDescription("Show active matches"),

  async execute(interaction) {
    const matches = matchService.getActiveMatches()
      .filter(match => match.status !== "closed" && match.status !== "completed");

    if (matches.length === 0) {
      return interaction.reply("No active matches.");
    }

    const output = matches.map(match => {
      const channelLine = match.textChannelId
        ? `Temporary text channel: <#${match.textChannelId}>`
        : "Temporary text channel: not created";

      return `RANKD Match ID: ${match.id}
Status: ${match.status}
${channelLine}

**Team A**
${formatTeam(match.teams.teamA)}

**Team B**
${formatTeam(match.teams.teamB)}`;
    }).join("\n\n--------------------\n\n");

    await interaction.reply(output);
  },
};
