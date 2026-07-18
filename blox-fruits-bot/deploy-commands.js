require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID) {
  console.error('[ERROR] TOKEN and CLIENT_ID are required in .env');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
    console.log(`[CMD] Queued /${command.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log(`\n🔄 Registering ${commands.length} slash command(s)...`);

    if (GUILD_ID) {
      const data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} command(s) to guild ${GUILD_ID} (instant)`);
    } else {
      const data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Registered ${data.length} command(s) globally (up to 1 hour to appear)`);
    }
  } catch (err) {
    console.error('[ERROR] Failed to register commands:', err.message);
    process.exit(1);
  }
})();
