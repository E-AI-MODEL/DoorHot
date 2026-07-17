#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_ADMIN_URL:?DATABASE_ADMIN_URL is required}"
: "${SOURCE_DATABASE:?SOURCE_DATABASE is required}"
: "${RESTORE_DATABASE:?RESTORE_DATABASE is required}"

for database_name in "$SOURCE_DATABASE" "$RESTORE_DATABASE"; do
  if [[ ! "$database_name" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; then
    echo "Invalid PostgreSQL database name: $database_name" >&2
    exit 2
  fi
done

if [[ "$SOURCE_DATABASE" == "$RESTORE_DATABASE" ]]; then
  echo "SOURCE_DATABASE and RESTORE_DATABASE must differ." >&2
  exit 2
fi

ARTIFACT_DIR="${RESTORE_DRILL_ARTIFACT_DIR:-artifacts/postgres-restore-drill}"
DUMP_PATH="$ARTIFACT_DIR/door010.dump"
RESULT_PATH="$ARTIFACT_DIR/result.json"
SUMMARY_PATH="$ARTIFACT_DIR/summary.md"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  psql "$DATABASE_ADMIN_URL" \
    --set ON_ERROR_STOP=1 \
    --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'restore_database' AND pid <> pg_backend_pid();" \
    --set restore_database="$RESTORE_DATABASE" >/dev/null 2>&1 || true
  psql "$DATABASE_ADMIN_URL" \
    --set ON_ERROR_STOP=1 \
    --command "DROP DATABASE IF EXISTS \"$RESTORE_DATABASE\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

database_url_for() {
  local database_name="$1"
  node --input-type=module - "$DATABASE_ADMIN_URL" "$database_name" <<'NODE'
const url = new URL(process.argv[2]);
url.pathname = `/${encodeURIComponent(process.argv[3])}`;
process.stdout.write(url.toString());
NODE
}

SOURCE_URL="$(database_url_for "$SOURCE_DATABASE")"
RESTORE_URL="$(database_url_for "$RESTORE_DATABASE")"

SOURCE_TABLE_COUNT="$(
  psql "$SOURCE_URL" --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
)"

SOURCE_SCHEMA_FINGERPRINT="$(
  psql "$SOURCE_URL" --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT md5(string_agg(table_name || ':' || column_name || ':' || data_type, ',' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema = 'public';"
)"

pg_dump "$SOURCE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$DUMP_PATH"

psql "$DATABASE_ADMIN_URL" \
  --set ON_ERROR_STOP=1 \
  --command "DROP DATABASE IF EXISTS \"$RESTORE_DATABASE\";"

psql "$DATABASE_ADMIN_URL" \
  --set ON_ERROR_STOP=1 \
  --command "CREATE DATABASE \"$RESTORE_DATABASE\" TEMPLATE template0;"

pg_restore "$RESTORE_URL" \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  "$DUMP_PATH"

RESTORE_TABLE_COUNT="$(
  psql "$RESTORE_URL" --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
)"

RESTORE_SCHEMA_FINGERPRINT="$(
  psql "$RESTORE_URL" --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT md5(string_agg(table_name || ':' || column_name || ':' || data_type, ',' ORDER BY table_name, ordinal_position)) FROM information_schema.columns WHERE table_schema = 'public';"
)"

MIGRATION_SMOKE="$(
  psql "$RESTORE_URL" --tuples-only --no-align --set ON_ERROR_STOP=1 \
    --command "SELECT CASE WHEN to_regclass('public.orchestration_runs') IS NOT NULL AND to_regclass('public.memory_graph_nodes') IS NOT NULL AND to_regclass('public.notification_outbox') IS NOT NULL THEN 'pass' ELSE 'fail' END;"
)"

STATUS="pass"
if [[ "$SOURCE_TABLE_COUNT" != "$RESTORE_TABLE_COUNT" ]]; then
  STATUS="fail"
fi
if [[ "$SOURCE_SCHEMA_FINGERPRINT" != "$RESTORE_SCHEMA_FINGERPRINT" ]]; then
  STATUS="fail"
fi
if [[ "$MIGRATION_SMOKE" != "pass" ]]; then
  STATUS="fail"
fi

COMPLETED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DUMP_BYTES="$(wc -c < "$DUMP_PATH" | tr -d ' ')"

cat > "$RESULT_PATH" <<JSON
{
  "status": "$STATUS",
  "startedAt": "$STARTED_AT",
  "completedAt": "$COMPLETED_AT",
  "sourceDatabase": "$SOURCE_DATABASE",
  "restoreDatabase": "$RESTORE_DATABASE",
  "sourceTableCount": $SOURCE_TABLE_COUNT,
  "restoreTableCount": $RESTORE_TABLE_COUNT,
  "sourceSchemaFingerprint": "$SOURCE_SCHEMA_FINGERPRINT",
  "restoreSchemaFingerprint": "$RESTORE_SCHEMA_FINGERPRINT",
  "migrationSmoke": "$MIGRATION_SMOKE",
  "dumpBytes": $DUMP_BYTES
}
JSON

cat > "$SUMMARY_PATH" <<MARKDOWN
- Status: **$STATUS**
- Source database: \`$SOURCE_DATABASE\`
- Temporary restore database: \`$RESTORE_DATABASE\`
- Source tables: $SOURCE_TABLE_COUNT
- Restored tables: $RESTORE_TABLE_COUNT
- Schema fingerprint matched: $([[ "$SOURCE_SCHEMA_FINGERPRINT" == "$RESTORE_SCHEMA_FINGERPRINT" ]] && echo yes || echo no)
- Required-table smoke test: $MIGRATION_SMOKE
- Dump size: $DUMP_BYTES bytes
- Completed: $COMPLETED_AT
MARKDOWN

cat "$RESULT_PATH"

if [[ "$STATUS" != "pass" ]]; then
  exit 1
fi
