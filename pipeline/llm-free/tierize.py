"""coverage-ratio 기반 tier 분류.

입력: lexicon-nl-grammar.v1.yaml (정규화된)
출력: lexicon-nl-grammar.v1-tiered.yaml (tier 필드 추가)

정책 (normalization-rules.yaml §7 tier_strategy):
- Tier 1: 전체 occurrences 누적 0-70% (core, auto-inject 후보)
- Tier 2: 70-90% (reference)
- Tier 3: 90-100% (domain-specific, long-tail)
- per_da_field_min = 3: connective 의 경우 각 da_field 최소 top-3 는 Tier 1 보장
"""
import os, sys, yaml
from collections import defaultdict

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'lexicon-nl-grammar.v1.yaml')
OUT = SRC.replace('.yaml', '-tiered.yaml')

doc = yaml.safe_load(open(SRC, encoding='utf-8'))

def tierize_simple(items):
    """단순 coverage-ratio — verbs/endings 용."""
    items = sorted(items, key=lambda x: -x['occurrences'])
    total = sum(x['occurrences'] for x in items) or 1
    cum = 0
    for x in items:
        cum += x['occurrences']
        pct = cum / total * 100
        if pct <= 70:
            x['tier'] = 1
        elif pct <= 90:
            x['tier'] = 2
        else:
            x['tier'] = 3
    return items

def tierize_with_per_group_min(items, group_key, min_per_group=3):
    """connective 용 — 각 da_field 최소 top-N 보장."""
    items = sorted(items, key=lambda x: -x['occurrences'])
    total = sum(x['occurrences'] for x in items) or 1
    # 먼저 global cumulative 기반 할당
    cum = 0
    for x in items:
        cum += x['occurrences']
        pct = cum / total * 100
        if pct <= 70:
            x['tier'] = 1
        elif pct <= 90:
            x['tier'] = 2
        else:
            x['tier'] = 3
    # 그 다음 per-group top-N 를 Tier 1 로 강제 승격
    by_group = defaultdict(list)
    for x in items:
        by_group[x.get(group_key)].append(x)
    promoted = []
    for g, glist in by_group.items():
        top = glist[:min_per_group]
        for x in top:
            if x['tier'] != 1:
                x['tier'] = 1
                promoted.append(f"{x['text']} (promoted from T2/3 by {group_key}={g})")
    return items, promoted

doc['verbs'] = tierize_simple(doc['verbs'])
doc['endings'] = tierize_simple(doc['endings'])
doc['connectives'], promoted = tierize_with_per_group_min(doc['connectives'], 'da_field', 3)

# Tier 분포 통계
from collections import Counter
stats = {
    'verbs_by_tier': dict(Counter(x['tier'] for x in doc['verbs'])),
    'endings_by_tier': dict(Counter(x['tier'] for x in doc['endings'])),
    'connectives_by_tier': dict(Counter(x['tier'] for x in doc['connectives'])),
    'connective_promotions': len(promoted),
}
doc.setdefault('stats', {}).update({'tier_distribution': stats})

with open(OUT, 'w', encoding='utf-8') as fh:
    yaml.safe_dump(doc, fh, allow_unicode=True, sort_keys=False, width=200)

print(f'wrote {OUT}')
print(f'tier distribution:')
for k, v in stats.items():
    print(f'  {k}: {v}')
if promoted:
    print(f'  promotions (per_da_field_min=3):')
    for p in promoted[:10]:
        print(f'    - {p}')
