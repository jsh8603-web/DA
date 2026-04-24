"""normalization-rules.yaml 적용 → lexicon-nl-grammar.v1.yaml 생성.

입력: lexicon-nl-grammar.draft-v0.5.yaml + normalization-rules.yaml
출력: lexicon-nl-grammar.v1.yaml (정규화된 버전, tier 분류 전)
"""
import os, yaml
from copy import deepcopy

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'lexicon-nl-grammar.draft-v0.5.yaml')
RULES = os.path.join(ROOT, 'normalization-rules.yaml')
OUT = os.path.join(ROOT, 'lexicon-nl-grammar.v1.yaml')

src = yaml.safe_load(open(SRC, encoding='utf-8'))
rules = yaml.safe_load(open(RULES, encoding='utf-8'))

verbs = {v['stem']: dict(v) for v in src['verbs']}
endings = {e['text']: dict(e) for e in src['endings']}
connectives = {c['text']: dict(c) for c in src['connectives']}

# rules/*.md 에서 등장 여부 판정용 (저빈도 잡음 제거 시 보존 대상)
# 실제로 source yaml 에 path 정보 없음 → file_coverage + 원래 source group 사용 어려움
# 단순화: 저빈도 제거 시 has_da_sections 관계 없이 occ<=1 AND cov<=1 만 기준

def merge_entry(dst_dict, canonical, alias, cat):
    """alias 항목을 canonical 에 병합 후 alias 제거."""
    if alias not in dst_dict or canonical not in dst_dict:
        return
    a = dst_dict[alias]
    c = dst_dict[canonical]
    c['occurrences'] += a.get('occurrences', 0)
    c['file_coverage'] = max(c.get('file_coverage', 0), a.get('file_coverage', 0))
    if cat == 'verbs':
        c['forms'] = sorted(set(c.get('forms', []) + a.get('forms', [])))
    del dst_dict[alias]

report = {'moves': [], 'removes': [], 'remaps': [], 'merges': []}

# (1) Category 교정: endings → connectives (modality 이상치 중 connective 성질)
for item in rules.get('move_endings_to_connectives', []) or []:
    t = item['text']
    if t in endings:
        e = endings.pop(t)
        connectives[t] = {
            'text': t,
            'da_field': item['new_da_field'],
            'occurrences': e['occurrences'],
            'file_coverage': e['file_coverage'],
        }
        report['moves'].append(f"endings→connectives: {t} → da_field={item['new_da_field']}")

# (1b) connective → endings 이동
for item in rules.get('move_connectives_to_endings', []) or []:
    t = item['text']
    if t in connectives:
        c = connectives.pop(t)
        endings[t] = {
            'text': t,
            'modality': item['new_modality'],
            'occurrences': c['occurrences'],
            'file_coverage': c['file_coverage'],
        }
        report['moves'].append(f"connectives→endings: {t} → modality={item['new_modality']}")

# (2) Connective 제거 (modality marker 본질)
for t in rules.get('remove_connectives', []) or []:
    if t in connectives:
        del connectives[t]
        report['removes'].append(f"connective removed: {t}")

# (3) Modality 재매핑 (endings in-place)
for t, new_m in (rules.get('remap_modality') or {}).items():
    if t in endings:
        old = endings[t].get('modality')
        endings[t]['modality'] = new_m
        endings[t].pop('negate', None)
        report['remaps'].append(f"modality {t}: {old} → {new_m}")

# (4) DA field 재매핑
for t, new_df in (rules.get('remap_da_field') or {}).items():
    if t in connectives:
        old = connectives[t].get('da_field')
        connectives[t]['da_field'] = new_df
        report['remaps'].append(f"da_field {t}: {old} → {new_df}")

# (5) Ending 병합
for canonical, spec in (rules.get('merge_endings') or {}).items():
    if canonical not in endings:
        continue
    endings[canonical]['modality'] = spec.get('modality', endings[canonical].get('modality'))
    for alias in spec.get('aliases', []) or []:
        if alias in endings:
            merge_entry(endings, canonical, alias, 'endings')
            report['merges'].append(f"ending merge: {alias} → {canonical}")

# (6) Connective 병합
for canonical, spec in (rules.get('merge_connectives') or {}).items():
    if canonical not in connectives:
        continue
    connectives[canonical]['da_field'] = spec.get('da_field', connectives[canonical].get('da_field'))
    for alias in spec.get('aliases', []) or []:
        if alias in connectives:
            merge_entry(connectives, canonical, alias, 'connectives')
            report['merges'].append(f"connective merge: {alias} → {canonical}")

# (7) 저빈도 잡음 제거
low_cfg = rules.get('remove_low_frequency') or {}
if low_cfg.get('enabled'):
    for cat, d in [('verbs', verbs), ('endings', endings), ('connectives', connectives)]:
        to_del = [k for k, x in d.items() if x.get('occurrences', 0) <= 1 and x.get('file_coverage', 0) <= 1]
        for k in to_del:
            del d[k]
            report['removes'].append(f"{cat} low-freq: {k}")

# 정렬 + 출력
def sort_list(d, key_field):
    return sorted(d.values(), key=lambda x: (-x['occurrences'], x[key_field]))

out_doc = {
    'version': 'v1.0',
    'source': 'draft-v0.5',
    'normalization_applied': RULES,
    'stats': {
        'verbs': len(verbs),
        'endings': len(endings),
        'connectives': len(connectives),
        'total': len(verbs) + len(endings) + len(connectives),
    },
    'verbs': sort_list(verbs, 'stem'),
    'endings': sort_list(endings, 'text'),
    'connectives': sort_list(connectives, 'text'),
}

with open(OUT, 'w', encoding='utf-8') as fh:
    yaml.safe_dump(out_doc, fh, allow_unicode=True, sort_keys=False, width=200)

print(f'wrote {OUT}')
print(f'stats: verbs={len(verbs)} endings={len(endings)} connectives={len(connectives)} total={sum([len(verbs),len(endings),len(connectives)])}')
print(f'report:')
for cat, items in report.items():
    print(f'  {cat}: {len(items)} changes')
    for it in items[:5]:
        print(f'    - {it}')
    if len(items) > 5:
        print(f'    ... +{len(items)-5} more')
