require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits, Events } = require("discord.js");
const { handleClubSetupButton, handleClubSetupModal } = require("./services/clubSetup");
const database = require("./services/database");
const { handleServerVoteInteraction } = require("./services/serverVote");
const { handleStaffAlertInteraction } = require("./services/staffAlert");
const { startWebServer } = require("./services/webServer");

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

global.client = client;

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, readyClient => {
  console.log(`🏒 The Hockey Server Bot is online as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isButton()) {
    const isServerVote = interaction.customId.startsWith("server_vote:");
    const isStaffAlert = interaction.customId.startsWith("staff_alert:");
    const isClubSetup = interaction.customId.startsWith("club_setup:");

    if (!isServerVote && !isStaffAlert && !isClubSetup) return;

    try {
      if (isServerVote) {
        await handleServerVoteInteraction(interaction);
      } else if (isClubSetup) {
        await handleClubSetupButton(interaction);
      } else {
        await handleStaffAlertInteraction(interaction);
      }
    } catch (error) {
      console.error(error);

      const response = {
        content: "There was an error processing this button.",
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(() => null);
      } else {
        await interaction.reply(response).catch(() => null);
      }
    }

    return;
  }

  if (interaction.isModalSubmit()) {
    if (!interaction.customId.startsWith("club_setup_modal:")) return;

    try {
      await handleClubSetupModal(interaction);
    } catch (error) {
      console.error(error);

      const response = {
        content: "There was an error saving the club name.",
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(response).catch(() => null);
      } else {
        await interaction.reply(response).catch(() => null);
      }
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const response = {
      content: "There was an error executing this command.",
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response).catch(() => interaction.followUp(response));
    } else {
      await interaction.reply(response);
    }
  }
});

client.on("error", console.error);

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("DISCORD_TOKEN is missing. Add it to your environment variables.");
  process.exit(1);
}

async function start() {
  try {
    await database.initDatabase();
    startWebServer();
    await client.login(token);
  } catch (error) {
    console.error("Failed to start RANKD bot:", error);
    process.exit(1);
  }
}

start();
