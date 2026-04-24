#!/usr/bin/env bash
# rollout-structure-sweep.sh — corpus-list.txt + 확장 타겟 파일들에 대해
# --structure-check (S1-S4) 집계를 JSON 으로 생성.
# 출력: ~/.claude/scripts/da-vector/_structure_baseline.json
#
# plan-da-coverage-extension.md Phase A.3 산출.
set -u

CORPUS="$HOME/.claude/scripts/da-vector/llm-free/corpus-list.txt"
OUT="$HOME/.claude/scripts/da-vector/_structure_baseline.json"
MD_TO_DA="$HOME/.claude/scripts/da-vector/md-to-da.ts"

# 보조 인자: 추가 경로를 공백 구분으로 받을 수 있음 (skills 등 corpus 외 파일 포함용)
# Usage: rollout-structure-sweep.sh [extra-md-path ...]
EXTRA_PATHS=("$@")

if [ ! -f "$CORPUS" ]; then
  echo "ERROR: corpus missing — $CORPUS" >&2
  exit 1
fi

echo '{"date":"'$(date -Iseconds)'","mode":"structure","files":[' > "$OUT"
first=1
total_files=0
total_violations=0
# violation code 별 카운트
count_S1=0
count_S2=0
count_S3=0
count_S4=0

cd "$HOME/.claude/scripts/da-vector" || exit 1

process_file() {
  local full="$1"
  local rel="$2"
  if [ ! -f "$full" ]; then
    echo "WARN: missing $rel" >&2
    return
  fi
  local out
  out=$(npx tsx "$MD_TO_DA" "$full" --structure-check 2>&1 || true)
  # JSON block 만 추출 ({..} 처음부터 끝까지)
  local json
  json=$(echo "$out" | awk 'BEGIN{p=0} /^\{/{p=1} p==1{print} /^\}$/{p=0}')
  if [ -z "$json" ]; then
    json='{"file":"'"$rel"'","error":"parse_fail","violations":[],"totalViolations":0}'
  fi
  local n
  n=$(echo "$json" | grep -oE '"totalViolations": [0-9]+' | grep -oE '[0-9]+' | head -1)
  [ -z "$n" ] && n=0

  # violation code 별 카운트
  local cS1 cS2 cS3 cS4
  cS1=$(echo "$json" | grep -cE '"code":\s*"S1"' || true)
  cS2=$(echo "$json" | grep -cE '"code":\s*"S2"' || true)
  cS3=$(echo "$json" | grep -cE '"code":\s*"S3"' || true)
  cS4=$(echo "$json" | grep -cE '"code":\s*"S4"' || true)
  count_S1=$((count_S1 + cS1))
  count_S2=$((count_S2 + cS2))
  count_S3=$((count_S3 + cS3))
  count_S4=$((count_S4 + cS4))

  # file 필드를 상대경로로 교체 + 결과 append
  local entry
  entry=$(echo "$json" | node -e "
let d='';
process.stdin.on('data', c=>d+=c);
process.stdin.on('end', ()=>{
  try { const j = JSON.parse(d); j.file = '$rel'; process.stdout.write(JSON.stringify(j)); }
  catch(e) { process.stdout.write(JSON.stringify({file:'$rel',error:'parse_fail'})); }
});
" 2>/dev/null)
  [ -z "$entry" ] && entry='{"file":"'"$rel"'","error":"empty"}'

  [ $first -eq 0 ] && echo ',' >> "$OUT"
  printf '%s' "$entry" >> "$OUT"
  first=0
  total_files=$((total_files + 1))
  total_violations=$((total_violations + n))
  echo "[$total_files] $rel — $n violations (S1=$cS1 S2=$cS2 S3=$cS3 S4=$cS4)" >&2
}

# 1. corpus-list.txt 파일들
while IFS=$'\t' read -r size rel || [ -n "$rel" ]; do
  [ -z "$rel" ] && continue
  full="$HOME/.claude/$rel"
  process_file "$full" "$rel"
done < "$CORPUS"

# 2. 추가 경로 (skills 등)
for extra in "${EXTRA_PATHS[@]}"; do
  [ -z "$extra" ] && continue
  # 절대경로 / ~ / 상대경로 모두 대응
  if [[ "$extra" == ~* ]]; then
    full="${extra/#\~/$HOME}"
  elif [[ "$extra" = /* ]]; then
    full="$extra"
  else
    full="$HOME/.claude/$extra"
  fi
  # rel path (for JSON file field)
  rel="${full#$HOME/.claude/}"
  process_file "$full" "$rel"
done

echo '],"summary":{"files":'$total_files',"total_violations":'$total_violations',"S1_no_da_section":'$count_S1',"S2_incomplete_da":'$count_S2',"S3_narrative_overflow":'$count_S3',"S4_orphan_heading":'$count_S4'}}' >> "$OUT"
echo "" >&2
echo "=== SUMMARY === files=$total_files total_violations=$total_violations" >&2
echo "  S1 no-DA-section: $count_S1" >&2
echo "  S2 incomplete-DA: $count_S2" >&2
echo "  S3 narrative-overflow: $count_S3" >&2
echo "  S4 orphan-heading: $count_S4" >&2
echo "OUT: $OUT" >&2
