#!/usr/bin/env python3
"""BATCH-1019-3 · 依盘上读数聚合 verdict.json（判定值由脚本从读数算出，不手抄）"""
import json
import re
import subprocess
from pathlib import Path

QA = Path('/Users/kevin/bistro/seafood/ops/batch-1019-3/qa')
R = QA / 'readings'
REPO = Path('/Users/kevin/bistro/seafood')

read = lambda n: json.loads((R / n).read_text())
paging = read('probe-paging.json')
retry = read('probe-paging-retry.json')
layout = read('probe-layout.json')
routes = read('probe-routes.json')
apidb = read('api-db.json')
prov = read('prov-readback.json')
p7b = read('p7b-03-offline-gates.json')
test_log = (R / 'test-unit.log').read_text()
build_log = (R / 'build.log').read_text()
tsc_log = (R / 'tsc-noemit.log').read_text()
theme_log = (R / 'gates-theme.log').read_text()

arms = {(a['arm'], a['viewport']): a for a in paging['arms']}
listed = apidb['db']['listed_ids']

# ---------------- AC1 ----------------
ac1_checks = {}
real_ok = True
for vp in ('390x844', '1440x900'):
    a = arms[('real', vp)]
    real_ok &= (
        a['first_screen']['cards'] == min(36, len(listed))
        and a['first_screen']['duplicate_ids'] == []
        and a['final']['cards'] == len(listed)
        and a['final']['distinct'] == len(listed)
        and a['final']['end'] is True
        and a['final']['loading'] is False
        and a['requests']['distinct_skips'] == ['0']
        and a['requests']['limits'] == ['36']
        and not a['pageErrors'] and not a['consoleErrors']
    )
ac1_checks['real_390_1440_first_screen_equals_min36_listed'] = bool(real_ok)

pa_ok = True
for vp in ('390x844', '1440x900'):
    a = arms[('paged-a', vp)]
    seq = [t['cards'] for t in a['scroll_timeline']]
    pa_ok &= (
        a['first_screen']['cards'] == 36
        and a['final']['cards'] == 80
        and a['final']['distinct'] == 80
        and a['requests']['distinct_skips'] == ['0', '36', '72']
        and a['requests']['limits'] == ['36']
        and a['final']['end'] is True
        and a['final']['loading'] is False
        and a['final']['duplicate_ids'] == []
        and seq[-1] == 80 and (72 in seq)
        and not a['pageErrors'] and not a['consoleErrors']
    )
ac1_checks['paged_a_cards_36_72_80_skip_0_36_72'] = bool(pa_ok)

pb_ok = True
for vp in ('390x844', '1440x900'):
    a = arms[('paged-b', vp)]
    seq = [t['cards'] for t in a['scroll_timeline']]
    pb_ok &= (
        a['first_screen']['cards'] == 36
        and 70 in seq                      # 第 2 页 36 行含 2 行重复 ⇒ 去重后 +34
        and a['final']['cards'] == 80      # 82 交付行 → 80 distinct
        and a['final']['distinct'] == 80
        and a['requests']['distinct_skips'] == ['0', '36', '72']
    )
ac1_checks['paged_b_overlap_deduped_36_70_80'] = bool(pb_ok)

slow = next(a for a in retry['arms'] if a['arm'] == 'slow-600ms')
ac1_checks['loading_transient_no_residual'] = bool(
    slow['loading_samples'] > 0
    and slow['loading_seen_text'] == ['加载中...']
    and slow['card_progression'] == [36, 72, 80]
    and slow['residual_loading'] is False
    and slow['final']['end'] is True
)

rt = next(a for a in retry['arms'] if a['arm'] == 'retry-once')
ac1_checks['failure_stops_and_retry_reuses_skip'] = bool(
    rt['after_fail']['error'] is True
    and rt['after_fail']['retry'] is True
    and rt['after_fail']['cards'] == 36
    and rt['auto_retry_observed'] is False
    and rt['skip36_before_retry'] == 1
    and rt['skip36_after_idle_wait'] == 1
    and rt['after_retry_click']['cards'] == 72
    and rt['after_retry_click']['error'] is False
    and rt['final']['cards'] == 80
    and rt['final']['end'] is True
    and rt['final']['loading'] is False
)

# ---------------- AC2 ----------------
ac2_checks = {
    'api_bid_set_equals_db_listed': apidb['prize_all']['set_equals_listed'] is True,
    'no_draft_delisted_in_api': apidb['prize_all']['draft_or_delisted_leaked'] == [],
    'api_count_equals_listed_count': apidb['prize_all']['count'] == len(listed) == 9,
    'page2_skip36_empty': apidb['prize_all_page2']['count'] == 0,
    'home_prizes_all_listed': apidb['home']['prizes_all_listed'] is True,
    'home_prizes_count_9': apidb['home']['prizes_count'] == 9,
    'detail_draft_ids_still_readable': all(
        apidb['detail'][k]['db_status'] != 'listed' and apidb['detail'][k]['readable'] is True
        and apidb['detail'][k]['row_key_count'] == 46 for k in ('1', '22')
    ),
    'detail_listed_readable': apidb['detail']['76']['readable'] is True,
}

# ---------------- AC3 ----------------
rows = {(r['theme'], r['vp']): r for r in layout['rows']}
ac3_checks = {}
for vp, exp in (('vp390', 2), ('vp1024', 4), ('vp1280', 6), ('vp1440', 6), ('vp1536', 6), ('vp1920', 6)):
    l, d = rows[('light', vp)], rows[('dark', vp)]
    ac3_checks[f'{vp}_cols_{exp}'] = l['gridCols'] == exp and d['gridCols'] == exp and l['colsMatch'] and d['colsMatch']
ac3_checks['day_night_same_cols_every_width'] = all(
    rows[('light', v)]['gridCols'] == rows[('dark', v)]['gridCols'] for v in ('vp390', 'vp1024', 'vp1280', 'vp1440', 'vp1536', 'vp1920')
)
ac3_checks['no_page_or_console_errors'] = all(not r['pageErrors'] and not r['consoleErrors'] for r in layout['rows'])

# ---------------- AC4 ----------------
r1920 = rows[('light', 'vp1920')]
ac4_checks = {
    'container_width_1536_at_1920': r1920['containerW'] == 1536,
    'container_centered_at_1920': r1920['centered'] is True,
    'no_horizontal_overflow_all_rows': all(r['overflowX'] == 0 for r in layout['rows']),
    'token_computed_1536px': all(r['shellMaxW'] == '1536px' for r in layout['rows']),
    'token_computed_on_1920': r1920['shellMaxW'] == '1536px',
    'css_token_1536px': any(c['name'] == 'css shell-max-w' and c['value'] == '1536px' for c in prov['checks']),
}

# ---------------- AC5 ----------------
files = re.search(r'Test Files\s+(\d+) passed', test_log)
tests = re.search(r'Tests\s+(\d+) passed', test_log)
theme_files = re.search(r'Test Files\s+(\d+) passed', theme_log)
theme_tests = re.search(r'Tests\s+(\d+) passed', theme_log)
regs_out = subprocess.run(
    ["grep", "-cE", r"^app\.(get|post|put|delete|patch)\(", str(REPO / 'backend-ts/src/index.ts')],
    capture_output=True, text=True).stdout.strip()
regs = int(regs_out or 0)
ac5_checks = {
    'frontend_build_exit_0': 'BUILD_EXIT=0' in build_log and '✓ built in' in build_log,
    'test_unit_61_files_583_tests': bool(files) and bool(tests) and int(files.group(1)) >= 61 and int(tests.group(1)) >= 583,
    'backend_tsc_noemit_exit_0': 'TSC_EXIT=0' in tsc_log and tsc_log.strip().count('\n') == 0,
    'p7b_03_37_of_37': p7b['summary']['total'] == 37 and p7b['summary']['passed'] == 37 and p7b['summary']['failed'] == 0,
    'p7b_ac10_2_regs_110': next(c for c in p7b['checks'] if c['id'] == 'AC10-2')['pass'] is True and regs == 110,
    'theme_gates_green': bool(theme_files) and bool(theme_tests) and int(theme_files.group(1)) == 2 and int(theme_tests.group(1)) == 33 and 'THEME_EXIT=0' in theme_log,
    'prov_pointer_readback': all(c['present'] for c in prov['checks'] if 'snippet' in c),
    'shell_css_single_767_block': True,
}

# ---------------- AC6 ----------------
reg_rows = {r['route']: r for r in routes['rows']}
ac6_checks = {
    'home_key_set_unchanged': apidb['home']['key_set_unchanged'] is True,
    'detail_row_keys_46': apidb['detail']['76']['row_key_count'] == 46,
    'currencies_2_rows': apidb['currencies']['count'] == 2,
    'media_999_404': apidb['media_999']['status'] == 404,
    'routes_no_pageerror': all(not reg_rows[p]['pageErrors'] and not reg_rows[p]['consoleErrors'] for p in ('/', '/item/1', '/task')),
    'routes_render_non_empty': all(reg_rows[p]['rootHtmlLen'] > 0 for p in ('/', '/item/1', '/task')),
    'routes_no_overflow': all(reg_rows[p]['docOverflowX'] == 0 for p in ('/', '/item/1', '/task')),
}

# shell.css@media 现取
shell_css = (REPO / 'frontend/src/shell/shell.css').read_text()
ac5_checks['shell_css_single_767_block'] = shell_css.count('@media') == 1 and re.search(r'@media \(max-width: 767px\)', shell_css) is not None

ACS = [
    ('AC1', '分页真生效（真后端 390/1440 + 拦截夹具）', ac1_checks,
     'readings/probe-paging.json, readings/probe-paging-retry.json',
     f'real 两档首屏 {arms[("real","390x844")]["first_screen"]["cards"]}/{arms[("real","1440x900")]["first_screen"]["cards"]} 卡 = min(36, listed={len(listed)})，无重复 bID，skip 仅 0（StrictMode 双发首条 ERR_ABORTED），到底 feed-end；夹具 A 36→72→80、skip 0→36→72、distinct 80、无残留 loading；夹具 B（第 2 页重叠 2 行）36→70→80（82 交付→80 distinct，去重生效）；slow-600ms 臂 loading 见 8 次采样后清零；retry 臂 500 后停住（2.5s 内 skip=36 仍只 1 次，无自动重试），点重试复用 skip=36 → 72 → 80 到底',
     '任一站卡数/顺序/去重/终止/残留不符即判负'),
    ('AC2', '只列 listed（行为变更）', ac2_checks,
     'readings/api-db.json',
     f"dev 库 26 行（draft 15 / delisted 2 / listed 9）；/api/prize/all bID 集合 = DB listed 集合 逐项相等（[76,71,24,23,19,18,15,14,13]，missing/extra 皆 ∅）；draft/delisted 泄漏 0；/api/home prizes 9 条全 listed；draft 详情 /api/prize/1、/api/prize/22 仍 200 可读 46 键（getBrandById 未过滤，未被误伤）",
     '任一 draft/delisted bID 出现在列表读口，或 draft 详情变不可读即判负'),
    ('AC3', '6 列断点（CSS 驱动）', ac3_checks,
     'readings/probe-layout.json',
     'computed gridTemplateColumns 轨道数：390=2 / 1024=4 / 1280=6 / 1440=6 / 1536=6 / 1920=6；日/夜两档六宽度逐档相等；网格类 = `sf-grid sf-feed`（HomePage 商品网格不再用 ResponsiveGrid，本文件零 innerWidth/matchMedia 读数）；12 行读数零 pageerror/console error',
     '任一档列数不符或日/夜列数不一致即判负'),
    ('AC4', '容器 1536', ac4_checks,
     'readings/probe-layout.json, readings/prov-readback.json',
     '1920 档 .sf-route-container 实宽 1536、left=192 ⇒ 居中；全 12 行 docScrollWidth−clientWidth=0；`--sf-st-shell-max-w` computed 全档 1536px（CSS 真值 1536px）；PROV 回读 style-preview.html:1180 `max-width:1536px` 命中',
     '1920 档容器 ≠1536 或溢出 ≠0 或 token ≠1536px 即判负'),
    ('AC5', '门套', ac5_checks,
     'readings/build.log, readings/test-unit.log, readings/tsc-noemit.log, readings/p7b-03.log, readings/p7b-03-offline-gates.json, readings/gates-theme.log, readings/prov-readback.json',
     f"frontend build exit 0（✓ built in 1.81s）；test:unit {files.group(1) if files else '?'} 文件 / {tests.group(1) if tests else '?'} 例全过（≥61/583）；backend-ts tsc --noEmit exit 0（零诊断）；p7b-03 37/37 regs=110（AC10-2 pass，源文件现取 110 = get49/post57/delete3/patch1）；theme-tokens + theme-shell-isomorphism 2 文件 33 例绿；shell.css @media 仍只 1 块且为 767",
     '任一门红、例数下降或 regs≠110 即判负'),
    ('AC6', '回归', ac6_checks,
     'readings/api-db.json, readings/probe-routes.json',
     '/api/home 载荷键集未变（claimed_prize_ids / is_authenticated / prizes / tasks / user_points）；/api/prize/76 行键 46；/api/currencies 2 行（$ + BTTC）；/api/media/999 = 404；/、/item/1、/task 三页 #root 非空、零 pageerror、零 console error、零横向溢出',
     '键集变化、行键数变化或页面异常即判负'),
]

acs_out = []
summary = {'PASS': 0, 'FAIL': 0, 'NOT_MEASURED': 0}
for aid, name, checks, reading, note, falsifier in ACS:
    failed = [k for k, v in checks.items() if not v]
    verdict = 'PASS' if not failed else 'FAIL'
    summary[verdict] += 1
    acs_out.append({
        'id': aid, 'name': name, 'verdict': verdict, 'reading': reading,
        'checks': checks, 'failed_checks': failed, 'note': note, 'falsifier': falsifier,
    })

verdict = {
    'task': 'batch-1019-3 独立质检：首页分页（82e465e）+ 6 列/容器 1536（10ef6b1）',
    'qa': 'Zang 独立质检（本单不重做 0fe454a 排序基线；只检 82e465e 与 10ef6b1）',
    'head': subprocess.run(['git', '-C', str(REPO), 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip(),
    'targets': {'paging': '82e465e', 'grid_6col_1536': '10ef6b1'},
    'env': {
        'frontend': 'vite dev http://localhost:5787（/api 反代 → 5788）',
        'backend': 'http://localhost:5788',
        'db_project': apidb['db_identity']['project_id'],
        'db_total_listing': apidb['db']['total'],
        'chrome': layout['chrome'],
    },
    'summary': summary,
    'acs': acs_out,
    'ruler_notes': [
        "派单 AC1 夹具预期「36→72→80 且第 2 页重叠 2 行」在算术上互斥：第 2 页 36 行若含 2 行重复，去重后卡数只能是 36+34=70。故本检跑两套夹具：paged-a（重叠落在第 2↔3 页边界 71,72）命中 AC 字面 36→72→80；paged-b（重叠落在第 1↔2 页边界 35,36）得 36→70→80，用来单独证实「跨页去重」。两臂 skip 序列均 0→36→72、终态 distinct 80（82 交付行 − 2 重复）。",
        "dev 库 listed 仅 9 行 ⇒ 真网络下第 2 页必空（skip=36 实测 0 行），分页的多页行为只能靠 context.route 夹具取证（已披露，非缺陷）。",
        "React.StrictMode 令首屏 skip=0 双发（首条 net::ERR_ABORTED），所有臂的 requests 原始序列均含 [0,0]，去重后为 [0]；不影响卡数与游标。",
        "本轮截图/读数全部在真 vite dev + 真 dev 后端上取；未写库、未改产品代码、未 commit/push。",
        "5788 现跑代码已含 status='listed' 过滤（/api/prize/all 返回 9 行）⇒ 上一轮「5788 仍是排序版代码」的口径已失效。",
    ],
}
(QA / 'verdict.json').write_text(json.dumps(verdict, ensure_ascii=False, indent=2))
print(json.dumps(summary, ensure_ascii=False))
for a in acs_out:
    print(a['id'], a['verdict'], a['failed_checks'])
