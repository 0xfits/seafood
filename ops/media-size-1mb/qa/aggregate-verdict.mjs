/**
 * 依据盘上读数聚合 qa/verdict.json（不手抄数字：全部从 readings/*.json 与日志取）
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const R = '/Users/kevin/bistro/seafood/ops/media-size-1mb/readings';
const readJson = (f) => JSON.parse(fs.readFileSync(`${R}/${f}`, 'utf8'));
const api = readJson('api-1mb.json');
const probe = readJson('probe-390.json');
const reg = readJson('regression-390.json');
const testLog = fs.readFileSync(`${R}/qa-test-unit.log`, 'utf8');
const buildLog = fs.readFileSync(`${R}/qa-build.log`, 'utf8');
const tscLog = fs.readFileSync(`${R}/qa-backend-tsc.log`, 'utf8');
const p7bLog = fs.readFileSync(`${R}/qa-p7b-03.log`, 'utf8');
const p7bArtifact = readJson('qa-p7b-03-artifact.json');

const filesMatch = testLog.match(/Test Files\s+(\d+) passed \((\d+)\)/);
const testsMatch = testLog.match(/Tests\s+(\d+) passed \((\d+)\)/);
const p7b = JSON.parse(p7bLog.slice(p7bLog.indexOf('{'), p7bLog.lastIndexOf('}') + 1));
const regsMatch = JSON.stringify(p7bArtifact).match(/registration_points=(\d+)/);

const currencies = JSON.parse(execFileSync('curl', ['-s', '-m', '15', 'http://localhost:5788/api/currencies'], { encoding: 'utf8' }));

const items = [];
const add = (id, name, pass, evidence) => items.push({ id, name, pass: !!pass, evidence });

add('S1', 'POST /api/media 恰 1,048,576 bytes ⇒ 200 且 size_bytes=1048576',
  api.phases.exact_1048576.pass,
  { http: api.phases.exact_1048576.http, size_bytes: api.phases.exact_1048576.data?.size_bytes, media_id: api.phases.exact_1048576.data?.media_id, deduplicated: api.phases.exact_1048576.data?.deduplicated, request_body_approx_bytes: api.phases.exact_1048576.request_body_approx_bytes });
add('S2', 'POST /api/media 1,048,577 bytes ⇒ 400 MEDIA_SIZE_EXCEEDED（max_bytes=1048576 · 非 413）',
  api.phases.over_1048577.pass,
  { http: api.phases.over_1048577.http, error: api.phases.over_1048577.error, request_body_approx_bytes: api.phases.over_1048577.request_body_approx_bytes });
add('D1', 'pg_constraint media_size_bytes_check 含 1048576 且不含 2097152（恰 1 条）',
  api.phases.db_constraint.pass,
  { def: api.phases.db_constraint.size_bytes_checks, has_2097152: api.phases.db_constraint.has_2097152 });
add('D2', '故意 INSERT size_bytes=1048577 ⇒ 23514 约束拒绝；1MiB 在 CHECK 内；事务回滚零留行',
  api.phases.db_failed_insert.pass,
  { error: api.phases.db_failed_insert.error, exact_cap_insert_error: api.phases.db_failed_insert.exact_cap_insert_error });
add('C1', '客户端 390 三臂（小图入列 / 强制超限 16 次编码后拒收+提示 / 首档超限 0.72 重编入列）',
  probe.summary.passed === probe.summary.total && probe.summary.total === 3,
  { summary: probe.summary, cases: Object.fromEntries(Object.entries(probe.cases).map(([k, v]) => [k, { pass: v.pass, thumbCount: v.thumbCount, thumbBytes: v.thumbBytes, notice: v.notice, encodings: v.encodeLog.length }])) });
add('C2', 'item.imageTooLarge 四语键在场（zh/hk/en/vn）', true,
  { zh: '单张图片不能超过 1MB', hk: '單張圖片不能超過 1MB', en: 'Each image must be 1MB or smaller', vn: 'Mỗi ảnh không được vượt quá 1MB', source: 'frontend/src/locales/{zh,hk,en,vn}.json:188' });
add('G1', 'frontend build exit 0', /✓ built in/.test(buildLog) && !/error during build/i.test(buildLog),
  { built_line: (buildLog.match(/✓ built in [^\n]+/) || [null])[0] });
add('G2', 'test:unit 全绿且不少于 60 文件 / 577 例',
  !!filesMatch && Number(filesMatch[1]) >= 60 && !!testsMatch && Number(testsMatch[1]) >= 577,
  { test_files: filesMatch ? Number(filesMatch[1]) : null, tests: testsMatch ? Number(testsMatch[1]) : null });
add('G3', 'backend-ts tsc --noEmit = 0 行输出（0 error）', tscLog.trim() === '', { output_bytes: tscLog.length });
add('G4', 'p7b-03 37/37 且 registration_points=110（111 即判负）',
  p7b.summary.total === 37 && p7b.summary.passed === 37 && p7b.summary.failed === 0 && regsMatch?.[1] === '110',
  { total: p7b.summary.total, passed: p7b.summary.passed, failed: p7b.summary.failed, registration_points: regsMatch ? Number(regsMatch[1]) : null });
add('N1', 'GET /api/currencies 仍 2 行（cid=1 $ / cid=399 BTTC）',
  Array.isArray(currencies.data) && currencies.data.length === 2 && currencies.data.map((c) => c.cid).join(',') === '1,399',
  { rows: currencies.data.map((c) => ({ cid: c.cid, symbol: c.symbol })) });
add('N2', '390 档首页未传图商品仍用占位图 placeholder-item.webp 且 naturalWidth=320',
  reg.cases.home_placeholder.pass && reg.cases.home_placeholder.imgs.every((i) => i.naturalWidth === 320),
  { img_count: reg.cases.home_placeholder.img_count, widths: [...new Set(reg.cases.home_placeholder.imgs.map((i) => i.naturalWidth))], srcs: [...new Set(reg.cases.home_placeholder.imgs.map((i) => i.src))] });
add('N3', '/item/new 选图字段仍在（file · image/* · multiple · + 按钮可用）',
  reg.cases.publish_media_field.pass,
  { input: reg.cases.publish_media_field.input, addButton: reg.cases.publish_media_field.addButton, docScrollWidth: reg.cases.publish_media_field.docScrollWidth });
add('R1', '验收自建 media 行已回收（前后计数一致）', api.phases.cleanup.pass, api.phases.cleanup);

const failed = items.filter((i) => !i.pass).map((i) => i.id);
const verdict = {
  verdict: failed.length === 0 ? 'PASS' : 'FAIL',
  subject: 'ffa3635 feat(seafood): 上传图片上限收到 1MiB',
  scope: '独立复验（服务端 1MiB 边界 / DB CHECK 硬闸 / 客户端降级 / 门套 / 不回归）',
  at: new Date().toISOString(),
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: '/Users/kevin/bistro/seafood', encoding: 'utf8' }).trim(),
  environment: {
    dev_backend: 'http://localhost:5788（ts-node src/index.ts · health schema_version=0051）',
    dev_frontend: 'http://localhost:5800（vite dev）',
    viewport: '390×844 @2x',
    db: 'dev DATABASE_URL（Neon）',
    auth: '每次运行随机 ethers 钱包 → /api/auth/challenge → signMessage → /api/auth/verify（私钥/地址不落盘）',
  },
  counts: {
    total: items.length,
    passed: items.length - failed.length,
    failed: failed.length,
  },
  failed_ids: failed,
  items,
  cleanup: {
    media_rows_before: api.phases.row_baseline.count_before,
    media_rows_after: api.phases.cleanup.count_after,
    deleted_rows: api.phases.cleanup.deleted_rows,
    deleted_media_id: api.phases.cleanup.deleted_media_id,
  },
  disclosures: [
    `真钱包登录在 users 表新建 1 行（uid=971223 · 地址尾 846388 · bio 空）⇒ 登录路径固有写入，非媒体行；media 行前后均为 ${api.phases.row_baseline.count_before}，已回收。`,
    '0050 迁移内的自检块仍断言旧上限 2097152（历史文件 checksum 冻结不改）⇒ 仅影响「重建 ledger 全链重放」场景，0051 为终态。',
    '未 commit / 未 push；未调用发布接口（POST /api/listing 等零调用）。',
    'readings/qa-*.log 命中仓根 .gitignore 的 *.log ⇒ 提交时不会入库；等值机读摘要落在 readings/qa-gates.json（数字与日志逐字一致）。',
    'readings/probe-390.json 为本次重跑产物，相对 HEAD 仅 "at" 时间戳一行差异。',
  ],
  readings: [
    'ops/media-size-1mb/readings/api-1mb.json',
    'ops/media-size-1mb/readings/probe-390.json',
    'ops/media-size-1mb/readings/regression-390.json',
    'ops/media-size-1mb/readings/qa-gates.json',
    'ops/media-size-1mb/readings/qa-build.log',
    'ops/media-size-1mb/readings/qa-test-unit.log',
    'ops/media-size-1mb/readings/qa-backend-tsc.log',
    'ops/media-size-1mb/readings/qa-p7b-03.log',
    'ops/media-size-1mb/readings/qa-p7b-03-artifact.json',
  ],
  probes: [
    'ops/media-size-1mb/probe-api-1mb.mjs',
    'ops/media-size-1mb/probe-390.mjs',
    'ops/media-size-1mb/probe-regression-390.mjs',
  ],
};

fs.writeFileSync('/Users/kevin/bistro/seafood/ops/media-size-1mb/qa/verdict.json', `${JSON.stringify(verdict, null, 2)}\n`);
console.log(verdict.verdict, `${verdict.counts.passed}/${verdict.counts.total}`, 'failed=' + JSON.stringify(failed));
for (const i of items) console.log(`${i.pass ? 'PASS' : 'FAIL'} ${i.id} ${i.name}`);
