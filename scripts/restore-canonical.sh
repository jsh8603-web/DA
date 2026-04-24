#!/usr/bin/env bash
# ~/.claude/scripts/da-vector/restore-canonical.sh
# 사용법: bash restore-canonical.sh [backup-date]
# 예시:  bash restore-canonical.sh 2026-04-22-pre-da
# 인자 없으면 최신 backup 자동 선택

set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
BACKUP_BASE="${CLAUDE_DIR}/docs/backup"

if [[ $# -ge 1 ]]; then
  BACKUP_DATE="$1"
  BACKUP_DIR="${BACKUP_BASE}/${BACKUP_DATE}"
else
  # 최신 backup 자동 선택
  BACKUP_DIR=$(ls -dt "${BACKUP_BASE}"/2*-pre-da 2>/dev/null | head -1)
  if [[ -z "$BACKUP_DIR" ]]; then
    echo "[restore] ERROR: No backup found in ${BACKUP_BASE}" >&2
    exit 1
  fi
  BACKUP_DATE=$(basename "$BACKUP_DIR")
fi

echo "[restore] Using backup: ${BACKUP_DIR}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "[restore] ERROR: Backup directory not found: ${BACKUP_DIR}" >&2
  exit 1
fi

# sha256 검증 (hashlist.txt 존재 시)
HASHLIST="${BACKUP_DIR}/hashlist.txt"
if [[ -f "$HASHLIST" ]]; then
  echo "[restore] Verifying sha256 checksums..."
  pushd "$BACKUP_DIR" > /dev/null
  sha256sum -c hashlist.txt --quiet 2>/dev/null || {
    echo "[restore] WARNING: sha256 mismatch detected. Proceeding anyway." >&2
  }
  popd > /dev/null
fi

# CLAUDE.md 복원
if [[ -f "${BACKUP_DIR}/CLAUDE.md" ]]; then
  cp "${BACKUP_DIR}/CLAUDE.md" "${CLAUDE_DIR}/CLAUDE.md"
  echo "[restore] ✓ CLAUDE.md restored"
fi

# rules/*.md 복원
if [[ -d "${BACKUP_DIR}/rules" ]]; then
  cp -r "${BACKUP_DIR}/rules/." "${CLAUDE_DIR}/rules/"
  echo "[restore] ✓ rules/ restored ($(ls ${BACKUP_DIR}/rules/*.md 2>/dev/null | wc -l) files)"
fi

# .mirror-state.json 삭제 (auto-render 상태 초기화)
rm -f "${CLAUDE_DIR}/decisions/.mirror-state.json"
echo "[restore] ✓ .mirror-state.json cleared"

echo "[restore] ✅ Restore complete from ${BACKUP_DATE}"
echo "[restore] Original rules/*.md and CLAUDE.md are now active."
