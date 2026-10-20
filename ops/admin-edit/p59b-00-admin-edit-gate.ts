/**
 * p59b-00 · **管理员可编辑他人商品**（后端门 · 迁移 0059 编辑台账 + 归属闸管理员放行与审计 +
 *             统一预填读口 `GET /api/listing/:listingId/edit` + `/api/user` admin 旗标）
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/admin-edit/p59b-00-admin-edit-gate.ts
 * 读数：`ops/admin-edit/readings/p59b-admin-edit-gate-<RUN>.json`
 *
 * Kevin 口径（2026-10-20）：管理员（如 09b0）**可以编辑他人发布的商品**；本人编辑**逐字不变**。
 *
 * 判据面：
 *   A · 静态面（**注册点 110 → 111** · 迁移 0059 · 台账入审计台白名单 · 服务层接线 · 零新错误码）
 *   B · 准入真源（`isListingEditAdminAccess` 真值表 + `/api/user` 载荷加性形状）
 *   C · 真库写口：① 本人 200 且**零台账行**；② 管理员编他人 200、库内变、台账**恰 1 行**且
 *       `changed_fields` **逐项对拍**；②′ 同值重投 ⇒ `changed_fields = []`（真实变化口径）；
 *       ③ 普通用户 403 且零台账；④ 管理员仍受字段校验（非法 price / 数字商品带成色 ⇒ 400 零写零台账）；
 *       ⑤ 管理员编**自己**的商品 ⇒ 200 且零台账；⑥ `delisted` ⇒ 409（状态机不被管理员绕过）
 *   D · 读口 `getListingEditView`（= `GET /api/listing/:listingId/edit` 的服务层真源）：
 *       本人 200 11 键 / 管理员 200 同形状 / 普通用户 403 / 行不存在 404（**先 404 后 403**）
 *   N · **负控（判负自证）**：① `$11=false`（= 摘掉管理员旗标判定）⇒ 管理员臂落 `not_owner`（C② 必红）；
 *       ② 台账 INSERT 中和（`WHERE false`）⇒ 台账行数断言必红；③ 摘除器确实改动了语句文本
 *   P · preflight（只读 · **不 apply**）：`schema_migration` 顶 = 0058、`listing_edit_log` 尚未建
 *       ⇒ 真库探针在事务内**按迁移头 DDL 建表**（ROLLBACK 零残留）；已 apply 的库走已建表
 *
 * 纪律：**不 apply、不写版本表、零 DDL 出事务**；一切写探针都在 `inRollbackTx` 内 ⇒ ROLLBACK 零残留。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, type Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService, isListingEditAdminAccess } from '../../backend-ts/src/database';
import { updateListingDetails, getListingEditView } from '../../backend-ts/src/listing-service';
import { AUDIT_TABLES, AUDIT_TABLE_NAMES } from '../../backend-ts/src/audit-console';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';

type ErrLike = { ok: boolean; status?: number; code?: string; details?: Record<string, unknown> };
const got = (r: ErrLike): string => (r.ok ? 'ok' : `${r.status}/${r.code}/${String(r.details?.reason ?? '')}`);

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const REPO_BACKEND = path.join(REPO_ROOT, 'backend-ts');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SVC = readSrc('backend-ts/src/listing-service.ts');
const DB = readSrc('backend-ts/src/database.ts');
const AUDIT = readSrc('backend-ts/src/audit-console.ts');
const MIG_PATH = path.join(REPO_BACKEND, 'migrations/0059_listing_edit_log.sql');
const MIG = fs.readFileSync(MIG_PATH, 'utf8');

/** 迁移头 DDL（`DO $$` 之前；自检块只在 apply 时由 runner 执行，门里**不跑**自检、只跑 DDL） */
const MIG_HEAD = MIG.slice(0, MIG.indexOf('\nDO $$')).trim();
/** ★ `$$` 感知的语句切分：头段含 plpgsql 函数体（`RAISE … ;` 在内），裸 `split(';')` 会切坏函数 */
const splitSqlStatements = (src: string): string[] => {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < src.length; i += 1) {
    if (src.slice(i, i + 2) === '$$') { inDollar = !inDollar; buf += '$$'; i += 1; continue; }
    const ch = src[i];
    if (!inDollar && ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((x) => x.replace(/--[^\n]*/g, '').trim().length > 0);
};
const MIG_HEAD_STMTS = splitSqlStatements(MIG_HEAD);
// ★ 迁移 0060（商品统一 Id）：读口行键 11→13（+item_code +snowflake_id）⇒ 未 apply 的库上
//   `listListingsBySeller` / `getListingEditRow` 的 SELECT 会 42703 ⇒ 事务内补 0060 头段 DDL。
const MIG60 = fs.readFileSync(path.join(REPO_BACKEND, 'migrations/0060_item_code_snowflake.sql'), 'utf8');
const MIG60_HEAD_STMTS = splitSqlStatements(MIG60.slice(0, MIG60.indexOf('\nDO $$')).trim());
// ★ 迁移 0061（多件购买授权）：UPDATE_LISTING_DETAILS_SQL 引用 `allow_multi_buy` 并绑 `$12` ⇒
//   未 apply 的库上该语句 42703 ⇒ 事务内补 0061 头段 DDL（单列 ADD，ROLLBACK 零残留）。
const MIG61 = fs.readFileSync(path.join(REPO_BACKEND, 'migrations/0061_listing_allow_multi_buy.sql'), 'utf8');
const MIG61_HEAD_STMTS = splitSqlStatements(MIG61.slice(0, MIG61.indexOf('\nDO $$')).trim());

/** 从 `database.ts` 取出唯一真源语句原文（负控要在它上面中和闸，而不是另写一份 SQL） */
const SQL_START = 'const UPDATE_LISTING_DETAILS_SQL = `';
const sqlAt = DB.indexOf(SQL_START);
const sqlEnd = sqlAt >= 0 ? DB.indexOf('`;', sqlAt + SQL_START.length) : -1;
const SQL_TEXT = sqlAt >= 0 && sqlEnd > sqlAt ? DB.slice(sqlAt + SQL_START.length, sqlEnd) : '';
const OWNER_CLAUSE = "cur.seller_uid <> $2::bigint";
const AUDIT_WHERE = 'WHERE $11::boolean';

/** 负控 ①：把管理员放行位钉成 false（= 去掉旗标判定 ⇒ 回到 0058 行为） */
const neutralizeAdminFlag = (sql: string): string => sql.replace('NOT $11::boolean', 'NOT ($11::boolean AND false)');
/** 负控 ②：把台账 INSERT 的取值条件钉成 false（语句仍合法、参数位仍在） */
const neutralizeAudit = (sql: string): string => sql.replace(AUDIT_WHERE, 'WHERE false');

const SQL_PARAM_ORDER = ['listing_id', 'actor_uid', 'description', 'price', 'stock', 'media_urls',
  'item_type', 'item_type_set', 'item_condition', 'item_condition_set', 'admin_edit', 'allow_multi_buy'];

const stubRow = (over: Record<string, unknown> = {}) => ({
  listing_id: 515151,
  title: 'P59 桩标题',
  price: 1000,
  cid: 1,
  status: 'draft',
  stock: 2,
  media_urls: [] as string[],
  time_created: 0,
  description: 'P59 桩描述',
  item_type: null as string | null,
  condition: null as string | null,
  ...over,
});

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/admin-edit/p59b-00-admin-edit-gate.ts' };
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading).slice(0, 700));
  };

  // ====================================================================== A · 静态面
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**注册点 = 128**（111 = 本单 `GET /api/listing/:listingId/edit`；+7 = project-domain 七口 route §49.19；+9 = campaign-domain 九口 route §49.18 ＋ user-balances `GET /api/user/balances` +1 —— 本单自身仍恰 +1）',
    regs === 128, `registration_points=${regs}`);

  const editRoutes = INDEX_TS.match(/^app\.get\('\/api\/listing\/:listingId\/edit'/gm) ?? [];
  const routeBlock = (() => {
    const at = INDEX_TS.indexOf("app.get('/api/listing/:listingId/edit'");
    return at >= 0 ? INDEX_TS.slice(at, at + 1400) : '';
  })();
  ck.t('A2', '新读口**恰 1 个注册点**且接线正确：`requireActor` → `getListingEditView({ listingId, actorUid, adminAccess: actor.adminAccess })` → `sendVerbError` / `sendSuccess`（授权真源在服务层，路由层不复制闸）',
    editRoutes.length === 1
      && /await requireActor\(req, res\)/.test(routeBlock)
      && /await getListingEditView\(\{/.test(routeBlock)
      && /adminAccess: actor\.adminAccess/.test(routeBlock)
      && /if \(!result\.ok\) return sendVerbError\(res, result\)/.test(routeBlock)
      && /return sendSuccess\(res, result\.view\)/.test(routeBlock)
      && !/AUTH_FORBIDDEN|ACTOR_NOT_ALLOWED/.test(routeBlock),
    `route_bytes=${routeBlock.length}`);

  const patchBlock = (() => {
    const at = INDEX_TS.indexOf("app.patch('/api/listing/:listingId'");
    return at >= 0 ? INDEX_TS.slice(at, at + 5200) : '';
  })();
  ck.t('A3', '写口路由：`PATCH /api/listing/:listingId` 字段支注入 `adminAccess: actor.adminAccess`（**body 的任何 admin 声明都不读**；状态支原样不动）',
    /await updateListingDetails\(\{/.test(patchBlock)
      && /adminAccess: actor\.adminAccess/.test(patchBlock)
      && !/body\.admin|req\.body\.admin|adminAccess:\s*body/.test(patchBlock)
      && /await transitionListingStatus\(\{/.test(patchBlock),
    `patch_bytes=${patchBlock.length}`);

  const migFiles = fs.readdirSync(path.join(REPO_BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const maxMig = (migFiles[migFiles.length - 1].match(/^(\d+)/) ?? [, ''])[1];
  ck.t('A4', '迁移面：`0059_listing_edit_log.sql` 在场 · **文件链顶已前推至 `0065_campaign_hierarchy.sql`**（文件即版本号；三文件都必须在，本门**不 apply**；0060 = 商品统一 Id 单、0061 = 多件购买授权列单、0063/0064 = project 域 DDL + 种子、0065 = 活动五表，0062 未落盘故顺延）',
    maxMig === '0065' && migFiles.includes('0059_listing_edit_log.sql') && migFiles.includes('0060_item_code_snowflake.sql') && migFiles.includes('0061_listing_allow_multi_buy.sql'),
    `max=${maxMig} count=${migFiles.length} has_0059=${migFiles.includes('0059_listing_edit_log.sql')} has_0060=${migFiles.includes('0060_item_code_snowflake.sql')} has_0061=${migFiles.includes('0061_listing_allow_multi_buy.sql')}`);

  const migCols = ['log_id', 'listing_id', 'actor_uid', 'owner_uid', 'admin_edit', 'changed_fields', 'time_created'];
  const checkDefs = Array.from(MIG.matchAll(/CONSTRAINT\s+(listing_edit_log_\w+_ck)\s+CHECK \(([\s\S]*?)\)\s*[,)]/g))
    .map((m) => ({ name: m[1], body: m[2].replace(/\s+/g, ' ') }));
  ck.t('A5', '迁移 0059 形状（静态）：`public.listing_edit_log` 七列齐 · `log_id bigserial PK` · `changed_fields text[] NOT NULL` · 索引 `(listing_id)` · **两条 CHECK**（闭集 `<@` 六字段 + `array_position(…, NULL) IS NULL`）· **append-only 触发器**（`BEFORE UPDATE OR DELETE` 无条件 RAISE，原生 P0001）· **零 FK**（无 `REFERENCES`）· 尾部 `DO $$` 自检 ≥ 11 面',
    /CREATE TABLE IF NOT EXISTS public\.listing_edit_log/.test(MIG)
      && migCols.every((c) => new RegExp(`\\b${c}\\b`).test(MIG))
      && /log_id\s+bigserial/.test(MIG)
      && /changed_fields\s+text\[\]\s+NOT NULL/.test(MIG)
      && /CONSTRAINT listing_edit_log_pk PRIMARY KEY \(log_id\)/.test(MIG)
      && /CREATE INDEX IF NOT EXISTS listing_edit_log_listing_idx\s*\n?\s*ON public\.listing_edit_log \(listing_id\)/.test(MIG)
      && checkDefs.length === 2
      && checkDefs.some((c) => c.name === 'listing_edit_log_fields_ck' && c.body.includes('<@')
        && ['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition'].every((f) => c.body.includes(`'${f}'`)))
      && checkDefs.some((c) => c.name === 'listing_edit_log_fields_no_null_ck' && /array_position\(changed_fields,\s*NULL\)/.test(c.body))
      && /CREATE OR REPLACE FUNCTION public\.listing_edit_log_append_only\(\) RETURNS trigger/.test(MIG)
      && /CREATE TRIGGER trg_listing_edit_log_append_only\s*\n?\s*BEFORE UPDATE OR DELETE ON public\.listing_edit_log/.test(MIG)
      && /EXECUTE FUNCTION public\.listing_edit_log_append_only\(\)/.test(MIG)
      && /RAISE EXCEPTION 'listing_edit_log is append-only/.test(MIG)
      && !/REFERENCES/i.test(MIG)
      && /DO \$\$/.test(MIG)
      && (MIG.match(/RAISE EXCEPTION '0059 self-check FAILED/g) ?? []).length >= 11,
    JSON.stringify({ bytes: MIG.length, exceptions: (MIG.match(/RAISE EXCEPTION/g) ?? []).length, checks: checkDefs.map((c) => c.name), refs: /REFERENCES/i.test(MIG) }));

  ck.t('A6', '唯一真源 SQL（`UPDATE_LISTING_DETAILS_SQL`）：归属闸加 `$11::boolean` 放行位 · 同语句 `ins` CTE 插 `listing_edit_log` · 台账只在 `$11 ∧ seller_uid <> $2` 时落行 · `changed_fields` 由逐列 `IS DISTINCT FROM` 计算',
    SQL_TEXT.length > 0
      && SQL_TEXT.includes(OWNER_CLAUSE) && /AND NOT \$11::boolean THEN 'not_owner'/.test(SQL_TEXT)
      && /ins AS \(\s*\n\s*INSERT INTO public\.listing_edit_log \(listing_id, actor_uid, owner_uid, admin_edit, changed_fields\)/.test(SQL_TEXT)
      && /WHERE \$11::boolean\s*\n\s*AND u\.seller_uid <> \$2::bigint/.test(SQL_TEXT)
      && /array_remove\(ARRAY\[/.test(SQL_TEXT)
      && ['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition']
        .every((f) => new RegExp(`THEN '${f}' END`).test(SQL_TEXT)),
    JSON.stringify({ sql_bytes: SQL_TEXT.length, placeholders: Array.from(new Set(SQL_TEXT.match(/\$\d+/g) ?? [])).sort() }));

  ck.t('A7', '管理员**不放宽**既有校验闸：可编辑态 / 库存需 listed / 成色适用性三条闸文本与措辞未动（管理员绕不过状态机与 DL60）',
    /cur\.status NOT IN \('draft', 'listed'\) THEN 'status_not_editable'/.test(SQL_TEXT)
      && /\$5::int IS DISTINCT FROM cur\.stock AND cur\.status <> 'listed' THEN 'stock_requires_listed'/.test(SQL_TEXT)
      && /THEN 'condition_not_applicable'/.test(SQL_TEXT),
    'guards=3');

  const auditMap = (AUDIT_TABLES as Record<string, unknown>)['listing_edit_log'] as Record<string, unknown> | undefined;
  ck.t('A8', '审计台入册：`AUDIT_TABLES.listing_edit_log` = actor `actor_uid` / target `listing_id` / action `changed_fields`（**数组列** `actionArray=true`）/ timeColumn `time_created` / refId `listing_id` / pk `log_id`；白名单 14 → 15 且新面在表尾',
    !!auditMap
      && JSON.stringify(auditMap) === JSON.stringify({
        actor: ['actor_uid'], target: ['listing_id'], action: ['changed_fields'],
        timeColumn: 'time_created', refId: ['listing_id'], pk: 'log_id', actionArray: true,
      })
      && AUDIT_TABLE_NAMES.length === 15
      && AUDIT_TABLE_NAMES[14] === 'listing_edit_log'
      && !AUDIT_TABLE_NAMES.includes('app_config'),
    JSON.stringify({ faces: AUDIT_TABLE_NAMES.length, last: AUDIT_TABLE_NAMES[14], map: auditMap }));

  ck.t('A9', '服务层接线：`updateListingDetails` 透传 `adminAccess`（省略 = null ⇒ 0058 行为）· `getListingEditView` 导出且**先 404 后 403** · 读口不下发 `seller_uid`',
    /adminAccess: params\.adminAccess \?\? null/.test(SVC)
      && /export const getListingEditView/.test(SVC)
      && /if \(!found\) return gone404\('listing', listingId\.value\);\n\n?\s*const isOwner/.test(SVC)
      && /if \(!isOwner && !isListingEditAdminAccess\(params\.adminAccess\)\)/.test(SVC)
      && !/seller_uid.*view|view.*seller_uid/.test(SVC.slice(SVC.indexOf('export const getListingEditView'))),
    `svc_bytes=${SVC.length}`);

  const userPayload = INDEX_TS.slice(INDEX_TS.indexOf('const buildUserPayload'), INDEX_TS.indexOf('const ensureOwnedTaskProgress'));
  ck.t('A10', '`/api/user` **纯加性** admin 子对象：三键 `can_access_admin / is_admin / permissions` 且**只**这三键（无 `preferred_admin_path` 等）；两处调用点都注入 token 侧 `adminAccess`',
    /admin: \{/.test(userPayload)
      && /can_access_admin: adminAccess\?\.can_access_admin === true/.test(userPayload)
      && /is_admin: adminAccess\?\.is_admin === true/.test(userPayload)
      && /permissions: \[\.\.\.\(adminAccess\?\.permissions \?\? \[\]\)\]/.test(userPayload)
      && !/preferred_admin_path/.test(userPayload)
      && (INDEX_TS.match(/buildUserPayload\([^)]*actor\.adminAccess\)/g) ?? []).length === 2,
    JSON.stringify({
      keys: (userPayload.match(/^\s{6}\w+:/gm) ?? []).map((s) => s.trim()),
      calls_with_admin: (INDEX_TS.match(/buildUserPayload\([^)]*actor\.adminAccess\)/g) ?? []).length,
    }));

  const newSvcCode = SVC.slice(SVC.indexOf('export const getListingEditView'));
  const codes = Array.from(new Set((newSvcCode.match(/'(LEDGER_[A-Z_]+|AUTH_[A-Z_]+)'/g) ?? []).map((s) => s.slice(1, -1))));
  ck.t('A11', `**零新错误码**：新读口只借既有码（${codes.join(' / ')}），33 码闭集不动；台账入册零新码`,
    LEDGER_ERROR_CODES.length === 33 && codes.every((c) => c === 'AUTH_FORBIDDEN' || (LEDGER_ERROR_CODES as string[]).includes(c)),
    `codes=${JSON.stringify(codes)} close_set=${LEDGER_ERROR_CODES.length}`);

  // ============================================== B · 准入真源（纯函数 · 零 DB）
  const truth: Array<{ id: string; access: Record<string, unknown> | null; expect: boolean; why: string }> = [
    { id: 'B1', access: { can_access_admin: true, is_admin: true, permissions: [] }, expect: true, why: 'is_admin（permissions 空也放行）' },
    { id: 'B2', access: { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] }, expect: true, why: 'can_access_admin ∧ manage_rewards' },
    { id: 'B3', access: { can_access_admin: true, is_admin: false, permissions: ['manage_points', 'manage_rewards'] }, expect: true, why: '权限位含 manage_rewards（多权限）' },
    { id: 'B4', access: { can_access_admin: true, is_admin: false, permissions: ['manage_points'] }, expect: false, why: '能进后台但**无** manage_rewards' },
    { id: 'B5', access: { can_access_admin: true, is_admin: false, permissions: [] }, expect: false, why: '仅角色行（无权限位）' },
    { id: 'B6', access: { can_access_admin: false, is_admin: true, permissions: ['manage_rewards'] }, expect: false, why: '★ can_access_admin=false ⇒ 一律否（前缀闸）' },
    { id: 'B7', access: { can_access_admin: false, is_admin: false, permissions: [] }, expect: false, why: '普通用户' },
    { id: 'B8', access: null, expect: false, why: '省略/ null ⇒ 0058 行为（仅本人）' },
  ];
  for (const t of truth) {
    u(t.id, `准入真源 \`isListingEditAdminAccess(${JSON.stringify(t.access)})\` ⇒ ${t.expect}（${t.why}）`,
      isListingEditAdminAccess(t.access as never) === t.expect, String(isListingEditAdminAccess(t.access as never)));
  }

  // ---- B9 · 服务层（桩 DB）：adminAccess 透传 + 读口四臂形状
  const svc = DatabaseService as unknown as Record<string, unknown>;
  const origUpdateRow = svc.updateListingDetailsRow;
  const origEditRow = svc.getListingEditRow;
  let lastInput: Record<string, unknown> | null = null;
  let rowStub: { row: Record<string, unknown>; sellerUid: number } | null = { row: stubRow(), sellerUid: 700001 };
  svc.updateListingDetailsRow = async (input: Record<string, unknown>) => {
    lastInput = input;
    return {
      outcome: 'updated', row: stubRow(), prev: { description: 'P59 桩描述' },
      sellerUid: 700001, changedFields: ['price'], editLogWritten: input.adminAccess ? true : false,
    };
  };
  svc.getListingEditRow = async () => rowStub;
  try {
    const passAdmin = { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] };
    const r = await updateListingDetails({ listingId: 515151, actorUid: 700002, patch: { price: 1200 }, adminAccess: passAdmin as never });
    u('B9', '服务层透传：`adminAccess` 原样进 `updateListingDetailsRow`（路由层注入 ⇒ 客户端不可声明）；省略时 = `null`',
      r.ok && JSON.stringify(lastInput?.adminAccess) === JSON.stringify(passAdmin)
        && (await (async () => {
          await updateListingDetails({ listingId: 515151, actorUid: 700002, patch: { price: 1200 } });
          return lastInput?.adminAccess === null;
        })()),
      JSON.stringify({ with: lastInput?.adminAccess, ok: r.ok }));

    // 读口四臂（桩行 sellerUid = 700001）
    const owner = await getListingEditView({ listingId: 515151, actorUid: 700001 });
    const admin = await getListingEditView({ listingId: 515151, actorUid: 700099, adminAccess: passAdmin as never });
    const stranger = await getListingEditView({ listingId: 515151, actorUid: 700099 });
    rowStub = null;
    const missingStranger = await getListingEditView({ listingId: 515151, actorUid: 700099 });
    const missingOwner = await getListingEditView({ listingId: 515151, actorUid: 700001 });
    rowStub = { row: stubRow(), sellerUid: 700001 };
    const keys = owner.ok ? Object.keys(owner.view).sort() : [];
    u('B10', '读口：本人 200 · 管理员（manage_rewards）200 **同形状 11 键** · 普通用户 403 `ACTOR_NOT_ALLOWED`（与写口同形）',
      owner.ok && admin.ok
        && JSON.stringify(keys) === JSON.stringify(['cid', 'condition', 'description', 'item_type', 'listing_id', 'media_urls', 'price', 'status', 'stock', 'time_created', 'title'])
        && JSON.stringify(Object.keys(admin.view).sort()) === JSON.stringify(keys)
        && !stranger.ok && stranger.status === 403 && stranger.code === 'AUTH_FORBIDDEN'
        && stranger.details?.reason === 'ACTOR_NOT_ALLOWED' && stranger.details?.ref_type === 'listing',
      JSON.stringify({ keys: keys.length, admin_keys: admin.ok ? Object.keys(admin.view).length : null, stranger: got(stranger as ErrLike) }));

    u('B11', '读口**先 404 后 403**：行不存在时普通用户 / 本人**都**得 404（不拿 403/404 差异枚举 listing_id 存在性）',
      !missingStranger.ok && missingStranger.status === 404 && missingStranger.code === 'LEDGER_REF_NOT_FOUND'
        && !missingOwner.ok && missingOwner.status === 404,
      JSON.stringify({ stranger: got(missingStranger as ErrLike), owner: got(missingOwner as ErrLike) }));
  } finally {
    svc.updateListingDetailsRow = origUpdateRow;
    svc.getListingEditRow = origEditRow;
  }
  ck.t('B12', '桩已回收（`updateListingDetailsRow` / `getListingEditRow` 逐字还原）',
    svc.updateListingDetailsRow === origUpdateRow && svc.getListingEditRow === origEditRow, 'restored');

  // ================================================== C/D · 真库面（rollback ⇒ 零残留）
  const live: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c: Qx) => {
      const r: Record<string, unknown> = {};

      // 迁移未 apply 时：在事务内按**迁移头 DDL** 建表（ROLLBACK 零残留）；已 apply 的库跳过
      const pre = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='listing_edit_log'");
      r.edit_log_pre_existing = Number(pre?.n ?? 0) === 1;
      if (!r.edit_log_pre_existing) {
        for (const stmt of MIG_HEAD_STMTS) await c.query(stmt);
      }
      // 0060 两列同理：未 apply 则事务内补（ROLLBACK 零残留）⇒ 21/23 键读口在 pre-apply 库上仍可跑
      const idCols = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')");
      r.id_columns_pre_existing = Number(idCols?.n ?? 0) === 2;
      if (!r.id_columns_pre_existing) {
        for (const stmt of MIG60_HEAD_STMTS) await c.query(stmt);
      }
      // 0061 一列同理：UPDATE_LISTING_DETAILS_SQL 引用 `allow_multi_buy` / 绑 $12 ⇒ pre-apply 库上 42703
      const mbCols = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name = 'allow_multi_buy'");
      r.mb_column_pre_existing = Number(mbCols?.n ?? 0) === 1;
      if (!r.mb_column_pre_existing) {
        for (const stmt of MIG61_HEAD_STMTS) await c.query(stmt);
      }
      const shape = await raw<{ column_name: string; data_type: string; is_nullable: string }>(c,
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name='listing_edit_log' ORDER BY ordinal_position`);
      r.edit_log_columns = shape;
      const fk = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.listing_edit_log'::regclass AND contype='f'");
      const idx = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND tablename='listing_edit_log' AND indexname='listing_edit_log_listing_idx'");
      ck.t('C0', `台账表就位（${r.edit_log_pre_existing ? '库内已 apply' : '**事务内按 0059 头 DDL 临时建表**，ROLLBACK 零残留'}）：7 列 / 零 FK / \`(listing_id)\` 索引`,
        shape.length === 7 && Number(fk?.n) === 0 && Number(idx?.n) === 1,
        JSON.stringify({ pre_existing: r.edit_log_pre_existing, cols: shape.length, fk: fk?.n, idx: idx?.n }));

      const cks = await raw<{ conname: string; def: string }>(c,
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
          WHERE conrelid='public.listing_edit_log'::regclass AND contype='c' ORDER BY conname`);
      const trg = await raw1<{ n: number; covers: number; enabled: string }>(c,
        `SELECT count(*)::int AS n,
                count(*) FILTER (WHERE (t.tgtype & 2) <> 0 AND (t.tgtype & 8) <> 0 AND (t.tgtype & 16) <> 0)::int AS covers,
                max(t.tgenabled) AS enabled
           FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
          WHERE n.nspname='public' AND cl.relname='listing_edit_log' AND NOT t.tgisinternal`);
      r.edit_log_checks = cks.map((x) => x.conname);
      r.edit_log_trigger = trg;
      ck.t('C0b', `台账表**不受篡改**（真库面）：两条 CHECK 在场（${cks.map((x) => x.conname).join(' / ')}）· append-only 触发器恰 1 个且 tgenabled='O'、覆盖 BEFORE UPDATE OR DELETE`,
        cks.length === 2
          && cks.some((x) => x.conname === 'listing_edit_log_fields_ck' && x.def.includes('<@'))
          && cks.some((x) => x.conname === 'listing_edit_log_fields_no_null_ck' && /array_position/i.test(x.def))
          && Number(trg?.n) === 1 && Number(trg?.covers) === 1 && trg?.enabled === 'O',
        JSON.stringify({ checks: cks.map((x) => x.conname), trigger: trg }));

      const draft = await raw1<Record<string, unknown>>(c,
        "SELECT listing_id, seller_uid::text AS seller_uid, price::text AS price, stock, description, media_urls, item_type, item_condition FROM public.listing WHERE status='draft' ORDER BY listing_id LIMIT 1");
      const listed = await raw1<Record<string, unknown>>(c,
        "SELECT listing_id, seller_uid::text AS seller_uid, price::text AS price, stock FROM public.listing WHERE status='listed' ORDER BY listing_id LIMIT 1");
      const delisted = await raw1<Record<string, unknown>>(c,
        "SELECT listing_id, seller_uid::text AS seller_uid FROM public.listing WHERE status='delisted' ORDER BY listing_id LIMIT 1");
      r.fixtures = { draft, listed, delisted };
      if (!draft) throw new Error('fixture missing (draft)');

      const svcLive = DatabaseService as unknown as Record<string, unknown>;
      const origLive = svcLive.updateListingDetailsRow as (...a: unknown[]) => Promise<unknown>;
      const origEditLive = svcLive.getListingEditRow as (...a: unknown[]) => Promise<unknown>;
      svcLive.updateListingDetailsRow = (input: Record<string, unknown>) => origLive(input, c);
      // ★ 读口同 binds 到本事务客户端（`getListingEditRow(id, ex)`）—— 否则 D3「读口 = 库内真值」
      //   会拿**事务外**的已提交值比对事务内新值 ⇒ 假红（事务间不可见是 MVCC 的预期行为）
      svcLive.getListingEditRow = (id: number) => origEditLive(id, c);
      const draftId = Number(draft.listing_id);
      const ownerUid = Number(draft.seller_uid);
      const adminUid = 990059;
      const strangerUid = 990060;
      const ADMIN_ACCESS = { can_access_admin: true, is_admin: false, permissions: ['manage_rewards'] };
      const logCount = async (listingId?: number) => Number((await raw1<{ n: number }>(c,
        listingId === undefined
          ? 'SELECT count(*)::int AS n FROM public.listing_edit_log'
          : 'SELECT count(*)::int AS n FROM public.listing_edit_log WHERE listing_id = $1::bigint',
        listingId === undefined ? [] : [listingId]))?.n ?? -1);
      const logs = async (listingId: number) => raw<Record<string, unknown>>(c,
        `SELECT listing_id::text AS listing_id, actor_uid::text AS actor_uid, owner_uid::text AS owner_uid,
                admin_edit, changed_fields, time_created
           FROM public.listing_edit_log WHERE listing_id = $1::bigint ORDER BY log_id`, [listingId]);
      const readBack = async (id: number) => raw1<Record<string, unknown>>(c,
        'SELECT price::text AS price, stock, description, media_urls, item_type, item_condition FROM public.listing WHERE listing_id = $1::bigint', [id]);

      try {
        // ---- ① 本人编辑：200、库内变、**零台账行**
        const beforePrice = Number(draft.price);
        const ownerPrice = beforePrice + 11;
        const c1 = await updateListingDetails({ listingId: draftId, actorUid: ownerUid, patch: { price: ownerPrice } });
        const a1 = await readBack(draftId);
        const c1logs = await logCount(draftId);
        r.C1 = { ok: c1.ok, price: a1?.price, logs: c1logs };
        ck.t('C1', `① 本人编辑 ⇒ 200、库内 price ${beforePrice} → ${a1?.price}、**台账 0 行**(\`$11=false\` 分支不触台账 ⇒ 与 0058 逐字同行为）`,
          c1.ok && Number(a1?.price) === ownerPrice && c1logs === 0,
          JSON.stringify(r.C1));

        // ---- ② 管理员编辑他人：200、库内变、台账**恰 1 行**、changed_fields 逐项对拍
        const adminDesc = `P59 管理员代编描述 ${RUN}`;
        const adminPrice = ownerPrice + 23;
        const c2 = await updateListingDetails({
          listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never,
          patch: { description: adminDesc, price: adminPrice, itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew' },
        });
        const a2 = await readBack(draftId);
        const l2 = await logs(draftId);
        const expectChanged = ['description', 'price', 'item_type', 'item_condition'];
        r.C2 = { ok: c2.ok, db: { price: a2?.price, description: a2?.description, item_type: a2?.item_type, item_condition: a2?.item_condition }, logs: l2 };
        ck.t('C2', `② 管理员（manage_rewards，非 is_admin）编**他人**商品 ⇒ 200、库内四字段全变、台账**恰 1 行**（actor_uid=${adminUid} · owner_uid=${ownerUid} · admin_edit=true · changed_fields 逐项 = ${JSON.stringify(expectChanged)}）`,
          c2.ok
            && Number(a2?.price) === adminPrice && String(a2?.description) === adminDesc
            && a2?.item_type === 'PhysicalFreeShip' && a2?.item_condition === 'LikeNew'
            && l2.length === 1
            && Number(l2[0].actor_uid) === adminUid && Number(l2[0].owner_uid) === ownerUid
            && l2[0].admin_edit === true
            && JSON.stringify(l2[0].changed_fields) === JSON.stringify(expectChanged)
            && !!l2[0].time_created,
          JSON.stringify(r.C2));

        // ---- ②′ 同值重投 ⇒ changed_fields = []（「实际变化」口径，不是「提交字段」口径）
        const c2b = await updateListingDetails({
          listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never,
          patch: { description: adminDesc, price: adminPrice, itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew' },
        });
        const l2b = await logs(draftId);
        r.C2b = { ok: c2b.ok, logs: l2b.length, last_changed: l2b[l2b.length - 1]?.changed_fields };
        ck.t('C2b', '②′ 管理员**同值重投** ⇒ 200、台账再加 1 行（共 2 行）但该行 `changed_fields = []`（台账记「实际变化」而非「提交字段」）',
          c2b.ok && l2b.length === 2 && JSON.stringify(l2b[1].changed_fields) === JSON.stringify([]),
          JSON.stringify(r.C2b));

        // ---- ③ 普通用户编他人：403 ACTOR_NOT_ALLOWED、零新台账
        const c3 = await updateListingDetails({ listingId: draftId, actorUid: strangerUid, patch: { price: 999 } });
        const a3 = await readBack(draftId);
        const c3logs = await logCount(draftId);
        r.C3 = { res: got(c3 as ErrLike), logs: c3logs, price: a3?.price };
        ck.t('C3', '③ 普通用户编他人 ⇒ 403 `AUTH_FORBIDDEN` + `reason=ACTOR_NOT_ALLOWED`、库内 price 未变、台账仍 2 行（零新增）',
          !c3.ok && c3.status === 403 && c3.code === 'AUTH_FORBIDDEN'
            && c3.details?.reason === 'ACTOR_NOT_ALLOWED' && c3.details?.ref_type === 'listing'
            && Number(a3?.price) === adminPrice && c3logs === 2,
          JSON.stringify(r.C3));

        // ---- ④ 管理员仍受字段校验（非法 price / 数字商品带成色 ⇒ 400，零写零台账）
        const c4a = await updateListingDetails({ listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never, patch: { price: 0 } });
        const c4b = await updateListingDetails({ listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never, patch: { itemType: 'DigitalAutoDeliver', itemCondition: 'LikeNew' } });
        const a4 = await readBack(draftId);
        const c4logs = await logCount(draftId);
        r.C4 = { zero_price: got(c4a as ErrLike), digital_condition: got(c4b as ErrLike), logs: c4logs, price: a4?.price, type: a4?.item_type };
        ck.t('C4', '④ 管理员**不放宽**字段校验：`price=0` ⇒ 400 `LEDGER_AMOUNT_NOT_POSITIVE`；数字商品带成色 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`；两者**零写零台账**',
          !c4a.ok && c4a.status === 400 && /LEDGER_AMOUNT/.test(String(c4a.code))
            && !c4b.ok && c4b.status === 400 && String(c4b.details?.reason) === 'ITEM_CONDITION_NOT_APPLICABLE'
            && Number(a4?.price) === adminPrice && a4?.item_type === 'PhysicalFreeShip' && c4logs === 2,
          JSON.stringify(r.C4));

        // ---- ⑤ 管理员旗标 ∧ **自己**的商品 ⇒ 200 且零台账（本人臂优先）
        const c5 = await updateListingDetails({ listingId: draftId, actorUid: ownerUid, adminAccess: ADMIN_ACCESS as never, patch: { price: adminPrice + 1 } });
        const c5logs = await logCount(draftId);
        r.C5 = { ok: c5.ok, logs: c5logs };
        ck.t('C5', '⑤ 本人（即便持管理员旗标）编辑自己的商品 ⇒ 200 且**台账 0 新增**（本人臂不写台账 ⇒ 审计面只记「代编」）',
          c5.ok && c5logs === 2, JSON.stringify(r.C5));

        // ---- ⑥ delisted 终态：管理员亦 409（状态机不被管理员绕过）
        if (delisted) {
          const c6 = await updateListingDetails({
            listingId: Number(delisted.listing_id), actorUid: adminUid, adminAccess: ADMIN_ACCESS as never, patch: { price: 5 },
          });
          const c6logs = await logCount(Number(delisted.listing_id));
          r.C6 = { res: got(c6 as ErrLike), logs: c6logs, id: delisted.listing_id };
          ck.t('C6', `⑥ 管理员编 **delisted 终态**商品（listing ${delisted.listing_id}）⇒ 409 \`LISTING_STATE_INVALID\`、台账 0 行（状态机与只读面不被管理员绕过）`,
            !c6.ok && c6.status === 409 && String(c6.details?.reason) === 'LISTING_STATE_INVALID' && c6logs === 0,
            JSON.stringify(r.C6));
        } else {
          ck.t('C6', '⑥ delisted 夹具缺失 ⇒ 未测', false, 'fixture_missing');
        }

        // ---- D · 读口真库四臂（11 键同族）
        // ★ 事务内注入 `ex`（同 tx 才看得见 0060 两列；事务间不可见是 MVCC 预期行为）
        const mineRows = await DatabaseService.listListingsBySeller(ownerUid, 0, 1, c);
        const mineKeys = mineRows.length ? Object.keys(mineRows[0]).sort() : [];
        const dOwner = await getListingEditView({ listingId: draftId, actorUid: ownerUid });
        const dAdmin = await getListingEditView({ listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never });
        const dStranger = await getListingEditView({ listingId: draftId, actorUid: strangerUid });
        const dMissing = await getListingEditView({ listingId: 999999999, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never });
        r.D = {
          owner: dOwner.ok ? Object.keys(dOwner.view).sort() : null,
          admin: dAdmin.ok ? Object.keys(dAdmin.view).sort() : null,
          stranger: got(dStranger as ErrLike), missing: got(dMissing as ErrLike), mine: mineKeys,
        };
        ck.t('D1', '读口真库：本人 200 / 管理员 200 / 普通用户 403 `ACTOR_NOT_ALLOWED` / 不存在 404 `LEDGER_REF_NOT_FOUND`',
          dOwner.ok && dAdmin.ok
            && !dStranger.ok && dStranger.status === 403 && dStranger.details?.reason === 'ACTOR_NOT_ALLOWED'
            && !dMissing.ok && dMissing.status === 404 && dMissing.code === 'LEDGER_REF_NOT_FOUND',
          JSON.stringify(r.D));
        ck.t('D2', '读口行**与 `GET /api/listing/mine` 行逐键同族 14 键**（11 + 0060 的 `item_code` / `snowflake_id` + 0061 的 `allow_multi_buy`；本人臂 / 管理员臂同一形状 ⇒ 编辑页一套预填）· `seller_uid` 不下发',
          mineKeys.length === 14
            && JSON.stringify(mineKeys) === JSON.stringify(['allow_multi_buy', 'cid', 'condition', 'description', 'item_code', 'item_type', 'listing_id', 'media_urls', 'price', 'snowflake_id', 'status', 'stock', 'time_created', 'title'])
            && dOwner.ok && JSON.stringify(Object.keys(dOwner.view).sort()) === JSON.stringify(mineKeys)
            && dAdmin.ok && JSON.stringify(Object.keys(dAdmin.view).sort()) === JSON.stringify(mineKeys)
            && dOwner.ok && !('seller_uid' in dOwner.view) && dAdmin.ok && !('seller_uid' in dAdmin.view),
          JSON.stringify({ mine: mineKeys, owner: dOwner.ok ? Object.keys(dOwner.view).length : null, admin: dAdmin.ok ? Object.keys(dAdmin.view).length : null }));

        // ---- D4 · 读口**零副作用**（不 +1 浏览 / 不写台账 / 不触译文）
        const vcBefore = await raw1<{ v: string }>(c,
          'SELECT view_count::text AS v FROM public.listing WHERE listing_id = $1::bigint', [draftId]);
        const logsBeforeRead = await logCount(draftId);
        await getListingEditView({ listingId: draftId, actorUid: ownerUid });
        await getListingEditView({ listingId: draftId, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never });
        await getListingEditView({ listingId: draftId, actorUid: strangerUid });
        await getListingEditView({ listingId: 999999999, actorUid: adminUid, adminAccess: ADMIN_ACCESS as never });
        const vcAfter = await raw1<{ v: string }>(c,
          'SELECT view_count::text AS v FROM public.listing WHERE listing_id = $1::bigint', [draftId]);
        const logsAfterRead = await logCount(draftId);
        r.D4 = { view_count_before: vcBefore?.v, view_count_after: vcAfter?.v, logs_before: logsBeforeRead, logs_after: logsAfterRead };
        ck.t('D4', '读口**零副作用**：四次调用（本人 / 管理员 / 普通用户 403 / 不存在 404）后 `listing.view_count` 逐字未变、`listing_edit_log` 行数未变（编辑预填不 +1 浏览、不写台账、不触译文）',
          vcBefore?.v === vcAfter?.v && logsBeforeRead === logsAfterRead,
          JSON.stringify(r.D4));

        // ---- 读口与写口库内读数一致（管理员读到的 = 代编后的真值）
        const a5 = await readBack(draftId);
        ck.t('D3', '读口读数 = 库内真值（管理员读到的 price/description 与 `readBack` 逐字一致 ⇒ 预填不会给出陈旧值）',
          dAdmin.ok
            && Number((dAdmin.view as Record<string, unknown>).price) === Number(a5?.price)
            && String((dAdmin.view as Record<string, unknown>).description) === String(a5?.description),
          JSON.stringify({ view_price: dAdmin.ok ? (dAdmin.view as Record<string, unknown>).price : null, db_price: a5?.price }));

        // ---- N · 负控（判负自证）
        const listedId = listed ? Number(listed.listing_id) : draftId;
        const listedOwner = listed ? Number(listed.seller_uid) : ownerUid;
        // $12 = `allow_multi_buy`（0061 第 12 参数位；null = 未传 ⇒ 语句走 W5 归一）
        const paramPack = (adminEdit: boolean) => [listedId, adminUid, null, 424242, null, null, null, false, null, false, adminEdit, null];
        const realAdmin = await raw1<Record<string, unknown>>(c, SQL_TEXT, paramPack(true));
        const noFlagAdmin = await raw1<Record<string, unknown>>(c, neutralizeAdminFlag(SQL_TEXT), paramPack(true));
        r.N1 = { real: realAdmin?.outcome, flag_removed: noFlagAdmin?.outcome, owner_uid: listedOwner };
        ck.t('N1', '★ **负控 ①**：把管理员放行位钉死（`NOT $11::boolean` → `NOT ($11::boolean AND false)`，参数位不动）⇒ 同一非本人管理员输入落 `not_owner` ⇒ **C2/D1 管理员臂必红**（放行判据非恒绿）',
          realAdmin?.outcome === 'updated' && noFlagAdmin?.outcome === 'not_owner', JSON.stringify(r.N1));

        const beforeNeg = await logCount(listedId);
        const auditRemoved = await raw1<Record<string, unknown>>(c, neutralizeAudit(SQL_TEXT), [listedId, adminUid, 'P59 neg-audit desc', null, null, null, null, false, null, false, true, null]);
        const afterNeg = await logCount(listedId);
        r.N2 = { outcome: auditRemoved?.outcome, logs_before: beforeNeg, logs_after: afterNeg };
        ck.t('N2', '★ **负控 ②**：把台账 INSERT 的取值条件中和（`WHERE $11::boolean` → `WHERE false`）⇒ 管理员仍 `updated` 但**台账行数不增** ⇒ **C2 的「恰 1 行」断言必红**（审计插入非摆设）',
          auditRemoved?.outcome === 'updated' && afterNeg === beforeNeg, JSON.stringify(r.N2));

        r.N3 = {
          admin_flag_mutation: neutralizeAdminFlag(SQL_TEXT) !== SQL_TEXT,
          audit_mutation: neutralizeAudit(SQL_TEXT) !== SQL_TEXT,
          audit_uses_seller_check: /u\.seller_uid <> \$2::bigint/.test(SQL_TEXT),
        };
        ck.t('N3', '负控 ③（静态）：两个摘除器**确实改变**语句文本（不空转 ⇒ N1/N2 不是在未变异的 SQL 上跑）；台账插入带 `seller_uid <> $2` 条件（本人编辑零行）',
          Object.values(r.N3 as Record<string, boolean>).every(Boolean), JSON.stringify(r.N3));

        return r;
      } finally {
        svcLive.updateListingDetailsRow = origLive;
        svcLive.getListingEditRow = origEditLive;
      }
    });
    await pool.end();
    live.result = probe.result;
    live.rolled_back = probe.rolled_back;
    live.error = probe.error ? String((probe.error as Error).message).slice(0, 400) : null;
    live.ms = probe.ms;
    ck.t('C-', '真库面跑完并**一律 ROLLBACK**（含事务内临时建表与全部 UPDATE/INSERT ⇒ 零残留）',
      probe.error === null && probe.rolled_back === true, `error=${live.error} rolled_back=${probe.rolled_back}`);
  } catch (e) {
    live.error = String((e as Error).message).slice(0, 400);
    ck.t('C-', '真库面（DB 不可达 ⇒ 未测）', false, `DB_ERR:${live.error}`);
  }

  // ===================================================== P · preflight（只读 · 不 apply）
  const pre: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const client = await pool.connect();
    try {
      const top = await raw1<{ version: string }>(client as never, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
      const pending = await raw<{ version: string }>(client as never,
        `SELECT v AS version FROM (VALUES ('0059'), ('0060'), ('0061')) AS t(v) WHERE v > $1::text ORDER BY v`, [top?.version ?? '']);
      const exists = await raw1<{ n: number }>(client as never,
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='listing_edit_log'");
      const counts = await raw1<Record<string, string>>(client as never,
        `SELECT count(*)::text AS total, count(*) FILTER (WHERE status='draft')::text AS draft,
                count(*) FILTER (WHERE status='listed')::text AS listed, count(*) FILTER (WHERE status='delisted')::text AS delisted
           FROM public.listing`);
      const migFilesAll = fs.readdirSync(path.join(REPO_BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
      const migTop = (migFilesAll[migFilesAll.length - 1] ?? '').slice(0, 4);
      pre.migration_chain_top = migTop;
      pre.max_applied = top?.version ?? null;
      pre.pending = pending.map((p) => p.version);
      pre.edit_log_exists = Number(exists?.n ?? 0) === 1;
      pre.listing_counts = counts;
      // 判据 = 「PENDING 恰为链上尚未 apply 的**后缀**」——dev 现态已全 apply（max=0061 ⇒ pending=[]）
      // 同样成立（post-apply 模式）；旧冻结「max=0059 ⇒ pending=[0060]」只是该不变式的一个时点特例。
      const maxApplied = String(pre.max_applied ?? '');
      const expectPending = (['0059', '0060', '0061'] as string[]).filter((v) => v > maxApplied);
      ck.t('P1', `preflight（只读·**不 apply**）：迁移**文件链顶** = ${migTop}（0059 admin-edit → 0060 商品统一 Id → 0061 多件购买授权列 → 0063/0064 project 域 → 0065 campaign 五表）· \`schema_migration\` 已应用顶 = **${maxApplied}** · PENDING(≥0059) = [${(pre.pending as string[]).join(',')}]（判据 = 链上尚未 apply 的后缀；dev 已全 apply ⇒ [] 同算过 = post-apply 模式）`,
        migTop === '0065'
          && ['0058', '0059', '0060', '0061'].includes(maxApplied)
          && JSON.stringify(pre.pending) === JSON.stringify(expectPending),
        JSON.stringify({ project: 'seafood', chain_top: migTop, max: maxApplied, pending: pre.pending, expect_pending: expectPending }));
      ck.t('P2', `preflight：\`listing_edit_log\` 存在 = ${pre.edit_log_exists}（false ⇒ 真库探针在事务内建表；true ⇒ 走已建表）· 存量 listing ${counts?.total} 行（draft ${counts?.draft} / listed ${counts?.listed} / delisted ${counts?.delisted}）`,
        Number(counts?.total ?? -1) > 0, JSON.stringify(pre));
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    pre.error = String((e as Error).message).slice(0, 200);
    ck.t('P1', 'preflight（DB 不可达 ⇒ 未测）', false, `DB_ERR:${pre.error}`);
  }

  out.migration = { file: 'backend-ts/migrations/0059_listing_edit_log.sql', head_stmts: MIG_HEAD_STMTS.length };
  out.sql = { bytes: SQL_TEXT.length, param_order: SQL_PARAM_ORDER };
  out.preflight = pre;
  out.live = live;
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p59b-admin-edit-gate', out);
  console.log(JSON.stringify({
    saved: f,
    summary: out.summary,
    preflight: { chain_top: pre.migration_chain_top, max: pre.max_applied, edit_log_exists: pre.edit_log_exists, pending: pre.pending },
    live: { rolled_back: live.rolled_back, error: live.error, ms: live.ms },
    red: (out.summary as { red: string[] }).red,
  }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
