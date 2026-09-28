/**
 * P3-P（平台配置柱 · `0017_platform_config.sql`）自用探针库 —— 只读为主 + 落 run-tagged 读数。
 *
 * 测试数据分区（**本单独占命名空间**，禁复用 9903xx/9904xx/9905xx/9906xx）：
 *   · uid 窗口 **9907xx**（990701..990704；`users.uid` identity 为 `BY DEFAULT` ⇒ 允许显式 uid）
 *   · `create_key` 前缀 **`cli:kong17-`**；角色键前缀 **`p3p:`**（本柱大多无 create_key ⇒ 用 uid 窗口 + 角色键前缀自证归属）
 *   · 运维键前缀 `ops:p3p:`
 * 只写本库；**不改** src / migrations（判负自证里迁移文件只被**读取**并复制到 scratch）/ docs。
 * 所有 SQL 显式限定 `public.`（DL151）。
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

export const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
export const RUN =
  process.env.P3P_RUN ||
  new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
export const OUT_DIR = path.resolve(__dirname, '..', '.p3p-artifacts');
export const REPO = path.resolve(__dirname, '..');
export const MIGRATION_FILE = path.resolve(REPO, 'migrations', '0017_platform_config.sql');

/** 命名空间常量（自证归属） */
export const NS_UID_MIN = 990700;
export const NS_UID_MAX = 990799;
export const NS_ROLE_PREFIX = 'p3p:';
export const NS_KEY_PREFIX = 'cli:kong17-';

export const mkPool = (max = 2, url = DIRECT_URL): Pool =>
  new Pool({ connectionString: url, max, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });

export const raw = async <R = Record<string, unknown>>(p: Pool, sql: string, params: unknown[] = []): Promise<R[]> =>
  (await p.query(sql, params as never[])).rows as R[];

/** 带 rowCount 的原始结果（无 RETURNING 的 DML 的 rows 为空 ⇒ 成败要看 rowCount） */
export const rawRes = async (
  p: Pool, sql: string, params: unknown[] = [],
): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> => {
  const r = await p.query(sql, params as never[]);
  const rc = (r as unknown as { rowCount?: number | null }).rowCount;
  return { rows: r.rows as Record<string, unknown>[], rowCount: typeof rc === 'number' ? rc : r.rows.length };
};

export const raw1 = async <R = Record<string, unknown>>(p: Pool, sql: string, params: unknown[] = []): Promise<R | null> =>
  (await raw<R>(p, sql, params))[0] ?? null;

export interface ErrInfo {
  sqlstate: string | null; message: string; detail: string; constraint: string | null;
  reason: string | null; field: string | null; detail_parsed: Record<string, unknown> | null;
}

export const errInfo = (e: unknown): ErrInfo => {
  const a = e as Record<string, unknown>;
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(String(a?.detail ?? '')) as Record<string, unknown>; } catch { /* noop */ }
  return {
    sqlstate: (a?.code as string) ?? null,
    message: String(a?.message ?? e).slice(0, 240),
    detail: String(a?.detail ?? '').slice(0, 600),
    constraint: (a?.constraint as string) ?? null,
    reason: (parsed?.reason as string) ?? null,
    field: (parsed?.field as string) ?? null,
    detail_parsed: parsed,
  };
};

export const sha256 = (s: string | Buffer): string => crypto.createHash('sha256').update(s as never).digest('hex');
export const md5 = (s: string | Buffer): string => crypto.createHash('md5').update(s as never).digest('hex');
export const sha256File = (f: string): string => sha256(fs.readFileSync(f));

/** 落 run-tagged 读数；**同名拒写**（DL121/DL149「永不写固定文件名」纪律） */
export const save = (label: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p3p-${RUN}-${label}.json`);
  if (fs.existsSync(file)) throw new Error(`refuse to overwrite artifact: ${file}`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, label, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

/** 校验本单命名空间：uid 窗口 / 角色键前缀 */
export const isOurUid = (v: unknown): boolean => {
  const n = Number(v);
  return Number.isFinite(n) && n >= NS_UID_MIN && n <= NS_UID_MAX;
};
export const isOurRole = (v: unknown): boolean => typeof v === 'string' && v.startsWith(NS_ROLE_PREFIX);

/** 断言容器 */
export interface Check { id: string; name: string; pass: boolean; readout: Record<string, unknown>; }
export const mkChecks = (): { add: (id: string, name: string, pass: boolean, readout?: Record<string, unknown>) => void; list: Check[] } => {
  const list: Check[] = [];
  return { list, add: (id, name, pass, readout = {}) => { list.push({ id, name, pass, readout }); } };
};

/** 跑一条「预期被 DB 拒」的语句，返回原始错误读数（纪律①：报「必抛」必须给原始读数） */
export const expectReject = async (
  p: Pool, sql: string, params: unknown[] = [],
): Promise<{ rejected: boolean; err: ErrInfo | null; rows: number; rowCount: number }> => {
  try {
    const r = await rawRes(p, sql, params);
    return { rejected: false, err: null, rows: r.rows.length, rowCount: r.rowCount };
  } catch (e) {
    return { rejected: true, err: errInfo(e), rows: 0, rowCount: 0 };
  }
};

/** 事务内语句（SAVEPOINT 隔离）：用于「同一事务内跑多路必拒用例再整体 ROLLBACK」⇒ 零残留 */
export const txn = {
  begin: (p: Pool) => raw(p, 'BEGIN'),
  commit: (p: Pool) => raw(p, 'COMMIT'),
  rollback: (p: Pool) => raw(p, 'ROLLBACK'),
  /** SAVEPOINT 包一条语句；失败只回滚到 savepoint（不毁整个事务） */
  try: async (p: Pool, sql: string, params: unknown[] = []): Promise<{ rejected: boolean; err: ErrInfo | null; rows: number; rowCount: number }> => {
    await raw(p, 'SAVEPOINT p3p_sp');
    try {
      const r = await rawRes(p, sql, params);
      await raw(p, 'RELEASE SAVEPOINT p3p_sp');
      return { rejected: false, err: null, rows: r.rows.length, rowCount: r.rowCount };
    } catch (e) {
      await raw(p, 'ROLLBACK TO SAVEPOINT p3p_sp');
      await raw(p, 'RELEASE SAVEPOINT p3p_sp');
      return { rejected: true, err: errInfo(e), rows: 0, rowCount: 0 };
    }
  },
};

/** 建夹具用户（uid 显式落在本单窗口 9907xx；uid 列 identity 为 BY DEFAULT） */
export const ensureUser = async (p: Pool, uid: number, tag: string): Promise<string> => {
  const evm = '0x' + sha256(`p3p-kong17-${tag}`).slice(0, 40);
  const cols = await raw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>(
    p,
    `SELECT column_name, is_nullable, column_default, data_type
       FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`,
  );
  const extra = cols.filter((c) =>
    c.is_nullable === 'NO' && c.column_default === null
    && c.column_name !== 'uid' && c.column_name !== 'evm');
  const names = ['uid', 'evm', ...extra.map((c) => c.column_name)];
  const params: unknown[] = [uid, evm, ...extra.map((c) => (/timestamp|date/.test(c.data_type) ? new Date() : ''))];
  const ph = names.map((_, i) => `$${i + 1}`).join(',');
  try {
    await raw(p, `INSERT INTO public.users (${names.join(',')}) VALUES (${ph}) ON CONFLICT DO NOTHING`, params);
  } catch (e) {
    if (errInfo(e).sqlstate !== '23505') throw e;
  }
  const got = await raw1<{ uid: string }>(p, 'SELECT uid::text AS uid FROM public.users WHERE uid = $1::bigint', [uid]);
  if (!got) throw new Error(`ensureUser failed for uid ${uid}`);
  return got.uid;
};

/** 本单命名空间外的残留行读数（判负自证「恢复前」必须为 []，否则立停上报） */
export const foreignRows = async (p: Pool): Promise<Record<string, unknown>> => {
  const a = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.admin_user_role WHERE NOT (uid BETWEEN $1 AND $2) OR role_key NOT LIKE $3`, [NS_UID_MIN, NS_UID_MAX, `${NS_ROLE_PREFIX}%`]);
  const b = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.admin_role WHERE role_key NOT LIKE $1`, [`${NS_ROLE_PREFIX}%`]);
  const c = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.app_config WHERE key NOT LIKE $1`, [`${NS_KEY_PREFIX}%`]);
  const d = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE NOT (actor_uid BETWEEN $1 AND $2)`, [NS_UID_MIN, NS_UID_MAX]);
  return {
    admin_user_role_foreign: a?.n, admin_role_foreign: b?.n, app_config_foreign: c?.n, currency_status_log_foreign: d?.n,
    all_empty: a?.n === '0' && b?.n === '0' && c?.n === '0' && d?.n === '0',
  };
};
