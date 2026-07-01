#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
APP_DIR=${SCRIPT_DIR:h}
WEB_DIR=$APP_DIR/web
HOST=${FINANCE_AGENT_GUI_HOST:-127.0.0.1}
PORT=${FINANCE_AGENT_GUI_PORT:-5173}
NODE_BIN=${NODE_BIN:-}

if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN=$(command -v node || true)
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node.js executable not found. Set NODE_BIN or install Node.js." >&2
  exit 127
fi

cd "$WEB_DIR"
exec "$NODE_BIN" ./node_modules/vite/bin/vite.js --host "$HOST" --port "$PORT"
