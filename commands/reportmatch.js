const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require("discord.js");

const eloService = require("../services/eloService");
const matchService = require("../services/matchService");
const { releaseMatchRoom } = require("../services/matchLobby");

function formatRatingChanges(players) {
  return players.map(player => {
    const sign = player.lastRatingChange >= 0 ? "+" : "";
    return `<@${player.userId}>: ${player.previousRating} -> ${player.rating} (${sign}${player.lastRatingChange})`;
  }).join("\n");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reportmatch")
    .setDescription("Admin: report a RANKD match score and update ELO")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option
        .setName("match_id")
        .setDescription("The match ID to report")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption(option =>
      option
        .setName("team_a_score")
        .setDescription("Team A final score")
        .setRequired(true)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option
        .setName("team_b_score")
        .setDescription("Team B final score")
        .setRequired(true)
        .setMinValue(0)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const matchId = interaction.options.getInteger("match_id");
    const teamAScore = interaction.options.getInteger("team_a_score");
    const teamBScore = interaction.options.getInteger("team_b_score");
    const match = matchService.getMatch(matchId);

    if (!match || match.status === "closed" || match.status === "completed") {
      return interaction.editReply(`No open RANKD match found for Match ${matchId}.`);
    }

    if (teamAScore === teamBScore) {
      return interaction.editReply("RANKD matches need a winner. Please report the final score after overtime or replay.");
    }

    const result = await eloService.recordMatchResult(match, teamAScore, teamBScore);
    matchService.completeMatch(matchId, teamAScore, teamBScore);
    await releaseMatchRoom(matchId, `Match ${matchId} final: Team A ${teamAScore}, Team B ${teamBScore}.`);

    const winner = teamAScore > teamBScore ? "Team A" : "Team B";

    await interaction.editReply([
      `**RANKD Match ${matchId} reported**`,
      `Final: Team A **${teamAScore}** - Team B **${teamBScore}**`,
      `Winner: **${winner}**`,
      "",
      "**Team A ELO Changes**",
      formatRatingChanges(result.updatedTeamA),
      "",
      "**Team B ELO Changes**",
      formatRatingChanges(result.updatedTeamB),
    ].join("\n"));
  },
};
