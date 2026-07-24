require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs   = require('fs');
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
  console.log(`\n🔄 Registering ${commands.length} command(s)...`);

  // Register globally first so ALL servers get the commands
  try {
    const data = await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log(`✅ Registered ${data.length} command(s) globally (may take up to 1 hour to appear in all servers)`);
  } catch (err) {
    console.error('[ERROR] Global registration failed:', err.message);
    if (err.rawError) console.error('[DETAIL]', JSON.stringify(err.rawError, null, 2));
    process.exit(1);
  }

  // Also register to the dev guild for instant testing if GUILD_ID is set
  if (GUILD_ID) {
    try {
      const data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Also registered ${data.length} command(s) to dev guild ${GUILD_ID} (instant)`);
    } catch (err) {
      console.warn(`[WARN] Dev guild registration failed: ${err.message}`);
    }
  }
})();
