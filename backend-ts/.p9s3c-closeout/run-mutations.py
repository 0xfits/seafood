#!/usr/bin/env python3
"""P9③ 收口（Kong）· 库面判负：仓外副本 4 变异 → 逐字红点 → 复原回绿 → 主仓 cmp。"""
import json, os, glob, subprocess, shutil

MAIN = '/Users/kevin/bistro/seafood/backend-ts'
COPY = '/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s3c-copy/backend-ts'
OUT = '/Users/kevin/bistro/seafood/backend-ts/.p9s3c-closeout'

MUT = [
    ('M1_live_rating_no_row_guard', 'src/database.ts',
     'periods[days][role] = n > 0 ? round4(s / n) : policy.defaultStars;',
     'periods[days][role] = round4(s / n);'),
    ('M2_live_timeliness_null_to_zero', 'src/database.ts',
     'posterAvgDays: numOf(row.poster_avg_days),',
     'posterAvgDays: Number(row.poster_avg_days) || 0,'),
    ('M3_source_status_set_4', 'migrations/0030_listing_order_status_extend.sql',
     "ADD CONSTRAINT listing_order_status_enum CHECK (status IN ('created','paid','shipped','received','refunded','cancelled'));",
     "ADD CONSTRAINT listing_order_status_enum CHECK (status IN ('created','paid','refunded','cancelled'));"),
    ('M4_source_allow_received_refunded', 'migrations/0030_listing_order_status_extend.sql',
     "WHEN 'shipped'  THEN p_to IN ('received', 'refunded')",
     "WHEN 'shipped'  THEN p_to IN ('received', 'refunded')\n    WHEN 'received' THEN p_to IN ('refunded')"),
]

def run_gate():
    env = dict(os.environ, P8S8_BASE='http://127.0.0.1:5797')
    p = subprocess.run('npx ts-node --transpile-only scripts/p8-s8-rating-timeliness-gate.ts',
                       cwd=COPY, env=env, shell=True, capture_output=True, text=True, timeout=300)
    arts = sorted(glob.glob(os.path.join(COPY, '.p8s8-artifacts', 'p8s8-*', 'gate.json')), key=os.path.getmtime)
    d = json.load(open(arts[-1]))
    failed = sorted(c['id'] for c in d['checks'] if not c['pass'])
    return p.returncode, d['total'], d['passed'], d['failed'], failed, d['readings']['live'].get('http_err')

results = []
for name, rel, old, new in MUT:
    fp = os.path.join(COPY, rel)
    txt = open(fp).read()
    assert old in txt, f'{name}: old not found in {rel}'
    open(fp, 'w').write(txt.replace(old, new, 1))
    rc, total, passed, failed, redids, herr = run_gate()
    # restore from main
    shutil.copyfile(os.path.join(MAIN, rel), fp)
    same = open(fp, 'rb').read() == open(os.path.join(MAIN, rel), 'rb').read()
    results.append({'mutation': name, 'file': rel, 'exit': rc, 'total': total, 'passed': passed,
                    'failed': failed, 'red_ids': redids, 'restored_byte_same': same})
    print(json.dumps(results[-1], ensure_ascii=False))

# final green re-run after all restores
rc, total, passed, failed, redids, herr = run_gate()
print(json.dumps({'after_all_restores': {'exit': rc, 'total': total, 'passed': passed, 'failed': failed, 'red_ids': redids}}, ensure_ascii=False))
with open(os.path.join(OUT, 'mutations.json'), 'w') as f:
    json.dump({'mutations': results, 'final': {'exit': rc, 'total': total, 'passed': passed, 'failed': failed}}, f, ensure_ascii=False, indent=1)
