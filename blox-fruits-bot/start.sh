#!/bin/bash
# Keeps the bot running forever — restarts automatically after any crash.
echo "[BOT] Starting Blox Fruits Stock Bot..."
while true; do
  node index.js
  EXIT=$?
  echo ""
  echo "[BOT] Process exited with code $EXIT at $(date -u). Restarting in 5 seconds..."
  sleep 5
done
