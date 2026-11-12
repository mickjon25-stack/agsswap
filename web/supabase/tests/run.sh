#!/bin/bash
# Local migration + grant/RLS test against a throwaway Postgres 17 (no Supabase
# project needed). Simulates a NEW Supabase project (no automatic Data API
# grants), applies every migration in order (009 aborts on any grant gap),
# then runs 87 role-by-role app-flow checks.
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DB="${TEST_DB:-agsswap_test}"
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/00_supabase_stub.sql"
for f in "$HERE"/../migrations/*.sql; do
  echo "== $(basename "$f")"
  psql -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1 | grep -v 'does not exist, skipping' || true
done
psql -d "$DB" -q -f "$HERE/10_flow_tests.sql" 2>&1 | grep -E 'FAIL|passed|^ +[0-9]+ \|' | grep -v PASS
