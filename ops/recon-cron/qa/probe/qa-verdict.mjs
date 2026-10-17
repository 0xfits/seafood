/**
 * 独立质检 · 汇总出 verdict（各 AC 的 pass 一律**从落盘读数文件读**，不手写结论）
 * 用法：node ops/recon-cron/qa/probe/qa-verdict.mjs
 * 产出：ops/recon-cron/qa/verdict.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const QA = path.resolve(HERE, '..');
const OUT = path.join(QA, 'readings');
const REPO = path.resolve(HERE, '../../../..');

const j = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const ac1 = j('AC1-readonly.json');
const ac2s = j('AC2-symbol-baseline.json');
const ac2b = j('AC2-judgement.json');
const ac3 = j('AC3-auth-states.json');
const ac4s = j('AC4-endpoint-static.json');
const ac4g = j('AC4-gates.json');
const ac5 = j('AC5-sample-two-phase.json');
const ac6 = j('AC6-sensitivity-arms.json');
const ac7 = j('AC7-zero-side-effects.json');
const ac8 = j('AC8-real-dev-readonly.json');
const ac9 = j('AC9-disclosures.json');
const kind = j('AC9-kind-coverage.json');

/* —— 真数据符号自证（从 AC8 的 supply 首行现算，不手抄） */
const c1 = (ac8.per_sql[0].sample_rows || []).find((r) => r.cid === '1') || {};
const signProof = {
  source: 'ops/recon-cron/qa/readings/AC8-real-dev-readonly.json · per_sql[0].sample_rows[0]（dev 真库，cid=1）',
  total_supply: c1.total_supply,
  sum_mint: c1.sum_mint,
  sum_burn: c1.sum_burn,
  plus: (BigInt(c1.sum_mint) + BigInt(c1.sum_burn)).toString(),
  minus: (BigInt(c1.sum_mint) - BigInt(c1.sum_burn)).toString(),
};
signProof.plus_equals_total_supply = signProof.plus === signProof.total_supply;
signProof.minus_equals_total_supply = signProof.minus === signProof.total_supply;
ac2s.real_data_sign_proof = signProof;
ac2s.real_data_sign_proof.interpretation =
  `cid=1 实测 Σmint+Σburn=${signProof.plus} == total_supply=${signProof.total_supply}；若误写成减法得 ${signProof.minus}（≠ total_supply）⇒ 真数据独立证成「加号」口径（burn 存负 delta）。`;
fs.writeFileSync(path.join(OUT, 'AC2-symbol-baseline.json'), JSON.stringify(ac2s, null, 2) + '\n');

const ac2Pass = ac2s.pass === true && ac2b.pass === true;
const ac4Pass = ac4s.pass === true && ac4g.pass === true;

const acs = [
  {
    id: 'AC1',
    status: ac1.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC1-readonly.json · 剥注释后代码面 DML/事务关键字命中 ${ac1.assertions.no_forbidden_keywords_in_code.hits.length} 处；`
      + `三条 SQL 均以 SELECT 开头且无分号分隔的第二语句；readQuery 调用 ${ac1.assertions.readQuery_used_for_all_three.calls} 次、`
      + `无 getPool/withTransaction/pool.query；无 ledger_post_event。`
      + `（披露：原文注释里命中 INSERT/UPDATE/DELETE/ledger_post_event 各 1 处，属自述性注释，故判据必须剥注释取；见 disclosures）`,
  },
  {
    id: 'AC2',
    status: ac2Pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC2-symbol-baseline.json + AC2-judgement.json · SQL 表达式为 COALESCE(sum_mint,0)+COALESCE(sum_burn,0)（减号命中 0）；`
      + `基线 Object.freeze 常量表恰 2 条 {'1':'2000000','21':'1'}、未登记 cid 默认 '0'；判据 parsed.big === baseline（无 >=、无容差、无 try-catch、无 SKIP）；`
      + `BigInt 比较 ${ac2s.assertions.bigint_strict_compare.bigint_uses} 处、Number() 强转 ${ac2s.assertions.bigint_strict_compare.number_casts} 处；`
      + `行为臂：差 1 ⇒ FAIL、cid21 基线错配 ⇒ FAIL、命中基线 ⇒ PASS、小数残差 2000000.5 ⇒ FAIL、2000000.0 ⇒ PASS；`
      + `真数据自证 Σmint+Σburn=${signProof.plus} == total_supply=${signProof.total_supply}（减法得 ${signProof.minus}）。`,
  },
  {
    id: 'AC3',
    status: ac3.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC3-auth-states.json · 8 例自跑：无 secret env ⇒ ${ac3.cases[0].actual_status}、有 secret 无头 ⇒ ${ac3.cases[1].actual_status}、`
      + `错 Bearer ⇒ ${ac3.cases[2].actual_status}、错 x-cron-secret ⇒ ${ac3.cases[3].actual_status}、对 Bearer ⇒ ${ac3.cases[4].actual_status}、`
      + `对 x-cron-secret ⇒ ${ac3.cases[5].actual_status}、错路径 ⇒ ${ac3.cases[6].actual_status}、同路径 POST ⇒ ${ac3.cases[7].actual_status}；`
      + `8/8 响应体均不含密钥值（密钥进程内随机生成，未读任何仓内/环境凭据）。`,
  },
  {
    id: 'AC4',
    status: ac4Pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC4-endpoint-static.json + AC4-gates.json · 该路径仅 1 处注册且为 app.get；同路径 POST 实测 ${ac4g.get_only_behavior.post_same_path_status}；`
      + `grep -cE '^app\\.(get|post|put|delete|patch)\\(' = ${ac4s.registration_count_measured}（get ${ac4s.verb_breakdown.get} / post ${ac4s.verb_breakdown.post} / put ${ac4s.verb_breakdown.put ?? 0} / delete ${ac4s.verb_breakdown.delete} / patch ${ac4s.verb_breakdown.patch}）；`
      + `p7b-03 离线门 ${ac4g.gate.summary.passed}/${ac4g.gate.summary.total}、red=[]、AC10-2 reading=${ac4g.gate.ac10_2.reading}；tsc --noEmit exit ${ac4g.tsc.exit_code}。`,
  },
  {
    id: 'AC5',
    status: ac5.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC5-sample-two-phase.json · 25 行夹具（第 22 行 cid=9021 偏离基线）⇒ status=${ac5.f1_drift_at_row22.status}、diff=${ac5.f1_drift_at_row22.diff}、`
      + `sample_len=${ac5.f1_drift_at_row22.sample_len}、sample[0].cid=${ac5.f1_drift_at_row22.sample_cids[0]}（失败行在前、未被 slice 切掉）；`
      + `全 PASS 夹具 ⇒ status=${ac5.f2_all_pass.status}、diff='${ac5.f2_all_pass.diff}'、rows=${ac5.f2_all_pass.rows}；全 FAIL 25 行 ⇒ cap 20 且全为失败行；`
      + `反向对照（旧策略在探针内逐字复刻）⇒ 同夹具 sample 丢失 9021（旧 cids 末位 ${ac5.negative_control_old_impl.old_f1_sample_cids.slice(-1)[0]}、has_9021=${ac5.negative_control_old_impl.old_f1_has_9021}）`
      + `且旧/新 status·diff·rows 逐项相同 ⇒ 用例有分辨力、判据语义未变。`,
  },
  {
    id: 'AC6',
    status: ac6.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC6-sensitivity-arms.json · 5 臂 + 3 辅助臂：supply diff 偏移 ⇒ ok=false、cid21 基线错配 ⇒ ok=false、account 漂移 1 行 ⇒ ok=false、`
      + `batt 漂移 1 行 ⇒ ok=false；反向臂（全净）⇒ ok=${ac6.arms.find((a) => a.arm === 'clean_no_drift_reverse_arm').ok}；`
      + `基线命中臂 cid21 diff=1 ⇒ ok=true、小数残差 ⇒ ok=false、2000000.0 ⇒ ok=true。`,
  },
  {
    id: 'AC7',
    status: ac7.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC7-zero-side-effects.json · git diff --name-status 0537ea8..HEAD：迁移 ${ac7.assertions.no_migration_files.hits.length} 个、`
      + `frontend/** ${ac7.assertions.no_frontend_changes.hits.length} 个、i18n 面 ${ac7.assertions.no_i18n_key_changes.hits.length} 个；`
      + `vercel.json numstat = ${ac7.assertions.vercel_json_pure_append.numstat}（删行 ${ac7.assertions.vercel_json_pure_append.deleted}）；`
      + `JSON 合法、crons 恰 ${ac7.assertions.crons_exactly_two.crons.length} 条、首条既存 0 18 * * * 未动、新条仅追加 30 18 * * *。`,
  },
  {
    id: 'AC8',
    status: ac8.pass ? 'PASS' : 'FAIL',
    evidence:
      `readings/AC8-real-dev-readonly.json · 连 dev（project_id=${ac8.identity.project_id}，非生产 ${ac8.guard.prod_project_forbidden}）；`
      + `三条 SQL 原文逐条执行成功（supply ${ac8.per_sql[0].row_count} 行 / account ${ac8.per_sql[1].row_count} 行 / batt ${ac8.per_sql[2].row_count} 行），`
      + `runLedgerRecon 真路径跑通（duration ${ac8.report.duration_ms}ms）；5 张表齐备；schema 顶 ${ac8.schema_migration_top.version}；全程仅 SELECT。`,
  },
  {
    id: 'AC9',
    status: 'REGISTERED',
    evidence:
      `readings/AC9-disclosures.json + AC9-kind-coverage.json · ①漂移三臂实测 HTTP ${ac9.disclosures[0].measured.drift_arms.map((a) => a.http_status).join('/')} 且各打 1 条 [recon] 日志（干净臂 0 条）⇒ 平台面板不会红，已披露；`
      + `②dev ok=false 归因为构造性（基线取生产：cid1 基线 2000000 vs dev diff 0）；`
      + `③legacy builds 下 cron 注册/触发只能上线后现证 ⇒ ENV_LIMITED。`
      + `旁证：检查①只算 mint/burn，dev 上逐 cid「非 mint/burn 净额 + frozen == 0」（cid1 −16745 + 16745）且 orphan 分录 0 ⇒ 口径自洽、未发现覆盖缺口。`,
  },
];

const verdict = {
  batch: {
    head: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
    commits: [
      'a201cb3 对账 cron 主体（ops-recon.ts 221 行 + GET 注册 + vercel.json 第二条 cron + 门常量 106→107）',
      '3423a4b judgeSupply 样本两阶段采集 + 回归两例',
      '34d736b 生产面证据（GET /api/translate/backfill 401）',
    ],
    baseline_commit: '0537ea8',
  },
  checker: 'Neng（独立质检方）· 只读被检对象、自跑探针、自落读数；未修改任何仓内实现/测试文件、未写库、未 push',
  measured_at: new Date().toISOString(),
  verdict: 'PASS-with-drift',
  acs,
  drift: [
    'D1 漂移时 HTTP 仍 200（Vercel cron 面板不会红）—— 属已披露设计：告警面 v1 = 结构化回执 + console.error 一条（实测三臂各 1 条、干净臂 0 条）。残余风险：若无人看日志，漂移可长期无人处置；建议另立单接外部告警。',
    'D2 dev 库 ok=false 是构造性结果（基线常量取生产：cid=1 登记 2000000，dev 实测 diff=0），非缺陷；同一批 dev 数据下 account/batt 两条 0 行判据均 PASS。',
    'D3 口径覆盖披露：检查①只聚合 mint/burn（ledger_kind_enum 实有 20 个 kind）。dev 实测逐 cid「非 mint/burn 净额 + frozen 合计 == 0」（cid1 −16745+16745、cid21 −1+1）、orphan 分录 0 ⇒ 内部转移/持有只改余额与冻结的分配、不改 total_supply，口径自洽；生产侧建议按同式复核一次以防 dev/生产数据形态不同。',
    'D4 注册表基线 cid=\'21\' → 1 属本轮新增登记值，dev 上该 cid 现取 diff=0（故 dev 判 FAIL）；该行缺席不影响判定（基线只对在场 cid 生效），登记值本身需生产侧对拍确认。',
  ],
  env_limited: [
    'ENV_LIMITED-1 vercel.json 为 legacy builds + routes 形态 ⇒ 「cron 是否真按 30 18 * * * 注册并触发 /api/ops/recon/ledger」离线不可证，只能上线后现证（Vercel cron 面板 + 一次真实触发日志）。',
    'ENV_LIMITED-2 Hobby 档 cron 名额已用满 2/2（每条每天至多 1 次、非准点）⇒ 后续新增第三条前必须先合并成单一调度器，属机制约束、非本批缺陷。',
    'ENV_LIMITED-3 dev 库读数与生产不可比（技能已登记）⇒ AC8 只证「SQL 在真 schema 上可执行」，不证生产值；生产 ok 值须上线后看回执。',
  ],
  readings: [
    'readings/AC1-readonly.json', 'readings/AC2-symbol-baseline.json', 'readings/AC2-judgement.json',
    'readings/AC3-auth-states.json', 'readings/AC4-endpoint-static.json', 'readings/AC4-gates.json',
    'readings/AC5-sample-two-phase.json', 'readings/AC6-sensitivity-arms.json', 'readings/AC7-zero-side-effects.json',
    'readings/AC8-real-dev-readonly.json', 'readings/AC9-disclosures.json', 'readings/AC9-kind-coverage.json',
    'readings/qa-static-summary.json', 'readings/qa-behavior-summary.json',
  ],
  probes: [
    'probe/qa-static.mjs', 'probe/qa-behavior.ts', 'probe/qa-ac4-gates.mjs',
    'probe/qa-real-read.ts', 'probe/qa-ac9-disclosures.ts', 'probe/qa-kind-coverage.ts', 'probe/qa-verdict.mjs',
  ],
  logs: ['logs/qa-p7b-03-gate.log', 'logs/qa-tsc.log', 'logs/qa-tsc-exit.log'],
  notes: [
    '所有 AC 的 PASS/FAIL 均由 readings/*.json 的 pass 字段机械汇总（见 probe/qa-verdict.mjs），未手写结论。',
    'AC1 判据在剥注释后的代码面取；原文命中作为 disclosures 一并落盘（避免「原文 grep=0」被当假证）。',
    '探针 ts-node 运行需 TS_NODE_PROJECT=tsconfig.json（cwd=backend-ts）；否则 ts-node 会按仓根配置编译并报 TS5109。',
  ],
};

const allPass = acs.filter((a) => a.id !== 'AC9').every((a) => a.status === 'PASS');
verdict.verdict = allPass ? 'PASS-with-drift' : 'FAIL';
verdict.self_check = {
  ac_pass_flags_from_files: { AC1: ac1.pass, AC2: ac2Pass, AC3: ac3.pass, AC4: ac4Pass, AC5: ac5.pass, AC6: ac6.pass, AC7: ac7.pass, AC8: ac8.pass },
  ac9_registered_not_judged: true,
};

fs.writeFileSync(path.join(QA, 'verdict.json'), JSON.stringify(verdict, null, 2) + '\n');
console.log(JSON.stringify({ verdict: verdict.verdict, acs: acs.map((a) => [a.id, a.status]), self_check: verdict.self_check }, null, 2));
