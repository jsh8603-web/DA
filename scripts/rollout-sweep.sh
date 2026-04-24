#!/usr/bin/env bash
# rollout-sweep.sh — corpus-list.txt 의 37 파일 순회, rule-check 결과를 JSON 으로 집계
# 출력: ~/.claude/scripts/da-vector/_rollout_unmatched_baseline.json
set -u

CORPUS="$HOME/.claude/scripts/da-vector/llm-free/corpus-list.txt"
OUT="$HOME/.claude/scripts/da-vector/_rollout_unmatched_baseline.json"
MD_TO_DA="$HOME/.claude/scripts/da-vector/md-to-da.ts"

if [ ! -f "$CORPUS" ]; then
  echo "ERROR: corpus missing — $CORPUS" >&2
  exit 1
fi

echo '{"date":"'$(date -Iseconds)'","files":[' > "$OUT"
first=1
total_files=0
total_unmatched=0

cd "$HOME/.claude/scripts/da-vector" || exit 1

while IFS=$'\t' read -r size rel || [ -n "$rel" ]; do
  [ -z "$rel" ] && continue
  full="$HOME/.claude/$rel"
  if [ ! -f "$full" ]; then
    echo "WARN: missing $rel" >&2
    continue
  fi
  out=$(npx tsx "$MD_TO_DA" "$full" --rule-check 2>&1 || true)
  n=$(echo "$out" | grep -oE 'total: [0-9]+ sentences, [0-9]+ unmatched' | grep -oE '[0-9]+ unmatched' | grep -oE '[0-9]+' | head -1)
  [ -z "$n" ] && n=0
  s=$(echo "$out" | grep -oE 'total: [0-9]+ sentences' | grep -oE '[0-9]+' | head -1)
  [ -z "$s" ] && s=0
  [ $first -eq 0 ] && echo ',' >> "$OUT"
  printf '{"file":"%s","sentences":%s,"unmatched":%s}' "$rel" "$s" "$n" >> "$OUT"
  first=0
  total_files=$((total_files + 1))
  total_unmatched=$((total_unmatched + n))
  echo "[$total_files] $rel — $n/$s unmatched" >&2
done < "$CORPUS"

echo '],"summary":{"files":'"$total_files"',"total_unmatched":'"$total_unmatched"'}}' >> "$OUT"
echo "" >&2
echo "=== SUMMARY === files=$total_files total_unmatched=$total_unmatched" >&2
echo "OUT: $OUT" >&2
