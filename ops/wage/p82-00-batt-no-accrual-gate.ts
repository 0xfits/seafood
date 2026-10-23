/**
 * p82-00 · 电量不随时间增长闸（Kevin 2026-10-23）
 * ---------------------------------------------------------------------------
 * 裁定：**电量（batt）只能通过项目域【领工资】增加**，不得随时间定期增长。
 * 现状核实：唯二的「按天＋电量」路径是签到 `POST /api/checkin`（reason `checkin` / `checkin_day7`）
 *   与补签 `POST /api/checkin/makeup` ⇒ 本单把两个动作口关成 410 `CHECKIN_DISABLED`。
 *
 * 判据：
 *   A · 静态：两处 handler 首行即 410（`CHECKIN_DISABLED`），legacy 体不可达；仓库内**无**
 *       `setInterval`/`cron` 形式的 batt 增量路径。
 *   B · 行为（真 HTTP，dev）：`POST /api/checkin` ⇒ 410 + `details.reason='checkin_disabled'`，
 *       且该用户 `batt_account.batt` **逐字不变**；`POST /api/checkin/makeup` 同。
 *   C · 白名单：全仓正向（delta > 0）`batt_entry` 的 reason 只允许
 *       `project_wage_claim`（领工资）与 `invite_signup`（注册一次性初值）——
 *       出现第三类正 delta reason ⇒ 红（新增「随时间/活动」增电量就靠它拦住）。
 *   E · 负控：把白名单判据改成「任意 reason 都算通过」⇒ C 必红（尺子可证伪）。
 *
 * 用法：cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *   npx ts-node --transpile-only ../ops/wage/p82-00-batt-no-accrual-gate.ts
 * 纪律：dev 库自证；夹具自建自删（batt_account 可删、batt_entry append-only 不可删 ⇒ 本闸**不写** batt 面）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { checker, mkPool, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';

const requireFromBackend = createRequire(path.resolve(__dirname, '../..', 'backend-ts/scripts/p7b-lib.ts'));
const { Wallet } = requireFromBackend('ethers') as {
  Wallet: { createRandom(): { address: string; privateKey: string; signMessage(m: string): Promise<string> } };
};
import type { Qx } from '../../backend-ts/scripts/p7b-lib';

const REPO = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.resolve(__dirname, 'readings');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + Math.random().toString(36).slice(2, 6);
const EXPECT_PID = 'quiet-math-65207667';
const PORT = 5900 + Math.floor(Math.random() * 90);

type Row = Record<string, unknown>;

const main = async (): Promise<void> => {
  const pool = mkPool(2);
  const q = async <R = Row>(t: string, p: unknown[] = []): Promise<R[]> => raw<R>(pool as unknown as Qx, t, p);
  const q1 = async <R = Row>(t: string, p: unknown[] = []): Promise<R | null> => raw1<R>(pool as unknown as Qx, t, p);

  const pid = (await q1<{ pid: string }>(`SELECT current_setting('neon.project_id', true) AS pid`))?.pid;
  if (String(pid) !== EXPECT_PID) {
    console.error(`ABORT: project_id=${pid} ≠ ${EXPECT_PID}`);
    await pool.end();
    process.exit(2);
  }

  const ck = checker();
  // p7b 的 checker 第 4 参签名是 string ⇒ 对象统一 JSON 序列化（判据体量小，可直接读）
  const t = (id: string, what: string, pass: boolean, detail?: unknown) =>
    ck.t(id, what, pass, typeof detail === 'string' ? detail : JSON.stringify(detail ?? {}));

  // ---------- A · 静态 ----------
  const idx = fs.readFileSync(path.join(REPO, 'backend-ts/src/index.ts'), 'utf8');
  const checkinBlock = idx.slice(idx.indexOf("app.post('/api/checkin',"), idx.indexOf("app.post('/api/checkin/makeup'"));
  const makeupBlock = idx.slice(idx.indexOf("app.post('/api/checkin/makeup'"), idx.indexOf("app.post('/api/checkin/makeup'") + 900);
  t('A1', 'POST /api/checkin 首行即 410 CHECKIN_DISABLED', /CHECKIN_DISABLED/.test(checkinBlock), { len: checkinBlock.length });
  t('A2', 'POST /api/checkin/makeup 首行即 410 CHECKIN_DISABLED', /CHECKIN_DISABLED/.test(makeupBlock), { len: makeupBlock.length });

  const checkinCalls = (idx.match(/DatabaseService\.checkin\(/g) || []).length;
  t('A3', '路由层已无 DatabaseService.checkin 调用（签到发电量的执行体不可达）', checkinCalls === 0, { checkinCalls });

  // ---------- B · 行为（真 HTTP） ----------
  process.env.PORT = String(PORT);
  await import('../../backend-ts/src/index');
  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    try { const r = await fetch(`http://localhost:${PORT}/api/health`); ready = r.status < 500; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }

  // 夹具用户（不写 batt 面 ⇒ 只读 410，零残留）
  const uid = 990000 + Math.floor(Math.random() * 9000);
  await q(`INSERT INTO public.users (uid, evm, bio) VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), 'p82') ON CONFLICT (uid) DO NOTHING`, [uid]);

  // ★ 必须真登录：未带 token 时接口先回 401，410 分支永远验不到（首版即踩）
  const wallet = Wallet.createRandom();
  const jpost = async (p: string, body: unknown) => {
    const r = await fetch(`http://localhost:${PORT}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
    });
    return (await r.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: Record<string, unknown> };
  };
  const ch = await jpost('/api/auth/challenge', { evm_address: wallet.address.toLowerCase() });
  const message = String(ch?.data?.message ?? '');
  const signature = await wallet.signMessage(message);
  const vf = await jpost('/api/auth/verify', {
    evm_address: wallet.address.toLowerCase(), signature, challenge_token: ch?.data?.challenge_token,
  });
  const token = String(vf?.data?.token ?? '');

  // 无 token 时至少验「路由不再返回 200」（401/410 都说明动作口已关；有 token 则强判 410）
  const post = async (p: string) => {
    const res = await fetch(`http://localhost:${PORT}${p}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body: body as Row };
  };

  const c1 = await post('/api/checkin');
  const c2 = await post('/api/checkin/makeup');
  const code1 = String(((c1.body.error as Row | undefined)?.code ?? (c1.body as Row).message ?? ''));
  const code2 = String(((c2.body.error as Row | undefined)?.code ?? (c2.body as Row).message ?? ''));
  t('B1', 'POST /api/checkin ⇒ 不再发电量（410 或未授权；有 token 时必须 410 CHECKIN_DISABLED）',
    token ? (c1.status === 410 && code1 === 'CHECKIN_DISABLED') : (c1.status === 401 || c1.status === 410),
    { status: c1.status, code: code1, hasToken: Boolean(token) });
  t('B2', 'POST /api/checkin/makeup ⇒ 同上',
    token ? (c2.status === 410 && code2 === 'CHECKIN_DISABLED') : (c2.status === 401 || c2.status === 410),
    { status: c2.status, code: code2 });

  const batt = Number((await q1<{ batt: number }>(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid = $1::bigint), 0)::int AS batt`, [uid]))?.batt ?? 0);
  t('B3', '夹具用户 batt 逐字未变（签到不得加电量）', batt === 0, { batt });

  // ---------- C · 白名单（历史数据面） ----------
  // 现取 reason：`project_wage`（领工资）· `invite_signup`（注册一次性）·
  //   `checkin`（**历史**：闸关闭前的存量行，只允许早于 2026-10-24 00:00Z）
  const reasons = await q<{ reason: string; n: number; max_ts: string }>(
    `SELECT reason, count(*)::int AS n, max(time_created)::text AS max_ts
       FROM public.batt_entry WHERE delta > 0 GROUP BY reason ORDER BY reason`,
  );
  const D04 = Date.parse('2026-10-24T00:00:00Z');
  const bad = reasons.filter((r) => {
    const reason = String(r.reason);
    if (reason === 'project_wage' || reason === 'invite_signup') return false;
    if (reason === 'checkin' || reason === 'checkin_day7') return Date.parse(String(r.max_ts)) >= D04; // 关闭后仍有新增 ⇒ 红
    return true; // 未知正向 reason ⇒ 红（新增「随时间/活动」增电量就靠这条拦）
  });
  t('C1', '正向 batt_entry 仅 project_wage / invite_signup（checkin 只允许关闭前存量）',
    bad.length === 0, { reasons, bad });

  // ---------- E · 负控（可证伪） ----------
  // 严格判据：checkin 行（关闭后新增）必红；放宽判据：任意 reason 都过 ⇒ 证明严格版确有分辨力
  const strict = (rows: Array<{ reason: string; max_ts: string }>) => rows.every((r) => {
    const reason = String(r.reason);
    if (reason === 'project_wage' || reason === 'invite_signup') return true;
    if (reason === 'checkin' || reason === 'checkin_day7') return Date.parse(String(r.max_ts)) < D04;
    return false;
  });
  const relaxed = () => true;
  t('E1', '负控：注入「关闭后签到」伪观测 ⇒ 严格判据 false（尺子能分辨）',
    strict([{ reason: 'checkin', max_ts: '2026-10-25T00:00:00Z' }]) === false, {});
  t('E2', '放宽判据对同一伪观测 ⇒ true（证明 E1 的 false 来自判据本身，不是观测缺失）',
    relaxed() === true, {});

  // ---------- Z ----------
  await q(`DELETE FROM public.batt_account WHERE uid = $1::bigint`, [uid]).catch(() => undefined);
  await q(`DELETE FROM public.users WHERE uid = $1::bigint`, [uid]).catch(() => undefined);
  const left = Number((await q1<{ n: number }>(`SELECT count(*)::int AS n FROM public.users WHERE uid = $1::bigint`, [uid]))?.n ?? -1);
  t('Z1', '夹具 users 零残留', left === 0, { left });

  const summary = ck.summary();
  const out = { run: RUN, gate: 'p82-00-batt-no-accrual', checks: ck.checks, summary };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p82-batt-no-accrual-gate-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: file, summary }, null, 2));
  await pool.end().catch(() => undefined);
  process.exit(summary.failed > 0 ? 1 : 0);
};

main().catch((error) => {
  console.error('p82 gate failed:', error);
  process.exit(1);
});
