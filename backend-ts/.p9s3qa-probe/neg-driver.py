#!/usr/bin/env python3
import subprocess, os, json, shutil, sys, re
NEG = '/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s3-qa-neg/backend-ts'
WT  = '/Users/kevin/.hermes/profiles/zang/cache/scratch/qaP9s3/backend-ts'
OUT = os.path.join(WT, '.p9s3qa-artifacts')
DB  = os.path.join(NEG, 'src/database.ts')
SQL = os.path.join(NEG, 'migrations/0030_listing_order_status_extend.sql')

def failed_ids(path):
    s = open(path).read()
    i = s.index('{'); j = s.rindex('}', 0, s.index('SUMMARY')) + 1
    r = json.loads(s[i:j])
    return [(c['id'], c['group']) for c in r['checks'] if not c['pass']]

def run_gate(tag):
    out = os.path.join(OUT, f'neg-{tag}.out')
    with open(out, 'w') as f:
        subprocess.run(['npx', 'ts-node', '--transpile-only', 'scripts/p8-s8-rating-timeliness-gate.ts'],
                       cwd=NEG, stdout=f, stderr=subprocess.STDOUT)
    env = dict(os.environ)
    r = subprocess.run(['grep', '-oE', 'SUMMARY.*', out], capture_output=True, text=True)
    summ = r.stdout.strip().splitlines()[-1] if r.stdout.strip() else 'NO SUMMARY'
    fids = failed_ids(out)
    return summ, fids

def restore():
    shutil.copyfile(os.path.join(WT, 'src/database.ts'), DB)
    shutil.copyfile(os.path.join(WT, 'migrations/0030_listing_order_status_extend.sql'), SQL)

report = {}
# ---- M1: 去评分无行守卫 ----
s = open(DB).read()
s2 = s.replace('periods[days][role] = n > 0 ? round4(s / n) : policy.defaultStars;',
               'periods[days][role] = round4(s / n);')
assert s2 != s, 'M1 no-op'
open(DB, 'w').write(s2)
report['M1_rating_guard'] = run_gate('M1'); restore()

# ---- M2: 时效 null -> 0 ----
s = open(DB).read()
s2 = s.replace('const numOf = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));',
               'const numOf = (v: unknown): number | null => Number(v ?? 0);')
assert s2 != s, 'M2 no-op'
open(DB, 'w').write(s2)
report['M2_timeliness_null0'] = run_gate('M2'); restore()

# ---- M3: 状态集回 4 值 ----
s = open(SQL).read()
old = "ADD CONSTRAINT listing_order_status_enum CHECK (status IN ('created','paid','shipped','received','refunded','cancelled'));"
new = "ADD CONSTRAINT listing_order_status_enum CHECK (status IN ('created','paid','refunded','cancelled'));"
s2 = s.replace(old, new)
assert s2 != s, 'M3 no-op'
open(SQL, 'w').write(s2)
report['M3_status_set_4'] = run_gate('M3'); restore()

# ---- M4: transition_ok 放行 received->refunded ----
s = open(SQL).read()
old = "    WHEN 'shipped'  THEN p_to IN ('received', 'refunded')"
new = "    WHEN 'shipped'  THEN p_to IN ('received', 'refunded')\n    WHEN 'received' THEN p_to IN ('refunded')"
s2 = s.replace(old, new)
assert s2 != s, 'M4 no-op'
open(SQL, 'w').write(s2)
report['M4_received_refundable'] = run_gate('M4'); restore()

# ---- 复原回绿 ----
report['RESTORE'] = run_gate('restore')

for k, (summ, fids) in report.items():
    print(f'== {k}: {summ}')
    print('   failed:', fids)
json.dump({k: {'summary': v[0], 'failed': v[1]} for k, v in report.items()},
          open(os.path.join(OUT, 'neg-mutations.json'), 'w'), indent=1)
print('WROTE', os.path.join(OUT, 'neg-mutations.json'))
