#!/usr/bin/env bash
# rebuild.ts 실행 + 타임스탬프 로그. 수동 or daily cron 호출용.
set -u
LOG="$HOME/.claude/scripts/da-vector/_rebuild.log"
echo "=== rebuild-batch $(date -Iseconds) ===" >> "$LOG"
cd "$HOME/.claude/scripts/da-vector" || exit 1
npx tsx rebuild.ts >> "$LOG" 2>&1
RET=$?
echo "=== end $(date -Iseconds) exit=$RET ===" >> "$LOG"
tail -5 "$LOG"
exit $RET
