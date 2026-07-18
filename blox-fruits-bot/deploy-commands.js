/**
 * deploy-commands.js
 * Run this script once to register slash commands with Discord.
 *
 * Usage:
 *   node deploy-commands.js
 *
 * To deploy globally (takes up to 1 hour to propagate):
 *   Remove GUILD_ID from .env
 *
 * To deploy to a single guild instantly (for development):
 *   Set GUILD_ID in .env
 */

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID) {
  console.error('[ERROR] TOKEN and CLIENT_ID are required in .env');
  process.exit(1);
}

// ─── Collect command data ──────────────────────────────────────────────────────
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`[CMD] Queued /${command.data.name}`);
  }
}

// ─── Register with Discord REST API ───────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`\n🔄 Registering ${commands.length} slash command(s)...`);

    let data;
    if (GUILD_ID) {
      // Guild-scoped: instant update, good for development
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} command(s) to guild ${GUILD_ID}`);
    } else {
      // Global: up to 1 hour propagation
      data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} command(s) globally`);
    }
  } catch (error) {
    console.error('[ERROR] Failed to register commands:', error);
    process.exit(1);
  }
})();
