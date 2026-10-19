// 质检聚合：把 readings/ 与 logs/ 的盘上读数汇成 verdict.json（不重跑、不改判据）
import fs from 'node:fs';
import path from 'node:path';

const QA = '/Users/kevin/bistro/seafood/ops/item-type/delivery/qa';
const R = (f) => JSON.parse(fs.readFileSync(path.join(QA, 'readings', f), 'utf8'));
const L = (f) => fs.readFileSync(path.join(QA, 'logs', f), 'utf8');
const parseGate = (f) => {
  const t = L(f);
  const i = t.indexOf('{');
  const j = JSON.parse(t.slice(i, t.lastIndexOf('}') + 1));
  const exit = (t.match(/S5\d_EXIT=(\d+)/) || [])[1];
  return { summary: j.summary, live: j.live, exit: exit ? Number(exit) : null };
};

const ac1 = R('ac1-write-port.json');
const ac2 = R('ac2-read-port.json').read_port;
const ac2d = R('ac2-detail-rows.json');
const br = R('ac3-ac4-ac6-browser.json');
const reg = R('ac6-regression-http.json');
const base = R('db-baseline.json');
const cln = R('cleanup-purge.json');

const buildLog = L('build.log');
const testLog = L('test-unit.log');
const buildExit = Number((buildLog.match(/BUILD_EXIT=(\d+)/) || [])[1]);
const testFiles = Number((testLog.match(/Test Files\s+(\d+) passed/) || [])[1]);
const testCases = Number((testLog.match(/Tests\s+(\d+) passed/) || [])[1]);
const tscExit = Number((L('tsc.log').match(/TSC_EXIT=(\d+)/) || [])[1]);
const p7b = parseGate('p7b-03.log');
const p7bArtifact = (() => {
  const dir = '/Users/kevin/bistro/seafood/backend-ts/.p7b-artifacts';
  const newest = fs.readdirSync(dir).map((f) => ({ f, m: fs.statSync(path.join(dir, f)).mtimeMs })).sort((a, b) => b.m - a.m)[0];
  const full = path.join(dir, newest.f);
  const j = JSON.parse(fs.readFileSync(full, 'utf8'));
  const ac102 = j.checks.find((c) => c.id === 'AC10-2');
  return { artifact: path.relative('/Users/kevin/bistro/seafood', full), summary: j.summary, registration_points: ac102?.reading ?? null };
})();

const ac3 = br.ac3.desktop_1536;
const ac4 = br.ac4;
const ac6m = br.ac6.mobile_390;

const items = [
  {
    id: 'AC1', title: '写口四值 + 退役负控（真钱包登录 · 14 臂）',
    pass: ac1.cases.every((c) => c.pass) && ac1.cases.length === 14,
    evidence: ['readings/ac1-write-port.json'],
    readings: {
      cases: ac1.cases.length,
      failed: ac1.cases.filter((c) => !c.pass).map((c) => c.case),
      valid_four: ac1.cases.filter((c) => c.case.startsWith('valid_')).map((c) => ({ sent: c.sent.item_type, db: c.db_item_type, http: c.http })),
      bare_Digital: (() => { const c = ac1.cases.find((x) => x.case === 'invalid_bare_Digital'); return { http: c.http, code: c.code, reason: c.reason, allowed: c.allowed, rows_written: c.rows_written }; })(),
      invalid_all: ac1.cases.filter((c) => c.case.startsWith('invalid_')).map((c) => ({ case: c.case, http: c.http, code: c.code, reason: c.reason, rows_written: c.rows_written })),
      null_arms: ac1.cases.filter((c) => c.case.startsWith('null_')).map((c) => ({ case: c.case, db: c.db_item_type, http: c.http })),
      patch: ac1.cases.filter((c) => c.case.startsWith('patch')).map((c) => ({ case: c.case, http: c.http, db_before: c.db_before, db_after: c.db_after })),
    },
  },
  {
    id: 'AC2', title: '读口 feed 48 / 详情 47 键 · 与 DB 逐行对拍',
    pass: ac2.feed_key_count === 48 && ac2.detail_key_count === 47 && ac2.api_vs_db_mismatch_count === 0 && ac2d.detail_all_pass === true,
    evidence: ['readings/ac2-read-port.json', 'readings/ac2-detail-rows.json'],
    readings: {
      feed_keys: ac2.feed_key_count, detail_keys: ac2.detail_key_count,
      feed_rows_compared: ac2.feed_rows, mismatch: ac2.api_vs_db_mismatch_count,
      keys_only_in_feed: ac2d.keys_only_in_feed, keys_only_in_detail: ac2d.keys_only_in_detail,
      detail_rows_checked: ac2d.detail_rows.length, detail_all_pass: ac2d.detail_all_pass,
      value_counts: ac2.item_type_value_counts,
    },
  },
  {
    id: 'AC3', title: '全链 E2E：四类型真页 1536 黄/绿标签矩阵',
    pass: Object.values(ac3.checks).every(Boolean),
    evidence: ['readings/ac3-ac4-ac6-browser.json', 'readings/created-listings.json'],
    readings: {
      cards: ac3.cards_total, yellow: ac3.yellow_count, green: ac3.green_count,
      yellow_on: ac3.arms.PhysicalFreeShip && { text: ac3.arms.PhysicalFreeShip.tag_text, bg: ac3.arms.PhysicalFreeShip.style?.backgroundColor ?? ac3.arms.PhysicalFreeShip.bg, first_el: ac3.arms.PhysicalFreeShip.tag_first_element },
      green_on: ac3.arms.DigitalAutoDeliver && { text: ac3.arms.DigitalAutoDeliver.tag_text, bg: ac3.arms.DigitalAutoDeliver.bg, first_el: ac3.arms.DigitalAutoDeliver.tag_first_element },
      no_tag_arms: ['DigitalManualDeliver', 'PhysicalBuyerShip'].map((k) => ({ arm: k, ship: ac3.arms[k]?.has_ship_tag, auto: ac3.arms[k]?.has_auto_tag })),
      row1_all_48: ac3.rows_not_48.length === 0, card_all_392: ac3.cards_not_392.length === 0,
      tag_geometry_equal: ac3.tag_geometry_equal,
      page_errors: ac3.page_errors,
      checks: ac3.checks,
    },
  },
  {
    id: 'AC4', title: '发布页级联三控件：清空 / 互斥在场 / 三闸零请求 / 正控',
    pass: Object.values(ac4.checks).every(Boolean),
    evidence: ['readings/ac3-ac4-ac6-browser.json'],
    readings: {
      gates: ac4.steps.map((s) => ({ label: s.label, api_count: s.api_count, type_miss: s.type.miss, deliver_miss: s.deliver.miss, ship_miss: s.ship.miss, hints: s.body_has_badrequest })),
      cascade: {
        digital_branch: { deliver: ac4.cascade.c1_digital_branch.deliver.present, ship: ac4.cascade.c1_digital_branch.ship.present },
        after_switch_physical: { deliver: ac4.cascade.c3_switch_physical.deliver.present, ship: ac4.cascade.c3_switch_physical.ship.present, ship_checked: ac4.cascade.c3_switch_physical.ship_checked },
        switch_back_digital_deliver_checked: ac4.cascade.c4_back_digital.deliver_checked,
      },
      ui_publishes: ac4.ui_publishes.map((p) => ({ combo: p.combo, http: p.response_status, payload: p.payload_item_type, db: p.db_item_type, listing_id: p.listing_id, requests: p.api_count, pass: p.pass })),
      checks: ac4.checks,
    },
  },
  {
    id: 'AC5', title: '门套（build / test:unit / backend tsc / p7b-03 / s54 / s53）',
    pass: buildExit === 0 && testFiles >= 63 && testCases >= 634 && tscExit === 0 && p7b.summary.failed === 0 && p7b.summary.total === 37 && p7bArtifact.registration_points === 'registration_points=110' && parseGate('s54-gate.log').summary.failed === 0 && parseGate('s54-gate.log').summary.total === 45 && parseGate('s53-gate.log').summary.failed === 0 && parseGate('s53-gate.log').summary.total === 50,
    evidence: ['logs/build.log', 'logs/test-unit.log', 'logs/tsc.log', 'logs/p7b-03.log', 'logs/s54-gate.log', 'logs/s53-gate.log'],
    readings: {
      build: { exit: buildExit, built_in: (buildLog.match(/built in ([\d.]+)s/) || [])[1] + 's', js: (buildLog.match(/assets\/(index-[\w-]+\.js)/) || [])[1], css: (buildLog.match(/assets\/(index-[\w-]+\.css)/) || [])[1] },
      test_unit: { files: testFiles, tests: testCases },
      backend_tsc: { exit: tscExit },
      p7b_03: p7bArtifact,
      s54: parseGate('s54-gate.log').summary,
      s53: parseGate('s53-gate.log').summary,
      contaminated_first_pass: { s53: ['P3', 'Q4'], s54: ['P3', 'D4'], cause: '质检自建夹具在库内（listing 40 行 / item_type 非空 12 行）⇒ 存量面断言与「退回三值」负控臂当场红；回收后复跑即 50/50 与 45/45', logs: ['logs/s53-gate-contaminated.log', 'logs/s54-gate-contaminated.log'] },
    },
  },
  {
    id: 'AC6', title: '回归面（currencies 2 行 / media 404 / 390 零溢出 / 存量 26 行全 NULL）',
    pass: Object.values(reg.checks).every(Boolean) && ac6m.checks.zero_overflow && ac6m.checks.zero_page_errors,
    evidence: ['readings/ac6-regression-http.json', 'readings/ac3-ac4-ac6-browser.json'],
    readings: {
      currencies_rows: reg.currencies.rows, media_999: reg.media_999.status,
      mobile_390: { overflow_x: ac6m.overflow_x, body_overflow_x: ac6m.body_overflow_x, yellow: ac6m.yellow, green: ac6m.green, tabbar: ac6m.tabbar_items, errors: ac6m.page_errors.length },
      listing_total: reg.listing_total, non_null: reg.listing_item_type_non_null, distribution: reg.listing_item_type_distribution,
      checks: reg.checks,
    },
  },
  {
    id: 'AC7', title: '自建数据全回收（listing 前值复归 + 引用面清零 + 触发器复原）',
    pass: cln.listing_after === base.listing_total && cln.leftover_rows.length === 0 && cln.zero_reference_surface && cln.trigger_restored && cln.counts_after.content_translation === base.table_counts.content_translation,
    evidence: ['readings/db-baseline.json', 'readings/cleanup-purge.json', 'readings/cleanup-partial-run.json'],
    readings: {
      baseline_listing: base.listing_total, deleted_fixtures: cln.fixture_ids,
      listing_before_cleanup: cln.listing_before, listing_after_cleanup: cln.listing_after,
      reference_counts_before_delete: cln.reference_counts_before_delete,
      delta: cln.delta, leftover: cln.leftover_rows,
      trigger: { before: cln.transaction?.trigger_before, inside_disabled: cln.transaction?.trigger_disabled_inside_tx, inside_enabled: cln.transaction?.trigger_enabled_inside_tx, after: cln.trigger_tgenabled_after },
      post_delete_reference_counts: cln.post_delete_reference_counts,
    },
  },
];

const verdict = {
  batch: {
    repo: '/Users/kevin/bistro/seafood',
    commits: ['f5cdc26 docs(item-type): 四值闭集 + 卡面两标签', 'df14c53 feat(backend): 迁移 0054 + 闭集四值 + s53 同步', '2688187 feat(frontend): 级联三控件 + 双标签'],
    head_at_qc: '9bcf4be（质检期间被并发会话 push，origin/main..HEAD = 0）',
    dev_schema: base.schema_top?.version, prod_schema: reg.health.schema_version,
    dev_project_id: base.project_id,
    constraint: base.item_type_constraints?.[0]?.def,
  },
  verdict: items.every((i) => i.pass) ? 'PASS' : 'FAIL',
  acs: items,
  red: items.filter((i) => !i.pass).map((i) => ({ id: i.id, title: i.title })),
  notes: [
    '承接方在质检期间把本批 push 了（HEAD 9bcf4be，origin/main..HEAD = 0，且已带一份 prod-verify 提交）⇒ 本单读数取自被推送的同一棵树（9bcf4be 仅新增 ops/ 工件，产品代码零改动）。',
    's53/s54 首次运行各有 2 条红（P3 / Q4 / P3 / D4）—— 归因 = 质检自建夹具在库（listing 40 行、item_type 非空 12 行）⇒ 存量面断言与「退回 0053 三值」负控臂被自己的夹具顶红；回收后复跑 s53 50/50、s54 45/45。不是产品缺陷，但**门必须在库面干净时跑**。',
    '写口探针首跑中断一次（Neon HTTP ECONNRESET），已加指数退避重试；中断留下的 6 行夹具（87–92）单独回收并留证 readings/cleanup-partial-run.json（listing 32 → 26）。',
    'feed 行数在质检期与回收后分别 15 / 9（差 = 自建 6 件 listed 夹具），属夹具口径，不是产品回归。',
  ],
};

fs.writeFileSync(path.join(QA, 'verdict.json'), JSON.stringify(verdict, null, 2));
console.log(JSON.stringify({ verdict: verdict.verdict, red: verdict.red, acs: items.map((i) => ({ id: i.id, pass: i.pass })) }, null, 2));
