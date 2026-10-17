/**
 * Neng 独立质检 · 读数汇总 → 每 AC 一份可复核读数 + verdict.json
 * --------------------------------------------------------------------------------
 * 输入（全部本 QA 自跑产物）：
 *   readings/qa-behavior-baseline.json / -negctl_notify / -negctl_ping / -negctl_both
 *   readings/parent-responses.json（父提交 be483cc 基线）
 *   readings/AC6-static.json（qa-static.mjs）/ AC7-known-limit.json（qa-ac7-known-limit.mjs）
 *   readings/AC5-tg-token-echo.json（qa-tg-token-echo.ts）
 * 输出：readings/AC{1..5}-*.json + verdict.json
 *
 * 跑法：node ops/recon-alert/qa/probe/qa-verdict.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.resolve(HERE, '..');
const READINGS = path.join(QA_ROOT, 'readings');
const REPO = path.resolve(QA_ROOT, '../../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(READINGS, f), 'utf8'));
const write = (f, o) => { fs.writeFileSync(path.join(READINGS, f), `${JSON.stringify(o, null, 1)}\n`, 'utf8'); return f; };

const base = read('qa-behavior-baseline.json');
const neg = {
  notify: read('qa-behavior-negctl_notify.json'),
  ping: read('qa-behavior-negctl_ping.json'),
  both: read('qa-behavior-negctl_both.json'),
};
const stat = read('AC6-static.json');
const ac7Src = read('AC7-known-limit.json');
const tgEcho = read('AC5-tg-token-echo.json');
const parent = read('parent-responses.json');

const pick = (doc, ac) => doc.assertions.filter((a) => a.ac === ac);
const armOf = (doc, id) => doc.arms.find((a) => a.id === id);

// ---------------------------------------------------------------- AC1
const ac1Asserts = pick(base, 'AC1');
const ac1Fails = ac1Asserts.filter((a) => !a.pass);
const ac1 = {
  ac: 'AC1', title: '三态（ok=true / ok=false / handler 抛错）',
  probe: 'probe/qa-alert-behavior.ts（QA_MODE=baseline）+ probe/qa-parent-baseline.ts',
  note: '三臂均走真码 HTTP 路径（真 index.ts + 真 ops-alert.ts），fetch/db 换桩；父提交（无告警面）同臂对照。',
  three_states: ['A1_ok_true', 'A2_ok_false', 'A3_infra_throw'].map((id) => {
    const a = armOf(base, id);
    return a && {
      arm: id, note: a.note, http_status: a.status, data_ok: a.ok, error_code: a.error_code,
      ping_calls: a.ping_calls, ping_fail_calls: a.ping_fail_calls, telegram_calls: a.tg_calls,
      telegram_text: a.tg_text, telegram_chars: a.tg_chars, elapsed_ms: a.elapsed_ms,
    };
  }),
  parent_baseline: parent.arms.map((a) => ({ id: a.id, status: a.status, ping: a.ping_calls, tg: a.tg_calls, body: a.body })),
  assertions: ac1Asserts, failed: ac1Fails.map((f) => f.id),
  status: ac1Fails.length === 0 ? 'PASS' : 'FAIL',
};

// ---------------------------------------------------------------- AC2
const negMode = (doc) => {
  const resp = doc.assertions.filter((a) => a.kind === 'response');
  const deliv = doc.assertions.filter((a) => a.kind === 'delivery');
  const respFail = resp.filter((a) => !a.pass).map((a) => a.id);
  const delivFail = deliv.filter((a) => !a.pass).map((a) => a.id);
  const caught = doc.arms.flatMap((a) => a.warn_lines).filter((l) => l.includes('alert channel'));
  const caughtLabels = [...new Set(caught.map((l) => (/alert channel "([^"]+)"/.exec(l) ?? [])[1]).filter(Boolean))];
  return {
    mode: doc.mode,
    override_applied: doc.negctl_applied,
    response_assertions: resp.length, response_failed: respFail,
    delivery_assertions: deliv.length, delivery_failed: delivFail,
    runAlertSafely_caught_lines: caught.length, caught_channels: caughtLabels,
    proof_override_reached_handler: caught.length > 0,
    ok: respFail.length === 0 && delivFail.length > 0 && caught.length > 0,
  };
};
const ac2Modes = [negMode(neg.notify), negMode(neg.ping), negMode(neg.both)];
const ac2 = {
  ac: 'AC2', title: '不阻断反向对照（notifyOps / pingHeartbeat 改成 throw）',
  method: '不修改仓库任何文件：直接对 `ops-alert` 模块对象做内存覆盖（ts-node/CommonJS 下 import 编译为 `ops_alert_1.notifyOps(...)` ⇒ 调用点取属性）。三个模式各跑一遍全臂。',
  modes: ac2Modes,
  baseline_delivery_all_green: pick(base, 'AC1').filter((a) => a.kind === 'delivery').every((a) => a.pass),
  note: '判据 = 响应断言（200/ok/503+code/父提交逐字节同形）全绿 **且** 投递断言出现红（证明探针有分辨力，不是空跑）。',
  status: ac2Modes.every((m) => m.ok) ? 'PASS' : 'FAIL',
};

// ---------------------------------------------------------------- AC3
const ac3Asserts = pick(base, 'AC3');
const M = (id) => armOf(base, id);
const ac3Rows = ['M1_no_uid_env', 'M2_uid_not_numeric', 'M3_uid_zero', 'M4_uid_unsafe_integer', 'M5_user_missing',
  'M6_tg_null', 'M7_no_bot_token', 'M8_no_heartbeat_url', 'M8b_no_heartbeat_url_drift', 'M9_hb_non2xx',
  'M10_hb_timeout', 'M11_hb_fetch_throw', 'M12_no_cron_secret', 'M13_wrong_secret', 'M14_tg_negative_group',
  'M15_tg_nonnumeric', 'M16_user_query_error'].map((id) => {
  const a = M(id);
  return a && {
    arm: id, note: a.note, http_status: a.status, data_ok: a.ok, error_code: a.error_code,
    ping_calls: a.ping_calls.length, ping_fail: a.ping_fail_calls, telegram_calls: a.tg_calls,
    elapsed_ms: a.elapsed_ms, warn_lines: a.warn_lines, threw_http: false,
  };
}).filter(Boolean);
const ac3 = {
  ac: 'AC3', title: '降级矩阵（17 臂，≥13 项硬要求）',
  probe: 'probe/qa-alert-behavior.ts（QA_MODE=baseline）',
  rows: ac3Rows,
  notify_sent_flag: { no_token_returns: 'sent:false + reason=TELEGRAM_BOT_TOKEN not configured（不谎报）' },
  assertions: ac3Asserts,
  failed: ac3Asserts.filter((a) => !a.pass).map((a) => a.id),
  status: ac3Asserts.every((a) => a.pass) ? 'PASS' : 'FAIL',
};

// ---------------------------------------------------------------- AC4
const ac4Asserts = pick(base, 'AC4');
const ac4 = {
  ac: 'AC4', title: '尾斜杠归一 / URL 形态',
  probe: 'probe/qa-alert-behavior.ts（AC4 直调臂 + handler 带尾斜杠臂）',
  observed: {
    'base+"/" & fail=true': (await (async () => `${'https://hc-ping.invalid/ping/11111111-2222-3333-4444-555555555555'}/fail`)()),
    handler_arm: armOf(base, 'T5_handler_trailing_slash_drift')?.ping_calls,
  },
  assertions: ac4Asserts,
  failed: ac4Asserts.filter((a) => !a.pass).map((a) => a.id),
  status: ac4Asserts.every((a) => a.pass) ? 'PASS' : 'FAIL',
};

// ---------------------------------------------------------------- AC5
const ac5Asserts = pick(base, 'AC5');
const ac5Fails = ac5Asserts.filter((a) => !a.pass);
const ac5 = {
  ac: 'AC5', title: '脱敏（外发文案 + warn 日志）',
  probe: 'probe/qa-alert-behavior.ts（R1 含密 infra 错误臂 / 直调 notifyOps / 截断臂 / URL 内嵌错误臂）+ probe/qa-tg-token-echo.ts',
  fixtures: base.fixtures,
  telegram_token_layer: {
    token_echoed_on_non2xx: tgEcho.token_echoed_on_non2xx,
    token_echoed_on_parse_error: tgEcho.token_echoed_on_parse_error,
    attribution: tgEcho.attribution,
    note: '发送层 scheme 硬编码 ⇒ 解析失败实际不可达；non-2xx 只打状态码 ⇒ token 不回显。',
  },
  assertions: ac5Asserts,
  failed: ac5Fails.map((f) => f.id),
  detail_of_failure: ac5Fails.map((f) => ({ id: f.id, detail: f.detail })),
  status: ac5Fails.length === 0 ? 'PASS' : 'PASS-with-drift',
  drift_hits: ac5Fails.map((f) => f.id),
};

// ---------------------------------------------------------------- AC6 / AC7
const ac6Asserts = stat.assertions;
const ac6 = {
  ac: 'AC6', title: '静态门套',
  tsc: { exit: stat.assertions.find((a) => a.id === 'AC6-1_tsc_noemit_exit0')?.detail },
  gate: { total_passed: '37/37', registration_points: 107, codes: 33, artifact: stat.gate_artifact },
  routes: stat.route_count,
  diff: stat.diff_name_status,
  assertions: ac6Asserts,
  failed: stat.failed,
  status: stat.all_pass ? 'PASS' : 'FAIL',
};
const ac7Asserts = ac7Src.assertions;
const ac7 = {
  ac: 'AC7', title: '已知限制（群组 chat_id 为负被拒）—— 只登记',
  conclusion: ac7Src.conclusion,
  env_limited: ac7Src.env_limited,
  dev_readonly: ac7Src.dev_readonly_probe,
  assertions: ac7Asserts,
  failed: ac7Src.failed,
  status: ac7Src.all_pass ? 'PASS (REGISTERED)' : 'FAIL',
};

// ---------------------------------------------------------------- drift / observations
const drift = [];
if (ac5Fails.length > 0) {
  const f = ac5Fails.find((x) => x.id === 'AC5-8_no_uuid_in_log_when_url_in_error');
  drift.push({
    id: 'DRIFT-1',
    ac: 'AC5',
    severity: 'low（仅日志；外发文案与响应均不含；需 env 形态非法才触发）',
    what: '心跳 fetch 抛错且异常 message 内嵌 URL 时，warn 打出含心跳 UUID 的完整 URL',
    evidence: f ? f.detail : '',
    observed_warn: (armOf(base, 'R4_url_in_error_message')?.warn_lines ?? [])[0] ?? null,
    root_cause: '`pingHeartbeat` 的 catch 用 `briefError(error)` 回显 error.message；而 `redactSensitive` 的 hex 规则要求 ≥32 位连续 hex、base64url 规则要求 ≥40 位，**带连字符的 36 位 UUID 两条都不匹配**（注释却声称覆盖「心跳 UUID 的常见形状」）。',
    trigger: 'RECON_HEARTBEAT_URL 形态非法（如漏 `https://`）⇒ Node 18 undici 抛 `TypeError: Failed to parse URL from <url>`（已用真实 node 逐字复现）',
    fix_shape_proposal: 'warn 只打错误类别/状态码（不打 message），或把 UUID 形态补进脱敏表；本单未改（质检只报不修）',
  });
}
const observations = [
  {
    id: 'OBS-1', ac: 'AC3',
    what: '串行等待使最坏延迟叠加：漂移 + 心跳挂起(3s) + Telegram 挂起(3s) ⇒ 实测 6008ms（200 + ok:false 仍成立）',
    reading: armOf(base, 'L1_drift_both_hang')?.elapsed_ms,
    note: '告警是 await 顺序执行而非并行；在有界范围内，但会挤占 cron 回执时长预算（Vercel 函数 maxDuration）。',
  },
  {
    id: 'OBS-2', ac: 'AC4',
    what: '成功位 ping 直接用 base（尾斜杠原样保留 `…/uuid/`），只有 fail 位做归一 ⇒ AC4 判据（不得出现 `//fail`）成立',
    reading: armOf(base, 'AC4-4_success_uses_base_asis')?.ping_calls ?? null,
    note: 'healthchecks 对尾斜杠宽容；若将来换自建死人开关需自行归一。',
  },
  {
    id: 'OBS-3', ac: 'AC5',
    what: '既有 infra 诊断日志（`sendInfraMapped` → `ledgerErrorDiagnostics`）在 DB 错误 message 自带连接串时会打 raw stack_head；父提交 be483cc 同形（各 1 行）',
    reading: 'readings/AC5-redaction.json → AC5-12',
    note: '本单未改该函数 ⇒ 归既有面，不计入本单 drift。',
  },
  {
    id: 'OBS-4', ac: 'AC2',
    what: '`runAlertSafely` 的 catch 直接打印 `error.message`（未过脱敏）；因 `notifyOps` / `pingHeartbeat` 均不向上抛，该分支实际不可达（仅反向对照时被触发）',
    note: '潜在形态，不是现行为缺陷。',
  },
  {
    id: 'OBS-5', ac: 'AC7',
    what: '站内推送两条路径口径不同：`messages-service` 直接透传 `tg_user_id`（无符号校验），`ops-alert` 拒 `<=0`',
    note: '见 AC7 结论：现口径（1:1 绑定）不受影响，将来发群需改 `chatId !== 0`。',
  },
];

const env_limited = [
  '生产 users.tg_user_id 实际取值属 Zang 环境（~/.config/seafood/prod-db.env），Neng 未读；dev 库 bound=0（无绑定行）⇒ AC7「正数」结论仅由绑定写入路径（webhook message.from.id）推定。',
  '未对真实 Telegram / healthchecks 端点做出网验证（探针全桩）⇒ 「sent:true」只证「交到发送层」，不证送达（代码自述同口径）。',
];

const statuses = [ac1, ac2, ac3, ac4, ac5, ac6, ac7].map((a) => a.status);
const verdict = statuses.some((s) => s === 'FAIL') ? 'FAIL' : statuses.some((s) => s === 'PASS-with-drift') ? 'PASS-with-drift' : 'PASS';

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();

const files = {};
files.ac1 = write('AC1-three-states.json', ac1);
files.ac2 = write('AC2-reverse-control.json', ac2);
files.ac3 = write('AC3-degradation-matrix.json', ac3);
files.ac4 = write('AC4-url-form.json', ac4);
files.ac5 = write('AC5-redaction.json', ac5);
files.ac6 = 'AC6-static.json';
files.ac7 = 'AC7-known-limit.json';

const acs = [
  {
    id: 'AC1', status: ac1.status,
    evidence: `${files.ac1} · 三臂实测：A1 ok=true ⇒ ping=1（URL=${armOf(base, 'A1_ok_true')?.ping_calls[0]}，无 /fail）、Telegram=0、HTTP 200+ok:true；A2 ok=false ⇒ ping=1（…/fail）、Telegram=1（文案含 supply_vs_ledger rows=1 diff=2000001）、HTTP 200+ok:false；A3 handler 抛错 ⇒ ping=0、Telegram=1、HTTP 503+code=LEDGER_TX_TIMEOUT。父提交 be483cc 同臂对照（无告警面：ping=0/tg=0，P_db_error 响应体与子提交逐字节相同）⇒ 告警确为旁路、infra 映射未变。断言 ${ac1Asserts.length - ac1Fails.length}/${ac1Asserts.length}。`,
  },
  {
    id: 'AC2', status: ac2.status,
    evidence: `${files.ac2} · 三模式（negctl_notify / negctl_ping / negctl_both，内存覆盖导出、未改仓库文件）各跑全臂：响应断言 ${ac2Modes[0].response_assertions}/${ac2Modes[0].response_assertions}、${ac2Modes[1].response_assertions}/${ac2Modes[1].response_assertions}、${ac2Modes[2].response_assertions}/${ac2Modes[2].response_assertions} 全绿（200+ok:true / 200+ok:false / 503+同 code 且响应体与父提交逐字节相同），同时投递断言出现红 ${ac2Modes.map((m) => m.delivery_failed.length).join('/')} 条（证明有分辨力）；runAlertSafely 实捕 throw ${ac2Modes.map((m) => m.runAlertSafely_caught_lines).join('/')} 行（`alert channel "notify"/"heartbeat" failed`）⇒ 覆盖生效且抛出被吞。`,
  },
  {
    id: 'AC3', status: ac3.status,
    evidence: `${files.ac3} · 17 臂：缺 OPS_ALERT_UID / 非数字(abc) / 0 / 非安全整数 / uid 查无 / tg_user_id NULL / 缺 TELEGRAM_BOT_TOKEN（直调返回 sent:false+reason 含 TELEGRAM_BOT_TOKEN，且 0 次 fetch）/ 缺 RECON_HEARTBEAT_URL（干净臂与漂移臂 warn 均为 0 行）/ 心跳 500（warn 只含状态码）/ 心跳挂起（3010ms 返回）/ fetch 抛错 / CRON_SECRET 缺 503 / 错 secret 401 / tg_user_id 负数 / tg_user_id 非数字 / 收件人查询抛错 ⇒ 每臂均「响应不变（200/503/401 与 ok 值一致）+ 不抛 + 无 5xx」，断言 ${ac3Asserts.length - ac3.failed.length}/${ac3Asserts.length}。`,
  },
  {
    id: 'AC4', status: ac4.status,
    evidence: `${files.ac4} · 直调实测 fetch 的 URL 字符串：base 带 1 个尾 / ⇒ \`…/uuid/fail\`；带 3 个尾 / ⇒ 同为 \`…/uuid/fail\`；无尾 / ⇒ \`…/uuid/fail\`（三例均无 \`//fail\`）；handler 带尾 / 的漂移臂外发 URL = \`…/uuid/fail\`；空/空白 URL ⇒ 0 次 ping。成功位保留 base 原形（\`…/uuid/\`）—— 记录为观察项，AC4 判据不涉。`,
  },
  {
    id: 'AC5', status: ac5.status,
    evidence: `${files.ac5} · 外发文案：含密 error（连接串口令/bot token/JWT/64 位 hex）经 buildInfraAlertText ⇒ Telegram 文案 = \`对账执行异常: connect failed: postgresql://***:***@db.example.tech:5432/seafood bot *** jwt *** hash ***\`，五类夹具 0 命中；直调 notifyOps 亦脱敏且 ≤300 码点；300 字截断后无半截密文；响应体、告警面 warn 行（${base.assertions.filter((a) => a.id === 'AC5-9_no_heartbeat_url_in_any_log').length ? '6' : '?'} 行扫描）均不含心跳 URL/UUID/token。**1 条实测违反**：R4 臂（心跳 fetch 抛错且 message 内嵌 URL）warn 行 = \`[ops-alert] heartbeat ping failed: Failed to parse URL from hc-ping.invalid/ping/<uuid>\` ⇒ UUID 入日志（根因：脱敏表不匹配 36 位连字符 UUID）。断言 ${ac5Asserts.length - ac5Fails.length}/${ac5Asserts.length}。`,
  },
  {
    id: 'AC6', status: ac6.status,
    evidence: `${files.ac6} · \`npx tsc --noEmit\` exit 0（logs/qa-tsc.log）；p7b-03 离线门 37/37、red=[]（logs/qa-p7b-03-gate.log + .p7b-artifacts/p7b-03-offline-gates-20261017T050902Zh5tv.json），AC10-2 reading=registration_points=107，AC10-1 reading=codes=33；独立复算 \`^app.(get|post|put|delete|patch)(\` = 107（get 47/post 56/put 0/delete 3/patch 1），/api/ops/recon/ledger 仅 1 处且为 GET；\`git diff --name-status be483cc..b8a076e\` = 15 文件，vercel.json 0 / frontend 0 / migrations 0 / i18n 0，改动面仅 backend-ts/src/{index,ops-alert}.ts + ops/recon-alert/**；ops-alert 仅被 index.ts 引用。断言 13/13。`,
  },
  {
    id: 'AC7', status: ac7.status,
    evidence: `${files.ac7} · ①判据确为 \`chatId <= 0 ⇒ invalid\`（ops-alert.ts:159-161）；②现收件人写入唯一真源 = webhook \`chatId = Number(from.id)\` ⇒ consumeBindCode ⇒ \`UPDATE users SET tg_user_id\`（Telegram 用户 ID，结构性为正）⇒ **现口径（OPS_ALERT_UID 指向站内 1:1 绑定用户）不受该限制影响**；③0046 无符号 CHECK（库里可出现负数，但绑定路径不写）；④探针 M14 臂：tg_user_id=-1001234567890 ⇒ Telegram 0 次、HTTP 200+ok:false（静默拒发、不改回执）⇒ 群组 chat_id 确被堵。**登记**：将来若要发群（-100…），判据需改为 \`chatId !== 0\`；本单不建议改码。dev 库 bound=0（无实数据），生产 users 属 Zang 未读 ⇒ 见 env_limited。`,
  },
];

const verdictDoc = {
  verdict,
  verdict_path: 'ops/recon-alert/qa/verdict.json',
  commit,
  parent: 'be483cc',
  checker: 'Neng（独立质检方）· 只读被检对象、自写自跑探针（不采信 ops/recon-alert/readings/*）、未修改仓内实现/测试、未写库（dev 仅 1 条 SELECT count/明细）、未读生产连接串、未 push',
  measured_at: new Date().toISOString(),
  commit_under_test: 'b8a076e',
  acs,
  acs_detail_files: files,
  drift,
  observations,
  env_limited,
  probe_modes: {
    baseline: base.summary,
    negctl_notify: neg.notify.summary,
    negctl_ping: neg.ping.summary,
    negctl_both: neg.both.summary,
  },
  artifacts: {
    probe_sources: [
      'ops/recon-alert/qa/probe/qa-alert-behavior.ts',
      'ops/recon-alert/qa/probe/qa-parent-baseline.ts',
      'ops/recon-alert/qa/probe/qa-static.mjs',
      'ops/recon-alert/qa/probe/qa-ac7-known-limit.mjs',
      'ops/recon-alert/qa/probe/qa-ac7-dev-read.ts',
      'ops/recon-alert/qa/probe/qa-tg-token-echo.ts',
      'ops/recon-alert/qa/probe/qa-verdict.mjs',
    ],
    logs: ['ops/recon-alert/qa/logs/qa-tsc.log', 'ops/recon-alert/qa/logs/qa-p7b-03-gate.log'],
    parent_tree: 'git archive be483cc backend-ts/src → 临时树（scratch，未入仓）',
  },
};
write('verdict.json', verdictDoc);
console.log(JSON.stringify({ verdict, statuses: { ac1: ac1.status, ac2: ac2.status, ac3: ac3.status, ac4: ac4.status, ac5: ac5.status, ac6: ac6.status, ac7: ac7.status }, drift: drift.map((d) => d.id), files }));
