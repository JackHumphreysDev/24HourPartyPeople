#!/usr/bin/env bash

set -euo pipefail

cleanup() {
  npm run db:test:down >/dev/null 2>&1 || true
}

trap cleanup EXIT

npm run db:test:up
npm run db:test:deploy --workspace server
npm run test:workspaces
