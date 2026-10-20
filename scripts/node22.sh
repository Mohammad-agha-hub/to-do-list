#!/usr/bin/env sh
# Runs a Node script with Node >= 22 (needed by wrangler / OpenNext).
# Uses the installed node if it's new enough, otherwise a cached Node 22 via npx.
major=$(node -p "process.versions.node.split('.')[0]")
if [ "$major" -ge 22 ]; then exec node "$@"; else exec npx -y node@22 "$@"; fi
