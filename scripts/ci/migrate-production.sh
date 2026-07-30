#!/usr/bin/env bash
set -euo pipefail

# A copy of this connection string in a repository secret drifts and silently
# migrates a database nobody serves, so read Vercel's production environment.
env_file=".vercel/.env.production.local"
if [[ ! -f "$env_file" ]]; then
    echo "::error::$env_file is missing. Run 'vercel pull --environment=production' before this step."
    exit 1
fi

set -a
# shellcheck source=/dev/null
. "$env_file"
set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "::error::The Vercel production environment does not define DATABASE_URL."
    exit 1
fi

pnpm db:migrate
