/**
 * A5 收口 · 站内信 + Telegram 行为探针（Kong · 后端收尾单 ①）
 * ============================================================================
 * 口径（逐条可回溯）：
 *   · 只起**受控实例**（`5794` = TG 已配置臂 / `5795` = TG 未配置臂；均在 5792–5799 内，
 *     不碰 5787/5788/5800/5555/5191，不碰面板网关端口）。
 *   · 一切**写路径**探针**事务内 + 末尾 `ROLLBACK`**（净写 0）；HTTP 轮次产生的确有提交
 *     的行（0045 两表 append-only ⇒ 无 DELETE 触发器通道），在 §C 收尾用**同事务内
 *     `ALTER TABLE … DISABLE TRIGGER` 的定向清账**把净行数还原到基线，并逐项复核
 *     「触发器已复位 + 行数 == 基线」。
 *   · 读数落本目录（`messaging-behavior-probe.json` + `.steps.log`），不含任何 token / 密钥。
 * 用法：cd backend-ts && node --dns-result-order=ipv4first node_modules/.bin/ts-node \
 *        --transpile-only .v117-messaging-artifacts/messaging-behavior-probe.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { readQuery, getTransactionPool, type TxClient } from '../src/db';
import { createSessionToken } from '../src/auth';
import { requireConversationParticipant } from '../src/messages-service';
import { issueBindCode, verifyBindCode } from '../src/telegram-service';

const REPO = path.resolve(__dirname, '..');
const OUT_DIR = __dirname;
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const PORT_CFG = 5794;
const PORT_NOCFG = 5795;
const BASE_CFG = `http://127.0.0.1:${PORT_CFG}`;
const BASE_NOCFG = `http://127.0.0.1:${PORT_NOCFG}`;
const TG_TOKEN = 'v117-probe-dummy-token';
const TG_SECRET = 'v117-probe-dummy-secret';

// 夹具（活体既有行，只读引用；不新增 users/listing）
const LISTING_ID = 13;          // status='listed' · seller_uid=7
const UID_BUYER = 2;
const UID_SELLER = 7;
const UID_OTHER = 3;            // 非参与者
const UID_ADMIN = 10;           // is_admin=true 的非参与者
const EVM_SELLER = '0xe4b8e61134f50d78fd3e85c337647f4a7abef66b';

// 事务内夹具（tx uid ≥ 9.6e6，尾 ROLLBACK ⇒ 零残留）
const T_B = 9601001, T_S = 9601002, T_N = 9601003, T_X = 9601004, T_Z = 9601005;

const steps: string[] = [];
const log = (s: string) => { const l = `[${new Date().toISOString()}] ${s}`; steps.push(l); console.log(l); };

type Check = { id: string; group: string; pass: boolean; expect: string; actual: string };
const checks: Check[] = [];
const ck = (id: string, group: string, pass: boolean, expect: string, actual: string) => {
  checks.push({ id, group, pass: Boolean(pass), expect, actual: String(actual) });
  log(`  ${pass ? 'PASS' : 'FAIL'} ${id} [${group}] expect=${expect} actual=${actual}`);
  return Boolean(pass);
};

// ---------------------------------------------------------------- HTTP
interface HRes { status: number; json: any; text: string; err?: string }
const http = async (base: string, method: string, p: string, opt: { token?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<HRes> => {
  const headers: Record<string, string> = { accept: 'application/json', ...(opt.headers || {}) };
  if (opt.token) headers.authorization = `Bearer ${opt.token}`;
  const init: RequestInit = { method, headers };
  if (opt.body !== undefined) { headers['content-type'] = 'application/json'; init.body = JSON.stringify(opt.body); }
  try {
    const res = await fetch(`${base}${p}`, init);
    const text = await res.text();
    let json: any = null; try { json = JSON.parse(text); } catch { /* non-json */ }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: -1, json: null, text: '', err: String((e as Error)?.message || e).slice(0, 160) };
  }
};
const errCode = (r: HRes): string | null => (r.json && r.json.error && r.json.error.code) ? String(r.json.error.code) : null;

// ---------------------------------------------------------------- 记结果容器
const results: Record<string, any> = {
  run: RUN, started_at: new Date().toISOString(),
  ports: { configured: PORT_CFG, unconfigured: PORT_NOCFG },
  negative_controls: [] as any[],
  db: {} as any, http: {} as any, tx: {} as any, readings: {} as any,
};

// ---------------------------------------------------------------- 起受控实例
const children: ChildProcess[] = [];
const launch = async (port: number, extra: Record<string, string>): Promise<{ pid: number | undefined; ready: boolean }> => {
  const env: Record<string, string> = { ...(process.env as Record<string, string>), PORT: String(port), ...extra };
  const child = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/index.ts'], {
    cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  let ready = false;
  for (let i = 0; i < 60 && !ready; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); ready = r.status > 0; } catch { /* not up */ }
  }
  log(`instance :${port} pid=${child.pid} ready=${ready}`);
  return { pid: child.pid, ready };
};

const shutdown = async () => {
  for (const c of children) {
    if (c.pid && c.exitCode === null) { try { c.kill('SIGTERM'); } catch { /* noop */ } }
  }
  await new Promise((r) => setTimeout(r, 800));
};

// ---------------------------------------------------------------- 基线与清账
const fingerprint = async () => {
  const rows = await readQuery<Record<string, unknown>>(
    `SELECT (SELECT count(*)::int FROM public.conversation) AS conversations,
            (SELECT count(*)::int FROM public.message) AS messages,
            (SELECT count(*)::int FROM public.users) AS users,
            (SELECT count(*)::int FROM public.listing) AS listings`);
  return rows[0];
};

const triggerState = async () => {
  const rows = await readQuery<Record<string, unknown>>(
    `SELECT tgname, tgenabled FROM pg_trigger
      WHERE tgrelid IN ('public.conversation'::regclass,'public.message'::regclass) AND NOT tgisinternal
      ORDER BY tgname`);
  return rows;
};

/** 定向清账：同事务内临时关两表删除闸 → DELETE → 复位闸 → COMMIT（净行数还原） */
const purgeFixture = async (conversationId: number): Promise<Record<string, unknown>> => {
  const pool = getTransactionPool();
  const c = (await pool.connect()) as unknown as TxClient;
  try {
    await c.query('BEGIN');
    await c.query('SET LOCAL lock_timeout = 5000');
    await c.query('ALTER TABLE public.message DISABLE TRIGGER trg_message_no_update_or_delete');
    await c.query('ALTER TABLE public.conversation DISABLE TRIGGER trg_conversation_no_delete');
    const dm = await c.query('DELETE FROM public.message WHERE conversation_id = $1', [conversationId]);
    const dc = await c.query('DELETE FROM public.conversation WHERE conversation_id = $1', [conversationId]);
    await c.query('ALTER TABLE public.message ENABLE TRIGGER trg_message_no_update_or_delete');
    await c.query('ALTER TABLE public.conversation ENABLE TRIGGER trg_conversation_no_delete');
    await c.query('COMMIT');
    return { deleted_messages: dm.rowCount, deleted_conversations: dc.rowCount };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    (c as unknown as { release?: () => void }).release?.();
  }
};

// ---------------------------------------------------------------- 主流程
(async () => {
  log(`=== A5 messaging behavior probe run=${RUN} ===`);

  // ============ §0 基线 ============
  const before = await fingerprint();
  const trigBefore = await triggerState();
  results.db.before = { fingerprint: before, triggers: trigBefore };
  log(`DB_BEFORE ${JSON.stringify(before)}`);

  // 纯函数腿：binding code 签发 / 验签（零 DB / 零网络）
  {
    const code = issueBindCode(UID_BUYER);
    const good = verifyBindCode(code.code);
    const tampered = verifyBindCode(`${code.code.slice(0, -3)}zzz`);
    const malformed = verifyBindCode('v1.not-base64.sig');
    const expiredShape = verifyBindCode(`v1.${Buffer.from(JSON.stringify({ uid: 2, iat: 1, exp: 1 })).toString('base64url')}.x`);
    results.readings.bind_code = { expires_in: code.expires_in, good_ok: good.ok, tampered_ok: tampered.ok, malformed_ok: malformed.ok, expired_shape_ok: expiredShape.ok };
    ck('P1', 'tg', code.expires_in === 600 && good.ok === true && tampered.ok === false && malformed.ok === false,
      'code.expires_in=600 · 合法验签 ok · 篡改/畸形 ⇒ 不 ok', JSON.stringify(results.readings.bind_code));
  }

  // ============ §A/§B 受控实例 HTTP（无需夹具的面） ============
  const cfg = await launch(PORT_CFG, { TELEGRAM_BOT_TOKEN: TG_TOKEN, TELEGRAM_WEBHOOK_SECRET: TG_SECRET, TELEGRAM_BOT_USERNAME: 'v117_probe_bot' });
  const nocfg = await launch(PORT_NOCFG, { TELEGRAM_BOT_TOKEN: '', TELEGRAM_WEBHOOK_SECRET: '', TELEGRAM_BOT_USERNAME: '' });
  ck('A0', 'instance', cfg.ready && nocfg.ready, '两受控实例 ready', JSON.stringify({ cfg: cfg.ready, nocfg: nocfg.ready }));

  const tokB = createSessionToken({ uID: UID_BUYER, evm: '' });
  const tokS = createSessionToken({ uID: UID_SELLER, evm: '' });
  const tokN = createSessionToken({ uID: UID_OTHER, evm: '' });
  const tokA = createSessionToken({ uID: UID_ADMIN, evm: '' });

  // ---- A · 未登录 ⇒ 401（站内信 6 + TG 4 · 两臂同规：requireActor 先于 env 闸）----
  const unauth: Array<[string, string, string]> = [
    ['A1', 'POST', '/api/messages/conversations'],
    ['A2', 'GET', '/api/messages/conversations'],
    ['A3', 'GET', '/api/messages/conversations/1/messages'],
    ['A4', 'POST', '/api/messages/conversations/1/messages'],
    ['A5', 'POST', '/api/messages/conversations/1/read'],
    ['A6', 'GET', '/api/messages/unread-count'],
    ['A7', 'POST', '/api/telegram/bind/start'],
    ['A8', 'POST', '/api/telegram/unbind'],
    ['A9', 'GET', '/api/telegram/bind/status'],
  ];
  const unauthRead: Record<string, unknown> = {};
  for (const [id, m, p] of unauth) {
    const r = await http(BASE_CFG, m, p, { body: m === 'GET' ? undefined : {} });
    unauthRead[id] = { status: r.status, code: errCode(r) };
    ck(id, 'authz', r.status === 401, '401', `${r.status}/${errCode(r)}`);
  }
  results.http.unauth_configured = unauthRead;
  {
    // TG 未配置臂同样「未登录 ⇒ 401」（闸序：鉴权先于降级）
    const r = await http(BASE_NOCFG, 'POST', '/api/telegram/bind/start', { body: {} });
    ck('A10', 'authz', r.status === 401, '401（鉴权先于 env 降级）', `${r.status}/${errCode(r)}`);
    // 站内信面未登录也 401（拟证「永不降级」不改变鉴权序）
    const r2 = await http(BASE_NOCFG, 'GET', '/api/messages/unread-count');
    ck('A11', 'authz', r2.status === 401, '401', `${r2.status}/${errCode(r2)}`);
  }

  // ---- B · TG 已配置臂：绑定面 200 / 读面隐私 / 未绑定解绑 400 ----
  {
    const bind = await http(BASE_CFG, 'POST', '/api/telegram/bind/start', { token: tokB, body: {} });
    const d = bind.json?.data || {};
    const codeOk = typeof d.code === 'string' && d.code.startsWith('v1.') && verifyBindCode(d.code).ok === true;
    ck('B1', 'tg', bind.status === 200 && d.expires_in === 600 && codeOk, '200 · expires_in=600 · code 可验签', `${bind.status} expires_in=${d.expires_in} code_ok=${codeOk}`);
    results.http.bind_start_configured = { status: bind.status, expires_in: d.expires_in, bot_username: d.bot_username, code_prefix: String(d.code || '').slice(0, 3) };
  }
  {
    const st = await http(BASE_CFG, 'GET', '/api/telegram/bind/status', { token: tokB });
    const d = st.json?.data || {};
    const leaks = /\btg_user_id\b/.test(st.text) || /"tg_user_id"\s*:/.test(st.text);
    ck('B2', 'tg', st.status === 200 && d.tg_linked === false && !leaks, '200 · {tg_linked:false,tg_linked_at:null} · **无 tg_user_id**', `${st.status} keys=${Object.keys(d).join(',')} tg_user_id_present=${leaks}`);
    results.http.bind_status = { status: st.status, data: d, tg_user_id_present: leaks };
  }
  {
    const ub = await http(BASE_CFG, 'POST', '/api/telegram/unbind', { token: tokB, body: {} });
    ck('B3', 'tg', ub.status === 400 && errCode(ub) === 'TG_NOT_LINKED', '400 TG_NOT_LINKED（未绑定却解绑）', `${ub.status}/${errCode(ub)}`);
  }

  // ---- C · webhook（已配置臂）：缺/错 secret ⇒ 401 · 合法 ⇒ 恒 200 ----
  {
    const noSec = await http(BASE_CFG, 'POST', '/api/telegram/webhook', { body: {} });
    ck('C1', 'webhook', noSec.status === 401 && errCode(noSec) === 'TG_WEBHOOK_UNAUTHORIZED', '401 TG_WEBHOOK_UNAUTHORIZED（缺 secret）', `${noSec.status}/${errCode(noSec)}`);
    const badSec = await http(BASE_CFG, 'POST', '/api/telegram/webhook', { body: {}, headers: { 'x-telegram-bot-api-secret-token': 'wrong' } });
    ck('C2', 'webhook', badSec.status === 401 && errCode(badSec) === 'TG_WEBHOOK_UNAUTHORIZED', '401（错 secret）', `${badSec.status}/${errCode(badSec)}`);
    const okEmpty = await http(BASE_CFG, 'POST', '/api/telegram/webhook', { body: {}, headers: { 'x-telegram-bot-api-secret-token': TG_SECRET } });
    ck('C3', 'webhook', okEmpty.status === 200, '200（合法 secret + 无 message）', `${okEmpty.status}`);
    const okHint = await http(BASE_CFG, 'POST', '/api/telegram/webhook', {
      body: { message: { from: { id: 555000111 }, chat: { id: 555000111 }, text: 'hello not a command' } },
      headers: { 'x-telegram-bot-api-secret-token': TG_SECRET } });
    ck('C4', 'webhook', okHint.status === 200, '200（合法 secret + 非 /start 文本 ⇒ 仍 200）', `${okHint.status}`);
    const okBadCode = await http(BASE_CFG, 'POST', '/api/telegram/webhook', {
      body: { message: { from: { id: 555000112 }, chat: { id: 555000112 }, text: '/start v1.bad.sig' } },
      headers: { 'x-telegram-bot-api-secret-token': TG_SECRET } });
    ck('C5', 'webhook', okBadCode.status === 200, '200（业务失败〔code 无效〕也恒 200 —— Telegram 重试语义）', `${okBadCode.status}`);
    results.http.webhook_configured = { no_secret: noSec.status, bad_secret: badSec.status, ok_empty: okEmpty.status, ok_hint: okHint.status, ok_bad_code: okBadCode.status };
  }

  // ---- C6 · 全链绑定消费（webhook 真写 + 解绑回滚 ⇒ 净写 0）----
  //   探针现取（P1/B1 缺陷）修复后的端到端回归：合法 code 经 webhook 真落 `users.tg_user_id`，
  //   随后经 #8 解绑把该行还原 ⇒ 行状态净写 0（无 append-only 表参与，无需清账特技）。
  {
    const bindUid = 4;
    const tok4 = createSessionToken({ uID: bindUid, evm: '' });
    const before4 = await readQuery<{ tg_user_id: string | null }>(`SELECT tg_user_id FROM public.users WHERE uid = $1`, [bindUid]);
    const code = issueBindCode(bindUid);
    let status: any = null;
    try {
      const w = await http(BASE_CFG, 'POST', '/api/telegram/webhook', {
        body: { message: { from: { id: 770000123 }, chat: { id: 770000123 }, text: `/start ${code.code}` } },
        headers: { 'x-telegram-bot-api-secret-token': TG_SECRET } });
      const mid = await readQuery<{ tg_user_id: string | null; tg_linked_at: Date | null }>(`SELECT tg_user_id, tg_linked_at FROM public.users WHERE uid = $1`, [bindUid]);
      const st = await http(BASE_CFG, 'GET', '/api/telegram/bind/status', { token: tok4 });
      status = { webhook: w.status, db_tg_user_id: mid[0]?.tg_user_id ?? null, bind_status: st.status, tg_linked: st.json?.data?.tg_linked };
      ck('C6', 'tg', w.status === 200 && String(mid[0]?.tg_user_id ?? '') === '770000123' && st.json?.data?.tg_linked === true,
        'webhook 合法 code ⇒ 200 · users.tg_user_id 真落 770000123 · bind/status tg_linked:true（修复后绑得通）',
        JSON.stringify(status));
    } finally {
      const ub = await http(BASE_CFG, 'POST', '/api/telegram/unbind', { token: tok4, body: {} });
      const after4 = await readQuery<{ tg_user_id: string | null; tg_linked_at: Date | null }>(`SELECT tg_user_id, tg_linked_at FROM public.users WHERE uid = $1`, [bindUid]);
      const restored = (after4[0]?.tg_user_id ?? null) === (before4[0]?.tg_user_id ?? null) && after4[0]?.tg_linked_at === null;
      ck('C7', 'tg', ub.status === 200 && restored, '解绑 ⇒ 200 · 该 users 行还原（tg_user_id/tg_linked_at 归 null）⇒ 净写 0',
        `unbind=${ub.status} after=${JSON.stringify(after4[0])}`);
      status = { ...(status || {}), unbind: ub.status, after: after4[0] };
      results.http.bind_consume = status;
    }
  }

  // ---- D · TG 未配置臂：绑定面 + webhook 面 ⇒ 503 TG_NOT_CONFIGURED（§41.9）----
  {
    const bs = await http(BASE_NOCFG, 'POST', '/api/telegram/bind/start', { token: tokB, body: {} });
    ck('D1', 'degrade', bs.status === 503 && errCode(bs) === 'TG_NOT_CONFIGURED', '503 TG_NOT_CONFIGURED', `${bs.status}/${errCode(bs)}`);
    const ub = await http(BASE_NOCFG, 'POST', '/api/telegram/unbind', { token: tokB, body: {} });
    ck('D2', 'degrade', ub.status === 503 && errCode(ub) === 'TG_NOT_CONFIGURED', '503 TG_NOT_CONFIGURED', `${ub.status}/${errCode(ub)}`);
    const st = await http(BASE_NOCFG, 'GET', '/api/telegram/bind/status', { token: tokB });
    ck('D3', 'degrade', st.status === 503 && errCode(st) === 'TG_NOT_CONFIGURED', '503 TG_NOT_CONFIGURED', `${st.status}/${errCode(st)}`);
    const wh = await http(BASE_NOCFG, 'POST', '/api/telegram/webhook', { body: {} });
    ck('D4', 'degrade', wh.status === 503 && errCode(wh) === 'TG_NOT_CONFIGURED', '503 TG_NOT_CONFIGURED（§41.9 明列 #10 webhook 面）', `${wh.status}/${errCode(wh)}`);
    // 站内信 6 条永不降级：未配置臂带 token ⇒ 200
    const un = await http(BASE_NOCFG, 'GET', '/api/messages/unread-count', { token: tokB });
    ck('D5', 'degrade', un.status === 200, '200（站内信永不降级）', `${un.status}`);
    results.http.degrade_unconfigured = { bind_start: bs.status, unbind: ub.status, bind_status: st.status, webhook: wh.status, unread_count: un.status };
  }

  // ---- E · F19 读口扩展 ----
  {
    const r = await http(BASE_CFG, 'GET', `/api/prize/${LISTING_ID}`);
    const s = r.json?.data?.seller;
    const fullEvmLeak = r.text.includes(EVM_SELLER);
    ck('E1', 'f19', r.status === 200 && s && Number(s.uid) === UID_SELLER && s.avatar === null,
      `200 · data.seller={uid:${UID_SELLER}, nickname:掩码, avatar:null}`, `${r.status} seller=${JSON.stringify(s)}`);
    ck('E2', 'f19', s && typeof s.nickname === 'string' && /^0x[0-9a-f]{4}…[0-9a-f]{4}$/.test(s.nickname) && !fullEvmLeak,
      'nickname = EVM 掩码（0x前4…后4）· 响应**不含完整 EVM**', `nickname=${s?.nickname} full_evm_leak=${fullEvmLeak}`);
    results.http.f19 = { status: r.status, seller: s ?? null, full_evm_leak: fullEvmLeak };
  }

  // ============ §TX 事务内行为探针（末尾 ROLLBACK · 净写 0）============
  const txRead: Record<string, unknown> = {};
  const pool = getTransactionPool();
  const conn = (await pool.connect()) as unknown as TxClient;
  const q = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<R[]> => (await conn.query<R>(sql, p)).rows;
  const sp = async <T>(name: string, fn: () => Promise<T>): Promise<{ ok: boolean; v?: T; sqlstate?: string; message?: string }> => {
    await conn.query(`SAVEPOINT ${name}`);
    try { const v = await fn(); await conn.query(`RELEASE SAVEPOINT ${name}`); return { ok: true, v }; }
    catch (e) { await conn.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined); const a = e as any; return { ok: false, sqlstate: String(a?.code ?? ''), message: String(a?.message ?? e).slice(0, 120) }; }
  };

  // 频次闸 CTE —— 与 `src/messages-service.ts` 的 `sendMessage` **逐字同源**。
  const GATE_SQL = `WITH day AS (
         SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS d
       ),
       conv AS (
         SELECT count(*)::int AS n
           FROM public.message, day
          WHERE conversation_id = $1
            AND from_uid = $2
            AND time_created >= day.d
       ),
       glob AS (
         SELECT count(*)::int AS n
           FROM public.message, day
          WHERE from_uid = $2
            AND time_created >= day.d
       ),
       ins AS (
         INSERT INTO public.message (conversation_id, from_uid, body)
         SELECT $1, $2, $3
          WHERE (SELECT n FROM conv) < $4::int
            AND (SELECT n FROM glob) < $5::int
         RETURNING msg_id, time_created
       )
       SELECT ins.msg_id, ins.time_created, (SELECT n FROM conv) AS conv_n, (SELECT n FROM glob) AS glob_n
         FROM ins`;
  const COUNT_SQL = `SELECT (SELECT count(*)::int FROM public.message
                  WHERE conversation_id = $1 AND from_uid = $2
                    AND time_created >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS conv_n,
                (SELECT count(*)::int FROM public.message
                  WHERE from_uid = $2
                    AND time_created >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS glob_n`;

  try {
    await conn.query('BEGIN');
    await conn.query('SET LOCAL lock_timeout = 8000');
    await conn.query('SET LOCAL statement_timeout = 30000');

    // tx 夹具：users x5 + 三会话（listing 用既有 13/14）
    for (const uid of [T_B, T_S, T_N, T_X, T_Z]) {
      await conn.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
                        VALUES ($1, $2, '', false, now(), now())`, [uid, `0x${String(uid).padStart(40, '0')}`]);
    }
    await conn.query(`INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key)
                      VALUES ($1, $2, $3, $4)`, [13, T_B, T_S, `open:13:${T_B}`]);
    const conv1 = Number((await q<{ id: string }>(`SELECT conversation_id AS id FROM public.conversation WHERE create_key = $1`, [`open:13:${T_B}`]))[0].id);
    await conn.query(`INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key) VALUES ($1,$2,$3,$4)`, [14, T_X, T_S, `open:14:${T_X}`]);
    const conv2 = Number((await q<{ id: string }>(`SELECT conversation_id AS id FROM public.conversation WHERE create_key = $1`, [`open:14:${T_X}`]))[0].id);
    await conn.query(`INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key) VALUES ($1,$2,$3,$4)`, [15, T_X, T_S, `open:15:${T_X}`]);
    const conv3 = Number((await q<{ id: string }>(`SELECT conversation_id AS id FROM public.conversation WHERE create_key = $1`, [`open:15:${T_X}`]))[0].id);
    await conn.query(`INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key) VALUES ($1,$2,$3,$4)`, [18, T_X, T_S, `open:18:${T_X}`]);
    const conv6 = Number((await q<{ id: string }>(`SELECT conversation_id AS id FROM public.conversation WHERE create_key = $1`, [`open:18:${T_X}`]))[0].id);
    txRead.fixtures = { conv1, conv2, conv3, conv6 };
    log(`TX fixtures conv1=${conv1} conv2=${conv2} conv3=${conv3} conv6=${conv6}`);

    // ---- T1 会话闸：19 ⇒ 放行；20 ⇒ 拒（第 21 条必拒）----
    for (let i = 0; i < 19; i += 1) await conn.query(`INSERT INTO public.message (conversation_id, from_uid, body) VALUES ($1,$2,$3)`, [conv1, T_S, `seed-${i}`]);
    const t1a = await conn.query(GATE_SQL, [conv1, T_S, 'gate-probe-20th', 20, 200]);
    const t1b = await conn.query(GATE_SQL, [conv1, T_S, 'gate-probe-21st', 20, 200]);
    const t1c = await q<{ conv_n: number; glob_n: number }>(COUNT_SQL, [conv1, T_S]);
    const reason1 = Number(t1c[0].conv_n) >= 20 ? 'PER_CONVERSATION_DAILY' : 'GLOBAL_DAILY';
    txRead.rate_conv = { at19_rows: t1a.rowCount, at20_rows: t1b.rowCount, conv_n: Number(t1c[0].conv_n), glob_n: Number(t1c[0].glob_n), reason: reason1 };
    ck('T1', 'rate', t1a.rowCount === 1 && t1b.rowCount === 0 && Number(t1c[0].conv_n) === 20 && reason1 === 'PER_CONVERSATION_DAILY',
      '19 条 ⇒ 放行(1 行) · 20 条 ⇒ 第 21 条必拒(0 行) · reason=PER_CONVERSATION_DAILY',
      JSON.stringify(txRead.rate_conv));

    // ---- T2 全局闸：199 ⇒ 放行；200 ⇒ 拒（第 201 条必拒 · reason=GLOBAL_DAILY）----
    //   取法：同发送者 T_X 在 conv2 19 条 + conv3 180 条 = 全局 199（各会话均 < 20 ⇒ 会话闸不先拦）。
    for (let i = 0; i < 19; i += 1) await conn.query(`INSERT INTO public.message (conversation_id, from_uid, body) VALUES ($1,$2,$3)`, [conv2, T_X, `x-a-${i}`]);
    for (let i = 0; i < 180; i += 1) await conn.query(`INSERT INTO public.message (conversation_id, from_uid, body) VALUES ($1,$2,$3)`, [conv3, T_X, `x-b-${i}`]);
    const t2a = await conn.query(GATE_SQL, [conv2, T_X, 'gate-probe-glob-200th', 20, 200]); // 全局 199 ⇒ 放行（conv_n=19）
    const t2b = await conn.query(GATE_SQL, [conv6, T_X, 'gate-probe-201st', 20, 200]);
    const t2c = await q<{ conv_n: number; glob_n: number }>(COUNT_SQL, [conv6, T_X]);
    const reason2 = Number(t2c[0].conv_n) >= 20 ? 'PER_CONVERSATION_DAILY' : 'GLOBAL_DAILY';
    txRead.rate_global = { at199_rows: t2a.rowCount, conv6_at200_rows: t2b.rowCount, conv_n: Number(t2c[0].conv_n), glob_n: Number(t2c[0].glob_n), reason: reason2 };
    ck('T2', 'rate', t2a.rowCount === 1 && t2b.rowCount === 0 && Number(t2c[0].glob_n) === 200 && Number(t2c[0].conv_n) === 0 && reason2 === 'GLOBAL_DAILY',
      '全局 199 ⇒ 放行(1 行) · 全局 200 ⇒ 第 201 条必拒(0 行) · reason=GLOBAL_DAILY',
      JSON.stringify(txRead.rate_global));

    // ---- T3 未读聚合（查询期派生）：对端 +1 后标读 ⇒ 0 ----
    const unreadSql = `SELECT (SELECT count(*)::int FROM public.message m
              WHERE m.conversation_id = $1 AND m.from_uid <> $2
                AND m.msg_id > (SELECT buyer_last_read_msg_id FROM public.conversation WHERE conversation_id = $1)) AS buyer_unread`;
    const u1 = await q<{ buyer_unread: number }>(unreadSql, [conv1, T_B]);
    // 买方回 1 条 ⇒ 卖方未读 +1（会话列表同源子查询）
    await conn.query(`INSERT INTO public.message (conversation_id, from_uid, body) VALUES ($1,$2,$3)`, [conv1, T_B, 'reply-from-buyer']);
    const listUnread = await q<{ unread_count: number }>(
      `SELECT count(*)::int AS unread_count FROM public.message m
        WHERE m.conversation_id = $1 AND m.from_uid <> $2 AND m.msg_id > (SELECT seller_last_read_msg_id FROM public.conversation WHERE conversation_id = $1)`, [conv1, T_S]);
    const newest = await q<{ mx: string }>(`SELECT COALESCE(max(msg_id),0)::bigint AS mx FROM public.message WHERE conversation_id = $1`, [conv1]);
    await conn.query(`UPDATE public.conversation SET buyer_last_read_msg_id = GREATEST(buyer_last_read_msg_id, $2::bigint) WHERE conversation_id = $1`, [conv1, Number(newest[0].mx)]);
    const u2 = await q<{ buyer_unread: number }>(unreadSql, [conv1, T_B]);
    txRead.unread = { buyer_unread_before_read: Number(u1[0].buyer_unread), buyer_unread_after_read: Number(u2[0].buyer_unread), seller_unread: Number(listUnread[0].unread_count), newest: Number(newest[0].mx) };
    ck('T3', 'unread', Number(u1[0].buyer_unread) === 20 && Number(listUnread[0].unread_count) === 1 && Number(u2[0].buyer_unread) === 0,
      '发送后买方未读 = 20 · 买方回 1 条 ⇒ 卖方未读 = 1（+1）· 标读后买方未读 = 0（查询期聚合）',
      JSON.stringify(txRead.unread));

    // ---- T4 两表闸（message append-only / conversation 受限可变）----
    const t4 = {
      msg_update: await sp('t4a', () => conn.query(`UPDATE public.message SET body = 'x' WHERE conversation_id = $1`, [conv1])),
      msg_delete: await sp('t4b', () => conn.query(`DELETE FROM public.message WHERE conversation_id = $1`, [conv1])),
      conv_delete: await sp('t4c', () => conn.query(`DELETE FROM public.conversation WHERE conversation_id = $1`, [conv1])),
      conv_update_immut: await sp('t4d', () => conn.query(`UPDATE public.conversation SET listing_id = 99 WHERE conversation_id = $1`, [conv1])),
      conv_watermark_down: await sp('t4e', () => conn.query(`UPDATE public.conversation SET buyer_last_read_msg_id = buyer_last_read_msg_id - 1 WHERE conversation_id = $1`, [conv1])),
      conv_time_updated: await sp('t4f', () => conn.query(`UPDATE public.conversation SET time_updated = now() WHERE conversation_id = $1`, [conv1])),
    };
    const blocked = (o: { ok: boolean; sqlstate?: string; message?: string }) => !o.ok && o.sqlstate === 'P0001';
    txRead.triggers = t4;
    ck('T4', 'append-only',
      blocked(t4.msg_update) && /append-only/.test(t4.msg_update.message || '')
      && blocked(t4.msg_delete)
      && blocked(t4.conv_delete) && /not deletable/.test(t4.conv_delete.message || '')
      && blocked(t4.conv_update_immut)
      && blocked(t4.conv_watermark_down) && /monotonic/.test(t4.conv_watermark_down.message || '')
      && t4.conv_time_updated.ok === true,
      'message UPDATE/DELETE 拒(P0001) · conversation DELETE 拒 · 非允许列 UPDATE 拒 · 水位回退拒 · time_updated 允许',
      JSON.stringify({ msg_update: `${t4.msg_update.sqlstate}:${t4.msg_update.message}`, msg_delete: t4.msg_delete.sqlstate, conv_delete: `${t4.conv_delete.sqlstate}:${t4.conv_delete.message}`, immut: t4.conv_update_immut.sqlstate, wm_down: `${t4.conv_watermark_down.sqlstate}:${t4.conv_watermark_down.message}`, time_updated_ok: t4.conv_time_updated.ok }));

    // ---- T5 参与者准入（服务层真函数 · tx 注入）：非参与者 403 MSG_NOT_PARTICIPANT ----
    const gOther = await requireConversationParticipant(conn as TxClient, T_N, conv1) as any;
    const gBuyer = await requireConversationParticipant(conn as TxClient, T_B, conv1) as any;
    const gMissing = await requireConversationParticipant(conn as TxClient, T_B, 99999999) as any;
    txRead.participant = {
      other: { ok: gOther.ok, status: gOther.status, code: gOther.code },
      buyer: { ok: gBuyer.ok },
      missing: { ok: gMissing.ok, status: gMissing.status, code: gMissing.code },
    };
    ck('T5', 'authz', gOther.ok === false && gOther.status === 403 && gOther.code === 'MSG_NOT_PARTICIPANT'
      && gBuyer.ok === true && gMissing.ok === false && gMissing.status === 404 && gMissing.code === 'MSG_CONVERSATION_NOT_FOUND',
      '非参与者 ⇒ 403 MSG_NOT_PARTICIPANT · 参与者 ⇒ ok · 不存在会话 ⇒ 404 MSG_CONVERSATION_NOT_FOUND',
      JSON.stringify(txRead.participant));

    // ---- NC1 判负：去频次闸 ⇒ 第 21 条变绿（必红对照）----
    const nc1 = await conn.query(`INSERT INTO public.message (conversation_id, from_uid, body) VALUES ($1,$2,'no-gate-21st') RETURNING msg_id`, [conv1, T_S]);
    results.negative_controls.push({ id: 'NC1', what: '去掉频次闸（纯 INSERT 无 `count<limit`）', expect: '第 21 条落库（证明闸是承重的）', rows: nc1.rowCount });
    ck('NC1', 'negative', nc1.rowCount === 1, '去闸后第 21 条落库（原断言若在此口径下断 429 ⇒ 必红）', `rows=${nc1.rowCount}`);

    // ---- NC2 判负：message 可 UPDATE ⇒ 闸失效（关触发器后 UPDATE 成功）----
    await conn.query('SAVEPOINT nc2');
    await conn.query('ALTER TABLE public.message DISABLE TRIGGER trg_message_no_update_or_delete');
    const nc2 = await conn.query(`UPDATE public.message SET body = 'nc2-mutated' WHERE conversation_id = $1`, [conv1]);
    await conn.query('ALTER TABLE public.message ENABLE TRIGGER trg_message_no_update_or_delete');
    await conn.query('RELEASE SAVEPOINT nc2');
    results.negative_controls.push({ id: 'NC2', what: '关 message 闸后 UPDATE', expect: 'UPDATE 生效 ⇒ 闸是禁止 UPDATE 的真实机制', rows: nc2.rowCount });
    ck('NC2', 'negative', (nc2.rowCount ?? 0) > 0, '关闸后 UPDATE 生效（⇒ 未关时必拒 = 闸承重）', `rows=${nc2.rowCount}`);

    // ---- NC3 判负：零管理员旁路 —— 不过滤参与者时，会话对非参与者「可见」 ----
    const nc3 = await q<{ n: number }>(`SELECT count(*)::int AS n FROM public.conversation WHERE conversation_id = $1`, [conv1]);
    results.negative_controls.push({ id: 'NC3', what: '不带参与者过滤的会话读取（模拟 admin 旁路）', expect: '行可见 ⇒ 403 由准入码承担，非数据缺失', rows: Number(nc3[0].n) });
    ck('NC3', 'negative', Number(nc3[0].n) === 1, '不过滤 ⇒ 会话可见（⇒ 准入闸承重；旁路实现会把 403 变 200）', `rows=${Number(nc3[0].n)}`);

    throw new Error('A5_PROBE_TX_ROLLBACK');
  } catch (e) {
    if (String((e as Error)?.message) !== 'A5_PROBE_TX_ROLLBACK') {
      ck('T-FATAL', 'tx', false, 'tx 腿无异常', String((e as Error)?.message).slice(0, 200));
    }
  } finally {
    await conn.query('ROLLBACK').catch(() => undefined);
    (conn as unknown as { release?: () => void }).release?.();
    log('TX ROLLBACK done（净写 0）');
  }
  results.tx = txRead;

  // ============ §HTTP2 站内信真 HTTP 轮次（提交态夹具 + §C 清账还原）============
  let convId: number | null = null;
  try {
    // #1 开会话（买方 2 看他人商品 13）
    const c1 = await http(BASE_CFG, 'POST', '/api/messages/conversations', { token: tokB, body: { listing_id: LISTING_ID } });
    const c1id = Number(c1.json?.data?.conversation_id ?? 0);
    convId = c1id || null;
    ck('H1', 'send', c1.status === 200 && c1id > 0 && c1.json?.data?.created === true, '200 · created:true', `${c1.status} id=${c1id} created=${c1.json?.data?.created}`);
    const c1b = await http(BASE_CFG, 'POST', '/api/messages/conversations', { token: tokB, body: { listing_id: LISTING_ID } });
    ck('H2', 'send', c1b.status === 200 && Number(c1b.json?.data?.conversation_id) === c1id && c1b.json?.data?.created === false,
      '自然幂等：重放 ⇒ created:false 同 id', `${c1b.status} created=${c1b.json?.data?.created}`);
    // 卖家本人开自己商品 ⇒ 400
    const cSelf = await http(BASE_CFG, 'POST', '/api/messages/conversations', { token: tokS, body: { listing_id: LISTING_ID } });
    ck('H3', 'send', cSelf.status === 400 && errCode(cSelf) === 'MSG_SELF_CONVERSATION', '400 MSG_SELF_CONVERSATION（卖家本人）', `${cSelf.status}/${errCode(cSelf)}`);
    if (!convId) throw new Error('conversation not created');

    // #6 未读基数
    const un0 = await http(BASE_CFG, 'GET', '/api/messages/unread-count', { token: tokB });
    const u0 = Number(un0.json?.data?.unread_total ?? -1);
    // #4 卖方发 1 条
    const s1 = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'p1', create_key: 'cli:v117-s-1' } });
    const m1 = Number(s1.json?.data?.msg_id ?? 0);
    ck('H4', 'send', s1.status === 200 && m1 > 0, '200 · msg_id>0', `${s1.status} msg_id=${m1}`);
    // 未读 +1
    const un1 = await http(BASE_CFG, 'GET', '/api/messages/unread-count', { token: tokB });
    ck('H5', 'unread', un1.status === 200 && Number(un1.json?.data?.unread_total) === u0 + 1, `unread_total = ${u0}+1`, `${un1.json?.data?.unread_total}`);
    // #3 消息列表（买方）
    const l1 = await http(BASE_CFG, 'GET', `/api/messages/conversations/${convId}/messages`, { token: tokB });
    const l1rows = l1.json?.data?.rows || [];
    ck('H6', 'list', l1.status === 200 && l1rows.length === 1 && Number(l1rows[0].msg_id) === m1 && l1.json?.data?.conversation?.role === 'buyer' && Number(l1.json?.data?.conversation?.counterpart_uid) === UID_SELLER,
      '200 · 1 行 · role=buyer · counterpart=seller', `${l1.status} rows=${l1rows.length} role=${l1.json?.data?.conversation?.role}`);
    // #5 标读 ⇒ 未读归 0
    const rd = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/read`, { token: tokB, body: {} });
    const un2 = await http(BASE_CFG, 'GET', '/api/messages/unread-count', { token: tokB });
    ck('H7', 'unread', rd.status === 200 && Number(rd.json?.data?.last_read_msg_id) === m1 && Number(un2.json?.data?.unread_total) === u0,
      `标读 last_read=${m1} ⇒ unread_total 回 ${u0}`, `read=${rd.status}/${rd.json?.data?.last_read_msg_id} unread=${un2.json?.data?.unread_total}`);

    // #4 幂等重放：同键同内容 ⇒ 200 idempotent_replay · 不产生新行
    const cntBefore = Number((await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.message WHERE conversation_id = $1`, [convId]))[0].n);
    const rep = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'p1', create_key: 'cli:v117-s-1' } });
    const cntAfter = Number((await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.message WHERE conversation_id = $1`, [convId]))[0].n);
    ck('H8', 'idempotency', rep.status === 200 && rep.json?.data?.idempotent_replay === true && Number(rep.json?.data?.msg_id) === m1 && cntAfter === cntBefore,
      '200 idempotent_replay:true · 同 msg_id · 行数不变（不计数）', `${rep.status} replay=${rep.json?.data?.idempotent_replay} rows ${cntBefore}→${cntAfter}`);
    // 同键异内容 ⇒ 409
    const conf = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'p1-DIFFERENT', create_key: 'cli:v117-s-1' } });
    ck('H9', 'idempotency', conf.status === 409 && errCode(conf) === 'LEDGER_IDEMPOTENCY_CONFLICT', '409 LEDGER_IDEMPOTENCY_CONFLICT（同键异内容）', `${conf.status}/${errCode(conf)}`);
    // 键形状 / body 闸
    const nk = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'x' } });
    const bk = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'x', create_key: 'foo:1' } });
    const be = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: '   ', create_key: 'cli:v117-empty' } });
    const bl = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: 'y'.repeat(2001), create_key: 'cli:v117-long' } });
    ck('H10', 'send', nk.status === 400 && errCode(nk) === 'LEDGER_IDEMPOTENCY_KEY_REQUIRED'
      && bk.status === 400 && errCode(bk) === 'LEDGER_IDEMPOTENCY_KEY_INVALID'
      && be.status === 400 && errCode(be) === 'MSG_BODY_INVALID' && be.json?.error?.details?.reason === 'EMPTY'
      && bl.status === 400 && errCode(bl) === 'MSG_BODY_INVALID' && bl.json?.error?.details?.reason === 'TOO_LONG',
      '缺键 400 REQUIRED · 坏前缀 400 INVALID · 空 body 400 MSG_BODY_INVALID/EMPTY · 超长 TOO_LONG',
      JSON.stringify({ nk: `${nk.status}/${errCode(nk)}`, bk: `${bk.status}/${errCode(bk)}`, be: `${be.status}/${errCode(be)}/${be.json?.error?.details?.reason}`, bl: `${bl.status}/${errCode(bl)}/${bl.json?.error?.details?.reason}` }));

    // authz：非参与者 403（读/写/标读）· 零管理员旁路
    const n1 = await http(BASE_CFG, 'GET', `/api/messages/conversations/${convId}/messages`, { token: tokN });
    const n2 = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokN, body: { body: 'nope', create_key: 'cli:v117-n-1' } });
    const n3 = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/read`, { token: tokN, body: {} });
    ck('H11', 'authz', n1.status === 403 && errCode(n1) === 'MSG_NOT_PARTICIPANT' && n2.status === 403 && errCode(n2) === 'MSG_NOT_PARTICIPANT' && n3.status === 403,
      '非参与者 ⇒ 读/写/标读 全 403 MSG_NOT_PARTICIPANT', JSON.stringify({ read: `${n1.status}/${errCode(n1)}`, write: `${n2.status}/${errCode(n2)}`, mark: `${n3.status}/${errCode(n3)}` }));
    const a1 = await http(BASE_CFG, 'GET', `/api/messages/conversations/${convId}/messages`, { token: tokA });
    const a2 = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokA, body: { body: 'admin-bypass?', create_key: 'cli:v117-a-1' } });
    ck('H12', 'authz', a1.status === 403 && a2.status === 403, '零管理员旁路：admin(uid=10) 非参与者 ⇒ 403（非 200）', `${a1.status}/${a2.status}`);
    // 404
    const nf = await http(BASE_CFG, 'GET', '/api/messages/conversations/99999999/messages', { token: tokB });
    ck('H13', 'authz', nf.status === 404 && errCode(nf) === 'MSG_CONVERSATION_NOT_FOUND', '404 MSG_CONVERSATION_NOT_FOUND', `${nf.status}/${errCode(nf)}`);

    // 频次闸（HTTP 真腿）：会话闸 20/日/（会话×发送者）⇒ 第 21 条 429
    //   S 已发 1 条；补 19 条 ⇒ 20 条；第 21 条必拒（重放不占额已由 H8 证）
    let okCount = 0; let first429: any = null;
    for (let i = 2; i <= 21; i += 1) {
      const r = await http(BASE_CFG, 'POST', `/api/messages/conversations/${convId}/messages`, { token: tokS, body: { body: `p${i}`, create_key: `cli:v117-s-${i}` } });
      if (r.status === 200) okCount += 1;
      else if (!first429) first429 = { i, status: r.status, code: errCode(r), reason: r.json?.error?.details?.reason };
    }
    ck('H14', 'rate', okCount === 19 && first429 && first429.status === 429 && first429.code === 'MSG_RATE_LIMITED' && first429.reason === 'PER_CONVERSATION_DAILY',
      'S 累计 20 条放行 · 第 21 条 ⇒ 429 MSG_RATE_LIMITED · reason=PER_CONVERSATION_DAILY',
      JSON.stringify({ ok200: okCount, first_blocked: first429 }));
    // 会话列表（买方）应见该会话 + last_body_preview 截断
    const cl = await http(BASE_CFG, 'GET', '/api/messages/conversations', { token: tokB });
    const cr = (cl.json?.data?.rows || []).find((x: any) => Number(x.conversation_id) === convId);
    ck('H15', 'list', cl.status === 200 && !!cr && Number(cr.unread_count) === 19 && cr.role === 'buyer',
      '会话列表含该会话 · 买方未读 19（标读水位 = m1 ⇒ 其后 19 条未读）', `${cl.status} unread=${cr?.unread_count}`);
    results.http.roundtrip = { conv: convId, unread_base: u0, ok200: okCount, first_blocked: first429 };
  } catch (e) {
    ck('H-FATAL', 'http2', false, 'HTTP 轮次无异常', String((e as Error)?.message).slice(0, 200));
  }

  // ============ §C 清账 + 净写 0 复核 ============
  if (convId) {
    try {
      const purge = await purgeFixture(convId);
      const after = await fingerprint();
      const trigAfter = await triggerState();
      const rest = Number((await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.message WHERE conversation_id = $1`, [convId]))[0].n)
        + Number((await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM public.conversation WHERE conversation_id = $1`, [convId]))[0].n);
      const trigSame = JSON.stringify(trigBefore) === JSON.stringify(trigAfter);
      const netZero = JSON.stringify(before) === JSON.stringify(after) && rest === 0;
      results.db.after = { fingerprint: after, triggers: trigAfter, purge };
      ck('Z1', 'net-zero', netZero, '行数指纹回基线 + 夹具 0 残留', `before=${JSON.stringify(before)} after=${JSON.stringify(after)} rest=${rest}`);
      ck('Z2', 'net-zero', trigSame && trigAfter.every((t: any) => t.tgenabled === 'O'), '两表全部闸复位（tgenabled=O）', JSON.stringify(trigAfter));
    } catch (e) {
      ck('Z-FATAL', 'net-zero', false, '清账成功', String((e as Error)?.message).slice(0, 200));
    }
  } else {
    ck('Z1', 'net-zero', false, 'HTTP 轮次建立夹具会话', 'convId=null');
  }

  // ---- NC4 判负：webhook 缺 secret 若「改为 200」⇒ 必红 ----
  {
    const noSec = await http(BASE_CFG, 'POST', '/api/telegram/webhook', { body: {} });
    results.negative_controls.push({ id: 'NC4', what: 'webhook 缺 secret 实测形态', expect: '401（若断言「缺 secret ⇒ 200」则必红）', status: noSec.status, would_be_red_if_expect_200: noSec.status !== 200 });
    ck('NC4', 'negative', noSec.status !== 200, '缺 secret ≠ 200（⇒「改为 200」的断言必红）', `status=${noSec.status}`);
  }

  await shutdown();

  const failed = checks.filter((c) => !c.pass);
  const summary = { total: checks.length, passed: checks.length - failed.length, failed: failed.length, red: failed.map((c) => c.id) };
  const out = { ...results, checks, summary, finished_at: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT_DIR, 'messaging-behavior-probe.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'messaging-behavior-probe.steps.log'), steps.join('\n') + '\n');
  console.log(`SUMMARY ${JSON.stringify(summary)}`);
  console.log('WROTE messaging-behavior-probe.json');
  process.exit(failed.length === 0 ? 0 : 2);
})().catch(async (e) => {
  log(`FATAL ${String((e as Error)?.stack || e).slice(0, 600)}`);
  await shutdown().catch(() => undefined);
  fs.writeFileSync(path.join(OUT_DIR, 'messaging-behavior-probe.steps.log'), steps.join('\n') + '\n');
  process.exit(1);
});
