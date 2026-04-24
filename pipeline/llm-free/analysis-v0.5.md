# v0.5 Normalization Analysis

- source: C:\msys64\home\jsh86\.claude\scripts\da-vector\llm-free\lexicon-nl-grammar.draft-v0.5.yaml
- raw total: verbs=146 endings=109 connectives=137

## Modality 분포 (endings)
- `neutral`: 33
- `must`: 27
- `must-not`: 21
- `may`: 12
- `should`: 9
- `because`: 2  [OUTLIER]
- `then`: 2  [OUTLIER]
- `when`: 1  [OUTLIER]
- `restriction`: 1  [OUTLIER]
- `conditional-must`: 1  [OUTLIER]

## DA Field 분포 (connectives)
- `if`: 30
- `when`: 23
- `counter-example`: 23
- `then`: 22
- `because`: 21
- `anti-pattern`: 12
- `neutral`: 4  [OUTLIER]
- `must-not`: 1  [OUTLIER]
- `and-condition`: 1  [OUTLIER]

## Modality 이상치 항목 (재분류 필요)
- `-이므로` (modality=because, occ=5, cov=2)
- `-할 때` (modality=when, occ=5, cov=2)
- `-으로 대체` (modality=then, occ=4, cov=2)
- `-만` (modality=restriction, occ=2, cov=1)
- `-도록` (modality=then, occ=1, cov=1)
- `-지 않으므로` (modality=because, occ=1, cov=1)
- `-할 때만` (modality=conditional-must, occ=1, cov=1)

## DA Field 이상치 항목 (재분류 필요)
- `또는` (da_field=neutral, occ=17, cov=5)
- `그리고` (da_field=neutral, occ=3, cov=1)
- `⛔` (da_field=must-not, occ=2, cov=1)
- `권장` (da_field=neutral, occ=2, cov=1)
- `**모두** 충족` (da_field=and-condition, occ=1, cov=1)
- `포함 권장` (da_field=neutral, occ=1, cov=1)

## Verb 유의어/활용형 후보 (어간 prefix 일치)

## Ending 유사 후보 (prefix 3자 일치)
- `-해야*`: -해야 한다(m=must,occ=208), -해야(m=must,occ=13), -해야 함(m=must,occ=4), -해야 합니다(m=must,occ=4)
- `-하는*`: -하는가?(m=neutral,occ=20), -하는(m=neutral,occ=6), -하는지(m=neutral,occ=4), -하는 행위(m=neutral,occ=3)
- `-(으*`: -(으)면 안 된다(m=must-not,occ=12), -(으)ㄹ 수 있다(m=neutral,occ=9), -(으)ㄹ 수 없다(m=neutral,occ=4), -(으)면 안 됨(m=must-not,occ=1)
- `-할 *`: -할 때(m=when,occ=5), -할 것(m=should,occ=2), -할 수 있다(m=may,occ=2), -할 때만(m=conditional-must,occ=1)
- `반드시*`: 반드시 ~(m=must,occ=25), 반드시(m=must,occ=9), 반드시 ~경유(m=must,occ=3)
- `-하면*`: -하면 안 된다(m=must-not,occ=22), -하면 즉시(m=must,occ=4), -하면 실패한다(m=neutral,occ=3)
- `-(이*`: -(이)므로(m=neutral,occ=14), -(이)다(m=neutral,occ=12), -(이)며(m=neutral,occ=8)
- `-하지*`: -하지 않는다(m=must-not,occ=5), -하지 말고(m=must-not,occ=3), -하지 않는지(m=neutral,occ=2)
- `-금지*`: -금지(m=must-not,occ=20), -금지한다(m=must-not,occ=13)
- `-가능*`: -가능(m=may,occ=13), -가능하다(m=may,occ=5)
- `-필수*`: -필수(m=must,occ=10), -필수이다(m=must,occ=9)
- `-허용*`: -허용한다(m=may,occ=8), -허용(m=may,occ=3)
- `-되지*`: -되지 않는다(m=neutral,occ=7), -되지 않음(m=must-not,occ=2)
- `-를 *`: -를 확인한 뒤(m=must,occ=6), -를 먼저 Read 한다(m=must,occ=4)
- `-필요*`: -필요하다(m=should,occ=4), -필요한 신호(m=should,occ=4)

## Connective 유사 후보 (prefix 2자 일치)
- `{X*`: {X}한 경우(df=if,occ=12), {X}이므로 {Y}(df=because,occ=10), {X}하면 {Y}가 발생한다(df=anti-pattern,occ=9), {X}하려 할 때(df=when,occ=8), {X}하기 직전(df=when,occ=7), {X}가 아닌 경우(df=counter-example,occ=6), {X}없이 {Y}하면(df=anti-pattern,occ=5), {X} 키워드가 포함되거나(df=if,occ=3), {X} 후 완료 보고 → {Y} 누락으로(df=anti-pattern,occ=3), {X}에만 저장하면 {Y}가 불가능하다(df=because,occ=3), {X}인지 확인한다(df=then,occ=3), {X} 키워드가 없는 경우(df=counter-example,occ=2), {X}가 필요하고 {Y}하려는 상황(df=if,occ=2), {X}로는 {Y}에 필요한 정보가 부족한 경우(df=if,occ=2), {X}만 확인하고 바로 Bash 실행 → {Y} 모름(df=anti-pattern,occ=2), {X}만이 목적이면 본 규칙은 비적용(df=counter-example,occ=2)
- `반드*`: 반드시 {X}한다(df=then,occ=14), 반드시(df=then,occ=11), 반드시 ~(df=then,occ=8), 반드시 ~ 경유(df=then,occ=5), 반드시 {X}를 먼저 Read 한 뒤(df=then,occ=4), 반드시 {X}와 {Y} 모두(df=then,occ=4)
- `~이*`: ~이면(df=if,occ=74), ~이므로(df=because,occ=37), ~이면 →(df=then,occ=10), ~이면 → 조치(df=then,occ=5), ~이 발생한다(df=because,occ=4)
- `~하*`: ~하면(df=if,occ=18), ~하려는 경우(df=if,occ=12), ~하기 전에(df=when,occ=8), ~하면 안 됨(df=anti-pattern,occ=6), ~하면 ~발생하므로(df=because,occ=3)
- `~위*`: ~위험(df=because,occ=8), ~위반(df=anti-pattern,occ=5), ~위해(df=because,occ=5)
- `→ *`: → 조치(df=then,occ=7), → 즉시(df=then,occ=6), → nudge fire(df=then,occ=3)
- `만약*`: 만약 {X}이면(df=if,occ=3), 만약 ~(df=if,occ=3), 만약(df=if,occ=2)
- `~할*`: ~할 때(df=when,occ=82), ~할 때, 또는 ~ 직전(df=when,occ=2)
- `~에*`: ~에서(df=when,occ=42), ~에서만(df=counter-example,occ=3)
- `~해*`: ~해야 한다(df=then,occ=35), ~해서는 안 됨(df=anti-pattern,occ=6)
- `단,*`: 단, ~(df=counter-example,occ=12), 단,(df=counter-example,occ=1)
- `~있*`: ~있으면(df=if,occ=11), ~있을 때(df=when,occ=4)
- `~없*`: ~없으면(df=counter-example,occ=10), ~없을 때(df=when,occ=4)
- `~시*`: ~시 바로 ~하면(df=anti-pattern,occ=8), ~시나리오에서(df=when,occ=7)
- `없으*`: 없으면(df=if,occ=8), 없으므로(df=because,occ=4)
- `대신*`: 대신(df=anti-pattern,occ=6), 대신 에(df=then,occ=1)
- `따라*`: 따라서 ~(df=because,occ=5), 따라(df=because,occ=2)
- `이 *`: 이 상세 없이 {X}하면 {Y}가 발생한다(df=because,occ=3), 이 중 하나라도 ~(df=if,occ=3)
- `~플*`: ~플래그 파일이 존재(df=if,occ=2), ~플래그가 없는 ~경우(df=counter-example,occ=2)
- `왜냐*`: 왜냐하면(df=because,occ=2), 왜냐하면 ~(df=because,occ=2)

## Coverage ratio 기반 Tier 추천
- **verbs** (총 146, total_occ=1642):
  - Tier 1 (70% 커버): **top-35**
  - Tier 2 (70-90%): top-36 ~ top-83  (48 항목)
  - Tier 3 (90-100%): top-84 ~ top-146  (63 항목)
- **endings** (총 109, total_occ=1565):
  - Tier 1 (70% 커버): **top-11**
  - Tier 2 (70-90%): top-12 ~ top-50  (39 항목)
  - Tier 3 (90-100%): top-51 ~ top-109  (59 항목)
- **connectives** (총 137, total_occ=923):
  - Tier 1 (70% 커버): **top-38**
  - Tier 2 (70-90%): top-39 ~ top-84  (46 항목)
  - Tier 3 (90-100%): top-85 ~ top-137  (53 항목)

## 저빈도 잡음 (occurrences=1, file_coverage=1)
- verbs: 10/146  (제거 후보)
- endings: 10/109  (제거 후보)
- connectives: 18/137  (제거 후보)
