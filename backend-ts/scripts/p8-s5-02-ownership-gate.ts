/**
 * 批 8⑤ 收口 · ④ **归属闸 HTTP 面 4 例**（两读数：改动前 / 改动后）
 * ============================================================================
 * 用法（受控实例起后）：
 *   PORT=5796 P8S5_HTTP_MODE=after  npx ts-node --transpile-only scripts/p8-s5-02-ownership-gate.ts   # 改动后 = 本仓工作树
 *   PORT=5797 P8S5_HTTP_MODE=before npx ts-node --transpile-only scripts/p8-s5-02-ownership-gate.ts   # 改动前 = `git show HEAD:` 旧码（requireAdmin 直挂）
 * 产物：backend-ts/.p8s5-artifacts/p8s5-http-<RUN>/http.json（RUN-tagged）
 *
 * ★ 纪律：**只打鉴权面 / 早退面**（401/403/404/409/200）；**不调真写路径** —— 抓手 = 挑一个
 *   **已终态**（`settled`）的 job（employer = uid 11）：
 *     · 归属闸**放行**（admin / 雇主本人）⇒ 落业务服务层 ⇒ 已有白名单边被拒（409，**零写**）或幂等重放（200）；
 *     · 归属闸**拦住**（非雇主非 admin）⇒ 403（**先于**任何写）。
 *   γ 复核：跑前后现取 `ledger_entry` 行数，须**相等**（零净写）。
 * ⚠️ 只打印状态码 / 机读码 / reason；**不打印任何令牌 / 密钥 / 连接串**。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createSessionToken } from '../src/auth';
import { readQuery, closePools } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const MODE = process.env.P8S5_HTTP_MODE === 'before' ? 'before' : 'after';
const BASE = `http://127.0.0.1:${process.env.PORT || '5796'}`;
const OUT_DIR = path.join(__dirname, '..', '.p8s5-artifacts', `p8s5-http-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};

const call = async (method: string, url: string, token?: string, body?: unknown) => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${BASE}${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: Record<string, unknown> | null = null;
  try { json = (await r.json()) as Record<string, unknown>; } catch { /* noop */ }
  const err = (json?.error ?? {}) as Record<string, unknown>;
  const details = (err.details ?? {}) as Record<string, unknown>;
  return { status: r.status, code: (err.code ?? null) as string | null, reason: (details.reason ?? null) as string | null };
};

const ledgerCount = async (): Promise<number> =>
  Number((await readQuery<{ n: string }>(`SELECT count(*)::int::text AS n FROM public.ledger_entry`))[0]?.n ?? -1);

const main = async (): Promise<void> => {
  const adminRow = (await readQuery<{ uid: string }>(
    `SELECT uid::text AS uid FROM public.users WHERE is_admin = true ORDER BY uid ASC LIMIT 1`))[0];
  const jobRow = (await readQuery<{ job_id: string; employer_uid: string; status: string }>(
    `SELECT job_id::text AS job_id, employer_uid::text AS employer_uid, status
       FROM public.job
      WHERE employer_uid = 11 AND status IN ('settled','cancelled','rejected')
      ORDER BY job_id ASC LIMIT 1`))[0];
  if (!adminRow || !jobRow) throw new Error('PRECONDITION: no admin / no terminal job of uid 11');

  const uids = { admin: Number(adminRow.uid), employer: 11, non_admin: 3, perm_limited: 910004 };
  const toks = Object.fromEntries(
    Object.entries(uids).map(([k, v]) => [k, createSessionToken({ uID: v, evm: '' })]),
  ) as Record<keyof typeof uids, string>;
  const JOB = jobRow.job_id;

  const ledBefore = await ledgerCount();
  const health = await fetch(`${BASE}/health`).then((r) => r.json()).catch(() => null) as Record<string, unknown> | null;

  const rows: Array<{ actor: string; uid: number; cancel: unknown; review_reject: unknown; review_approve: unknown }> = [];
  for (const actor of Object.keys(uids) as Array<keyof typeof uids>) {
    const cancel = await call('POST', `/api/job/${JOB}/cancel`, toks[actor]);
    const reviewReject = await call('POST', `/api/job/${JOB}/review`, toks[actor], { approved: false });
    const reviewApprove = await call('POST', `/api/job/${JOB}/review`, toks[actor], { approved: true });
    rows.push({ actor, uid: uids[actor], cancel, review_reject: reviewReject, review_approve: reviewApprove });
  }
  const noToken = await call('POST', `/api/job/${JOB}/cancel`);
  const ledAfter = await ledgerCount();

  const row = (a: string) => rows.find((r) => r.actor === a)!;
  const is403 = (x: unknown, reason: string) => {
    const y = x as { status: number; reason: string | null };
    return y.status === 403 && y.reason === reason;
  };
  const passthrough = (x: unknown) => (x as { status: number }).status !== 401 && (x as { status: number }).status !== 403;

  // 4 例断言（mode-aware：改动后 = 归属闸生效；改动前 = HEAD 旧码直挂 requireAdmin）
  t('G1.admin', 'ownership', passthrough(row('admin').cancel) && passthrough(row('admin').review_reject),
    'admin(uid 1) ⇒ **通**（非 401/403；落业务层）', JSON.stringify({ cancel: row('admin').cancel, review_reject: row('admin').review_reject }));
  if (MODE === 'after') {
    t('G2.employer', 'ownership', passthrough(row('employer').cancel) && passthrough(row('employer').review_reject),
      '雇主本人(uid 11) ⇒ **通**（改动后归属闸放行）', JSON.stringify({ cancel: row('employer').cancel, review_reject: row('employer').review_reject }));
  } else {
    t('G2.employer_before', 'ownership', is403(row('employer').cancel, 'NOT_ADMIN') && is403(row('employer').review_reject, 'NOT_ADMIN'),
      '雇主本人(uid 11) ⇒ **403 NOT_ADMIN**（改动前 = 旧码直挂 requireAdmin）', JSON.stringify({ cancel: row('employer').cancel, review_reject: row('employer').review_reject }));
  }
  t('G3.non_admin', 'ownership', is403(row('non_admin').cancel, 'NOT_ADMIN') && is403(row('non_admin').review_reject, 'NOT_ADMIN'),
    '非雇主非 admin(uid 3) ⇒ **403 AUTH_FORBIDDEN / NOT_ADMIN**', JSON.stringify({ cancel: row('non_admin').cancel, review_reject: row('non_admin').review_reject }));
  t('G4.perm_limited', 'ownership', is403(row('perm_limited').cancel, 'PERMISSION_NOT_GRANTED') && is403(row('perm_limited').review_reject, 'PERMISSION_NOT_GRANTED'),
    '非雇主 admin 缺 review_tasks(uid 910004 仅 manage_points) ⇒ **403 PERMISSION_NOT_GRANTED**',
    JSON.stringify({ cancel: row('perm_limited').cancel, review_reject: row('perm_limited').review_reject }));
  t('G5.no_token_401', 'ownership', noToken.status === 401 && noToken.code === 'AUTH_UNAUTHORIZED',
    '无 token ⇒ 401 AUTH_UNAUTHORIZED（先于任何写）', JSON.stringify(noToken));
  t('G6.zero_net_write', 'ownership', ledBefore === ledAfter,
    '★ 只读/鉴权面：跑前后 `ledger_entry` 行数**相等**（零净写）', JSON.stringify({ before: ledBefore, after: ledAfter }));

  const summary = {
    mode: MODE, base: BASE, job_used: { job_id: JOB, employer_uid: jobRow.employer_uid, status: jobRow.status },
    health: { status: health?.status ?? null, schema_version: health?.schema_version ?? null },
    readings: rows, no_token: noToken, ledger_entry: { before: ledBefore, after: ledAfter },
    note: '只打鉴权面 / 早退面：动作口**放行**只到服务层早退（终态 job ⇒ 白名单边拒 409 或幂等重放 200），不产生真写；拦住 = 403 先于写。',
  };

  const failed = checks.filter((c) => !c.pass);
  fs.writeFileSync(path.join(OUT_DIR, 'http.json'),
    JSON.stringify({ unit: 'P8-S5-HTTP-OWNERSHIP', run: RUN, mode: MODE, total: checks.length, passed: checks.length - failed.length, failed: failed.length, summary, checks }, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ mode: MODE, total: checks.length, passed: checks.length - failed.length, failed: failed.length, failed_ids: failed.map((f) => f.id), readings: rows }, null, 1));
  console.log(`ARTIFACT ${path.join(OUT_DIR, 'http.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
};
main().catch(async (e) => { console.error('HTTP PROBE FAIL:', (e as Error)?.message); await closePools(); process.exit(2); });
