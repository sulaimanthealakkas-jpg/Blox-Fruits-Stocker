const { Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * Loads all slash commands from the /commands directory
 * into client.commands (a Discord.js Collection).
 */
function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`[WARN] Skipping ${file} — missing "data" or "execute" export.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    console.log(`[CMD] Loaded /${command.data.name}`);
  }
}

/**
 * Handles incoming slash command interactions.
 */
async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`[ERROR] No command found for /${interaction.commandName}`);
    return interaction.reply({
      content: '❌ Unknown command.',
      ephemeral: true,
    });
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[ERROR] Failed to execute /${interaction.commandName}:`, error);

    const reply = { content: '❌ An error occurred while running this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}

module.exports = { loadCommands, handleInteraction };
