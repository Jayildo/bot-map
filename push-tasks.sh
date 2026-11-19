#!/usr/bin/env bash
# Usage: push-tasks.sh <bot-slug> <json-file>
#
# Required:
#   BOT_MAP_URL              Deployed origin, e.g. https://your-app.vercel.app
# And one of:
#   TASKS_WRITE_SECRET       Shared write secret (same as the Vercel env var)
#   TASKS_WRITE_SECRET_FILE  Path to a file containing that secret (one line)
set -euo pipefail

slug="${1:?usage: push-tasks.sh <bot-slug> <json-file>}"
file="${2:?usage: push-tasks.sh <bot-slug> <json-file>}"

if [[ -z "${BOT_MAP_URL:-}" ]]; then
  echo "Set BOT_MAP_URL to your deployed origin, e.g. https://your-app.vercel.app" >&2
  exit 1
fi

secret="${TASKS_WRITE_SECRET:-}"
if [[ -z "$secret" ]]; then
  if [[ -n "${TASKS_WRITE_SECRET_FILE:-}" && -f "$TASKS_WRITE_SECRET_FILE" ]]; then
    secret="$(tr -d '\n' < "$TASKS_WRITE_SECRET_FILE")"
  else
    echo "Set TASKS_WRITE_SECRET or TASKS_WRITE_SECRET_FILE" >&2
    exit 1
  fi
fi

python3 -c "import json,sys;d=json.load(open(sys.argv[1]));assert d.get('slug',sys.argv[2])==sys.argv[2],'slug mismatch';assert isinstance(d.get('tasks'),list)" "$file" "$slug"

base="${BOT_MAP_URL%/}"
out="/tmp/push-tasks-${slug}.out"
code="$(
  curl -s -o "$out" -w '%{http_code}' -X PUT "${base}/api/tasks/${slug}" \
    -H "Authorization: Bearer ${secret}" \
    -H 'Content-Type: application/json' \
    --data-binary @"$file"
)"
echo "PUT ${slug} -> ${code}"
[[ "$code" == "200" ]]
