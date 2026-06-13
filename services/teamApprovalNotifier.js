const { EmbedBuilder } = require("discord.js");

const { getGuild } = require("./memberRoleService");

const TEAM_APPROVAL_CHANNEL_NAME = "team-approvals";

async function getApprovalChannel() {
  const guild = await getGuild();
  const channels = await guild.channels.fetch();
  return channels.find(channel =>
    channel.name === TEAM_APPROVAL_CHANNEL_NAME && channel.isTextBased()
  ) ?? null;
}

async function notifyNewApplication(application) {
  const channel = await getApprovalChannel();

  if (!channel) {
    console.warn(`Team RANKD application #${application.id} created, but #${TEAM_APPROVAL_CHANNEL_NAME} was not found.`);
    return false;
  }

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(`New Team RANKD Application #${application.id}`)
    .setDescription(`<@${application.ownerUserId}> requested protected ownership of **${application.clubName}**.`)
    .addFields(
      { name: "Club ID", value: `\`${application.clubId}\``, inline: true },
      { name: "Applicant", value: `<@${application.ownerUserId}>`, inline: true },
      { name: "Status", value: "Pending Staff Review", inline: true },
      { name: "Notes", value: application.notes || "None provided.", inline: false }
    )
    .setFooter({ text: "Review on the RANKD website or use /teamapprove and /teamdeny." })
    .setTimestamp();

  await channel.send({
    content: "@here New Team RANKD application submitted.",
    embeds: [embed],
  });
  return true;
}

async function notifyReview(application) {
  const channel = await getApprovalChannel();

  if (!channel) return false;

  const approved = application.status === "approved";
  const embed = new EmbedBuilder()
    .setColor(approved ? 0x31d879 : 0xff4c6a)
    .setTitle(`Team RANKD Application #${application.id} ${approved ? "Approved" : "Denied"}`)
    .setDescription(`**${application.clubName}** (\`${application.clubId}\`) was ${application.status}.`)
    .addFields(
      { name: "Applicant", value: `<@${application.ownerUserId}>`, inline: true },
      { name: "Reviewed By", value: `<@${application.reviewedBy}>`, inline: true },
      { name: "Notes", value: application.notes || "None provided.", inline: false }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  return true;
}

module.exports = {
  notifyNewApplication,
  notifyReview,
};
