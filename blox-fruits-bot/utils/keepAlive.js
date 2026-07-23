/**
 * Spins up a tiny HTTP server so Replit keeps the bot alive.
 * Point an external monitor (e.g. UptimeRobot) at the project URL / health.
 */
const http = require('http');

function startKeepAlive() {
  const PORT = process.env.PORT || 3000;

  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'online', bot: 'Blox Stock', time: new Date().toISOString() }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`[KEEP-ALIVE] HTTP server on port ${PORT} — GET /health to ping`);
  });

  return server;
}

module.exports = { startKeepAlive };
