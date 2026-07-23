const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'guilds');

const DEFAULTS = {
  rollCooldownHours: 2,
  stockChannelId:    null,   // channel to post auto-stock updates
  aiChannels:        {},     // userId → channelId
};

function configPath(guildId) {
  return path.join(DATA_DIR, guildId, 'config.json');
}

function getConfig(guildId) {
  const p = configPath(guildId);
  if (!fs.existsSync(p)) return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, 'utf-8')) }; }
  catch { return { ...DEFAULTS }; }
}

function saveConfig(guildId, cfg) {
  const p = configPath(guildId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
}

function setRollCooldown(guildId, hours) {
  const cfg = getConfig(guildId);
  cfg.rollCooldownHours = hours;
  saveConfig(guildId, cfg);
}

function setStockChannel(guildId, channelId) {
  const cfg = getConfig(guildId);
  cfg.stockChannelId = channelId;
  saveConfig(guildId, cfg);
}

function getRollCooldownMs(guildId) {
  const cfg = getConfig(guildId);
  return (cfg.rollCooldownHours || 2) * 60 * 60 * 1000;
}

module.exports = { getConfig, saveConfig, setRollCooldown, setStockChannel, getRollCooldownMs };
