/**
 * 回归探针 · AC5-8 / DRIFT-1 —— 「心跳 URL 的 UUID 不得进日志」
 * ---------------------------------------------------------------------------
 * 缺陷（Neng 独立质检坐实）：`RECON_HEARTBEAT_URL` **格式不对**（如缺 scheme）时，
 *   `fetch` 抛 `TypeError: Failed to parse URL from hc-ping.invalid/ping/<uuid>`，
 *   `pingHeartbeat` 的 catch 曾把该 message 交给 `briefError` 写进 `console.warn`
 *   ⇒ **UUID（= 心跳凭据）进日志**。根因：旧脱敏表「长 hex ≥32 / base64url ≥40」都不匹配
 *   36 字符带连字符的 UUID。
 *
 * 本探针三臂（**零真库 / 零真网络 / 零外发**）：
 *   ① 纯正控：`redactSensitive(uuid) === '***'`（大小写两版）+ 真实 undici 报错原文过脱敏后无 UUID。
 *   ② 行为臂：`RECON_HEARTBEAT_URL` = 无 scheme 的坏 URL ⇒ 调**真码** `pingHeartbeat`，
 *      **真** `fetch`（Node 18 undici，URL 解析即失败，绝不出网）⇒ 所有 warn 行不含 UUID / `hc-ping`。
 *   ③ 不回归臂：正常 https URL 路径不变（成功位 1 次、失败位 `/fail`、非 2xx 只记状态码、空 URL 不 ping）。
 *
 * 跑法（cwd = backend-ts）：
 *   npx ts-node --transpile-only ../ops/recon-alert/probe/uuid-redact-probe.ts
 * 退出码：0 = 全绿；1 = 有断言红；2 = 探针自身崩。
 */
import * as path from 'path';
import * as fs from 'fs';

const BACKEND_ROOT = path.resolve(__dirname, '../../../backend-ts');
const OUT_DIR = process.env.PROBE_OUT_DIR
  ? path.resolve(process.env.PROBE_OUT_DIR)
  : path.resolve(__dirname, '../readings');

// ---------------------------------------------------------------- 台账 / warn 截获
const warnLines: string[] = [];
const origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  warnLines.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '));
  origWarn(...args);
};

// 必须在任何调用之前拿到模块（模块加载期无 IO：db 的 Pool 是惰性的，telegram 只读 env）
/* eslint-disable @typescript-eslint/no-var-requires */
const alertMod = require(path.join(BACKEND_ROOT, 'src/ops-alert'));

const UUID = '11111111-2222-3333-4444-555555555555';
const BAD_URL = `hc-ping.invalid/ping/${UUID}`;          // 缺 scheme ⇒ undici 解析失败
const OK_URL = `https://hc-ping.invalid/ping/${UUID}`;   // 正常形状（`.invalid` 不可解析，永不出网）

type Ck = { id: string; ok: boolean; detail: string };
const cks: Ck[] = [];
const t = (id: string, pass: boolean, detail: string) => cks.push({ id, ok: Boolean(pass), detail });

const realFetch = globalThis.fetch; // Node 18 undici 真身（本探针不换桩，直到 ③ 臂）

(async () => {
  // ------------------------------------------------------------ ① 纯正控（脱敏表）
  const r1 = String(alertMod.redactSensitive(UUID));
  const r2 = String(alertMod.redactSensitive(UUID.toUpperCase()));
  const r3 = String(alertMod.redactSensitive(BAD_URL));

  t('R1_redact_uuid_exact', r1 === '***', `redactSensitive(uuid)=${r1}`);
  t('R2_redact_uuid_uppercase', r2 === '***', `redactSensitive(UUID)=${r2}`);
  // 只抹凭据（UUID），**保留 host** —— 脱敏表的设计口径是「保留 scheme/host 便于定位是哪条 check」
  t('R3_redact_url_no_uuid', !r3.includes(UUID) && r3.includes('***'), r3);

  // 真实 undici 报错原文（URL 解析失败，无 socket）——先证明「泄漏载体确实带 UUID」
  let realMsg = '';
  let realName = '';
  try {
    await realFetch(BAD_URL);
    realMsg = '__FETCH_UNEXPECTEDLY_RESOLVED__';
  } catch (error) {
    const e = error as { name?: string; message?: string };
    realName = String(e.name ?? '');
    realMsg = String(e.message ?? '');
  }
  const redactedMsg = String(alertMod.redactSensitive(realMsg));
  t('R4_undici_message_carries_uuid', realName === 'TypeError' && realMsg.includes(UUID),
    `name=${realName} msg=${realMsg.slice(0, 120)}`);
  // 纵深第二层：即便 message 被交出去（当前 catch 已不交），UUID 也已被脱敏表吃掉
  t('R5_redacted_undici_message_clean', !redactedMsg.includes(UUID) && redactedMsg.includes('***'),
    redactedMsg.slice(0, 160));

  // ------------------------------------------------------------ ② 行为臂（真码 + 真 fetch）
  process.env.RECON_HEARTBEAT_URL = BAD_URL;
  warnLines.length = 0;
  let badThrew: string | null = null;
  const badStarted = Date.now();
  try {
    // 与 index.ts 调用点同形：直接读 env 传进真码
    await alertMod.pingHeartbeat(process.env.RECON_HEARTBEAT_URL);
    await alertMod.pingHeartbeat(process.env.RECON_HEARTBEAT_URL, true); // /fail 臂同样不得泄漏
  } catch (error) {
    badThrew = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  }
  const badElapsed = Date.now() - badStarted;
  const badWarn = warnLines.slice();

  t('R6_bad_url_never_throws', badThrew === null, `threw=${String(badThrew)}`);
  t('R7_bad_url_logged', badWarn.length >= 2, `lines=${JSON.stringify(badWarn)}`);
  t('R8_no_uuid_in_warn', badWarn.every((l) => !l.includes(UUID)), JSON.stringify(badWarn));
  t('R9_no_host_in_warn', badWarn.every((l) => !l.includes('hc-ping')), JSON.stringify(badWarn));
  t('R10_warn_keeps_error_class',
    badWarn.some((l) => l.includes('[ops-alert] heartbeat ping failed: TypeError')),
    JSON.stringify(badWarn));
  t('R11_bad_url_bounded', badElapsed <= 8000, `elapsed=${badElapsed}ms`);

  // ------------------------------------------------------------ ③ 不回归臂（正常 URL 路径）
  const calls: string[] = [];
  globalThis.fetch = ((input: unknown) => {
    calls.push(String(input));
    return Promise.resolve({ ok: true, status: 200, text: async () => 'OK' });
  }) as unknown as typeof fetch;

  warnLines.length = 0;
  calls.length = 0;
  await alertMod.pingHeartbeat(OK_URL);
  const okCalls = calls.slice();

  calls.length = 0;
  await alertMod.pingHeartbeat(OK_URL, true);
  const failCalls = calls.slice();

  // 尾斜杠归一（既有行为：`${url}/fail` 不得出现 `//fail`）
  calls.length = 0;
  await alertMod.pingHeartbeat(`${OK_URL}/`, true);
  const trailingFail = calls.slice();

  calls.length = 0;
  await alertMod.pingHeartbeat(undefined);
  await alertMod.pingHeartbeat('');
  const emptyCalls = calls.slice();

  // 非 2xx：只记状态码，不记 URL
  warnLines.length = 0;
  globalThis.fetch = (() => Promise.resolve({ ok: false, status: 500, text: async () => '' })) as unknown as typeof fetch;
  await alertMod.pingHeartbeat(OK_URL);
  const non2xxWarn = warnLines.slice();

  t('R12_success_arm_ping_once', okCalls.length === 1 && okCalls[0] === OK_URL, JSON.stringify(okCalls));
  t('R13_fail_arm_appends_fail', failCalls.length === 1 && failCalls[0] === `${OK_URL}/fail`, JSON.stringify(failCalls));
  t('R14_fail_arm_no_double_slash', trailingFail.length === 1 && trailingFail[0] === `${OK_URL}/fail`, JSON.stringify(trailingFail));
  t('R15_empty_url_no_ping', emptyCalls.length === 0, JSON.stringify(emptyCalls));
  t('R16_non2xx_status_only',
    non2xxWarn.length === 1 && non2xxWarn[0].includes('500')
      && !non2xxWarn[0].includes(UUID) && !non2xxWarn[0].includes('hc-ping'),
    JSON.stringify(non2xxWarn));

  // ------------------------------------------------------------ 汇总
  const failed = cks.filter((c) => !c.ok);
  const allPass = failed.length === 0;
  const out = {
    probe: 'uuid-redact-probe',
    defect: 'AC5-8 / DRIFT-1 · heartbeat URL UUID entered console.warn via briefError(error)',
    node: process.version,
    fixtures: { uuid: UUID, bad_url: BAD_URL, ok_url: OK_URL },
    arms: {
      unit: { r1, r2, r3, undici_name: realName, undici_message: realMsg, redacted_message: redactedMsg },
      behavior: { warn_lines: badWarn, threw: badThrew, elapsed_ms: badElapsed },
      no_regression: { ok_calls: okCalls, fail_calls: failCalls, trailing_fail: trailingFail, empty_calls: emptyCalls, non2xx_warn: non2xxWarn },
    },
    assertions: cks,
    failed: failed.map((f) => f.id),
    all_assertions_pass: allPass,
    total: cks.length,
    passed: cks.length - failed.length,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, 'probe-uuid-redact.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');

  console.log('===== UUID REDACT ASSERTIONS =====');
  for (const c of cks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.id} :: ${c.detail}`);
  console.log(JSON.stringify({ saved: file, total: cks.length, passed: cks.length - failed.length, failed: failed.map((f) => f.id), all_assertions_pass: allPass }));
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error('PROBE_FATAL', e instanceof Error ? e.stack : String(e));
  process.exit(2);
});
