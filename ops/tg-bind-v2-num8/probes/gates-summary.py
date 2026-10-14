"""AC-6 门套读数汇总（从 gates/ 日志提数 + 产物串自证）。"""
import json, os, re, glob

REPO = '/Users/kevin/bistro/seafood'
G = REPO + '/ops/tg-bind-v2-num8/gates'
POST = REPO + '/ops/tg-bind-v2-num8/gates/POSTBUILD'


def read(name):
    p = os.path.join(G, name)
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except FileNotFoundError:
        return ''


exits = {}
for line in read('exitcodes.txt').splitlines():
    m = re.match(r'^(\w+_exit)=(\d+)$', line.strip())
    if m:
        exits[m.group(1)] = int(m.group(2))

vit = read('vitest.log')
m_files = re.search(r'Test Files\s+(\d+) passed \((\d+)\)', vit)
m_tests = re.search(r'Tests\s+(\d+) passed \((\d+)\)', vit)
m_failed = re.search(r'Tests\s+.*?(\d+) failed', vit)
offline = read('offline-tg-bind-v2.log')

# 产物自证：dist 主 bundle 是否含新口径串
dist_bundle = sorted(glob.glob(REPO + '/frontend/dist/assets/index-*.js'))
dist_checks = {}
if dist_bundle:
    src = open(dist_bundle[-1], encoding='utf-8', errors='replace').read()
    dist_checks = {
        'bundle': os.path.basename(dist_bundle[-1]),
        'contains_en_8digit_wording': '8-digit numeric code' in src,
        'contains_example_12345678': '12345678' in src,
        'contains_old_example_AB12CD': 'AB12CD' in src,
        'contains_inputmode_numeric': 'inputmode' in src.lower(),
    }

out = {
    'ac': 'AC-6', 'at': __import__('time').strftime('%Y-%m-%dT%H:%M:%S%z'), 'head_under_test': '625571e',
    'gates': [
        {'name': 'frontend npm run build', 'cmd': 'cd frontend && npm run build',
         'exit_code': exits.get('fe_build_exit'), 'log': 'ops/tg-bind-v2-num8/gates/fe-build.log',
         'tail': [l for l in read('fe-build.log').strip().splitlines()[-3:]]},
        {'name': 'frontend unit vitest', 'cmd': 'cd frontend && npx vitest run src/test/unit --reporter=basic',
         'exit_code': exits.get('vitest_exit'), 'log': 'ops/tg-bind-v2-num8/gates/vitest.log',
         'test_files': int(m_files.group(1)) if m_files else None,
         'tests': int(m_tests.group(1)) if m_tests else None,
         'failed': int(m_failed.group(1)) if m_failed else 0,
         'threshold': {'test_files_min': 54, 'tests_min': 519}},
        {'name': 'backend-ts npm run build', 'cmd': 'cd backend-ts && npm run build',
         'exit_code': exits.get('be_build_exit'), 'log': 'ops/tg-bind-v2-num8/gates/be-build.log',
         'tail': read('be-build.log').strip().splitlines()[-2:]},
        {'name': 'offline tg-bind-v2 assertions', 'cmd': 'cd backend-ts && npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts',
         'exit_code': exits.get('offline_exit'), 'log': 'ops/tg-bind-v2-num8/gates/offline-tg-bind-v2.log',
         'pass_lines': offline.count('PASS '),
         'summary_line': [l for l in offline.strip().splitlines() if 'ALL PASS' in l]},
    ],
    'dist_artifact_self_check': dist_checks,
    'checks': {
        'fe_build_exit_0': exits.get('fe_build_exit') == 0,
        'vitest_exit_0': exits.get('vitest_exit') == 0,
        'vitest_files_ge_54': bool(m_files) and int(m_files.group(1)) >= 54,
        'vitest_tests_ge_519': bool(m_tests) and int(m_tests.group(1)) >= 519,
        'vitest_zero_failed': (int(m_failed.group(1)) if m_failed else 0) == 0,
        'be_build_exit_0': exits.get('be_build_exit') == 0,
        'offline_exit_0': exits.get('offline_exit') == 0,
        'offline_all_pass_line': any('ALL PASS' in l for l in offline.splitlines()),
        'dist_contains_new_wording': bool(dist_checks.get('contains_en_8digit_wording')),
        'dist_no_old_example': dist_checks.get('contains_old_example_AB12CD') is False,
    },
}
out['all_pass'] = all(out['checks'].values())
open(REPO + '/ops/tg-bind-v2-num8/readings/ac6-gates.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
print(json.dumps({'checks': out['checks'], 'all_pass': out['all_pass'], 'vitest': (out['gates'][1]['test_files'], out['gates'][1]['tests'])}, ensure_ascii=False))
