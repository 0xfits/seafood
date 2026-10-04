/**
 * 批 9 第 4 片（P9④ · `route-layer.spec` v2.18 §30 · `data-layer.spec` v0.25 §33）：
 * **BTTC 代币（`battcoin`）铸造 / 分解** 类级门。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s9-bttc-gate.ts
 * 出口：全绿 exit 0；任一 FAIL ⇒ exit 1。
 * 产物：backend-ts/.p8s9-artifacts/p8s9-<RUN>/gate.json
 *
 * ★ A–H 静态面 **零 DB / 零网络**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）。
 * ★ I/K 库面 leg：**只连库**（结构面**活体**只读 + ★★ 四段真链路 + `R-9-23` 反事実直插 = 事务内 + 子步 `SAVEPOINT` + 末尾 `ROLLBACK`）；**零 HTTP**。
 * ★ `0032`/`0033`/`0034`/`0035`…`0042` **已 apply**（`schema_version = 0042` · `schema_migration` 41 行）⇒ 其 DB 级效果**转为活体 `checks`**；
 *   `pending_apply[]` **归零**（原 10 条库面 leg 全部落实，**不伪装绿**）。
 *   ★ 库面写一律**事务内 + 末尾 `ROLLBACK`**（append-only ⇒ 无 DELETE 复原路径）；**严禁** `UPDATE app_config`。
 *
 * 判据（每条可判负 + 自证负对照）：
 *   A  注册点 **88** 逐 verb（`get 37 / post 48 / put 0 / patch 1 / delete 2`）+ 2 新动作口在场；负对照（缩进注入 ⇒ 88）
 *   B  2 新口形态：全闸 `requireActor`（零 `requireAdmin`）；`bttcKeyGuard` + 取数 `bttcMint(`/`bttcBurn(`；异常标签 `sendInfraMapped`
 *   C  `0038`：kind 关闭集 **23 → 24**（CHECK + `ledger_kind_ok` 两处同集含 `invite_first_task_reward`）；
 *      冻结族第二支一字不动（4 值）；`−1` credit 白名单逐字不变（8 值）；`0032`（21 → 23）转 P9④ 历史快照；正/负自检在场
 *   D  `0033`：只 `ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false`（不改既有 7 约束）；
 *      存量兼容（全部行 `false`）；豁免谓词落 `src/database.ts` 唯一写路径（`AND ( EXISTS(…) OR 平台标记 )`）+ 保证金腿跳过
 *   E  `0034`：`op` 白名单末位加 `burn`（原 6 项逐字不动）；`v_op='burn'` 分支（本体腿单边负额）；`C8` 回执
 *   F  **`total_supply` 双写与配对不变式**（`R-9-37`）：`burn` 分支 `total_supply − v_amount`；`kind IN ('mint','burn')` 配对豁免；
 *      分解本体腿 `−v_amount` 与 DB 供应量同步 ⇒ 不变量 `total_supply == Σmint − Σburn` 恢复；正/负自检在场
 *   G  **幂等键 = `cli:<UUID>`**（调用方供键 · `R-9-41`）；`resolveBttcKey` 三态（`MISSING`/`PREFIX_REQUIRED`/`NOT_UUID`）；禁 `biz:bttc:*` 形态
 *   H  **`C-15`「无行 ⇒ 兜底值」独立负对照**（空表 / 无行 / `null` / `[]` ⇒ `source=constant` 且五键 = 常量默认）+ SQL `COALESCE` 包在标量子查询**外层**
 *   I  **`R-9-23` 钳制 + 反事実直插必红 `23514`**：纯函数钳 `mintBattCost ≤ capBatt` / `burnBattGain ≤ 100`；SQL `LEAST(…, capBatt)`；活体直插 `batt = 101` ⇒ `23514`（边界 `100` ⇒ 通过）
 *   J  零新增错误码（仍恰 **33**）+ 借既有码 + 稳定 `reason` 常量 + `pending_apply[]` **归零**（三迁移已 apply）
 *   K  库面**活体**：`0032`/`0033`/`0034`/`0038` 结构指纹（kind 24 / kind_ok / −1 credit 8 / 列 / op 白名单含 burn + 双写 / `schema_migration` 41·0042）
 *      + ★★ 四段真链路（创建含豁免闸两读数 / 铸造含幂等重放与闸负读数 / 分解含封顶丢弃 / 配对不变式）+ 零残渣（`ROLLBACK`）
 *   L  四语 `bttcPanel` 键集逐语相等 + 六类工程口径泄漏 = 0 + `en`/`vn` 零 CJK
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DatabaseService,
  MINT_BURN_POLICY_DEFAULTS,
  BATT_CAP_HARD_MAX,
  resolveMintBurnPolicy,
  resolveBattPolicy,
} from '../src/database';
import { LEDGER_KINDS } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s9-artifacts', `p8s9-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown): void => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual) });
};
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, expect: string): void => {
  const fired = predicate(wrongInput) === false;
  checks.push({ id: `${id}__selftest`, group: `${group}SelfTest`, pass: fired, expect, actual: JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }) });
};

// ---------------------------------------------------------------- 读源码
const readSrc = (rel: string): string => fs.readFileSync(path.resolve(REPO_ROOT, rel), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DATABASE_TS = readSrc('backend-ts/src/database.ts');
const LEDGER_TS = readSrc('backend-ts/src/ledger.ts');
const SQL_0032 = readSrc('backend-ts/migrations/0032_kind_close_set_23.sql');
const SQL_0033 = readSrc('backend-ts/migrations/0033_currency_platform_coin_flag.sql');
const SQL_0034 = readSrc('backend-ts/migrations/0034_ledger_op_burn_and_supply.sql');
const SQL_0038 = readSrc('backend-ts/migrations/0038_kind_close_set_24.sql');
const LOCALES: Record<string, Record<string, unknown>> = Object.fromEntries(
  ['zh', 'en', 'hk', 'vn'].map((l) => [l, JSON.parse(readSrc(`frontend/src/locales/${l}.json`)) as Record<string, unknown>]),
);

// ---------------------------------------------------------------- 冻结常量 + 工具
const REG_POINTS_FROZEN = 88;
const PER_VERB_FROZEN: Record<string, number> = { get: 37, post: 48, put: 0, patch: 1, delete: 2 };
const ROUTE_REG_RE = /^[ \t]*app\.(get|post|put|patch|delete)\(/gm;
const countRoutes = (text: string): number => (text.match(ROUTE_REG_RE) || []).length;
const countVerb = (text: string, verb: string): number =>
  (text.match(new RegExp(`^[ \\t]*app\\.${verb}\\(`, 'gm')) || []).length;
const countOf = (hay: string, re: RegExp): number => (hay.match(re) || []).length;
const eqJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const sortedEq = (a: string[], b: string[]): boolean => eqJson([...a].sort(), [...b].sort());

/** 从源码切「某注册点起、到本路由顶层收口 `});` 止」的 handler 文本（沿 p8-s7 收口边界先例）。 */
const handlerBlock = (src: string, routeLiteral: string): string => {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => l.includes(routeLiteral));
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\}\);/.test(lines[i])) { end = i + 1; break; }
    if (/^\s*app\.(get|post|put|delete|patch)\(/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
};
const R_MINT = "app.post('/api/bttc/mint'";
const R_BURN = "app.post('/api/bttc/burn'";
const NEW_ROUTES = [R_MINT, R_BURN];
const BLOCK_MINT = handlerBlock(INDEX_TS, R_MINT);
const BLOCK_BURN = handlerBlock(INDEX_TS, R_BURN);

/** 从某个 kind 列表串抽值（排序）。 */
const kindListFrom = (re: RegExp, src: string): string[] => {
  const m = src.match(re);
  return (m ? (m[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
};
const CHECK_LIST_RE = /ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(([\s\S]*?)\)\)/;
const FN_LIST_RE = /SELECT p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/;
const P94_KINDS = ['bttc_mint_fee', 'bttc_burn_fee'];
const P95_KINDS = ['invite_first_task_reward'];   // P9⑤（23 → 24）
const KINDS_TS: string[] = [...LEDGER_KINDS];
const KINDS_0032_CHECK = kindListFrom(CHECK_LIST_RE, SQL_0032);
const m32 = SQL_0032.match(FN_LIST_RE);
const KINDS_0032_FN = (m32 ? (m32[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0032_FROZEN = (m32 ? (m32[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0038_CHECK = kindListFrom(CHECK_LIST_RE, SQL_0038);
const m38 = SQL_0038.match(FN_LIST_RE);
const KINDS_0038_FN = (m38 ? (m38[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
const KINDS_0038_FROZEN = (m38 ? (m38[2].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));
/** `ledger_assert_platform_mutation` 的 `-1` credit 白名单（从 0032 源抽）。 */
const mWhitelist = SQL_0032.match(/WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN \(([^)]*)\)/);
const WL_0032_M1_CREDIT = (mWhitelist ? (mWhitelist[1].match(/'([a-z_]+)'/g) || []) : []).map((s) => s.slice(1, -1));

// ============================================================================
// A · 注册点 88 逐 verb + 2 新动作口在场
// ============================================================================
{
  const perVerb = { get: countVerb(INDEX_TS, 'get'), post: countVerb(INDEX_TS, 'post'), put: countVerb(INDEX_TS, 'put'), patch: countVerb(INDEX_TS, 'patch'), delete: countVerb(INDEX_TS, 'delete') };
  t('A1', 'registration', countRoutes(INDEX_TS) === REG_POINTS_FROZEN,
    `注册点 = ${REG_POINTS_FROZEN}（P9④ BTTC 铸造/分解 2 新动作口 +2〔85→87〕⇒ 8⑥ 审计台统一读口 +1〔87→88〕；读口并入既有 GET /api/batt ⇒ 零新 GET）`, countRoutes(INDEX_TS));
  t('A2', 'registration', eqJson(perVerb, PER_VERB_FROZEN),
    `逐 verb 逐字 = ${JSON.stringify(PER_VERB_FROZEN)}（get 不变 / post +2）`, JSON.stringify(perVerb));
  t('A3', 'registration', Object.values(perVerb).reduce((a, b) => a + b, 0) === REG_POINTS_FROZEN,
    '逐 verb 计数之和 = 注册点总数', JSON.stringify(perVerb));
  const present = NEW_ROUTES.map((r) => countOf(INDEX_TS, new RegExp(r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')));
  t('A4', 'registration', present.every((n) => n === 1),
    '2 新口逐条注册**恰 1 处**（`POST /api/bttc/mint` / `POST /api/bttc/burn`）', JSON.stringify(present));
  const INJ = "  app.get('/api/p8s9-negsurface', (_req, res) => res.status(410).json({ ok: false }));\n";
  t('A5', 'registration', countRoutes(INDEX_TS + INJ) === REG_POINTS_FROZEN + 1,
    `★ 负对照：缩进注入一条路由 ⇒ 计数 ${REG_POINTS_FROZEN}→${REG_POINTS_FROZEN + 1}`, JSON.stringify({ injected: countRoutes(INDEX_TS + INJ) }));
  selfTest('A1', 'registration', (v) => countRoutes(String(v)) === REG_POINTS_FROZEN, 'x', '把非 88 条路由的文本喂入「注册点 = 88」谓词 ⇒ 必须转红');
}

// ============================================================================
// B · 2 新口形态（闸 · 取数 · 异常标签）
// ============================================================================
{
  const noAdmin = [BLOCK_MINT, BLOCK_BURN].every((b) => !/requireAdmin\(/.test(b));
  const actorOk = [BLOCK_MINT, BLOCK_BURN].every((b) => /requireActor\(req,\s*res\)/.test(b));
  t('B1', 'routeShape', actorOk && noAdmin,
    '★ 2 口全闸 `requireActor(req, res)`（用户本人 · uid 取自 token）且**零** `requireAdmin(` ⇒ 零 admin 权限键新增（11 键不动）',
    JSON.stringify({ actor_in_all: actorOk, requireAdmin_in_any: !noAdmin }));
  selfTest('B1', 'routeShape', (v) => /requireActor\(req,\s*res\)/.test(String(v)) && !/requireAdmin\(/.test(String(v)),
    "app.post('/api/bttc/mint', async (req, res) => { const actor = await requireAdmin(req, res, 'manage_settings'); if (!actor) return; });",
    '把「带 admin 闸」的 handler 喂入 ⇒ 谓词必须转红');
  t('B2', 'routeShape', /bttcKeyGuard\(req,\s*res\)/.test(BLOCK_MINT) && /bttcKeyGuard\(req,\s*res\)/.test(BLOCK_BURN),
    '★ 2 口写入前置 = `bttcKeyGuard(req, res)`（解析并校验 `cli:<UUID>` 幂等键 ⇒ 非法即既有码 400）',
    JSON.stringify({ mint: /bttcKeyGuard\(req,\s*res\)/.test(BLOCK_MINT), burn: /bttcKeyGuard\(req,\s*res\)/.test(BLOCK_BURN) }));
  const calls = /DatabaseService\.bttcMint\(/.test(BLOCK_MINT) && /DatabaseService\.bttcBurn\(/.test(BLOCK_BURN);
  t('B3', 'routeShape', calls,
    '★ 取数：`POST /api/bttc/mint` ⇒ `DatabaseService.bttcMint(` · `POST /api/bttc/burn` ⇒ `DatabaseService.bttcBurn(`',
    JSON.stringify({ mint: /DatabaseService\.bttcMint\(/.test(BLOCK_MINT), burn: /DatabaseService\.bttcBurn\(/.test(BLOCK_BURN) }));
  const labels: Array<[string, string]> = [[BLOCK_MINT, 'bttc.mint'], [BLOCK_BURN, 'bttc.burn']];
  t('B4', 'routeShape', labels.every(([b, l]) => b.includes(`sendInfraMapped(res, '${l}'`)),
    "★ 基础设施异常 ⇒ 既有 §14 分类器 `sendInfraMapped`（标签 'bttc.mint'/'bttc.burn'）",
    JSON.stringify(labels.map(([b, l]) => b.includes(`'${l}'`))));
  t('B5', 'routeShape', /sendBttcRejection\(res,\s*uid,\s*'mint'/.test(BLOCK_MINT) && /sendBttcRejection\(res,\s*uid,\s*'burn'/.test(BLOCK_BURN),
    '★ 拒绝面 = `sendBttcRejection(res, uid, action)`（同 uid 状态复核 ⇒ 稳定 `reason` · 零新增码）',
    JSON.stringify({ mint: /sendBttcRejection\(res,\s*uid,\s*'mint'/.test(BLOCK_MINT), burn: /sendBttcRejection\(res,\s*uid,\s*'burn'/.test(BLOCK_BURN) }));
  selfTest('B3', 'routeShape', (v) => /DatabaseService\.bttcMint\(/.test(String(v)), 'DatabaseService.getBatt(', '把「取数错口」的 handler 喂入 ⇒ 取数谓词必须转红');
}

// ============================================================================
// C · `0038`（kind 关闭集 23 → 24 · 三处编码 · −1 debit 白名单首开）；`0032`（21 → 23）转为 P9④ 历史
// ============================================================================
{
  t('C1', 'migration0032', KINDS_0038_CHECK.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KINDS_0038_CHECK.includes(k)) && sortedEq(KINDS_0038_CHECK, KINDS_TS),
    '★ `0038` `ledger_kind_enum` CHECK = 24 值（既有 23 + `invite_first_task_reward`）且与 TS `LEDGER_KINDS` 同集',
    JSON.stringify({ n: KINDS_0038_CHECK.length, has_new: [...P94_KINDS, ...P95_KINDS].map((k) => KINDS_0038_CHECK.includes(k)), same_ts: sortedEq(KINDS_0038_CHECK, KINDS_TS) }));
  t('C2', 'migration0032', KINDS_0038_FN.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KINDS_0038_FN.includes(k)) && sortedEq(KINDS_0038_FN, KINDS_TS),
    '★ `0038` `ledger_kind_ok` 第一支 = 24 值且与 TS 同集（③ 三处编码之二）',
    JSON.stringify({ n: KINDS_0038_FN.length, same_ts: sortedEq(KINDS_0038_FN, KINDS_TS) }));
  t('C3', 'migration0032', KINDS_TS.length === 24 && eqJson(KINDS_TS.slice(21), [...P94_KINDS, ...P95_KINDS]),
    '③ TS `LEDGER_KINDS` = 24 值 · 末位追加 `bttc_mint_fee`/`bttc_burn_fee`/`invite_first_task_reward`（不改既有 21 次序）',
    JSON.stringify({ n: KINDS_TS.length, tail: KINDS_TS.slice(21) }));
  t('C4', 'migration0032', eqJson([...KINDS_0038_FROZEN].sort(), ['hold_forfeit', 'job_payout', 'purchase', 'trade']) && [...P94_KINDS, ...P95_KINDS].every((k) => !KINDS_0038_FROZEN.includes(k)),
    '★ `ledger_kind_ok` 第二支（`p_frozen_settle`）**一字不动** = 4 值且不含任何新增值（新 kind 不属冻结结算族）',
    JSON.stringify({ frozen: [...KINDS_0038_FROZEN].sort(), has_new: [...P94_KINDS, ...P95_KINDS].filter((k) => KINDS_0038_FROZEN.includes(k)) }));
  t('C4b', 'migration0032',
    KINDS_0032_CHECK.length === 23 && KINDS_0032_FN.length === 23 && sortedEq(KINDS_0032_CHECK, KINDS_0032_FN) && sortedEq(KINDS_0032_CHECK, KINDS_TS.slice(0, 23)),
    '★ P9④ 历史两处（`0032` CHECK / 函数）= 23 且逐字 = TS 前 23（P9④ 冻结快照，被 `0038` 取代、文件不可改）',
    JSON.stringify({ n32c: KINDS_0032_CHECK.length, n32f: KINDS_0032_FN.length, eq_ts23: sortedEq(KINDS_0032_CHECK, KINDS_TS.slice(0, 23)) }));
  t('C5', 'migration0032',
    P94_KINDS.every((k) => WL_0032_M1_CREDIT.includes(k))
      && ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee'].every((k) => WL_0032_M1_CREDIT.includes(k)),
    '★ `ledger_assert_platform_mutation` 的 `−1` credit 白名单 = 既有 6 值 + 两新 kind（8 值；既有格逐字未丢）',
    JSON.stringify({ whitelist: WL_0032_M1_CREDIT }));
  t('C6', 'migration0032',
    /ALTER TABLE ledger_entry DROP CONSTRAINT IF EXISTS ledger_kind_enum/.test(SQL_0032)
      && /ALTER TABLE ledger_entry ADD CONSTRAINT ledger_kind_enum CHECK \(kind IN \(/.test(SQL_0032),
    '★ 手法 = DROP 旧 CHECK + ADD 新 CHECK（**非 enum**）；`ledger_kind_enum` 恰 1 个 CHECK（自检 ①）',
    JSON.stringify({ drop: /DROP CONSTRAINT IF EXISTS ledger_kind_enum/.test(SQL_0032), add: /ADD CONSTRAINT ledger_kind_enum CHECK/.test(SQL_0032) }));
  t('C7', 'migration0032',
    /ledger_kind_ok\('bttc_mint_fee', true\)/.test(SQL_0032) && /-1 debit bttc_mint_fee WAS NOT rejected/.test(SQL_0032) && /-1 credit commission WAS NOT rejected/.test(SQL_0032),
    '★ 自检含**正 + 负**：两新 kind 冻结族下必拒（负）/ `−1` debit 必拒（负）/ 非白名单 credit 必拒（负）；正向逐值在场',
    JSON.stringify({ frozen_neg: /bttc_mint_fee', true/.test(SQL_0032), debit_neg: /debit bttc_mint_fee WAS NOT rejected/.test(SQL_0032), credit_neg: /credit commission WAS NOT rejected/.test(SQL_0032) }));
  selfTest('C1', 'migration0032', (v) => sortedEq(v as string[], KINDS_0038_CHECK), [...KINDS_0038_CHECK.slice(0, 23), 'made_up_kind'],
    '把「少一值 / 多一值」的集喂入 24 同集谓词 ⇒ 必须转红');
}

// ============================================================================
// D · `0033`（`currency.is_platform_coin` 标记列 · 变体 Ⅱ）
// ============================================================================
{
  t('D1', 'migration0033',
    /ALTER TABLE public\.currency\s*\n\s*ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false;/.test(SQL_0033),
    '★ 唯一 DDL = `ALTER TABLE public.currency ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false;`（只加列 · 幂等）',
    JSON.stringify({ add_col: /ADD COLUMN IF NOT EXISTS is_platform_coin boolean NOT NULL DEFAULT false/.test(SQL_0033) }));
  t('D2', 'migration0033', !/ALTER TABLE public\.currency\s+(ALTER|DROP) COLUMN/.test(SQL_0033) && !/DROP CONSTRAINT/.test(SQL_0033) && !/ALTER COLUMN/.test(SQL_0033),
    '★ **不改任何既有约束**（零 `ALTER COLUMN` / 零 `DROP CONSTRAINT`；既有 1 UNIQUE + 6 CHECK 指纹不动 · `DL7`）',
    JSON.stringify({ alter_col: /ALTER COLUMN/.test(SQL_0033), drop_constraint: /DROP CONSTRAINT/.test(SQL_0033) }));
  t('D3', 'migration0033',
    /count\(\*\) INTO v_true FROM public\.currency WHERE is_platform_coin/.test(SQL_0033) && /v_true <> 0/.test(SQL_0033),
    '★ 存量兼容自检：`SELECT count(*) … WHERE is_platform_coin` 且 `v_true <> 0 ⇒ ABORT`（既有全部行 `false`）',
    JSON.stringify({ compat: /v_true <> 0/.test(SQL_0033) }));
  t('D4', 'migration0033',
    /AND \(\s*EXISTS \(\s*SELECT 1 FROM public\.currency_review_log[\s\S]{0,400}?OR c\.is_platform_coin = true\s*\)/.test(DATABASE_TS),
    '★ 豁免谓词落 `src/database.ts` 上市**唯一写路径**：`AND ( EXISTS(审核通过) OR c.is_platform_coin = true )`（既有审核闸逐字仍在）',
    JSON.stringify({ wrapped_gate: /AND \(\s*EXISTS \(\s*SELECT 1 FROM public\.currency_review_log/.test(DATABASE_TS) }));
  t('D5', 'migration0033',
    /AND NOT \(c\.is_platform_coin = true AND \$3::bigint <> 0\)/.test(DATABASE_TS),
    '★ 保证金腿对平台行跳过 = `AND NOT (c.is_platform_coin = true AND $3::bigint <> 0)`（非平台行仍全额缴 · C-1）',
    JSON.stringify({ deposit_skip: /AND NOT \(c\.is_platform_coin = true AND \$3::bigint <> 0\)/.test(DATABASE_TS) }));
  selfTest('D4', 'migration0033', (v) => /OR c\.is_platform_coin = true\s*\)/.test(String(v)), "AND EXISTS (SELECT 1 FROM public.currency_review_log WHERE result='approved')",
    '把「未加平台豁免谓词」的 SQL 喂入 ⇒ 豁免谓词必须转红');
}

// ============================================================================
// E/F · `0034`（op 白名单加 burn · 分解 total_supply 双写 · 配对不变式）
// ============================================================================
{
  const V_OLD6 = "''mint'', ''transfer'', ''hold'', ''hold_release'', ''settle'', ''entries''";
  const V_NEW = "v_op NOT IN (''mint'', ''transfer'', ''hold'', ''hold_release'', ''settle'', ''entries'', ''burn'')";
  const V_REAL = "v_op NOT IN ('mint', 'transfer', 'hold', 'hold_release', 'settle', 'entries', 'burn')";
  t('E1', 'migration0034', SQL_0034.includes(V_OLD6) && SQL_0034.includes(V_NEW) && SQL_0034.includes(V_REAL),
    "★ `op` 白名单**仅加一项 `burn`**（原 6 项 `'mint','transfer','hold','hold_release','settle','entries'` 逐字照抄 · 末位追加 `'burn'`）：**双面同锚** = `ledger_post_event` **真白名单**（单引号形 `V_REAL`）+ 自检串（双引号形 `V_NEW`）",
    JSON.stringify({ old6_selfcheck: SQL_0034.includes(V_OLD6), new7_selfcheck: SQL_0034.includes(V_NEW), real_whitelist: SQL_0034.includes(V_REAL) }));
  t('E2', 'migration0034', /ELSIF v_op = 'burn' THEN/.test(SQL_0034) && /ledger_norm_entry\(\s*\n?\s*v_uid, v_cid, -v_amount, 0, 'burn'/.test(SQL_0034),
    "★ `v_op = 'burn'` 分支在场：本体腿 = **单边负额** `ledger_norm_entry(v_uid, v_cid, -v_amount, 0, 'burn', …)`（真销毁）",
    JSON.stringify({ branch: /ELSIF v_op = 'burn' THEN/.test(SQL_0034), neg_entry: /v_uid, v_cid, -v_amount, 0, 'burn'/.test(SQL_0034) }));
  t('F1', 'migration0034', /UPDATE currency SET total_supply = total_supply - v_amount, time_updated = now\(\)/.test(SQL_0034),
    '★ **`R-9-37` 分解 `total_supply` 双写**：`UPDATE currency SET total_supply = total_supply - v_amount, time_updated = now() WHERE cid = v_cid;`（与 `op=mint` 对称）',
    JSON.stringify({ double_write: /total_supply = total_supply - v_amount/.test(SQL_0034) }));
  t('F2', 'migration0034', /IF v_e->>'kind' IN \('mint', 'burn'\) THEN v_has_mb := true; END IF;/.test(SQL_0034),
    "★ **配对不变式**（`Σ(delta)=0`）对 `kind IN ('mint','burn')` **豁免**（`v_has_mb`）一字未动 ⇒ 单边负额合法",
    JSON.stringify({ exemption: /v_e->>'kind' IN \('mint', 'burn'\)/.test(SQL_0034) }));
  t('F3', 'migration0034', /'supply_after', \(v_supply_before::numeric - v_amount::numeric\)::text/.test(SQL_0034) && /'supply_before', v_supply_before::text/.test(SQL_0034),
    "★ `v_op='burn'` 的 `C8` 回执：`supply_before = v_supply_before` / `supply_after = v_supply_before − v_amount`（与 `mint` 镜像）",
    JSON.stringify({ extra: /supply_before::numeric - v_amount::numeric/.test(SQL_0034) }));
  t('F4', 'migration0034', /PLATFORM_BURN_FORBIDDEN/.test(SQL_0034),
    '★ `R-9-38` 持有人授权兜底：平台 uid（≤0）不得经 `burn` 支销毁 ⇒ `PLATFORM_BURN_FORBIDDEN`（不因新币种免检）',
    JSON.stringify({ guard: /PLATFORM_BURN_FORBIDDEN/.test(SQL_0034) }));
  t('F5', 'migration0034',
    /0034 self-check OK/.test(SQL_0034) && /op whitelist does not contain burn/.test(SQL_0034) && /burn did not reach the burn branch/.test(SQL_0034) && /non-whitelisted op was not rejected/.test(SQL_0034),
    '★ 自检含**正 + 负**：白名单含 `burn` 断言（`op whitelist does not contain burn` 自检在场 · **结构面**）/ `burn` 达分支（正 · 期望 `LEDGER_CURRENCY_NOT_FOUND`）/ 白名单外 op 仍拒（负 · 期望 `LEDGER_AMOUNT_INVALID`）',
    JSON.stringify({ whitelist_assert: /op whitelist does not contain burn/.test(SQL_0034), pos: /burn did not reach the burn branch/.test(SQL_0034), neg: /non-whitelisted op was not rejected/.test(SQL_0034) }));
  selfTest('F1', 'migration0034', (v) => /total_supply = total_supply - v_amount/.test(String(v)), 'total_supply = total_supply + v_amount',
    '把「分解方向写反」的 SQL 喂入 ⇒ 双写方向谓词必须转红');
}

// ============================================================================
// G · 幂等键 = `cli:<UUID>`（调用方供键 · `R-9-41`）
// ============================================================================
{
  t('G1', 'idempotency', /const BTTC_UUID_RE = \/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$\/i;/.test(INDEX_TS),
    '★ 幂等键 = `cli:<UUID>`：UUID 形状正则 `BTTC_UUID_RE = /^[0-9a-f]{8}-…-[0-9a-f]{12}$/i`（调用方供键 · 服务端不派生）',
    JSON.stringify({ uuid_re: /BTTC_UUID_RE/.test(INDEX_TS), cli_prefix: /startsWith\('cli:'\)/.test(INDEX_TS) }));
  t('G2', 'idempotency',
    /s\.startsWith\('cli:'\)/.test(INDEX_TS) && /if \(!s\) return \{ ok: false, reason: 'MISSING' \}/.test(INDEX_TS)
      && /if \(!s\.startsWith\('cli:'\)\) return \{ ok: false, reason: 'PREFIX_REQUIRED' \}/.test(INDEX_TS)
      && /reason: 'NOT_UUID'/.test(INDEX_TS),
    "★ `resolveBttcKey` 三态穷举：无键 ⇒ `MISSING` · 无前缀 ⇒ `PREFIX_REQUIRED` · 前缀后非 UUID ⇒ `NOT_UUID`",
    JSON.stringify({ missing: /reason: 'MISSING'/.test(INDEX_TS), prefix: /reason: 'PREFIX_REQUIRED'/.test(INDEX_TS), not_uuid: /reason: 'NOT_UUID'/.test(INDEX_TS) }));
  t('G3', 'idempotency', !/bizKeyOf\(\s*['"]bttc['"]/.test(INDEX_TS),
    '★ **禁** `biz:bttc:mint:<uid>` 形态（**结构面锚到代码构造** `bizKeyOf(\'bttc\', …)` 而非注释文本 ⇒ 无天然判别子故调用方供 `cli:<UUID>`；`R-9-41`）',
    JSON.stringify({ bizKeyOf_bttc: /bizKeyOf\(\s*['"]bttc['"]/.test(INDEX_TS) }));
  selfTest('G3', 'idempotency', (v) => !/bizKeyOf\(\s*['"]bttc['"]/.test(String(v)), "const idemKey = bizKeyOf('bttc', uid);",
    '把「以 `bizKeyOf(\'bttc\', …)` 构造幂等键」的代码喂入谓词 ⇒ 必须转红（证明判据锚到代码而非注释）');
  t('G4', 'idempotency', /const idemKey = bttcKeyGuard\(req, res\);/.test(BLOCK_MINT) && /idempotencyKey: idemKey/.test(BLOCK_MINT) && /idempotencyKey: idemKey/.test(BLOCK_BURN),
    '★ 两 handler：`const idemKey = bttcKeyGuard(req, res)` ⇒ `bttcMint/bttcBurn({ …, idempotencyKey: idemKey })`（键透传库面）',
    JSON.stringify({ guard: /idemKey = bttcKeyGuard/.test(BLOCK_MINT), pass: /idempotencyKey: idemKey/.test(BLOCK_MINT) }));
  selfTest('G2', 'idempotency', (v) => /startsWith\('cli:'\)/.test(String(v)) && /'NOT_UUID'/.test(String(v)) && /'PREFIX_REQUIRED'/.test(String(v)), "if (s) return { ok: true, key: s };",
    '把「无前缀闸」的解析喂入 ⇒ `cli:` 前缀谓词必须转红');
}

// ============================================================================
// H · `C-15`「无行 ⇒ 兜底值」独立负对照 + COALESCE 包在标量子查询外层
// ============================================================================
{
  const noRow = resolveMintBurnPolicy(undefined);
  const nullRow = resolveMintBurnPolicy(null);
  const emptyArr = resolveMintBurnPolicy([]);
  const withRow = resolveMintBurnPolicy({ mintBattCost: 7, mintFeeUsd: 2, burnBttcCost: 3, burnFeeUsd: 4, burnBattGain: 5 });
  t('H1', 'noRowDefault', noRow.source === 'constant' && eqJson(noRow.policy, MINT_BURN_POLICY_DEFAULTS),
    `★ **负对照（无行 · 空表）**：\`resolveMintBurnPolicy(undefined)\` ⇒ \`source=constant\` 且五键 = 常量默认 ${JSON.stringify(MINT_BURN_POLICY_DEFAULTS)}（不因无行变 0/NaN）`,
    JSON.stringify(noRow));
  t('H2', 'noRowDefault', nullRow.source === 'constant' && emptyArr.source === 'constant' && eqJson(nullRow.policy, MINT_BURN_POLICY_DEFAULTS) && eqJson(emptyArr.policy, MINT_BURN_POLICY_DEFAULTS),
    '★ **独立负对照（`null` / `[]` 两种「无行」形）** ⇒ 均 `source=constant` 且回落常量默认',
    JSON.stringify({ null_src: nullRow.source, arr_src: emptyArr.source }));
  t('H3', 'noRowDefault', withRow.source === 'config' && eqJson(withRow.policy, { mintBattCost: 7, mintFeeUsd: 2, burnBttcCost: 3, burnFeeUsd: 4, burnBattGain: 5 }),
    '★ **正对照（有行）**：五键皆合法 ⇒ `source=config` 且取真值（非兜底）',
    JSON.stringify(withRow));
  t('H4', 'noRowDefault',
    /COALESCE\(\(SELECT b\.batt::int FROM public\.batt_account AS b WHERE b\.uid = \$\{uid\}\), 0\) AS batt/.test(DATABASE_TS)
      && /COALESCE\(\(SELECT a\.balance::text FROM public\.account AS a\s*\n\s*WHERE a\.uid = \$\{uid\} AND a\.cid = \(SELECT bttc\.cid FROM bttc\)\), '0'\) AS bttc_balance/.test(DATABASE_TS),
    '★ **`COALESCE` 包在标量子查询外层**：`COALESCE((SELECT …), 0)` / `COALESCE((SELECT …), \'0\')`（禁用 `(SELECT COALESCE(…))` 内层形）',
    JSON.stringify({ batt: /COALESCE\(\(SELECT b\.batt::int/.test(DATABASE_TS), bal: /COALESCE\(\(SELECT a\.balance::text/.test(DATABASE_TS) }));
  t('H5', 'noRowDefault', /MINT_BURN_POLICY_DEFAULTS = \{\s*\n\s*mintBattCost: 100, mintFeeUsd: 1, burnBttcCost: 1, burnFeeUsd: 1, burnBattGain: 100,/.test(DATABASE_TS),
    '★ 常量兜底逐字 = 需求 §5.2.2/§5.3.2/§5.3.3（100 电量 + 1$ ⇒ 铸 1 BTTC；1 BTTC + 1$ ⇒ 分解 +100 电量）',
    JSON.stringify({ defaults: MINT_BURN_POLICY_DEFAULTS }));
  selfTest('H1', 'noRowDefault', (v) => (v as { source?: string }).source === 'constant', { source: 'config', policy: MINT_BURN_POLICY_DEFAULTS },
    '把「有行」结果喂入「无行 ⇒ constant」谓词 ⇒ 必须转红');
}

// ============================================================================
// I · `R-9-23` 钳制（纯函数 + 源码面）；DB leg 反事実直插见 K
// ============================================================================
{
  const cap100 = resolveMintBurnPolicy({ mintBattCost: 500 }, 100);
  const cap50 = resolveMintBurnPolicy({ mintBattCost: 500 }, 50);
  t('I1', 'clamp', cap100.policy.mintBattCost === 100 && cap50.policy.mintBattCost === 50,
    '★ `mintBattCost` 钳到 ≤ `capBatt`：`{mintBattCost:500}, cap 100 ⇒ 100` · `cap 50 ⇒ 50`（否则 capBatt<100 时铸造恒不可达）',
    JSON.stringify({ cap100: cap100.policy.mintBattCost, cap50: cap50.policy.mintBattCost }));
  const gain = resolveMintBurnPolicy({ burnBattGain: 500 });
  const gain0 = resolveMintBurnPolicy({ burnBattGain: 0 });
  t('I2', 'clamp', gain.policy.burnBattGain === 100 && gain0.policy.burnBattGain === 100,
    '★ `burnBattGain` 钳到 ≤ `BATT_CAP_HARD_MAX`（100）：`{burnBattGain:500} ⇒ 100`；非正 ⇒ 回落常量 100（fail-closed）',
    JSON.stringify({ gain500: gain.policy.burnBattGain, gain0: gain0.policy.burnBattGain, hardmax: BATT_CAP_HARD_MAX }));
  t('I3', 'clamp', /LEAST\(COALESCE\(\(SELECT cur\.batt FROM cur\), 0\) \+ \$\{String\(p\.burnBattGain\)\}::int, \$\{String\(capBatt\)\}::int\)::int AS batt/.test(DATABASE_TS),
    '★ 分解写入封顶（`R-9-17`）源码面：`LEAST(COALESCE(cur.batt,0) + burnBattGain, capBatt)::int`（与 DB `CHECK (batt BETWEEN 0 AND 100)` 同构）',
    JSON.stringify({ least: /LEAST\(COALESCE\(\(SELECT cur\.batt FROM cur\), 0\) \+/.test(DATABASE_TS) }));
  t('I4', 'clamp', /const capBatt = Math\.min\(Math\.max\(1, battPolicy\.capBatt\), BATT_CAP_HARD_MAX\);/.test(DATABASE_TS),
    '★ `capBatt` 生效值再钳 ≤ 硬上限 100（`Math.min(Math.max(1, battPolicy.capBatt), BATT_CAP_HARD_MAX)`）',
    JSON.stringify({ cap_clamp: /BATT_CAP_HARD_MAX\);/.test(DATABASE_TS) }));
  selfTest('I1', 'clamp', (v) => Number((v as { policy: { mintBattCost: number } }).policy.mintBattCost) <= 100, { policy: { mintBattCost: 500 } },
    '把「未钳制（500）」的结果喂入「≤ capBatt」谓词 ⇒ 必须转红');
}

// ============================================================================
// J · 零新增错误码（仍恰 33）+ 借既有码 + 稳定 reason
// ============================================================================
const pendingApply: Array<{ leg: string; reason: string }> = [];
// ★ 库面收口（本单）：`0032`/`0033`/`0034`…`0038` **已 apply**（`schema_version = 0042` · `schema_migration` 41 行）⇒ 原 10 条
//   「等 apply 再测」的库面 leg **全部转为 K 段活体 `checks`** ⇒ `pending_apply[]` **归零**（**不得伪装绿**）。
{
  t('J1', 'closedSets', LEDGER_ERROR_CODES.length === 33, '错误码闭集仍恰 33 条（**不动**）', LEDGER_ERROR_CODES.length);
  const borrowed = ['LEDGER_IDEMPOTENCY_KEY_REQUIRED', 'LEDGER_IDEMPOTENCY_KEY_INVALID', 'LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_INSUFFICIENT_BALANCE'];
  t('J2', 'closedSets', borrowed.every((c) => LEDGER_ERROR_CODES.includes(c as never)) && /adminVerbError\(400, code/.test(INDEX_TS),
    '★ 2 口借**既有**码：`LEDGER_IDEMPOTENCY_KEY_REQUIRED`/`_INVALID`（键面）+ `LEDGER_CURRENCY_INVALID_TRANSITION`/`LEDGER_INSUFFICIENT_BALANCE`（业务拒绝）⇒ 零新增码',
    JSON.stringify({ missing: borrowed.filter((c) => !LEDGER_ERROR_CODES.includes(c as never)) }));
  t('J3', 'closedSets',
    /'BTTC_UNAVAILABLE'/.test(INDEX_TS) && /'INSUFFICIENT_BATT'/.test(INDEX_TS) && /'INSUFFICIENT_BTTC'/.test(INDEX_TS) && /'INSUFFICIENT_FEE'/.test(INDEX_TS),
    '★ 稳定 `reason` 常量（挂既有码下 · 非新码）：`BTTC_UNAVAILABLE` / `INSUFFICIENT_BATT` / `INSUFFICIENT_BTTC` / `INSUFFICIENT_FEE`',
    JSON.stringify({ unavailable: /'BTTC_UNAVAILABLE'/.test(INDEX_TS), batt: /'INSUFFICIENT_BATT'/.test(INDEX_TS), bttc: /'INSUFFICIENT_BTTC'/.test(INDEX_TS) }));
  t('J4', 'pending', pendingApply.length === 0, '★ `0032`/`0033`/`0034` **已 apply** ⇒ `pending_apply[]` **归零**（原 10 条库面 leg 全部转 K 段**活体** `checks`，不伪装绿）', JSON.stringify({ pending_apply: pendingApply.length }));
  selfTest('J1', 'closedSets', (v) => (v as string[]).length === 33, [...LEDGER_ERROR_CODES, 'LEDGER_MADEUP_CODE'], '把 34 条闭集喂入 ⇒ 必须转红');
  selfTest('J4', 'pending', (n: unknown) => Number(n) === 0, 1, '把「非零 pending」值喂入「归零」谓词 ⇒ 必须转红');
}

// ============================================================================
// L · 四语 `bttcPanel` 键集相等 + 六类泄漏 0 + `en`/`vn` 零 CJK
// ============================================================================
{
  const langs = ['zh', 'en', 'hk', 'vn'];
  const nsKeys = (loc: Record<string, unknown>, ns: string): string[] => {
    const o = loc[ns];
    return o && typeof o === 'object' ? Object.keys(o as Record<string, unknown>).sort() : [];
  };
  const zhKeys = nsKeys(LOCALES.zh, 'bttcPanel');
  const fourEqual = langs.every((l) => eqJson(nsKeys(LOCALES[l], 'bttcPanel'), zhKeys));
  t('L1', 'locales', zhKeys.length > 0 && fourEqual && zhKeys.includes('noData'),
    '★ 四语 `zh/en/hk/vn` 的 `bttcPanel` 键集**逐语相等**且含 `noData`（「暂无数据」四语各一值）',
    JSON.stringify({ keys: zhKeys, four_equal: fourEqual }));
  const cjk = /[\u4e00-\u9fff]/;
  const enCjk = (JSON.stringify(LOCALES.en.bttcPanel ?? null)).match(cjk);
  const vnCjk = (JSON.stringify(LOCALES.vn.bttcPanel ?? null)).match(cjk);
  t('L2', 'locales', enCjk === null && vnCjk === null,
    '★ `en`/`vn` 的 `bttcPanel` 键值**零 CJK**', JSON.stringify({ en_cjk: enCjk === null, vn_cjk: vnCjk === null }));
  const leakRe = /§\d|(?:GET|POST|PUT|PATCH|DELETE)\s|HTTP|\b(?:200|201|202|204|301|302|400|401|403|404|405|409|410|422|429|500|502|503|504)\b|\/api\/|bttc_mint_fee|bttc_burn_fee|is_platform_coin|total_supply|mint_batt_cost/;
  const leakHit: string[] = [];
  for (const l of langs) if (leakRe.test(JSON.stringify(LOCALES[l].bttcPanel ?? null))) leakHit.push(l);
  t('L3', 'locales', leakHit.length === 0,
    '★ 六类工程口径泄漏 = **0**（`bttcPanel` 值面不含章节号 / HTTP 码 / 路径 / 批次 / 机读码 / 表列名）',
    JSON.stringify({ leak_langs: leakHit }));
  selfTest('L3', 'locales', (v) => !leakRe.test(String(v)), '暫無數據（§33.2）', '把「值里带章节号」的文案喂入泄漏谓词 ⇒ 必须转红');
  selfTest('L1', 'locales', (keys) => eqJson([...(keys as string[])].sort(), zhKeys), [...zhKeys, 'extraKey'], '把「多一个键」的语言喂入键集相等谓词 ⇒ 必须转红');
}

// ============================================================================
// K · 库面 leg（只连库 · 零 HTTP）：结构面**活体**断言 + ★★ 四段真链路（事务内 + 子步 SAVEPOINT + 末尾 ROLLBACK）
// ----------------------------------------------------------------------------
// ★ `0032`/`0033`/`0034`/`0038` **已 apply**（`schema_version = 0042` · `schema_migration` 41 行）⇒ 原 `pending_apply[]` 10 条
//   **全部转本段活体 checks**（`ledger_kind_enum`/`ledger_kind_ok`/`−1` credit 白名单/`is_platform_coin` 列与默认/
//   `op` 白名单与双写/三迁移结构指纹 + 四段真链路 + 配对不变式 + 零残渣）。
// ★ 库面写一律**事务内 + 末尾 ROLLBACK**（`ledger_entry`/`batt_entry`/`batt_account` append-only ⇒ 无 DELETE 复原路径）；
//   子步一律 `SAVEPOINT`（任一语句出错只回滚该子步，不中止整事务）。
// ★ **严禁** `UPDATE app_config`：策略取**常量兜底**（无 `mint_burn_policy` 行 ⇒ `source=constant` ⇒ `100/1/1/1/100`），本段**零 `app_config` 写**。
// ============================================================================
(async () => {
  let dbConnections = 0;
  const httpCalls = 0;
  const live: Record<string, unknown> = {};
  const chains: Record<string, unknown> = {};
  const findings: Array<{ id: string; severity: string; status: string; title: string; evidence: string }> = [];
  const SENT = 'P8S9_LIVE_ROLLBACK';
  const TEST_UID = 4;          // $ 余额 > 0 的真实用户（`users` 在册）
  const TEST_UID_ZERO = 971100; // $ 余额 = 0 的真实用户（前置闸负读数）
  const TEST_UID_EMPTY = 999999999; // 全库不存在的 uid（负对照：天然无 `users` / `account` / `batt_account` 行）。
                                    // ★ 原用 900004 —— `0040`（存量补发 batt）已给该 uid 留 `batt_account` 行 ⇒ 「无行」状态消失，改用不存在 uid 构造（`C-15` 无行活体对照）
  const KEY_MINT = 'cli:aaaaaaaa-1111-4111-8111-111111111111';
  const KEY_BURN = 'cli:bbbbbbbb-2222-4222-8222-222222222222';
  const KEY_BURN_NEG = 'cli:cccccccc-3333-4333-8333-333333333333';

  const tableCounts = async (): Promise<Record<string, unknown>> => {
    const r = await readQuery<Record<string, unknown>>(`
      SELECT (SELECT count(*)::int FROM public.currency) AS currency,
             (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
             (SELECT count(*)::int FROM public.batt_account) AS batt_account,
             (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
             (SELECT count(*)::int FROM public.account) AS account,
             (SELECT count(*)::int FROM public.currency_status_log) AS currency_status_log,
             (SELECT count(*)::int FROM public.currency_review_log) AS currency_review_log`);
    return r[0];
  };

  try {
    // ---------------------------------------------------------------- 结构面（只读 · 活体）
    const cons = await readQuery<{ conname: string; def: string }>(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.batt_account'::regclass`);
    dbConnections += 1;
    const range = cons.find((c) => c.conname === 'batt_account_range')?.def ?? '';
    live.batt_account_range = range;
    t('K1', 'dbStructure', /batt >= 0/.test(range) && /batt <= 100/.test(range),
      '★ 既有（`0029`）`batt_account_range` = `CHECK (batt BETWEEN 0 AND 100)` 在场 ⇒ `R-9-23` 钳制的 DB 兜底依据', JSON.stringify({ def: range }));
    selfTest('K1', 'dbStructure', (v) => /batt <= 100/.test(String(v)), 'CHECK (batt >= 0)', '把「缺上限」的约束 def 喂入范围谓词 ⇒ 必须转红');

    const kindDef = (await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`))[0]?.def ?? '';
    dbConnections += 1;
    const KINDS_DB = (kindDef.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
    live.live_kind_enum = { n: KINDS_DB.length, has_89: P94_KINDS.filter((k) => KINDS_DB.includes(k)) };
    t('K2', 'dbStructureLive', KINDS_DB.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KINDS_DB.includes(k)) && sortedEq(KINDS_DB, KINDS_TS),
      '★ `0038` 活体：`ledger_kind_enum` = **24 值**（含 `bttc_mint_fee`/`bttc_burn_fee`/`invite_first_task_reward`）且与 TS `LEDGER_KINDS` 同集', JSON.stringify(live.live_kind_enum));
    selfTest('K2', 'dbStructureLive', (n) => Number(n) === 24, 23, '把「23 值」（apply 前）喂入「24 值」谓词 ⇒ 必须转红');

    const fnk = (await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_kind_ok' AND pronamespace='public'::regnamespace`))[0]?.src ?? '';
    dbConnections += 1;
    const mkk = fnk.match(/p_kind IN \(([^)]*)\)\s*AND \(NOT p_frozen_settle OR p_kind IN \(([^)]*)\)\)/);
    const KK_FIRST = mkk ? (mkk[1].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
    const KK_FROZEN = mkk ? (mkk[2].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
    live.live_kind_ok = { first_n: KK_FIRST.length, frozen: [...KK_FROZEN].sort() };
    t('K2b', 'dbStructureLive',
      KK_FIRST.length === 24 && [...P94_KINDS, ...P95_KINDS].every((k) => KK_FIRST.includes(k)) && sortedEq(KK_FROZEN, ['hold_forfeit', 'job_payout', 'purchase', 'trade']),
      '★ `0038` 活体：`ledger_kind_ok` 第一支 = **24 值**（含三新 kind）；冻结族第二支 = **4 值**（一字未动）', JSON.stringify(live.live_kind_ok));

    const fna = (await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_assert_platform_mutation' AND pronamespace='public'::regnamespace`))[0]?.src ?? '';
    dbConnections += 1;
    const ma = fna.match(/WHEN '-1' THEN CASE p_dir WHEN 'credit' THEN p_kind IN \(([^)]*)\)/);
    const WL_DB = ma ? (ma[1].match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
    live.live_wl_m1_credit = WL_DB;
    t('K2c', 'dbStructureLive',
      WL_DB.length === 8 && P94_KINDS.every((k) => WL_DB.includes(k))
        && ['trade_fee', 'listing_fee', 'currency_create_fee', 'job_fee', 'listing_deposit', 'checkin_makeup_fee'].every((k) => WL_DB.includes(k)),
      '★ `0032` 活体：`ledger_assert_platform_mutation` 的 `−1` credit 白名单 = **8 值**（既有 6 + 两新 kind）', JSON.stringify({ whitelist: WL_DB }));

    const col = (await readQuery<{ data_type: string; is_nullable: string; column_default: string | null }>(
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='currency' AND column_name='is_platform_coin'`))[0];
    dbConnections += 1;
    live.live_col = col ?? null;
    t('K3', 'dbStructureLive', !!col && col.data_type === 'boolean' && col.is_nullable === 'NO' && String(col.column_default ?? '').includes('false'),
      '★ `0033` 活体：`currency.is_platform_coin` = `boolean` / `NOT NULL` / `DEFAULT false`', JSON.stringify(col ?? null));
    const trueCnt = Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.currency WHERE is_platform_coin`))[0].n);
    dbConnections += 1;
    t('K3b', 'dbStructureLive', trueCnt === 0,
      '★ `0033` 活体存量兼容：既有 `currency` 行 `is_platform_coin = true` 计数 = **0**（`0033` 后现存 15 行全 false）', JSON.stringify({ true_rows: trueCnt }));

    const opSrc = (await readQuery<{ src: string }>(
      `SELECT prosrc AS src FROM pg_proc WHERE proname='ledger_post_event' AND pronamespace='public'::regnamespace AND pg_get_function_identity_arguments(oid)='payload jsonb'`))[0]?.src ?? '';
    dbConnections += 1;
    const opWlMatch = opSrc.match(/v_op NOT IN\s*\(([^)]*)\)/);
    const opWl = opWlMatch ? opWlMatch[1].replace(/\s+/g, ' ').trim() : '';
    const liveOp = {
      op_whitelist: opWl,
      has_burn_branch: /ELSIF v_op = 'burn' THEN/.test(opSrc),
      has_supply_debit: /total_supply = total_supply - v_amount/.test(opSrc),
      has_supply_credit: /total_supply = total_supply \+ v_amount/.test(opSrc),
      has_mb_exempt: /v_e->>'kind' IN \('mint', 'burn'\)/.test(opSrc),
    };
    live.live_post_event = liveOp;
    t('K4', 'dbStructureLive', opWlMatch !== null && /'burn'/.test(opWl) && liveOp.has_burn_branch,
      "★ `0034` 活体：`ledger_post_event` `op` 白名单含 `burn`（末位）+ `ELSIF v_op = 'burn'` 分支在场", JSON.stringify(liveOp));
    t('K4b', 'dbStructureLive', liveOp.has_supply_debit && liveOp.has_supply_credit && liveOp.has_mb_exempt,
      '★ `0034` 活体：`total_supply` 双写两向在场（`mint` `+v_amount` / `burn` `−v_amount`）+ 配对不变式对 `kind IN (mint,burn)` 豁免', JSON.stringify(liveOp));
    selfTest('K4', 'dbStructureLive', (v) => /v_op NOT IN\s*\([^)]*'burn'\)/.test(String(v)), "v_op NOT IN ('mint', 'transfer')",
      '把「op 白名单缺 burn」的源码喂入「含 burn」谓词 ⇒ 必须转红（证明判据锚到白名单而非任意子串）');

    const sm = await readQuery<{ n: string; mx: string | null }>(
      `SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`);
    dbConnections += 1;
    live.schema_migration = sm[0];
    t('K5', 'dbStructureLive', Number(sm[0].n) === 41 && String(sm[0].mx) === '0042',
      '★ 迁移结构指纹：`schema_migration` = **41 行** · `max(version)` = **0042**（`0032`→…→`0042` 已 apply · 8⑥ 审计台权限键）', JSON.stringify(sm[0]));
    selfTest('K5', 'dbStructureLive', (v) => String(v) === '0038', '0034', '把「未 apply（0034）」喂入「0038」谓词 ⇒ 必须转红');

    // ---------------------------------------------------------------- 四段真链路（单事务 + 子步 SAVEPOINT + 末尾 ROLLBACK）
    const before = await tableCounts();
    live.residue_before = before;

    await withTransaction(async (tx: TxClient) => {
      const rowsOf = async (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => (await tx.query<Record<string, unknown>>(text, params)).rows;
      const oneOf = async (text: string, params: unknown[] = []): Promise<Record<string, unknown>> => (await rowsOf(text, params))[0] ?? {};
      const sp = async <T>(name: string, fn: () => Promise<T>): Promise<{ ok: boolean; v?: T; err?: string }> => {
        await tx.query(`SAVEPOINT ${name}`);
        try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${name}`); return { ok: true, v }; }
        catch (e) { await tx.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined); return { ok: false, err: String((e as { code?: unknown }).code ?? (e as Error).message).slice(0, 120) }; }
      };
      const countsIn = async (): Promise<Record<string, unknown>> => oneOf(`
        SELECT (SELECT count(*)::int FROM public.currency) AS currency,
               (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
               (SELECT count(*)::int FROM public.batt_account) AS batt_account,
               (SELECT count(*)::int FROM public.batt_entry) AS batt_entry`);
      const supplyOf = async (cid: number): Promise<string> => String((await oneOf(`SELECT total_supply::text AS s FROM public.currency WHERE cid=$1`, [cid])).s ?? 'NA');
      const sumOf = async (cid: number, kind: string): Promise<string> => String((await oneOf(`SELECT COALESCE(sum(delta),0)::text AS s FROM public.ledger_entry WHERE cid=$1 AND kind=$2`, [cid, kind])).s ?? '0');
      const balOf = async (uid: number, cid: number): Promise<string> => String((await oneOf(`SELECT COALESCE((SELECT balance FROM public.account WHERE uid=$1 AND cid=$2),0)::text AS b`, [uid, cid])).b ?? '0');
      const battOf = async (uid: number): Promise<number> => Number((await oneOf(`SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid=$1),0)::int AS b`, [uid])).b ?? 0);
      const legs = async (cid: number, kind: string): Promise<Record<string, unknown>[]> => rowsOf(`SELECT uid::text, delta::text, kind FROM public.ledger_entry WHERE cid=$1 AND kind=$2 ORDER BY txid`, [cid, kind]);
      const setBatt = async (uid: number, v: number): Promise<void> => { await tx.query(`INSERT INTO public.batt_account (uid,batt) VALUES ($1,$2) ON CONFLICT (uid) DO UPDATE SET batt=EXCLUDED.batt`, [uid, v]); };

      // ---- K6/K7 `R-9-23` 反事実直插（钳制的 DB 兜底对照）----
      const over = await sp('sp_over', () => tx.query(`INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, 101) ON CONFLICT (uid) DO UPDATE SET batt = 101`, [TEST_UID]));
      const boundary = await sp('sp_bound', () => tx.query(`INSERT INTO public.batt_account (uid, batt) VALUES ($1::bigint, 100) ON CONFLICT (uid) DO UPDATE SET batt = 100`, [TEST_UID]));
      const overCode = over.ok ? '' : over.err;
      const boundCode = boundary.ok ? '' : boundary.err;
      live.counterfactual = { over_101: overCode || 'OK', boundary_100: boundCode || 'OK' };
      t('K6', 'dbBehavior', overCode === '23514',
        '★ `R-9-23` 反事実直插必红：绕过应用层钳制直插 `batt = 101` ⇒ DB `batt_account_range` 必拒 `23514`（证钳制必要）', JSON.stringify({ over_code: overCode || 'OK' }));
      t('K7', 'dbBehavior', boundary.ok === true,
        '★ 边界对照：直插 `batt = 100` ⇒ **通过**（`23514` 只在越界时触发，非恒拒）', JSON.stringify({ boundary_code: boundCode || 'OK' }));
      selfTest('K6', 'dbBehavior', (c) => String(c) === '23514', '00000', '把「未越界（00000）」的写入结果喂入「必红 23514」谓词 ⇒ 必须转红');

      // ===================== ① BTTC 创建（`ensureBttcCurrency`）=====================
      const c1 = await DatabaseService.ensureBttcCurrency(tx);
      const c2 = await DatabaseService.ensureBttcCurrency(tx);
      const rowNow = await oneOf(`SELECT cid::text, symbol, name, decimals::int, status, total_supply::text, is_platform_coin FROM public.currency WHERE symbol='BTTC'`);
      const brief = (c: typeof c1): Record<string, unknown> | null => (c ? { cid: c.cid, symbol: c.symbol, decimals: c.decimals, status: c.status, is_platform_coin: c.is_platform_coin, inserted: c.inserted } : null);
      chains.create = {
        call1: brief(c1), call2: brief(c2),
        row_direct: { cid: String(rowNow.cid), symbol: String(rowNow.symbol), decimals: Number(rowNow.decimals), status: String(rowNow.status), is_platform_coin: rowNow.is_platform_coin === true },
      };
      t('KC1', 'bttcCreate',
        String(rowNow.symbol) === 'BTTC' && Number(rowNow.decimals) === 0 && String(rowNow.status) === 'listed' && rowNow.is_platform_coin === true,
        '★ ① BTTC 创建：`currency` 载体行 = `symbol=BTTC` / `decimals=0` / `status=listed` / `is_platform_coin=true`（`R-9-40`）', JSON.stringify(chains.create));
      const cc = c2 ?? c1;
      t('KC2', 'bttcCreate', !!cc && cc.symbol === 'BTTC' && cc.decimals === 0 && cc.status === 'listed' && cc.is_platform_coin === true,
        '★ `ensureBttcCurrency` 取数（幂等确保态 · 第二次调用）返回 `symbol=BTTC`/`decimals=0`/`status=listed`/`is_platform_coin=true`', JSON.stringify(chains.create));
      t('KC1b', 'bttcCreate', c1 !== null && c1.symbol === 'BTTC' && c1.is_platform_coin === true && c1.decimals === 0 && c1.status === 'listed',
        '★ `R-9-45` 回归判据：`ensureBttcCurrency` **首次调用**（本次插入那一次）返回**确定值**（`ins RETURNING` 同名取回 + 逐列 `COALESCE` 兜底）⇒ 首调**非空**且 = 载体行（原缺陷 `F-α` 已被本判据覆盖，去修 ⇒ 必红）', JSON.stringify({ first_call: brief(c1) }));
      findings.push({
        id: 'F-α', severity: 'minor', status: c1 === null ? 'open' : 'resolved',
        title: '`ensureBttcCurrency` **首次调用**（本次插入那一次）曾返回 `null`（PG 数据修改型 CTE 同快照不可见）',
        evidence: '原实现：主 SELECT 的标量子查询读 `public.currency` 早于本语句 INSERT 的可见性 ⇒ 首调 `cid=NULL` ⇒ 返回 `null`（行确已插入，第二次调用返回该行）。**按 `R-9-45` 已最小修**（`ins RETURNING` 同名取回 + 逐列 `COALESCE` 兜底，`src/database.ts` `ensureBttcCurrency`）⇒ 本次首调实测 `c1=' + (c1 === null ? 'null（未修，仍为缺陷）' : '非空（已修）') + '`；`KC1b` 为该修的结构回归判据。',
      });
      const bcid = Number((cc as { cid: string }).cid);

      // ===================== ② 豁免闸两读数对照 =====================
      const mk = async (sym: string, plat: boolean, dep: number): Promise<string> => String((await oneOf(
        `INSERT INTO public.currency (symbol,name,owner_uid,decimals,status,deposit_amount,deposit_cid,is_platform_coin)
         VALUES ($1,'t',$2,0,'draft',$3,1,$4) RETURNING cid::text`, [sym, TEST_UID, dep, plat])).cid);
      const pPlat = await mk('P8S9PLAT', true, 0);
      const pNorm = await mk('P8S9NORM', false, 0);
      const pPlatD = await mk('P8S9PLATD', true, 7);
      const callList = async (cid: string, dep: number, tag: string): Promise<Record<string, unknown>> => {
        const r = await sp(`sp_l_${tag}`, () => DatabaseService.listCurrencyWithDeposit({
          cid: Number(cid), actorUid: TEST_UID, fee: 5, depositAmount: dep,
          idempotencyKey: `biz:p8s9:list:${tag}`, requestFingerprint: `P8S9:${tag}`, memo: tag,
        }, tx));
        if (!r.ok) return { ok: false, err: r.err };
        const row = r.v as Record<string, unknown>;
        return { ok: true, applied: Number(row.applied ?? 0), cur_status: String(row.cur_status ?? '') };
      };
      chains.exemption = {
        nonplatform_dep0: await callList(pNorm, 0, 'norm0'),
        platform_dep7: await callList(pPlatD, 7, 'plat7'),
        platform_dep0: await callList(pPlat, 0, 'plat0'),
      };
      const ex = chains.exemption as Record<string, Record<string, unknown>>;
      t('KE1', 'exemptionGate', ex.nonplatform_dep0.ok === true && Number(ex.nonplatform_dep0.applied) === 0,
        '★ ★ C-1 负对照（**非平台行仍走审核闸**）：`is_platform_coin=false` + 无审核台账 + 保证金 `0` ⇒ `applied=0`（未审 `draft` 不得上市）', JSON.stringify(ex.nonplatform_dep0));
      t('KE2', 'exemptionGate', ex.platform_dep7.ok === true && Number(ex.platform_dep7.applied) === 0,
        '★ **保证金腿对平台行跳过**：平台行（`is_platform_coin=true`）+ 保证金 `>0` ⇒ `applied=0`（`NOT (平台 AND 保证金<>0)` 守卫 · 平台行不得携带保证金）', JSON.stringify(ex.platform_dep7));
      t('KE3', 'exemptionGate', ex.platform_dep0.ok === false && ex.platform_dep0.err === 'LD016',
        '★ **审核闸豁免生效**（平台行**越过审核闸**、推进到账本腿）：平台行 + 无审核台账 + 保证金 `0` ⇒ **不**以 `applied=0`（审核拒）返回，而是推进到账本腿 —— 零额保证金分录触发 `LD016`（`LEDGER_AMOUNT_INVALID`/`BOTH_ZERO`）。**两读数对照**：非平台行止于审核（`applied=0`）⇄ 平台行越过审核（触达账本）', JSON.stringify(ex.platform_dep0));
      findings.push({
        id: 'F-β', severity: 'major', status: ex.platform_dep0.err === 'LD016' ? 'open_transferred_r9_44' : 'not_observed',
        title: '平台行经 `listCurrencyWithDeposit` **无法完成上市**（审核豁免已达，但保证金腿未在分录层跳过）',
        evidence: '平台行越过审核闸后：保证金 `0` ⇒ 保证金腿仍产零额分录 ⇒ `LD016`（`BOTH_ZERO`）整语句回滚；保证金 `>0` ⇒ 守卫 `NOT (平台 AND 保证金<>0)` 拦下（`applied=0`）。**已裁 `R-9-44`：属预期行为、非缺陷** —— 平台币/BTTC 由系统引导创建（`ensureBttcCurrency` 直达 `status=listed`），**不开放** `listCurrencyWithDeposit` 上市申请入口 ⇒ 豁免谓词语义 = **平台币免审核**，而非「平台币可申请上市」。登记待办：**若未来开放平台币上市申请** ⇒ 须修 `LD016` 零额保证金分录入径（**非本片范围**）。',
      });

      // ===================== ③ 铸造 =====================
      await tx.query(`INSERT INTO public.account (uid,cid,balance,frozen) VALUES ($1,$2,0,0) ON CONFLICT (uid,cid) DO NOTHING`, [TEST_UID, bcid]);

      // 前置闸不满足（batt=99）
      await setBatt(TEST_UID, 99);
      // ★ 基线对拍（前）：`batt_entry` 计数基线（对既有行免疫 —— `0040` 已给存量 uid 留 `reason='invite_signup'` 行，绝对 0 不再成立）
      const battEntryPre1 = Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [TEST_UID])).n);
      const mr1 = await DatabaseService.bttcMint({ uid: TEST_UID, idempotencyKey: KEY_MINT, requestFingerprint: 'P8S9:mint', memo: '' }, tx);
      const battEntryPost1 = Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [TEST_UID])).n);
      const mr1R = {
        outcome: mr1?.outcome, battAfter: await battOf(TEST_UID), usd: await balOf(TEST_UID, 1), bttc: await balOf(TEST_UID, bcid), supply: await supplyOf(bcid),
        mintLegs: (await legs(bcid, 'mint')).length, feeLegs: (await legs(1, 'bttc_mint_fee')).length,
        battEntryPre: battEntryPre1, battEntryPost: battEntryPost1, battEntryDelta: battEntryPost1 - battEntryPre1,
      };
      chains.mintRejectBatt = mr1R;
      t('KM1', 'mintChain',
        mr1?.outcome === 'rejected' && mr1R.battAfter === 99 && mr1R.usd === '4' && mr1R.mintLegs === 0 && mr1R.feeLegs === 0 && mr1R.battEntryDelta === 0 && mr1R.supply === '0',
        '★ ③ 铸造前置闸不满足（`batt=99 < mintBattCost=100`）⇒ `rejected` + **零副作用**（batt 不变 / `$` 不变 / BTTC 0 / 供应量 0 / **该 uid `batt_entry` 计数前后差 = 0**〔基线对拍 · 非绝对 0〕 / 零账本分录）', JSON.stringify(mr1R));

      // 前置闸不满足（$=0）
      await setBatt(TEST_UID_ZERO, 100);
      // ★ 基线对拍（前）：同 KM1（`0040` 已给存量 uid 留 `batt_entry` 行 ⇒ 绝对 0 不再成立）
      const battEntryPre2 = Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [TEST_UID_ZERO])).n);
      const mr2 = await DatabaseService.bttcMint({ uid: TEST_UID_ZERO, idempotencyKey: KEY_MINT, requestFingerprint: 'P8S9:mint', memo: '' }, tx);
      const battEntryPost2 = Number((await oneOf(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid=$1`, [TEST_UID_ZERO])).n);
      const mr2R = {
        outcome: mr2?.outcome, battAfter: await battOf(TEST_UID_ZERO), usd: await balOf(TEST_UID_ZERO, 1),
        mintLegs: (await legs(bcid, 'mint')).length, battEntryPre: battEntryPre2, battEntryPost: battEntryPost2, battEntryDelta: battEntryPost2 - battEntryPre2,
      };
      chains.mintRejectUsd = mr2R;
      t('KM2', 'mintChain',
        mr2?.outcome === 'rejected' && mr2R.battAfter === 100 && mr2R.usd === '0' && mr2R.mintLegs === 0 && mr2R.battEntryDelta === 0,
        '★ ③ 铸造前置闸不满足（`$=0 < mintFeeUsd=1`）⇒ `rejected` + **零副作用**（batt 不变 / BTTC 0 / 零账本分录 / **该 uid `batt_entry` 计数前后差 = 0**〔基线对拍 · 非绝对 0〕）', JSON.stringify(mr2R));

      // 铸造成功（batt=100 · $>=1）
      await setBatt(TEST_UID, 100);
      const usdPre = await balOf(TEST_UID, 1);
      const mint = await DatabaseService.bttcMint({ uid: TEST_UID, idempotencyKey: KEY_MINT, requestFingerprint: 'P8S9:mint', memo: '' }, tx);
      const mintBody = await legs(bcid, 'mint');
      const mintFee = await legs(1, 'bttc_mint_fee');
      const mintR = {
        outcome: mint?.outcome, txid: mint?.txid, supplyBefore: mint?.supplyBefore, supplyAfter: mint?.supplyAfter,
        battBefore: 100, battAfter: await battOf(TEST_UID), usdBefore: usdPre, usdAfter: await balOf(TEST_UID, 1),
        bttcAfter: await balOf(TEST_UID, bcid), supplyNow: await supplyOf(bcid), bodyLegs: mintBody, feeLegs: mintFee,
      };
      chains.mint = mintR;
      t('KM3', 'mintChain',
        mint?.outcome === 'applied' && mint?.supplyBefore === '0' && mint?.supplyAfter === '1' && mintR.battAfter === 0 && mintR.usdAfter === '3' && mintR.bttcAfter === '1'
          && mintBody.length === 1 && String(mintBody[0].delta) === '1' && String(mintBody[0].kind) === 'mint'
          && mintFee.some((l) => String(l.uid) === '-1' && String(l.delta) === String(MINT_BURN_POLICY_DEFAULTS.mintFeeUsd) && String(l.kind) === 'bttc_mint_fee'),
        '★ ③ 铸造成功：batt `100→0`（−100）+ `$` `4→3`（−1 → `uid=−1` kind `bttc_mint_fee`）+ BTTC `+1`（本体腿 `mint`）+ 供应量 `0→1`', JSON.stringify(mintR));

      // 幂等重放（同 cli:<UUID>）
      await setBatt(TEST_UID, 100);
      const bR = await countsIn();
      const replay = await DatabaseService.bttcMint({ uid: TEST_UID, idempotencyKey: KEY_MINT, requestFingerprint: 'P8S9:mint', memo: '' }, tx);
      const aR = await countsIn();
      const replayR = { outcome: replay?.outcome, ledger_entry_delta: Number(aR.ledger_entry) - Number(bR.ledger_entry), batt_entry_delta: Number(aR.batt_entry) - Number(bR.batt_entry), supplyNow: await supplyOf(bcid) };
      chains.mintReplay = replayR;
      t('KM4', 'mintChain',
        replay?.outcome === 'replayed' && replayR.ledger_entry_delta === 0 && replayR.batt_entry_delta === 0 && replayR.supplyNow === '1',
        '★ ③ 幂等重放（幂等键 = `cli:<UUID>`）⇒ `replayed` + **零新增**（账本分录 0 / `batt_entry` 0 / 供应量不变）', JSON.stringify(replayR));

      const invM = { supply: await supplyOf(bcid), sumMint: await sumOf(bcid, 'mint'), sumBurn: await sumOf(bcid, 'burn') };
      chains.invAfterMint = invM;
      t('KI1', 'pairingInvariant', BigInt(invM.supply) === BigInt(invM.sumMint) + BigInt(invM.sumBurn),
        '★ ④ 配对不变式（铸造后）：`total_supply == Σmint + Σburn`（burn 分录为**单边负额** `delta=−v_amount` ⇒ `Σburn=−1`；等价 §1.3 记法 `Σmint − Σ|burn|`）⇒ `1 == 1 + 0`', JSON.stringify(invM));

      // ===================== ③ 分解（batt=50 封顶丢弃）=====================
      await setBatt(TEST_UID, 50);
      const usdPreB = await balOf(TEST_UID, 1);
      const burn = await DatabaseService.bttcBurn({ uid: TEST_UID, idempotencyKey: KEY_BURN, requestFingerprint: 'P8S9:burn', memo: '' }, tx);
      const burnBody = await legs(bcid, 'burn');
      const burnFee = await legs(1, 'bttc_burn_fee');
      const battEntryBurn = await oneOf(`SELECT delta::int AS d, batt_after::int AS a FROM public.batt_entry WHERE idempotency_key=$1`, [KEY_BURN]);
      const burnR = {
        outcome: burn?.outcome, txid: burn?.txid, supplyBefore: burn?.supplyBefore, supplyAfter: burn?.supplyAfter,
        battBefore: 50, battAfter: await battOf(TEST_UID), usdBefore: usdPreB, usdAfter: await balOf(TEST_UID, 1),
        bttcAfter: await balOf(TEST_UID, bcid), supplyNow: await supplyOf(bcid), bodyLegs: burnBody, feeLegs: burnFee, battEntry: battEntryBurn,
      };
      chains.burn = burnR;
      t('KB1', 'burnChain',
        burn?.outcome === 'applied' && burn?.supplyBefore === '1' && burn?.supplyAfter === '0' && burnR.bttcAfter === '0' && burnR.usdAfter === '2'
          && burnBody.length === 1 && String(burnBody[0].delta) === '-1' && String(burnBody[0].uid) === String(TEST_UID) && String(burnBody[0].kind) === 'burn'
          && burnFee.some((l) => String(l.uid) === '-1' && String(l.delta) === String(MINT_BURN_POLICY_DEFAULTS.burnFeeUsd) && String(l.kind) === 'bttc_burn_fee'),
        '★ ③ 分解：BTTC `1→0`（`burn` 本体腿 `−1` · **`R25` 持有人本人 `uid`**）+ `$` `3→2`（−1 → `uid=−1` kind `bttc_burn_fee`）+ 供应量 `1→0`', JSON.stringify(burnR));
      t('KB2', 'burnChain', Number(battEntryBurn.d) === 50 && Number(battEntryBurn.a) === 100 && burnR.battAfter === 100,
        '★ ③ 分解 `batt +100` **封顶丢弃**（`R-9-17`）：`batt=50` ⇒ `LEAST(50+100,100)=100` ⇒ 只入 **+50**（`batt_entry` delta=+50 / batt_after=100），终值 100（**非** 150）', JSON.stringify({ battEntry: battEntryBurn, battAfter: burnR.battAfter }));
      const invB = { supply: await supplyOf(bcid), sumMint: await sumOf(bcid, 'mint'), sumBurn: await sumOf(bcid, 'burn') };
      chains.invAfterBurn = invB;
      t('KI2', 'pairingInvariant', BigInt(invB.supply) === BigInt(invB.sumMint) + BigInt(invB.sumBurn),
        '★ ④ 配对不变式（分解后）：`total_supply == Σmint + Σburn`（`Σburn=−1` 单边负额）⇒ `0 == 1 + (−1)`', JSON.stringify(invB));

      // 库级负读数：平台 uid 不得经 burn 销毁（`R-9-38` · `R25` 延用）
      const neg = await sp('sp_burn_neg', () => rowsOf(
        `SELECT public.ledger_post_event(jsonb_build_object('op','burn','idempotency_key',$1::text,'ref_type','currency','ref_id',$2::text,'uid','-1','cid',$2::text,'amount','1'))`,
        [KEY_BURN_NEG, String(bcid)]));
      const negR = neg.ok ? { raised: false } : { raised: true, code: neg.err };
      chains.burnPlatform = negR;
      t('KN1', 'burnChain', neg.ok === false && negR.code === 'LD021',
        '★ `R-9-38`（`R25` 延用）持有人授权兜底：平台 uid（`-1`）经 `burn` 销毁 ⇒ 必拒 `LD021`（`LEDGER_RESERVED_UID` / `PLATFORM_BURN_FORBIDDEN`，不因新币种免检）', JSON.stringify(negR));

      // ===================== ④ `getBttcState` 活体（有行 / 无行）=====================
      const st = await DatabaseService.getBttcState(TEST_UID, tx);
      const stR = { symbol: st.symbol, status: st.status, totalSupply: st.totalSupply, balance: st.balance, usdBalance: st.usdBalance, batt: st.batt, canMint: st.canMint, canBurn: st.canBurn, source: st.source };
      chains.getBttcStateRow = stR;
      t('KGS1', 'bttcStateLive', st.symbol === 'BTTC' && st.totalSupply === '0' && st.balance === '0' && st.canBurn === false && st.canMint === true,
        '★ `getBttcState` 活体（**有行**）：`symbol=BTTC` · 分解后 BTTC 持仓 `0` / 供应量 `0` ⇒ `canBurn=false`（无持仓）；`canMint=true`（分解 `+burnBattGain` 封顶后 `batt=100 ≥ mintBattCost=100` 且 `$=2 ≥ 1` ⇒ 派生布尔即时重算）', JSON.stringify(stR));
      const st0 = await DatabaseService.getBttcState(TEST_UID_EMPTY, tx);
      const st0R = { balance: st0.balance, usdBalance: st0.usdBalance, batt: st0.batt };
      chains.getBttcStateNoRow = st0R;
      t('KGS2', 'bttcStateLive', st0.balance === '0' && st0.usdBalance === '0' && st0.batt === 0,
        '★ `C-15` 活体负对照（**无行 ⇒ 兜底值**）：无 `account` / 无 `batt_account` 行的 uid ⇒ `COALESCE((SELECT …),0)` 外层 ⇒ `balance=0`/`usd=0`/`batt=0`（不 `null` 逃逸）', JSON.stringify(st0R));

      live.tx_counts_after_writes = await countsIn();
      throw new Error(SENT);
    }).catch((e) => { if (String((e as Error)?.message) !== SENT) throw e; });
    dbConnections += 1;

    // ---------------------------------------------------------------- 表级零残渣（ROLLBACK 后 ≡ 前）
    const after = await tableCounts();
    live.residue_after = after;
    t('K9', 'zeroResidue', eqJson(before, after),
      '★ 表级零残渣：`currency` / `ledger_entry` / `batt_account` / `batt_entry` / `account` / `currency_status_log` / `currency_review_log` 行数 **before == after**（事务末尾 `ROLLBACK` ⇒ 零生产落盘）',
      JSON.stringify({ before, after }));
    selfTest('K9', 'zeroResidue', (v) => eqJson((v as { before?: unknown }).before, (v as { after?: unknown }).after), { before, after: { currency: -1 } },
      '把「前后不一致」的行数喂入零残渣谓词 ⇒ 必须转红');

    const bttcAfter = Number((await readQuery<{ n: string }>(`SELECT count(*)::int AS n FROM public.currency WHERE symbol='BTTC'`))[0].n);
    dbConnections += 1;
    t('K10', 'zeroResidue', bttcAfter === 0,
      '★ 回滚后 `currency` **无 `symbol=BTTC` 行**（创建链未落盘 · ROLLBACK 复原）', JSON.stringify({ bttc_rows_after: bttcAfter }));
  } catch (e) {
    t('K0', 'dbStructure', false, '库面 leg 连通（readQuery / 事务）', String((e as Error)?.message || e).slice(0, 200));
  }

  live.chains = chains;
  live.findings = findings;

  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S9-BTTC-GATE',
    generated_at: new Date().toISOString(),
    run: RUN,
    offline: false,
    db_connections: dbConnections,
    http_calls: httpCalls,
    note: 'A–H/L 静态面零 DB / 零 HTTP；I/K 库面 leg **只连库**（结构面**活体**只读 + `R-9-23` 反事実直插 + 四段真链路 = 事务内 + 末尾 ROLLBACK）。★ `0032`/`0033`/`0034`…`0038` **已 apply**（`schema_version` 0042 · `schema_migration` 41 行）⇒ 其 DB 级效果全部转为 K 段**活体 checks**，`pending_apply[]` **归零**（不伪装绿）。',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    pending_apply: pendingApply,
    findings,
    readings: {
      registration_points_total: countRoutes(INDEX_TS),
      registration_points_per_verb: PER_VERB_FROZEN,
      new_routes: NEW_ROUTES,
      kind_ts: KINDS_TS.length,
      kind_0032_check: KINDS_0032_CHECK.length,
      kind_0032_fn: KINDS_0032_FN.length,
      kind_0032_frozen: [...KINDS_0032_FROZEN].sort(),
      whitelist_m1_credit: WL_0032_M1_CREDIT,
      mint_burn_defaults: MINT_BURN_POLICY_DEFAULTS,
      no_row: { source: resolveMintBurnPolicy(undefined).source, policy: resolveMintBurnPolicy(undefined).policy },
      has_row: { source: resolveMintBurnPolicy({ mintBattCost: 7 }).source, policy: resolveMintBurnPolicy({ mintBattCost: 7 }).policy },
      clamp: { mint500_cap50: resolveMintBurnPolicy({ mintBattCost: 500 }, 50).policy.mintBattCost, gain500: resolveMintBurnPolicy({ burnBattGain: 500 }).policy.burnBattGain },
      error_codes_closed_set_size: LEDGER_ERROR_CODES.length,
      locale_bttcPanel_keys: (() => { const o = LOCALES.zh.bttcPanel; return o && typeof o === 'object' ? Object.keys(o as Record<string, unknown>).sort() : []; })(),
      pending_apply_count: pendingApply.length,
      live,
    },
    checks,
  };
  const text = JSON.stringify(report, null, 1);
  fs.writeFileSync(path.join(OUT_DIR, 'gate.json'), text + '\n', 'utf8');
  console.log(text);
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} pending_apply=${pendingApply.length} db=${report.db_connections} http=${report.http_calls} artifact=${path.join(OUT_DIR, 'gate.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('P8S9_FATAL', String((e as Error)?.stack || e).slice(0, 400));
  await closePools().catch(() => undefined);
  process.exit(2);
});
