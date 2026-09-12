#!/usr/bin/env sh
# Runs one integrity tool (overlock, saidso, basting) as a Claude Code Stop hook.
#
# exec, so the tool's exit code is the hook's: 2 is what blocks a turn. A tool
# that is not installed never blocks — a fresh clone or a cloud session without
# `pnpm install` gets a note on stderr instead of a failing hook.
set -e

tool=$1
root=$(cd "$(dirname "$0")/../.." && pwd)
local_bin="$root/node_modules/.bin/$tool"

if [ -x "$local_bin" ]; then
  exec "$local_bin" hook claude
fi
if command -v "$tool" >/dev/null 2>&1; then
  exec "$tool" hook claude
fi

echo "$tool: not installed, so this turn was not checked (pnpm add -D $tool)." >&2
exit 0
