#!/usr/bin/env bash
# ============================================================================
# backup-supabase.sh — Backup toàn bộ database Supabase (pg_dump → gzip)
# ----------------------------------------------------------------------------
# Cách dùng:
#   1) Cài postgresql-client:   sudo apt-get install -y postgresql-client
#   2) Đặt biến DATABASE_URL (đầy đủ, KHÔNG commit):
#        export DATABASE_URL="postgresql://postgres.gjavupiyrnuwtersagnw:<DB_PASSWORD>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"
#   3) Chạy:  ./scripts/backup-supabase.sh
#
#   (Hoặc dùng SUPABASE_DB_PASSWORD + SUPABASE_REF để script tự dựng URL.)
# ============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
REF="${SUPABASE_REF:-gjavupiyrnuwtersagnw}"
HOST="aws-0-ap-northeast-2.pooler.supabase.com"

# Dựng DATABASE_URL nếu chưa có
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
    echo "❌ Thiếu DATABASE_URL (hoặc SUPABASE_DB_PASSWORD). Xem hướng dẫn đầu file." >&2
    exit 1
  fi
  DATABASE_URL="postgresql://postgres.${REF}:${SUPABASE_DB_PASSWORD}@${HOST}:5432/postgres"
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/agri_${REF}_${STAMP}.sql.gz"

echo "🔒 Đang backup database $REF → $OUT ..."
pg_dump "$DATABASE_URL" \
  --no-owner --no-privileges --clean --if-exists \
  | gzip > "$OUT"

echo "✅ Backup xong: $OUT ($(du -h "$OUT" | cut -f1))"
echo "   (để khôi phục: gunzip -c \"$OUT\" | psql \"$DATABASE_URL\")"
