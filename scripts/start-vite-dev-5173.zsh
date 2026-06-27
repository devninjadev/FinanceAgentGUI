#!/bin/zsh
set -euo pipefail

SCRIPT_DIR=${0:A:h}
WEB_DIR=${SCRIPT_DIR:h}/web
NODE_BIN=${NODE_BIN:-/usr/local/bin/node}

cd "$WEB_DIR"
exec "$NODE_BIN" ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
