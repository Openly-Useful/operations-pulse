#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

if [[ ! -f packages/core/dist/cli.js ]]; then
  echo "Operations Pulse runtime is unavailable. From a source checkout run: npm install && npm run build" >&2
  exit 1
fi

node packages/core/dist/cli.js pulse run --root "${1:-.}"
