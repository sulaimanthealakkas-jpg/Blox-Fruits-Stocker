const http  = require('http');
const https = require('https');

const PING_INTERVAL_MS = 4 * 60 * 1000;

function startKeepAlive() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status:  'online',
      bot:     'Blox Stock',
      time:    new Date().toISOString(),
      uptime:  Math.floor(process.uptime()) + 's',
    }));
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[KEEP-ALIVE] HTTP server on port ${PORT}`);
  });

  const replitDomain =
    process.env.REPLIT_DEV_DOMAIN ||
    (process.env.REPLIT_DOMAINS && process.env.REPLIT_DOMAINS.split(',')[0]) ||
    null;

  if (replitDomain) {
    const pingUrl = `https://${replitDomain}/health`;
    console.log(`[KEEP-ALIVE] Self-ping every 4 min → ${pingUrl}`);

    const doPing = () => {
      https.get(pingUrl, (res) => {
        res.resume();
        console.log(`[KEEP-ALIVE] Ping OK (${res.statusCode})`);
      }).on('error', (err) => {
        console.warn('[KEEP-ALIVE] Ping failed:', err.message);
      });
    };

    setTimeout(doPing, 30_000);
    setInterval(doPing, PING_INTERVAL_MS);
  } else {
    const doLocalPing = () => {
      http.get(`http://localhost:${PORT}/health`, (res) => {
        res.resume();
      }).on('error', () => {});
    };
    setTimeout(doLocalPing, 30_000);
    setInterval(doLocalPing, PING_INTERVAL_MS);
    console.log('[KEEP-ALIVE] No REPLIT_DEV_DOMAIN found — pinging localhost');
    console.log('[KEEP-ALIVE] For 24/7 uptime, point UptimeRobot at your Replit project URL /health');
  }

  return server;
}

module.exports = { startKeepAlive };
