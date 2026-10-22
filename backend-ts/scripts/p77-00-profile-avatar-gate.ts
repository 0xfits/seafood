/**
 * p77-00 · 用户头像写口闸（`POST /api/user/profile` 的 `users.avatar_url` 写口 + 前端头像编辑器）
 * ---------------------------------------------------------------------------------------------
 * 用法（本文件在 `backend-ts/scripts/` 内，与 p7b 系同锚）：
 *   cd backend-ts && npx ts-node --transpile-only scripts/p77-00-profile-avatar-gate.ts
 * 读数：`ops/profile-avatar/readings/p77-profile-avatar-gate-<RUN>.json`
 *
 * 派单面（逐条守住，2026-10-22 · commit `e6056a3` 已落盘实现在此**现取**，本单只补验证）：
 *   ① `POST /api/user/profile` 新增**可选** `avatar_url`：值域 `/api/media/<1–12 位数字>`
 *      （站内媒体相对路径）或 `null`（清空）；非法 ⇒ 400 + 机读码 `AVATAR_URL_INVALID`；
 *      键面判据 = **has-flag**（`avatar_url: null` 是真语义，不是缺键）；
 *      **只带头像不带 bio 合法**；两者都不传（或 `bio` 空/纯空白）⇒ 既有 400 `bio is required`。
 *   ② `DatabaseService.updateUserProfile`：`undefined` 不进 SET（保留现值）/ `null` 显式置空
 *      （has-flag 动态 SET；不再 COALESCE）。
 *   ③ `GET /api/user` 与 profile 回执**同源**（`buildUserPayload`）⇒ `avatar_url` 加性透出。
 *   ④ 零新路由（注册点仍 **109**）/ 零新 kind；新码恰 1 个（`AVATAR_URL_INVALID`）。
 *   ⑤ 只改头像时**零翻译入队**（`enqueueTranslation` 只在 `hasBio` 分支）。
 *
 * 判据面（闭集臂）：
 *   A · 静态：注册点 109 逐 verb · 路由接线（has-flag 两键 / 形状闸常量 / 新码形状 / 只生效于 hasAvatar）
 *       · 服务层动态 SET（`avatar_url` 分支存在且 `undefined` 不进）· 回执同源 buildUserPayload
 *       · 前端编辑器钩子（`data-sf-m=profile-avatar*` 七键，探针靠它定位）。
 *   H · 协议守卫：无 token ⇒ 401（requireActor 前置不变）。
 *   S · 行为（**真 HTTP** · 本进程 app · port 0 · 真 dev 库）：
 *       SA 只带 bio（回归）⇒ 200 · bio 落库 · 回执含 `avatar_url` 键（null）· 译文登记 > 0；
 *       SB 只带 `avatar_url` 合法形态（**真上传** `POST /api/media` 取真 id）⇒ 200 · avatar 落库
 *          · bio 不变 · **零翻译入队** · `GET /api/user` 回读同一值（回执=回读同源）；
 *       SC 非法形态六类（相对路径 / 外部 URL / 非数字 id / 超长 id / 空串 / 非字符串类型）
 *          ⇒ **均 400 `AVATAR_URL_INVALID`** · 且库内 avatar/bio 一个字节都没动；
 *       SD 两者都不传 / `bio:''` ⇒ 400 `bio is required`（旧文案旧形状）；
 *       SE `avatar_url: null` ⇒ 200 置空 · bio 不变 · 回读 null。
 *   F · **负控**：F1 mutant（把路由里 `USER_AVATAR_URL_PATTERN` 短路成 `/^[\s\S]*$/` 生成
 *       `src/index.p77neg.ts`，子进程 5796 真 HTTP）⇒ 六类里的**字符串五类全部不再 400**
 *       （C 段谓词必红），而**非字符串类型仍 400**（证明短路只切了形态闸、类型闸仍在）；
 *       F2 同一谓词喂 mutant 响应必 false、喂真响应必 true（可证伪自检）。
 *   Z · 残留：Z1 夹具 users / media / content_translation / batt / account 全删（自建临时用户，
 *       不动存量）；Z2 非夹具用户 `avatar_url` 指纹前后逐字相等（本轮零外溢写）。
 *
 * 纪律：**不 apply 迁移、不 push、不改 frontend/docs**；库身份自证 `neon.project_id`
 *   ≠ `quiet-math-65207667` ⇒ **ABORT**（不跑、不写）。夹具私钥落
 *   `~/.config/seafood/p77-gate.env` 0600（**不打印**）。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { Wallet } from 'ethers';
import { checker, mkPool, qRetry, raw, raw1 } from './p7b-lib';
import type { Qx } from './p7b-lib';


const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const BACKEND = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND, '..');
const OUT_DIR = path.join(REPO_ROOT, 'ops/profile-avatar/readings');
const PROJECT_ID = 'quiet-math-65207667';
const NEG_PORT = 5796;

const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DB_TS = readSrc('backend-ts/src/database.ts');
const COMPONENT_JSX = readSrc('frontend/src/components/ProfileAvatarEditor.jsx');
const PROFILE_CSS = readSrc('frontend/src/pages/profile.css');

/** 1×1 PNG（真图 ⇒ 走真 `POST /api/media`（魔数 + 体积 + sha256 去重全跑），不是 mock）。 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

type Http = { status: number; body: Record<string, unknown> };
const errOf = (r: Http) => (r.body.error && typeof r.body.error === 'object' ? r.body.error as Record<string, unknown> : {});
const dataOf = (r: Http) => (r.body.data && typeof r.body.data === 'object' ? r.body.data as Record<string, unknown> : {});

/** C 段核心谓词（真臂与 F1 mutant 共用 —— 同一函数，保证可证伪）。 */
const avatarRejectPredicate = (r: Http): boolean =>
  r.status === 400 && String(errOf(r).code ?? '') === 'AVATAR_URL_INVALID';

/** 六类非法形态（五类派单闭集 + 非字符串类型一类）。 */
const INVALID_FORMS: Array<{ id: string; why: string; value: unknown }> = [
  { id: 'C1', why: '相对路径（缺 /api/media/ 前缀）', value: 'media/123' },
  { id: 'C2', why: '外部 URL', value: 'https://cdn.example.com/a.png' },
  { id: 'C3', why: '非数字 id', value: '/api/media/abc123' },
  { id: 'C4', why: '超长 id（13 位 > 12）', value: '/api/media/1234567890123' },
  { id: 'C5', why: '空串（不是清空，是非法值）', value: '' },
  { id: 'C6', why: '非字符串类型（数字/对象/布尔）', value: 12345 },
];
const NON_STRING_FORMS: Array<{ id: string; why: string; value: unknown }> = [
  { id: 'C6a', why: '数字', value: 12345 },
  { id: 'C6b', why: '对象', value: { url: '/api/media/9' } },
  { id: 'C6c', why: '布尔', value: true },
];

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = {
    script: 'backend-ts/scripts/p77-00-profile-avatar-gate.ts',
    run: RUN,
    project_id_expected: PROJECT_ID,
  };
  const pool = mkPool(4);
  const db = pool as unknown as Qx;
  const roles = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
  type Role = typeof roles[number];
  const users = {} as Record<Role, number>;
  const tokens = {} as Record<Role, string>;
  let server: { close: (cb?: () => void) => void } | null = null;
  let child: ReturnType<typeof spawn> | null = null;
  const MUTANT_PATH = path.resolve(BACKEND, 'src/index.p77neg.ts');
  let base = '';
  const outerBase = () => base;

  // ---------------------------------------------------------------- 库身份自证（前置闸）
  const ident = await raw1<{ pid: string | null; db: string }>(db,
    `SELECT current_setting('neon.project_id', true) AS pid, current_database() AS db`);
  out.db_identity = ident;
  if (String(ident?.pid ?? '') !== PROJECT_ID) {
    console.error(`ABORT: neon.project_id = ${String(ident?.pid)} ≠ ${PROJECT_ID}（非 dev 库，拒绝运行）`);
    await pool.end();
    process.exit(2);
  }

  // ============================================================================
  // A · 静态面（零 DB）
  // ============================================================================
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const verbCounts = { regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete'), put: countVerb('put') };
  ck.t('A1',
    '★路由面：注册点仍 **109**（49/53/4/3/0 · 零新路由：`POST /api/user/profile` 是既有口，本单只加键）',
    regs === 109 && verbCounts.get === 49 && verbCounts.post === 53 && verbCounts.patch === 4 && verbCounts.delete === 3 && verbCounts.put === 0,
    JSON.stringify(verbCounts));

  const routeSlice = (verb: string, tail: string): string => {
    const head = INDEX_TS.indexOf(`${verb}${tail}`);
    if (head < 0) return '';
    const next = INDEX_TS.indexOf('\napp.', head + 8);
    return INDEX_TS.slice(head, next < 0 ? undefined : next);
  };
  const PROFILE_POST = routeSlice('app.post', "('/api/user/profile'");
  const USER_GET = routeSlice('app.get', "('/api/user'");

  ck.t('A2',
    '★接线（按现取形状）：has-flag 两键（`hasOwnProperty`）· 形状闸常量 `/^\\/api\\/media\\/[0-9]{1,12}$/`'
    + '· 非法 ⇒ `sendVerbError` 400 `AVATAR_URL_INVALID`（details.reason 同值）· `null` ⇒ 置空分支'
    + '· 两者都不传/`bio` 空 ⇒ 既有 400 `bio is required` 逐字未动',
    PROFILE_POST.includes("Object.prototype.hasOwnProperty.call(body, 'avatar_url')")
      && PROFILE_POST.includes("Object.prototype.hasOwnProperty.call(body, 'bio')")
      && /const USER_AVATAR_URL_PATTERN = \/\^\\\/api\\\/media\\\/\[0-9\]\{1,12\}\$\//.test(INDEX_TS)
      && /code: 'AVATAR_URL_INVALID'/.test(PROFILE_POST)
      && /details: \{ field: 'avatar_url', reason: 'AVATAR_URL_INVALID' \}/.test(PROFILE_POST)
      && /rawAvatar === null/.test(PROFILE_POST)
      && /if \(\(!hasBio && !hasAvatar\) \|\| \(hasBio && !bio\)\)/.test(PROFILE_POST)
      && /sendError\(res, 400, 'bio is required'\)/.test(PROFILE_POST),
    JSON.stringify({
      has_avatar_flag: PROFILE_POST.includes("hasOwnProperty.call(body, 'avatar_url')"),
      pattern: (INDEX_TS.match(/const USER_AVATAR_URL_PATTERN = .*/) ?? [''])[0],
      null_branch: /rawAvatar === null/.test(PROFILE_POST),
      bio_required_untouched: /sendError\(res, 400, 'bio is required'\)/.test(PROFILE_POST),
    }));

  ck.t('A3',
    '★只改头像 ⇒ **零翻译入队**：`enqueueTranslation` 只在 `if (hasBio)` 分支内（静态守门，'
    + '行为面由 SB 的 `content_translation` 计数复核）；`fields` 按「给了才进」构造',
    /if \(hasBio\) \{\s*\n\s*await enqueueTranslation\(\{ entityType: 'user'/.test(PROFILE_POST)
      && /if \(hasBio\) fields\.bio = bio;/.test(PROFILE_POST)
      && /if \(hasAvatar\) fields\.avatar_url = avatarUrl as string \| null;/.test(PROFILE_POST),
    JSON.stringify({ enqueue_guarded: /if \(hasBio\) \{\s*\n\s*await enqueueTranslation/.test(PROFILE_POST) }));

  ck.t('A4',
    '★服务层 `updateUserProfile` = has-flag 动态 SET：`avatar_url` 分支在（`!!== undefined` 才进 SET）·'
    + '`null` 走 `= $n::text` 显式绑 NULL（COALESCE 语汇零残留）· 零字段 ⇒ 纯回读不写库',
    DB_TS.includes('if (fields.avatar_url !== undefined) {')
      && DB_TS.includes('assignments.push(`"avatar_url" = $${params.length}::text`)')
      && DB_TS.includes('if (!assignments.length) {')
      && !/COALESCE\(\$\d+, "avatar_url"\)/.test(DB_TS),
    JSON.stringify({ avatar_branch: DB_TS.includes('if (fields.avatar_url !== undefined) {') }));

  ck.t('A5',
    '★回执与 `/api/user` **同源**：两者皆 `buildUserPayload`（⇒ 头像加性透出，前端可直刷会话）·'
    + '`normalizeUser` 透出 `avatar_url`（空/缺 ⇒ null）',
    /payload = await buildUserPayload\(updatedUser, actor\.adminAccess\)/.test(PROFILE_POST)
      && /payload = await buildUserPayload\(actor\.user, actor\.adminAccess\)/.test(USER_GET)
      && DB_TS.includes("avatar_url: toStringValue(getValue(row, 'avatar_url')) || null"),
    JSON.stringify({ profile_same_source: /buildUserPayload\(updatedUser/.test(PROFILE_POST) }));

  ck.t('A6',
    '★前端编辑器钩子（探针定位依赖）：`data-sf-m` 键齐（block/avatar/avatar-img/avatar-initial/'
    + 'avatar-change/avatar-input/avatar-reset/reset-confirm/notice）+ 错误取证三字段 · `.sf-prof-avatar*` CSS 在',
    ['profile-avatar-block', 'profile-avatar-img', 'profile-avatar-initial', 'profile-avatar-change',
      'profile-avatar-input', 'profile-avatar-reset', 'profile-avatar-reset-confirm', 'profile-avatar-notice']
      .every((m) => COMPONENT_JSX.includes(`data-sf-m="${m}"`))
      && COMPONENT_JSX.includes('data-sf-m="profile-avatar"')
      && ['data-sf-err-code', 'data-sf-err-reason', 'data-sf-err-status'].every((m) => COMPONENT_JSX.includes(m))
      && PROFILE_CSS.includes('.sf-prof-avatar'),
    JSON.stringify({
      hooks: ['profile-avatar-block', 'profile-avatar', 'profile-avatar-img', 'profile-avatar-initial',
        'profile-avatar-change', 'profile-avatar-input', 'profile-avatar-reset',
        'profile-avatar-reset-confirm', 'profile-avatar-notice'].map((m) => [m, COMPONENT_JSX.includes(`data-sf-m="${m}"`)]),
    }));

  // ============================================================================
  // 夹具 · 临时用户（自建自删，不动存量）
  // ============================================================================
  const ENV_FILE = path.join(os.homedir(), '.config/seafood/p77-gate.env');
  const readEnv = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {};
    const o: Record<string, string> = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return o;
  };
  const saved = readEnv(ENV_FILE);
  type GateWallet = { address: string; privateKey: string; signMessage: (message: string) => Promise<string> };
  const wallets = {} as Record<Role, GateWallet>;
  let envDirty = false;
  for (const role of roles) {
    const k = String(saved[`P77_KEY_${role}`] || '').trim();
    wallets[role] = (k ? new Wallet(k) : Wallet.createRandom()) as unknown as GateWallet;
    if (!k) { saved[`P77_KEY_${role}`] = wallets[role].privateKey; envDirty = true; }

  }
  if (envDirty) {
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(ENV_FILE, roles.map((r) => `P77_KEY_${r}=${saved[`P77_KEY_${r}`]}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
  }
  const addrOf = (r: Role) => wallets[r].address.toLowerCase();

  // 非夹具用户的 avatar_url 指纹（Z2 前后对拍；本轮零外溢写）
  const fingerprint = async () => {
    const r = await qRetry<{ n: string; fp: string | null }>(pool,
      `SELECT count(*)::text AS n,
              md5(string_agg(u.uid::text || ':' || coalesce(u.avatar_url, '~'), ',' ORDER BY u.uid)) AS fp
         FROM public.users u WHERE u.uid <> ALL($1::bigint[])`, [Object.values(users).filter(Boolean).length ? Object.values(users) : [0]]);
    return r[0] ?? { n: '-1', fp: null };
  };
  const preFingerprint = await fingerprint();

  // ★ 夹具建户走**直插**而不是 `findOrCreateUserByEvm`：后者带注册腿（`+signupBatt` ⇒ `batt_entry`
  //   写一行），而 `batt_entry` 是 **append-only（trigger 禁止 DELETE）** ⇒ 夹具收尾必然留残。
  //   直插只写 `users` 一行，用户已存在时登录路径不会触发注册腿 ⇒ 本轮零 append-only 残留。
  // uid 取「users 与 batt_entry 两侧 max + 1」起步并逐个前推 —— 单纯 `max(users.uid)+1` 会**回收**
  //   已删夹具的号段，撞上历史 append-only 审计行（`batt_entry` 不可删 ⇒ 会被误读成本轮残留）。
  const topRow = await raw1<{ top: string }>(db,
    `SELECT GREATEST(COALESCE((SELECT max(uid) FROM public.users), 0),
                     COALESCE((SELECT max(uid) FROM public.batt_entry), 0))::text AS top`);
  let nextUid = Number(topRow?.top ?? 0) + 1;
  for (const role of roles) {
    const existing = await raw1<{ uid: string }>(db,
      `SELECT uid::text AS uid FROM public.users WHERE evm = $1`, [addrOf(role)]);
    if (existing) {
      users[role] = Number(existing.uid);
      nextUid = Math.max(nextUid, Number(existing.uid) + 1);
      continue;
    }
    const created = await raw1<{ uid: string }>(db,
      `INSERT INTO public.users AS u (uid, evm, bio, is_admin, time_reg, time_login_last)
       VALUES ($1, $2, '', false, now(), now())
       RETURNING u.uid::text AS uid`, [nextUid, addrOf(role)]);
    if (!created) throw new Error(`fixture insert failed for ${role}`);
    users[role] = Number(created.uid);
    nextUid += 1;
  }

  const userRow = async (uid: number) => raw1<{ uid: string; bio: string | null; avatar_url: string | null }>(db,
    `SELECT uid::text AS uid, bio, avatar_url FROM public.users WHERE uid = $1`, [uid]);
  const translationCount = async (uid: number) => Number((await raw1<{ n: string }>(db,
    `SELECT count(*)::text AS n FROM public.content_translation WHERE entity_type = 'user' AND entity_id = $1`,
    [String(uid)]))?.n ?? '-1');

  const api = async (token: string | null, method: string, urlPath: string, body?: unknown): Promise<Http> => {
    const res = await fetch(base + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try { json = await res.json() as Record<string, unknown>; } catch { /* 非 JSON */ }
    return { status: res.status, body: json };
  };
  const login = async (role: Role): Promise<string> => {
    const ch = await api(null, 'POST', '/api/auth/challenge', { evm_address: addrOf(role) });
    const chData = dataOf(ch);
    const signature = await wallets[role].signMessage(String(chData.message ?? ''));
    const vf = await api(null, 'POST', '/api/auth/verify', {
      evm_address: addrOf(role), signature, challenge_token: chData.challenge_token,
    });
    const d = dataOf(vf);
    const token = String(d.token ?? d.access_token ?? '');
    if (!token) throw new Error(`login failed for ${role}: ${JSON.stringify(vf.body).slice(0, 200)}`);
    return token;
  };

  try {
    process.env.VERCEL = '1';
    // 闸不烧翻译 API：清掉 key ⇒ `translateFields` 走「无 key ⇒ 只标 pending 不翻译」闸
    //（pending 登记仍在 ⇒ SA 的「>0 行」判据照真；且 stub 写库结构上被拒 ⇒ 零库污染）。
    process.env.DEEPSEEK_API_KEY = '';
    const mod = await import('../src/index');
    const app = (mod as unknown as { default: { listen: (p: number, cb?: () => void) => unknown } }).default;
    const srv = app.listen(0) as unknown as {
      address: () => { port: number } | null; close: (cb?: () => void) => void; once: (ev: string, cb: () => void) => void;
    };
    server = srv;
    await new Promise<void>((resolve) => { srv.once('listening', resolve); setTimeout(resolve, 8000); });
    base = `http://127.0.0.1:${srv.address()?.port ?? 0}`;
    out.http_base = base;

    for (const role of roles) tokens[role] = await login(role);

    // ------------------------------------------------------------ H1 · 守卫
    const h1 = await api(null, 'POST', '/api/user/profile', { avatar_url: null });
    ck.t('H1', '★真 HTTP（守卫未动）：无 token `POST /api/user/profile` ⇒ 401（requireActor 前置不变）',
      h1.status === 401 && String(errOf(h1).code ?? '') === 'AUTH_UNAUTHORIZED',
      JSON.stringify({ status: h1.status, code: errOf(h1).code }));

    // ------------------------------------------------------------ SD · 都不传（回归）
    const beforeD = await userRow(users.D);
    const d1 = await api(tokens.D, 'POST', '/api/user/profile', {});
    const d2 = await api(tokens.D, 'POST', '/api/user/profile', { bio: '   ' });
    const afterD = await userRow(users.D);
    ck.t('SD', '★真 HTTP（旧面逐字未动）：`{}` 与 `{bio:"   "}` ⇒ **均 400 `bio is required`**（message 逐字）'
      + '· 库内 bio/avatar 零变化',
      d1.status === 400 && String(d1.body.message ?? '') === 'bio is required'
        && d2.status === 400 && String(d2.body.message ?? '') === 'bio is required'
        && JSON.stringify(beforeD) === JSON.stringify(afterD),
      JSON.stringify({ d1: { status: d1.status, message: d1.body.message }, d2: { status: d2.status, message: d2.body.message }, before: beforeD, after: afterD }));

    // ------------------------------------------------------------ SA · 只带 bio（回归）
    const BIO_TEXT = `p77 头像闸夹具简介 ${RUN}`;
    const trBeforeA = await translationCount(users.A);
    const sa = await api(tokens.A, 'POST', '/api/user/profile', { bio: BIO_TEXT });
    const saData = dataOf(sa);
    const rowA = await userRow(users.A);
    const trAfterA = await translationCount(users.A);
    ck.t('SA', '★真 HTTP（回归）：只带 `bio` ⇒ 200 · bio 落库 · 回执**含 `avatar_url` 键**（未设 ⇒ null）'
      + '· 既有译文登记仍在（>0 行）⇒ 本单没动 bio 老路',
      sa.status === 200 && rowA?.bio === BIO_TEXT
        && 'avatar_url' in saData && saData.avatar_url === null
        && trAfterA > trBeforeA,
      JSON.stringify({ status: sa.status, db: rowA, resp_avatar_key: 'avatar_url' in saData, resp_avatar: saData.avatar_url, tr_before: trBeforeA, tr_after: trAfterA }));

    // ------------------------------------------------------------ SB · 只带 avatar_url（合法 · 真上传）
    const meB = await api(tokens.B, 'GET', '/api/user');
    const bioBeforeB = (await userRow(users.B))?.bio ?? null;
    const trBeforeB = await translationCount(users.B);
    const up = await api(tokens.B, 'POST', '/api/media', {
      content_type: 'image/png', data_base64: PNG_1PX.toString('base64'),
    });
    const upData = dataOf(up);
    const mediaId = String(upData.media_id ?? '');
    const avatarUrl = mediaId ? `/api/media/${mediaId}` : '';
    const sb = await api(tokens.B, 'POST', '/api/user/profile', { avatar_url: avatarUrl });
    const sbData = dataOf(sb);
    const rowB = await userRow(users.B);
    const trAfterB = await translationCount(users.B);
    const getB = await api(tokens.B, 'GET', '/api/user');
    const getBData = dataOf(getB);
    ck.t('SB', '★真 HTTP（核心）：`POST /api/media` 取**真 media_id** ⇒ 只带 `avatar_url`（不带 bio）⇒ 200'
      + '· 库内 `users.avatar_url` = 该路径 · **bio 不变**（原 null 仍 null）· **零翻译入队**'
      + '（`content_translation` 行数不变）· `GET /api/user` 回读**同一值**（回执=回读同源）'
      + '· `requires_profile_completion` 仍 true（bio 面没被头像写口带脏）',
      up.status === 200 && Boolean(mediaId) && sb.status === 200
        && rowB?.avatar_url === avatarUrl && rowB?.bio === bioBeforeB
        && trAfterB === trBeforeB
        && String(sbData.avatar_url ?? '') === avatarUrl
        && String(getBData.avatar_url ?? '') === avatarUrl
        && getBData.requires_profile_completion === true,
      JSON.stringify({ media: { status: up.status, media_id: mediaId }, profile: { status: sb.status, avatar_url: sbData.avatar_url }, db: rowB, get_user: getBData.avatar_url, tr_before: trBeforeB, tr_after: trAfterB, bio_before: bioBeforeB }));

    ck.t('SB2', '★真 HTTP（加性键形 · 只带头像）：「bio 缺席」不回退成 400 —— 响应 data 键集仍含既有键'
      + '（`uID`/`bio`/`points`/`admin`/`requires_profile_completion`）+ 新增 `avatar_url`',
      sb.status === 200
        && ['uID', 'bio', 'points', 'admin', 'requires_profile_completion', 'avatar_url'].every((k) => k in sbData),
      JSON.stringify({ keys: Object.keys(sbData).sort() }));

    // ------------------------------------------------------------ SC · 非法形态六类
    const beforeC = await userRow(users.C);
    const cRows: Array<Record<string, unknown>> = [];
    let cAllRejected = true;
    const forms = [...INVALID_FORMS.slice(0, 5), ...NON_STRING_FORMS];
    for (const f of forms) {
      const r = await api(tokens.C, 'POST', '/api/user/profile', { avatar_url: f.value });
      const e = errOf(r);
      const ok = avatarRejectPredicate(r)
        && String((e.details as Record<string, unknown> | undefined)?.field ?? '') === 'avatar_url'
        && String((e.details as Record<string, unknown> | undefined)?.reason ?? '') === 'AVATAR_URL_INVALID'
        && String(e.i18n_key ?? '') === 'ledger.err.AVATAR_URL_INVALID';
      if (!ok) cAllRejected = false;
      cRows.push({ id: f.id, why: f.why, status: r.status, code: e.code, reason: (e.details as Record<string, unknown> | undefined)?.reason, ok });
    }
    const afterC = await userRow(users.C);
    ck.t('SC', '★真 HTTP（形状闸）：六类非法形态（相对路径 / 外部 URL / 非数字 id / 超长 id / 空串 / '
      + '非字符串类型×3）⇒ **均 400 `AVATAR_URL_INVALID`**（details.field=avatar_url · reason 同值 · '
      + 'i18n_key=`ledger.err.AVATAR_URL_INVALID`）· 库内 avatar/bio **一个字节没动**（非法值零脏写）',
      cAllRejected && JSON.stringify(beforeC) === JSON.stringify(afterC),
      JSON.stringify({ rows: cRows, before: beforeC, after: afterC }));

    // ------------------------------------------------------------ SE · null 置空
    const se = await api(tokens.B, 'POST', '/api/user/profile', { avatar_url: null });
    const seData = dataOf(se);
    const rowBNull = await userRow(users.B);
    const getBNull = await api(tokens.B, 'GET', '/api/user');
    const trAfterE = await translationCount(users.B);
    ck.t('SE', '★真 HTTP（清空）：`{avatar_url: null}` ⇒ 200 · 库内 **NULL** · bio 不变 · 回读 null'
      + '· 仍零翻译入队',
      se.status === 200 && rowBNull?.avatar_url === null && rowBNull?.bio === bioBeforeB
        && seData.avatar_url === null && dataOf(getBNull).avatar_url === null
        && trAfterE === trBeforeB,
      JSON.stringify({ status: se.status, db: rowBNull, resp: seData.avatar_url, read_back: dataOf(getBNull).avatar_url, tr: trAfterE }));

    const sa2 = await api(tokens.A, 'POST', '/api/user/profile', { bio: BIO_TEXT });
    ck.t('SE2', '★清空只作用于头像：A 的 bio 全程未被牵连（`bio` 键缺席 ⇒ 不进 SET）；头像写口与 bio 写口互不扰动',
      sa2.status === 200 && (await userRow(users.A))?.bio === BIO_TEXT,
      JSON.stringify({ status: sa2.status, db: await userRow(users.A) }));

    // ------------------------------------------------------------ F2 · 谓词可证伪（先自检）
    const realPred = avatarRejectPredicate({ status: 400, body: { error: { code: 'AVATAR_URL_INVALID' } } });
    const mutantPred = avatarRejectPredicate({ status: 200, body: { success: true, data: { avatar_url: 'media/123' } } });
    ck.t('F2', '★负控②（谓词可证伪自检）：喂真 400 体 ⇒ true；喂「mutant 200 且脏值落库」⇒ **false**'
      + '（判据本身对「形状闸被短路」敏感）',
      realPred === true && mutantPred === false,
      JSON.stringify({ real: realPred, mutant: mutantPred }));

    // ------------------------------------------------------------ F1 · 真 mutant 子进程
    try {
      const NEEDLE = 'const USER_AVATAR_URL_PATTERN = /^\\/api\\/media\\/[0-9]{1,12}$/;';
      const hits = INDEX_TS.split(NEEDLE).length - 1;
      if (hits !== 1) throw new Error(`pattern literal not unique in index.ts (hits=${hits})`);
      const mutantSrc = INDEX_TS.replace(NEEDLE,
        'const USER_AVATAR_URL_PATTERN = /^[\\s\\S]*$/; // p77 NEG: 形态闸短路（负控 mutant）');
      if (mutantSrc.includes(NEEDLE)) throw new Error('mutant still carries the strict pattern');
      fs.writeFileSync(MUTANT_PATH, mutantSrc, { mode: 0o600 });

      child = spawn('npx', ['ts-node', '--transpile-only', '../ops/profile-avatar/p77-neg-driver.ts'], {
        cwd: BACKEND,
        // ts-node 默认 **script mode**（按入口文件目录向上找 tsconfig）⇒ `ops/` 下无 tsconfig 时
        // 会退到最近一份别处的配置并报 TS5109（`moduleResolution` 必须 NodeNext）。显式钉 backend-ts 的 tsconfig。
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.join(BACKEND, 'tsconfig.json'),
          TS_NODE_TRANSPILE_ONLY: '1',
          P77_NEG_PORT: String(NEG_PORT),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const childOut: string[] = [];
      child.stdout?.on('data', (d: Buffer) => childOut.push(d.toString()));
      child.stderr?.on('data', (d: Buffer) => childOut.push(d.toString()));
      const negBase = `http://127.0.0.1:${NEG_PORT}`;
      let ready = false;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline && !ready) {
        await new Promise((r) => setTimeout(r, 1200));
        try {
          const h = await fetch(`${negBase}/api/health`);
          const hj = await h.json().catch(() => ({} as Record<string, unknown>));
          ready = (hj as Record<string, unknown>).ok === true;
        } catch { /* not yet */ }
        if (child.exitCode !== null) break;
      }
      if (!ready) throw new Error(`mutant child not ready: ${childOut.join('').slice(0, 400)}`);

      // F1 臂**真打 mutant**：api/login 吃闭包 base ⇒ 现场切到 5796（finally 必还原）
      const keep = base;
      base = negBase;
      try {
        const tokenF = await login('F');
        const stringForms = INVALID_FORMS.slice(0, 5);
        const negRows: Array<Record<string, unknown>> = [];
        let allEscaped = true;
        for (const f of stringForms) {
          const r = await api(tokenF, 'POST', '/api/user/profile', { avatar_url: f.value });
          const escaped = !avatarRejectPredicate(r);
          if (!escaped) allEscaped = false;
          negRows.push({ id: f.id, value: f.value, status: r.status, code: errOf(r).code, escaped });
        }
        const negTypeRows: Array<Record<string, unknown>> = [];
        let typeStillGuarded = true;
        for (const f of NON_STRING_FORMS) {
          const r = await api(tokenF, 'POST', '/api/user/profile', { avatar_url: f.value });
          const stillGuarded = avatarRejectPredicate(r);
          if (!stillGuarded) typeStillGuarded = false;
          negTypeRows.push({ id: f.id, status: r.status, code: errOf(r).code, still_guarded: stillGuarded });
        }
        // mutant 真把脏值写进库了？（证明短路是「真放行」而不是「换了个错误码」）
        const dirtyRow = await userRow(users.F);
        const dirty = dirtyRow?.avatar_url !== null && dirtyRow?.avatar_url !== undefined
          && !/^\/api\/media\/[0-9]{1,12}$/.test(String(dirtyRow.avatar_url));
        ck.t('F1', '★负控①（**真 mutant**：`USER_AVATAR_URL_PATTERN` 短路成 `/^[\\s\\S]*$/` · 子进程 5796 真 HTTP'
          + '· 六类形态真打 mutant）：字符串五类**全部不再 400 `AVATAR_URL_INVALID`**（C 段谓词必红）'
          + '· 非字符串类型**仍 400**（类型闸未动 ⇒ 短路只切了形态闸）· 脏值真落库',
          allEscaped && typeStillGuarded && dirty,
          JSON.stringify({ string_forms: negRows, type_forms: negTypeRows, dirty_db: dirtyRow }));
      } finally {
        base = keep;
      }
    } catch (e) {
      ck.t('F1', '★负控①（mutant 子进程真 HTTP）', false, `error=${String((e as Error).message ?? e).slice(0, 300)}`);
    } finally {
      if (child) { try { child.kill('SIGTERM'); } catch { /* noop */ } }
      try { if (fs.existsSync(MUTANT_PATH)) fs.unlinkSync(MUTANT_PATH); } catch { /* noop */ }
    }
  } finally {
    if (server) await new Promise<void>((resolve) => {
      try { server?.close(() => resolve()); setTimeout(resolve, 3000); } catch { resolve(); }
    });
  }

  // ============================================================================
  // Z · 残留（夹具自建自删）
  // ============================================================================
  const fixtureUids = Object.values(users).filter((n) => Number.isFinite(n) && n > 0);
  // 注：`batt_entry` **不删**（append-only trigger 禁 DELETE，属设计不变式）——夹具建户走直插 ⇒ 本轮
  //   理应**零** batt_entry 行；此处按「本轮新建行数 = 0」断言，而不是去删审计行。
  const cleanupSql: Array<[string, string]> = [
    ['content_translation', `DELETE FROM public.content_translation WHERE entity_type = 'user' AND entity_id = ANY($1::text[])`],
    ['media', `DELETE FROM public.media WHERE owner_uid = ANY($1::bigint[])`],
    ['user_activity_hour', `DELETE FROM public.user_activity_hour WHERE uid = ANY($1::bigint[])`],
    ['batt_account', `DELETE FROM public.batt_account WHERE uid = ANY($1::bigint[])`],
    ['account', `DELETE FROM public.account WHERE uid = ANY($1::bigint[])`],
    ['users', `DELETE FROM public.users WHERE uid = ANY($1::bigint[])`],
  ];
  const cleanupErrors: Array<{ table: string; error: string }> = [];
  const countLeft = async (): Promise<{ users: number; tr: number; media: number }> => ({
    users: Number((await raw1<{ n: string }>(db,
      `SELECT count(*)::text AS n FROM public.users WHERE uid = ANY($1::bigint[])`, [fixtureUids]))?.n ?? '-1'),
    tr: Number((await raw1<{ n: string }>(db,
      `SELECT count(*)::text AS n FROM public.content_translation WHERE entity_type = 'user' AND entity_id = ANY($1::text[])`,
      [fixtureUids.map(String)]))?.n ?? '-1'),
    media: Number((await raw1<{ n: string }>(db,
      `SELECT count(*)::text AS n FROM public.media WHERE owner_uid = ANY($1::bigint[])`, [fixtureUids]))?.n ?? '-1'),
  });
  // 背景译文任务（fire-and-forget）可能在删除**之后**再 upsert 一行 pending ⇒ 收尾用「删-等-复核」
  // 循环，连续两轮读到 0 才算稳（闸不许把竞态当残留，也不许把残留当竞态）。
  let left = await countLeft();
  for (let round = 0; round < 6; round += 1) {
    for (const [table, sql] of cleanupSql) {
      const params = table === 'content_translation' ? [fixtureUids.map(String)] : [fixtureUids];
      try { await qRetry(pool, sql, params); } catch (e) {
        cleanupErrors.push({ table, error: String((e as Error)?.message ?? e).slice(0, 200) });
      }
    }
    await new Promise((r) => setTimeout(r, 1200));
    const now = await countLeft();
    const settled = now.users === 0 && now.tr === 0 && now.media === 0;
    left = now;
    if (settled && round >= 1) break;
  }
  const battRows = Number((await raw1<{ n: string }>(db,
    `SELECT count(*)::text AS n FROM public.batt_entry WHERE uid = ANY($1::bigint[])`, [fixtureUids]))?.n ?? '-1');
  ck.t('Z1', '★零残留：夹具 users / content_translation / media 全删 · 本轮**零** `batt_entry` 行'
    + '（append-only 审计行不可删 ⇒ 夹具改直插建户，从源头不产生）；收尾用「删-等-复核」两轮稳',
    left.users === 0 && left.tr === 0 && left.media === 0 && battRows === 0 && cleanupErrors.length === 0,
    JSON.stringify({ left, batt_entry_rows: battRows, cleanup_errors: cleanupErrors }));

  const postFingerprint = await qRetry<{ n: string; fp: string | null }>(pool,
    `SELECT count(*)::text AS n,
            md5(string_agg(u.uid::text || ':' || coalesce(u.avatar_url, '~'), ',' ORDER BY u.uid)) AS fp
       FROM public.users u`).then((rs) => rs[0] ?? { n: '-1', fp: null });
  ck.t('Z2', '★非夹具用户 `avatar_url` 前后指纹逐字相等、用户总数回到基线（5 位 md5 指纹 + 计数双闸 ⇒ 本轮零外溢写）',
    postFingerprint.fp === preFingerprint.fp && String(postFingerprint.n) === String(preFingerprint.n),
    JSON.stringify({ before: preFingerprint, after: postFingerprint, fixtures: fixtureUids.length }));

  out.checks = ck.checks;
  out.summary = ck.summary();
  out.fixtures = {
    env_file: ENV_FILE,
    private_keys: '[REDACTED]',
    uids: Object.fromEntries(roles.map((r) => [r, users[r]])),
    addresses: Object.fromEntries(roles.map((r) => [r, addrOf(r)])),
  };
  const file = save('p77-profile-avatar-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary }, null, 1));
  await pool.end();
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('FATAL', e);
  try {
    const m = path.resolve(__dirname, '../src/index.p77neg.ts');
    if (fs.existsSync(m)) fs.unlinkSync(m);
  } catch { /* noop */ }
  process.exit(2);
});
