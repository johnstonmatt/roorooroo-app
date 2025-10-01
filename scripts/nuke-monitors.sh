#!/usr/bin/env bash
set -euo pipefail

# Nuke monitors, cron jobs, logs, notifications, and optionally sms_usage.
#
# Usage:
#   DB_URL=${DB_URL:?set_db_url} ./scripts/nuke-monitors.sh [--dry-run|--execute] [--scope=all|monitors|cron] [--keep-sms-usage] [--keep-cron]
#
# Safety:
# - Default is --dry-run (prints counts only).
# - To actually apply, pass --execute AND set NUKE_CONFIRM=YES in the environment.
# - Secrets must be provided via environment variables; do not echo them.
#
# Examples:
#   # Dry run (recommended first)
#   # DB_URL should be retrieved from your secret manager; do not paste it in plaintext.
#   # export DB_URL=$(secret_manager --secret-name=SUPABASE_DB_URL)
#   DB_URL="$DB_URL" ./scripts/nuke-monitors.sh --dry-run --scope=all
#
#   # Execute (dangerous!)
#   NUKE_CONFIRM=YES DB_URL="$DB_URL" ./scripts/nuke-monitors.sh --execute --scope=all
#

usage() {
  cat <<'EOF'
Nuke monitors/cron state in the database.

Flags:
  --dry-run            Show counts and planned actions (default)
  --execute            Perform destructive changes (requires NUKE_CONFIRM=YES)
  --scope=all          Nuke cron jobs, monitors (cascades logs/notifications), and sms_usage (default)
  --scope=monitors     Nuke cron jobs and monitors (cascades logs/notifications); keep sms_usage
  --scope=cron         Only unschedule monitor_check cron jobs
  --keep-sms-usage     Do not truncate sms_usage even when --scope=all
  --keep-cron          Do not unschedule monitor_check cron jobs (use with caution)
  -h, --help           Show this help

Environment:
  DB_URL         Postgres connection string (e.g. from Supabase)
  NUKE_CONFIRM   Must be set to YES when using --execute

EOF
}

SCOPE="all"
DRY_RUN=1
KEEP_SMS=0
KEEP_CRON=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --execute) DRY_RUN=0 ;;
    --scope=*) SCOPE="${arg#*=}" ;;
    --keep-sms-usage) KEEP_SMS=1 ;;
    --keep-cron) KEEP_CRON=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg"; usage; exit 1 ;;
  esac
done

if [[ -z "${DB_URL:-}" ]]; then
  echo "ERROR: DB_URL is not set. Export it from your secret manager and retry." >&2
  exit 1
fi

if [[ $DRY_RUN -eq 0 ]]; then
  if [[ "${NUKE_CONFIRM:-}" != "YES" ]]; then
    echo "Refusing to execute without NUKE_CONFIRM=YES" >&2
    exit 1
  fi
fi

# Helper to run SQL safely
run_sql() {
  local label="$1"; shift
  echo "==> $label"
  PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -c "$*"
}

run_sql_file() {
  local label="$1"; shift
  echo "==> $label"
  PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
SELECT 'Preflight check: extensions' AS section,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')       AS has_pg_cron,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')        AS has_pg_net,
       EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') AS has_vault;

SELECT 'Preflight counts' AS section,
       CASE WHEN to_regclass('public.monitors') IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM public.monitors) END AS monitors,
       CASE WHEN to_regclass('public.monitor_logs') IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM public.monitor_logs) END AS monitor_logs,
       CASE WHEN to_regclass('public.notifications') IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM public.notifications) END AS notifications,
       CASE WHEN to_regclass('cron.job') IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM cron.job WHERE jobname LIKE 'monitor_check_%') END AS cron_jobs,
       CASE WHEN to_regclass('public.sms_usage') IS NULL THEN NULL ELSE (SELECT COUNT(*) FROM public.sms_usage) END AS sms_usage;
SQL
}

# Preflight
run_sql_file "Preflight (counts and extensions)"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run complete. No changes made."
  echo "Planned actions:"
  if [[ $KEEP_CRON -eq 0 ]]; then
    echo " - Unschedule cron jobs named monitor_check_%"
  else
    echo " - (skip) Unschedule cron jobs"
  fi
  case "$SCOPE" in
    all)
      echo " - Delete all monitors (cascades logs/notifications)"
      if [[ $KEEP_SMS -eq 0 ]]; then echo " - Truncate sms_usage"; else echo " - (skip) Truncate sms_usage"; fi
      ;;
    monitors)
      echo " - Delete all monitors (cascades logs/notifications)"
      ;;
    cron)
      echo " - No table deletions (cron-only)"
      ;;
    *)
      echo "ERROR: Unknown scope '$SCOPE'" >&2; exit 1
      ;;
  esac
  exit 0
fi

# Execute destructive operations

# 1) Unschedule cron jobs (unless skipped)
if [[ $KEEP_CRON -eq 0 ]]; then
  echo "==> Unscheduling monitor_check_* cron jobs"
  PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
DO $$
DECLARE r RECORD;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    FOR r IN SELECT jobname FROM cron.job WHERE jobname LIKE 'monitor_check_%' LOOP
      PERFORM cron.unschedule(r.jobname);
    END LOOP;
  END IF;
END $$;
SQL
else
  echo "==> Skipping cron.unschedule per --keep-cron"
fi

# 2) Table deletions based on scope
case "$SCOPE" in
  all)
    echo "==> Deleting monitors (cascades logs/notifications)"
    PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
BEGIN;
  IF to_regclass('public.monitors') IS NOT NULL THEN
    DELETE FROM public.monitors;
  END IF;
COMMIT;
SQL
    if [[ $KEEP_SMS -eq 0 ]]; then
      echo "==> Truncating sms_usage"
      PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
BEGIN;
  IF to_regclass('public.sms_usage') IS NOT NULL THEN
    TRUNCATE TABLE public.sms_usage RESTART IDENTITY;
  END IF;
COMMIT;
SQL
    else
      echo "==> Skipping sms_usage per --keep-sms-usage"
    fi
    ;;
  monitors)
    echo "==> Deleting monitors (cascades logs/notifications)"
    PGPASSWORD= psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q <<'SQL'
BEGIN;
  IF to_regclass('public.monitors') IS NOT NULL THEN
    DELETE FROM public.monitors;
  END IF;
COMMIT;
SQL
    ;;
  cron)
    echo "==> Scope=cron only; no table deletions"
    ;;
  *)
    echo "ERROR: Unknown scope '$SCOPE'" >&2; exit 1
    ;;
esac

# 3) Postflight counts
run_sql_file "Postflight (counts)"

echo "Nuke completed."
