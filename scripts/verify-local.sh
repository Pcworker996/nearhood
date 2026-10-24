#!/usr/bin/env bash
# Runs every local gate. The browser suite gets a disposable database because
# Reports left by earlier runs accumulate in nearhood_test and eventually cover
# seeded map markers.
set -uo pipefail

cd "$(dirname "$0")/.."

host=127.0.0.1
port=${PGPORT:-55432}
db="nearhood_verify_$(date +%Y%m%d%H%M%S)"
logs=.local/verify
status=0
mkdir -p "$logs"

if ! pg_isready -h "$host" -p "$port" >/dev/null; then
  echo "PostgreSQL is not accepting connections on $host:$port. Start it as described in README.md." >&2
  exit 1
fi

gate() {
  local name=$1
  shift
  if "$@" >"$logs/$name.log" 2>&1; then
    echo "PASS  $name"
  else
    echo "FAIL  $name  ($logs/$name.log)"
    status=1
  fi
}

browser() {
  local attempt
  for attempt in 1 2; do
    TEST_DATABASE_URL="postgresql://$host:$port/$db" npx playwright test --reporter=list "$@" \
      >"$logs/browser.log" 2>&1 && return 0
    # next dev exits on alternate launches to print its upgrade advisory; only that case is retried.
    grep -q "stopped to show the upgrade recommendation" "$logs/browser.log" || return 1
  done
  return 1
}

gate typecheck npm run typecheck
gate test-model npm run test:model
gate test-extraction npm run test:extraction
gate test-review-set npm run test:review-set

createdb -h "$host" -p "$port" "$db"
trap 'dropdb -h "$host" -p "$port" --if-exists "$db"' EXIT
gate test-lease env DATABASE_URL="postgresql://$host:$port/$db" \
  bash -c 'npm run db:setup && npm run test:lease'
if browser "$@"; then
  echo "PASS  browser"
else
  echo "FAIL  browser  ($logs/browser.log)"
  status=1
fi
grep -E "^\s+[0-9]+ (passed|failed|flaky|skipped)" "$logs/browser.log"

exit $status
