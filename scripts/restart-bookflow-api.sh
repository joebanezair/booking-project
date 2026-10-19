#!/usr/bin/env bash
# Restart only this checkout's API process on port 5000 in Codespaces/Linux.
# Other processes that happen to own the port are never terminated.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
server_dir="$root/server"
port="${PORT:-5000}"

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to safely identify the existing API process." >&2
  echo "Stop the old backend using Ctrl+C, then run: cd server && npm run dev" >&2
  exit 1
fi
pids="$(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
for pid in $pids; do
  [[ -d "/proc/$pid" ]] || continue
  command_line="$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)"
  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
  if [[ "$cwd" != "$server_dir" || "$command_line" != *"server.js"* ]]; then
    echo "Refusing to terminate PID $pid: port $port is owned by another command ($command_line, cwd $cwd)." >&2
    exit 1
  fi
  parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  if [[ "$parent" =~ ^[0-9]+$ && -d "/proc/$parent" ]]; then
    parent_command="$(tr '\0' ' ' < "/proc/$parent/cmdline" 2>/dev/null || true)"
    parent_dir="$(readlink -f "/proc/$parent/cwd" 2>/dev/null || true)"
    if [[ "$parent_dir" == "$server_dir" && "$parent_command" == *"nodemon"* ]]; then
      echo "Stopping this checkout's nodemon supervisor (PID $parent)"
      kill -TERM "$parent" 2>/dev/null || true
    fi
  fi
  echo "Stopping stale BookFlow API (PID $pid)"
  kill -TERM "$pid" 2>/dev/null || true
done

for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if ! lsof -t -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 1
done
if lsof -t -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $port is still occupied. Stop the old terminal/nodemon process with Ctrl+C." >&2
  exit 1
fi
cd "$server_dir"
echo "Starting updated BookFlow API on port $port using server/.env"
exec npm run dev
