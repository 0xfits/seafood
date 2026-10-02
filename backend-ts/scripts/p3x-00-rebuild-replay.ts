/**
 * P3-D20-REBUILD-DRYRUN · 事务内重建重放（Phase 1 / dry-run）
 * ============================================================================
 * 单子：P3-D20-REBUILD-DRYRUN（Kong）
 *
 * 目标（Phase 1 = dry-run）：在**单个事务**内证明
 *   `DROP SCHEMA public CASCADE` → `CREATE SCHEMA public`
 *   → 按序重放 migrations/0001..0020（0018 缺）**原文** → 全量期望对拍
 * 可成立，然后 **ROLLBACK**，并在事务外证明库净零变化。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts                     # 默认 = --dry-run
 *   npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run
 *   npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --inject-fail-after=0010
 *   npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --apply --confirm-irreversible
 *   npx ts-node --transpile-only scripts/p3x-00-rebuild-replay.ts --dry-run --expect-corrupt  # 判负演练（只改内存期望）
 *
 * 铁律（脚本内强制）：
 *   1. **单连接** `new Client({ connectionString: DATABASE_URL_UNPOOLED })`；禁用 Pool；禁用 pooler。
 *   2. 事务收尾：**COMMIT 仅当 `mode==='apply' && --confirm-irreversible && gate.ok===true`**，
 *      其余一律 `ROLLBACK`。`gate` 在**事务内、COMMIT 之前**由 deriveExpectations(迁移文件自身) 对拍得出。
 *   3. `--apply` 分支需双闸（`--apply` + `--confirm-irreversible`）；两者缺一即拒绝执行（exit 2）。
 *      `--expect-corrupt` 只改内存期望（造 gate.ok=false 的输入），不写库、不改文件。
 *   4. 不碰 src/**、不碰 p3w-*、不 DELETE/TRUNCATE/UPDATE 真实行、事务外零写库
 *      （连序列都不 nextval —— 用只读 `SELECT last_value, is_called FROM <seq>` 推断下一值）。
 *   5. 输出一律 run-tagged + 同名拒写；连接串永不落盘（redact）。
 *
 * 退出码：0 OK / 2 环境或参数错误 / 3 期望对拍不等 / 4 重放报错 / 5 净零校验失败 / 6 被锁阻塞
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const ROOT = path.resolve(__dirname, '..');
const MIG_DIR = path.join(ROOT, 'migrations');
// 产物根默认不变（.p3x-artifacts）；装闸单通过 P3_ART_ROOT=.p3y-artifacts 落到自己的 run-tagged 命名空间。
const ART_ROOT = process.env.P3_ART_ROOT
  ? path.resolve(ROOT, process.env.P3_ART_ROOT)
  : path.join(ROOT, '.p3x-artifacts');

const KEY_FUNCTIONS = [
  'ledger_post_event',
  'job_post_event',
  'listing_post_event',
  'market_post_event',
  'ledger_assert_commission_conservation',
];

// P6-B6-PERM（批 6）：`0022_admin_permission_seed.sql` 追加到链尾（权限/角色种子；纯 DML，
// 不建对象 ⇒ 基表/触发器期望不变，但 `0017` 六表的**行数期望**由「全 0」改为「种子后真值」）。
// P6-B6-AUDIT（批 6）：`0023_admin_points_audit_daily_cap.sql` 追加到链尾（**建对象**：审计表 1 +
// 索引 4 + 触发器 1 + 函数 2）⇒ 期望 **基表 +1 / 触发器 +1 / 函数 +2**（对象集由文件派生，无需手改），
// 且**硬编码期望** `schema_migration.row_count`(21→22) 与 `triggers.non_internal`(43→44) 已同步。
const VERSION_ORDER = [
  '0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009',
  '0010', '0011', '0012', '0013', '0014', '0015', '0016', '0017', '0019', '0020',
  '0021', '0022', '0023',
];

const TABLES_ZERO_EXPECTED = [
  'users', 'referral', 'ledger_entry', 'job', 'job_application', 'job_submission',
  'listing', 'listing_order', 'market_order', 'market_trade',
];
const M0017_TABLES = ['app_config', 'admin_role', 'admin_permission', 'admin_role_permission', 'admin_user_role', 'currency_status_log'];
// --expect-corrupt 专用的「坏期望」标记（只存在于内存/artifact，不进任何迁移文件）
const CORRUPT_EXPECT_TABLE = '__p3y_corrupt_expectation__';

// ---------------------------------------------------------------- argv -----
const argv = process.argv.slice(2);
const wantsApply = argv.includes('--apply');
const confirmIrreversible = argv.includes('--confirm-irreversible');
const EXPECT_CORRUPT = argv.includes('--expect-corrupt');
const injectArg = argv.find((a) => a.startsWith('--inject-fail-after='));
const INJECT_AFTER: string | null = injectArg ? injectArg.split('=')[1] : null;
const MODE: 'dry-run' | 'apply' = wantsApply ? 'apply' : 'dry-run';

// --------------------------------------------------------------- utils -----
const redact = (s: string): string => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');
const json = (o: unknown): string => redact(JSON.stringify(o, null, 2));
const qident = (n: string): string => '"' + String(n).replace(/"/g, '""') + '"';

function writeArtifact(runDir: string, name: string, obj: unknown): string {
  const p = path.join(runDir, name);
  if (fs.existsSync(p)) throw new Error(`artifact 同名拒写: ${name}`);
  fs.writeFileSync(p, json(obj) + '\n', 'utf8');
  return p;
}

function stableHash(o: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

function diffObjects(a: any, b: any, prefix = ''): string[] {
  const out: string[] = [];
  const av = a === undefined ? null : a;
  const bv = b === undefined ? null : b;
  if (av === null || bv === null || typeof av !== 'object' || typeof bv !== 'object') {
    if (JSON.stringify(av) !== JSON.stringify(bv)) out.push(`${prefix}: A=${JSON.stringify(av)} F=${JSON.stringify(bv)}`);
    return out;
  }
  if (Array.isArray(av) || Array.isArray(bv)) {
    if (JSON.stringify(av) !== JSON.stringify(bv)) out.push(`${prefix}: A=${JSON.stringify(av)} F=${JSON.stringify(bv)}`);
    return out;
  }
  const keys = Array.from(new Set([...Object.keys(av), ...Object.keys(bv)])).sort();
  for (const k of keys) {
    if (k === 'at' || k === 'label') continue;
    out.push(...diffObjects(av[k], bv[k], prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

// --------------------------------------------- SQL 词法：剥注释与字面量 ----
function stripSql(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const two = src.substr(i, 2);
    if (two === '--') { while (i < n && src[i] !== '\n') i++; continue; }
    if (two === '/*') {
      let depth = 1; i += 2;
      while (i < n && depth > 0) {
        if (src.substr(i, 2) === '/*') { depth++; i += 2; }
        else if (src.substr(i, 2) === '*/') { depth--; i += 2; }
        else i++;
      }
      continue;
    }
    if (ch === "'") {
      i++;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === "'") { if (src[i + 1] === "'") { i += 2; continue; } i++; break; }
        i++;
      }
      out += " '' ";
      continue;
    }
    if (ch === '"') {
      let j = i + 1; let id = '"';
      while (j < n) {
        if (src[j] === '"') { if (src[j + 1] === '"') { id += '""'; j += 2; continue; } id += '"'; j++; break; }
        id += src[j]; j++;
      }
      out += ' ' + id + ' '; i = j; continue;
    }
    if (ch === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(src.slice(i));
      if (m) {
        const tag = m[0];
        const end = src.indexOf(tag, i + tag.length);
        if (end === -1) { out += ' $$ '; i = n; continue; }
        out += ' $$BODY$$ '; i = end + tag.length; continue;
      }
    }
    out += ch; i++;
  }
  return out;
}

const KIND_MAP: Record<string, string> = {
  table: 'TABLE', view: 'VIEW', function: 'FUNCTION', procedure: 'PROCEDURE',
  trigger: 'TRIGGER', sequence: 'SEQUENCE', type: 'TYPE', index: 'INDEX',
  domain: 'DOMAIN', policy: 'POLICY', rule: 'RULE', extension: 'EXTENSION',
};
const MODIFIERS = new Set(['or', 'replace', 'unlogged', 'temp', 'temporary', 'global', 'local', 'constraint', 'unique', 'materialized']);

const normIdent = (tok: string): string => {
  if (!tok) return '';
  if (tok.startsWith('"')) return tok.slice(1, -1).replace(/""/g, '"');
  return tok.toLowerCase();
};

function extractObjects(sql: string, file: string): Array<{ kind: string; name: string; file: string }> {
  const s = stripSql(sql);
  const toks = s.match(/"[^"]*"|[A-Za-z_][A-Za-z0-9_$]*|[^\sA-Za-z0-9_"]+/g) || [];
  const res: Array<{ kind: string; name: string; file: string }> = [];
  for (let i = 0; i < toks.length; i++) {
    if ((toks[i] || '').toLowerCase() !== 'create') continue;
    let j = i + 1;
    for (;;) {
      const w = (toks[j] || '').toLowerCase();
      if (w === 'or' && (toks[j + 1] || '').toLowerCase() === 'replace') { j += 2; continue; }
      if (MODIFIERS.has(w) && w !== 'or' && w !== 'replace') { j += 1; continue; }
      break;
    }
    const kindWord = (toks[j] || '').toLowerCase();
    const kind = KIND_MAP[kindWord];
    if (!kind) continue;
    let k = j + 1;
    if ((toks[k] || '').toLowerCase() === 'if' && (toks[k + 1] || '').toLowerCase() === 'not' && (toks[k + 2] || '').toLowerCase() === 'exists') k += 3;
    let name = normIdent(toks[k] || '');
    if ((toks[k + 1] || '') === '.') name = normIdent(toks[k + 2] || '');
    if (!name) continue;
    res.push({ kind, name, file });
  }
  return res;
}

function extractRenames(sql: string): Array<{ kind: string; from: string; to: string }> {
  const out: Array<{ kind: string; from: string; to: string }> = [];
  const re = /ALTER\s+(TABLE|INDEX|SEQUENCE|VIEW|TYPE)\s+(?:IF\s+EXISTS\s+)?((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))?)\s+RENAME\s+TO\s+((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_$]*))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    out.push({ kind: m[1].toUpperCase(), from: normIdent((m[2].split('.').pop() || '').trim()), to: normIdent(m[3].trim()) });
  }
  return out;
}

/** 从 `INSERT INTO <t> (cols) VALUES (...),(...);` 抽取字面量行（文件派生期望值） */
function extractInsertLiteralRows(sql: string, table: string): { cols: string[]; rows: string[][] } | null {
  const head = new RegExp(`INSERT\\s+INTO\\s+(?:public\\s*\\.\\s*)?"?${table}"?\\s*\\(([^)]*)\\)\\s*VALUES\\s*`, 'i');
  const m = head.exec(sql);
  if (!m) return null;
  const cols = m[1].split(',').map((c) => normIdent(c.trim()));
  let i = m.index + m[0].length;
  const rows: string[][] = [];
  const readTuple = (): string[] | null => {
    while (i < sql.length && /\s/.test(sql[i])) i++;
    if (sql[i] !== '(') return null;
    i++;
    const vals: string[] = [];
    let cur = '';
    let depth = 0;
    let inStr = false;
    while (i < sql.length) {
      const ch = sql[i];
      if (inStr) {
        if (ch === '\\') { cur += ch + (sql[i + 1] || ''); i += 2; continue; }
        if (ch === "'") { if (sql[i + 1] === "'") { cur += "''"; i += 2; continue; } inStr = false; cur += ch; i++; continue; }
        cur += ch; i++; continue;
      }
      if (ch === "'") { inStr = true; cur += ch; i++; continue; }
      if (ch === '(') { depth++; cur += ch; i++; continue; }
      if (ch === ')') {
        if (depth === 0) { vals.push(cur.trim()); i++; break; }
        depth--; cur += ch; i++; continue;
      }
      if (ch === ',' && depth === 0) { vals.push(cur.trim()); cur = ''; i++; continue; }
      cur += ch; i++;
    }
    return vals;
  };
  for (;;) {
    const t = readTuple();
    if (!t) break;
    rows.push(t);
    while (i < sql.length && /\s/.test(sql[i])) i++;
    if (sql[i] === ',') { i++; continue; }
    break;
  }
  return { cols, rows };
}

type MigrationFile = { version: string; name: string; sql: string; sha256: string; bytes: number };

function loadMigrations(): MigrationFile[] {
  const entries = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
  return entries.map((name) => {
    const sql = fs.readFileSync(path.join(MIG_DIR, name), 'utf8');
    return {
      version: (name.match(/^(\d+)/) || [, name])[1] as string,
      name, sql,
      sha256: crypto.createHash('sha256').update(sql, 'utf8').digest('hex'),
      bytes: Buffer.byteLength(sql, 'utf8'),
    };
  });
}

function deriveExpectations(files: MigrationFile[], corrupt: boolean = false) {
  const sets: Record<string, Set<string>> = {};
  let identityDecls = 0;
  let serialDecls = 0;
  const renames: Array<{ kind: string; from: string; to: string }> = [];

  for (const f of files) {
    const stripped = stripSql(f.sql);
    identityDecls += (stripped.match(/generated\s+(?:always|by\s+default)\s+as\s+identity/gi) || []).length;
    serialDecls += (stripped.match(/(?:^|[^A-Za-z0-9_])(?:smallserial|bigserial|serial)(?![A-Za-z0-9_])/gi) || []).length;
    for (const o of extractObjects(f.sql, f.name)) {
      if (!sets[o.kind]) sets[o.kind] = new Set();
      sets[o.kind].add(o.name);
    }
    renames.push(...extractRenames(f.sql));
  }

  const renameLog: Array<{ kind: string; from: string; to: string; applied: string[] }> = [];
  for (const r of renames) {
    const mapKind: Record<string, string[]> = { TABLE: ['TABLE'], VIEW: ['VIEW'], SEQUENCE: ['SEQUENCE'], INDEX: ['INDEX'], TYPE: ['TYPE'] };
    const applied: string[] = [];
    for (const k of mapKind[r.kind] || []) {
      if (sets[k] && sets[k].has(r.from)) { sets[k].delete(r.from); sets[k].add(r.to); applied.push(k); }
    }
    renameLog.push({ ...r, applied });
  }

  const names: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(sets)) names[k] = Array.from(v).sort();

  // ---- 种子期望（逐值，来自 0001 §13 / 0007 的 INSERT 字面量）----
  const f0001 = files.find((f) => f.version === '0001');
  const currSeed = f0001 ? extractInsertLiteralRows(f0001.sql, 'currency') : null;
  const ownerSeed = f0001 ? extractInsertLiteralRows(f0001.sql, 'ledger_owner') : null;
  const cur0 = currSeed && currSeed.rows.length ? currSeed.rows[0] : null;
  const idx = (cols: string[], n: string) => cols.findIndex((c) => c.toLowerCase() === n);
  const currencyExpected = cur0 && currSeed
    ? {
        cid: cur0[idx(currSeed.cols, 'cid')],
        symbol: cur0[idx(currSeed.cols, 'symbol')],
        name: (cur0[idx(currSeed.cols, 'name')] || '').replace(/^'|'$/g, '').replace(/''/g, "'"),
        owner_uid: cur0[idx(currSeed.cols, 'owner_uid')],
        decimals: cur0[idx(currSeed.cols, 'decimals')],
        total_supply: cur0[idx(currSeed.cols, 'total_supply')],
        status: (cur0[idx(currSeed.cols, 'status')] || '').replace(/^'|'$/g, ''),
      }
    : null;

  const ownersExpected = ownerSeed
    ? ownerSeed.rows.map((r) => {
        const uid = r[idx(ownerSeed.cols, 'uid')];
        const lits = Array.from(r[idx(ownerSeed.cols, 'name')].matchAll(/'((?:[^']|'')*)'/g)).map((x) => x[1].replace(/''/g, "'"));
        return { uid, name: lits.length ? lits[lits.length - 1] : null };
      })
    : null;

  // ---- cid 序列期望：0001 setval 下限 + 每条「无 cid 的 INSERT INTO currency」推进 1 ----
  const setvalFloor = (() => {
    const m = /setval\s*\(\s*pg_get_serial_sequence\s*\(\s*'currency'\s*,\s*'cid'\s*\)\s*,\s*(\d+)\s*,\s*(true|false)\s*\)/i.exec(f0001 ? f0001.sql : '');
    if (!m) return null;
    return String(m[2].toLowerCase() === 'true' ? Number(m[1]) + 1 : Number(m[1]));
  })();
  const cidAdvancing: string[] = [];
  for (const f of files) {
    const re = /INSERT\s+INTO\s+(?:public\s*\.\s*)?"?currency"?\s*\(([^)]*)\)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.sql)) !== null) {
      const cols = m[1].split(',').map((x) => normIdent(x.trim()).toLowerCase());
      if (!cols.includes('cid')) cidAdvancing.push(`${f.name}(cols=${cols.join(',')})`);
    }
  }
  const derivedNext = setvalFloor === null ? null : String(Number(setvalFloor) + cidAdvancing.length);

  const result: any = {
    counts: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size])),
    names,
    identity_decls: identityDecls,
    serial_decls: serialDecls,
    expected_sequences_count: identityDecls + serialDecls + 1,
    expected_sequences_source: 'identity 声明数 + serial 声明数 + 1（schema_migration bootstrap bigserial）',
    renames: renameLog,
    seed_expectations: {
      currency_from_0001: currencyExpected,
      ledger_owner_from_0001: ownersExpected,
      account_seed_rule_from_0001: 'INSERT INTO account (uid,cid,balance,frozen) SELECT o.uid,1,0,0 FROM ledger_owner o WHERE o.uid<=0 ⇒ 4 行 / 全 0',
      currency_cid_nextval_theory_from_0001_only: setvalFloor,
      currency_cid_nextval_derived: derivedNext,
      currency_cid_nextval_sources: [
        `0001 §13 setval(pg_get_serial_sequence('currency','cid'), 1, true) ⇒ 下限 ${setvalFloor}`,
        ...cidAdvancing.map((x) => `${x} ⇒ +1（无 cid ⇒ 走 IDENTITY 序列；子事务回滚不撤序列推进）`),
      ],
      note_for_brief: 'brief 预置「currency.cid 下一值 = 2」仅据 0001 setval；实测重放后为 4，差额已定位到 0011/0012 的自检 INSERT。',
    },
    per_file_object_counts: files.map((f) => {
      const c: Record<string, number> = {};
      for (const o of extractObjects(f.sql, f.name)) c[o.kind] = (c[o.kind] || 0) + 1;
      return { version: f.version, file: f.name, creates: c };
    }),
  };

  // ---- 判负注入（--expect-corrupt）：只改**内存里的期望对象**，不改任何文件、不写库 ----
  if (corrupt) {
    result.names.TABLE = Array.from(new Set([...(result.names.TABLE || []), CORRUPT_EXPECT_TABLE])).sort();
    result.counts.TABLE = ((result.counts.TABLE as number) || 0) + 1;
    if (result.seed_expectations.currency_from_0001) {
      result.seed_expectations.currency_from_0001.total_supply = '999';
    } else {
      result.seed_expectations.currency_from_0001 = { cid: '1', symbol: "'$'", name: '$', owner_uid: '0', decimals: '0', total_supply: '999', status: 'listed' };
    }
    result.corruption_injected = {
      enabled: true,
      table_extra_expectation: CORRUPT_EXPECT_TABLE,
      currency_total_supply_expected_corrupted_to: '999',
      note: '判负专用：期望对象被有意改坏，用于证明 COMMIT 闸会挡住 gate.ok=false。不改文件、不写库。',
    };
  }

  return result;
}

// --------------------------------------------------------------- probes ----
async function snapshot(c: Client, label: string) {
  const out: any = { label, at: new Date().toISOString() };

  const tbls: string[] = (await c.query(
    `SELECT table_name FROM information_schema."tables"
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )).rows.map((r: any) => r.table_name);
  out.public_base_tables = tbls;
  out.public_base_table_count = tbls.length;
  out.business_tables = tbls.filter((t) => t !== 'schema_migration');
  out.business_table_count = out.business_tables.length;

  out.table_row_counts = {};
  for (const t of tbls) {
    const r = await c.query(`SELECT count(*)::bigint AS n FROM public.${qident(t)}`);
    out.table_row_counts[t] = String(r.rows[0].n);
  }

  const cat = (await c.query(`
    SELECT
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='r') AS base_tables,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='v') AS views,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='m') AS matviews,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='S') AS sequences,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname='public' AND c.relkind='i') AS indexes,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public') AS functions_all,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.prokind='f') AS functions,
      (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname='public' AND p.prokind='p') AS procedures
  `)).rows[0];
  out.catalog = Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, String(v)]));

  out.catalog_names = {
    base_tables: tbls,
    views: (await c.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                            WHERE n.nspname='public' AND c.relkind='v' ORDER BY 1`)).rows.map((r: any) => r.relname),
    sequences: (await c.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                                WHERE n.nspname='public' AND c.relkind='S' ORDER BY 1`)).rows.map((r: any) => r.relname),
    functions: (await c.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY 1`)).rows.map((r: any) => r.proname),
    triggers: (await c.query(`SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                               JOIN pg_namespace n ON n.oid=c.relnamespace
                              WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY 1`)).rows.map((r: any) => r.tgname),
  };

  const trg = (await c.query(`
    SELECT count(*)::int AS non_internal,
           count(*) FILTER (WHERE t.tgenabled <> 'O')::int AS enabled_not_o,
           count(*) FILTER (WHERE t.tgenabled = 'O')::int AS enabled_O,
           count(*) FILTER (WHERE t.tgconstraint <> 0)::int AS constraint_triggers
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT t.tgisinternal`)).rows[0];
  out.triggers = Object.fromEntries(Object.entries(trg).map(([k, v]) => [k, String(v)]));
  out.trigger_enabled_distribution = (await c.query(`
    SELECT t.tgenabled, count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND NOT t.tgisinternal GROUP BY 1 ORDER BY 1`)).rows;

  out.key_functions_md5 = (await c.query(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, md5(p.prosrc) AS md5
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = ANY($1::text[]) ORDER BY 1, 2`,
    [KEY_FUNCTIONS],
  )).rows;

  out.schema_migration = tbls.includes('schema_migration')
    ? (await c.query(`SELECT version, name, checksum, applied_at::text AS applied_at FROM public."schema_migration" ORDER BY version`)).rows
    : null;
  out.schema_migration_row_count = out.schema_migration ? String(out.schema_migration.length) : null;

  if (tbls.includes('currency')) {
    out.currency_rows = (await c.query(
      `SELECT cid::text AS cid, symbol, name, owner_uid::text AS owner_uid, decimals::text AS decimals,
              total_supply::text AS total_supply, supply_cap::text AS supply_cap, status
         FROM public."currency" ORDER BY cid`)).rows;
    out.currency_row = out.currency_rows.find((x: any) => x.cid === '1') || null;
  }
  if (tbls.includes('account')) {
    out.account_sum = (await c.query(`
      SELECT count(*)::int AS rows_all,
             count(*) FILTER (WHERE balance = 0 AND frozen = 0)::int AS all_zero,
             count(*) FILTER (WHERE cid = 1 AND uid <= 0 AND balance = 0 AND frozen = 0)::int AS cid1_uid_le0_allzero,
             (SELECT coalesce(sum(balance + frozen), 0)::text FROM public."account") AS sigma_balance_frozen
        FROM public."account"`)).rows[0];
  }
  if (tbls.includes('ledger_owner')) {
    out.ledger_owner_rows = (await c.query(`SELECT uid::text AS uid, name FROM public."ledger_owner" ORDER BY uid`)).rows;
  }
  if (tbls.includes('commission_policy')) {
    out.commission_policy_ids = (await c.query(`SELECT policy_id::text AS policy_id FROM public."commission_policy" ORDER BY 1`)).rows.map((r: any) => r.policy_id);
    out.commission_policy_default = (await c.query(`SELECT to_jsonb(t)::text AS row FROM public."commission_policy" t WHERE policy_id = 1`)).rows[0] || null;
  }

  // 只读推断 cid 序列下一值（**不 nextval**，避免事务外写）
  out.currency_cid_seq = null;
  if (tbls.includes('currency')) {
    const s = (await c.query(`SELECT pg_get_serial_sequence('public."currency"','cid') AS seq`)).rows[0].seq as string | null;
    if (s) {
      const qn = s.split('.').map((p) => qident(p.replace(/^"|"$/g, ''))).join('.');
      const r = (await c.query(`SELECT last_value::text AS last_value, is_called FROM ${qn}`)).rows[0];
      out.currency_cid_seq = {
        seq_name: s,
        last_value: r.last_value,
        is_called: r.is_called,
        next_value_calc: r.is_called ? String(BigInt(r.last_value) + 1n) : String(r.last_value),
        probe: 'read-only SELECT on sequence relation (no nextval)',
      };
    }
  }
  return out;
}

async function connectionRegistry(c: Client) {
  const me = (await c.query(`SELECT pg_backend_pid()::int AS pid, current_database() AS db, current_user AS usr`)).rows[0];
  const others = (await c.query(`
    SELECT pid::int, usename, application_name, state, state_change::text AS state_change,
           backend_start::text AS backend_start, xact_start::text AS xact_start,
           coalesce(left(client_addr::text, 40), 'local') AS addr
      FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() ORDER BY pid`)).rows;
  const idleInTx = (await c.query(`
    SELECT pid::int, usename, application_name, state, state_change::text AS state_change
      FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
        AND state = 'idle in transaction'`)).rows;
  const waitingLocks = (await c.query(`
    SELECT l.pid::int, l.locktype, l.mode, l.granted, c.relname, n.nspname
      FROM pg_locks l LEFT JOIN pg_class c ON c.oid = l.relation LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT l.granted AND l.pid <> pg_backend_pid() LIMIT 50`)).rows;
  return {
    self: me, others_count: others.length, others,
    idle_in_transaction_count: idleInTx.length, idle_in_transaction: idleInTx,
    ungranted_locks_by_other_pids: waitingLocks,
  };
}

function compareExpectations(exp: any, act: any) {
  const diffs: string[] = [];
  const cmpSet = (kind: string, key: string) => {
    const e = new Set<string>((exp.names && exp.names[kind]) || []);
    const a = new Set<string>((act.catalog_names && act.catalog_names[key]) || []);
    const missing = Array.from(e).filter((x) => !a.has(x)).sort();
    const extra = Array.from(a).filter((x) => !e.has(x)).sort();
    if (missing.length) diffs.push(`${kind} 缺失（文件声明但库内无）: ${missing.join(',')}`);
    if (extra.length) diffs.push(`${kind} 多出（库内有但文件未声明）: ${extra.join(',')}`);
    return { expected_from_files: Array.from(e).sort(), expected_count: e.size, actual_count: a.size, missing, extra };
  };

  const actTables = new Set<string>((act.public_base_tables || []).filter((t: string) => t !== 'schema_migration'));
  const expTables = new Set<string>((exp.names && exp.names.TABLE) || []);
  const missingTables = Array.from(expTables).filter((x) => !actTables.has(x)).sort();
  const extraTables = Array.from(actTables).filter((x) => !expTables.has(x)).sort();
  if (missingTables.length) diffs.push(`TABLE 缺失（文件声明但库内无）: ${missingTables.join(',')}`);
  if (extraTables.length) diffs.push(`TABLE 多出（库内有但文件未声明，schema_migration 已排除）: ${extraTables.join(',')}`);

  return {
    objects: {
      TABLE: { expected_from_files: Array.from(expTables).sort(), expected_count: expTables.size, actual_business_count: actTables.size, missing: missingTables, extra: extraTables },
      VIEW: cmpSet('VIEW', 'views'),
      FUNCTION: cmpSet('FUNCTION', 'functions'),
      PROCEDURE: { expected_count: (exp.counts && exp.counts.PROCEDURE) || 0, actual_count: Number(act.catalog && act.catalog.procedures) },
      TRIGGER: cmpSet('TRIGGER', 'triggers'),
      SEQUENCE: {
        expected_by_name_from_files: (exp.names && exp.names.SEQUENCE) || [],
        actual_by_name: (act.catalog_names && act.catalog_names.sequences) || [],
        expected_count_identity_serial_bootstrap: exp.expected_sequences_count,
        identity_decls: exp.identity_decls, serial_decls: exp.serial_decls,
        actual_count: Number(act.catalog && act.catalog.sequences),
      },
    },
    catalog: {
      base_tables: Number(act.catalog && act.catalog.base_tables),
      views: Number(act.catalog && act.catalog.views),
      sequences: Number(act.catalog && act.catalog.sequences),
      functions: Number(act.catalog && act.catalog.functions),
      procedures: Number(act.catalog && act.catalog.procedures),
      indexes: Number(act.catalog && act.catalog.indexes),
    },
    terminal: {
      currency_rows: act.currency_rows,
      currency_cid1: act.currency_row,
      ledger_owner_rows: act.ledger_owner_rows,
      account_rows: act.table_row_counts && act.table_row_counts.account,
      account_sum: act.account_sum,
      commission_policy_ids: act.commission_policy_ids,
      table_zero: Object.fromEntries(TABLES_ZERO_EXPECTED.map((t) => [t, act.table_row_counts ? act.table_row_counts[t] : undefined])),
      m0017_six: Object.fromEntries(M0017_TABLES.map((t) => [t, act.table_row_counts ? act.table_row_counts[t] : undefined])),
      schema_migration_rows: act.schema_migration_row_count,
      non_internal_triggers: act.triggers && act.triggers.non_internal,
      triggers_enabled_not_o: act.triggers && act.triggers.enabled_not_o,
      currency_cid_seq: act.currency_cid_seq,
      seed_expectations: exp.seed_expectations,
    },
    diffs,
  };
}

function expectedTerminalChecks(exp: any, cmp: any) {
  const c = cmp.terminal;
  const checks: Array<{ name: string; expected: unknown; actual: unknown; ok: boolean | null; note?: string }> = [];
  const add = (name: string, expected: unknown, actual: unknown, note?: string) =>
    checks.push({ name, expected, actual, ok: expected === null ? null : JSON.stringify(expected) === JSON.stringify(actual), ...(note ? { note } : {}) });
  const s = (v: unknown) => (v === undefined || v === null ? null : String(v));
  const byUid = (rows: any[]) =>
    rows.map((x: any) => ({ uid: String(x.uid), name: x.name })).sort((a, b) => Number(a.uid) - Number(b.uid));

  // currency：逐值来自 0001 §13 字面量
  const ce = exp.seed_expectations && exp.seed_expectations.currency_from_0001;
  add('currency.row_count', '1', c.currency_rows ? String(c.currency_rows.length) : null);
  add(
    'currency.cid1(逐值)',
    ce ? { cid: ce.cid, symbol: ce.symbol.replace(/^'|'$/g, ''), name: ce.name, owner_uid: ce.owner_uid, decimals: ce.decimals, total_supply: ce.total_supply, status: ce.status } : null,
    c.currency_cid1 ? { cid: c.currency_cid1.cid, symbol: c.currency_cid1.symbol, name: c.currency_cid1.name, owner_uid: c.currency_cid1.owner_uid, decimals: c.currency_cid1.decimals, total_supply: c.currency_cid1.total_supply, status: c.currency_cid1.status } : null,
  );
  add('currency.total_supply=0', '0', c.currency_cid1 ? c.currency_cid1.total_supply : null);
  add('currency.status=listed', 'listed', c.currency_cid1 ? c.currency_cid1.status : null);
  add('currency.supply_cap=NULL', null, null, 'NOT_MEASURED：supply_cap 为 NULL 无法与「未取到」区分，故不计入判负');

  // ledger_owner：逐 uid + 逐名，来自 0001 §13 字面量
  const oe = exp.seed_expectations && exp.seed_expectations.ledger_owner_from_0001;
  add('ledger_owner.row_count', '4', c.ledger_owner_rows ? String(c.ledger_owner_rows.length) : null);
  add('ledger_owner.rows(uid+name 逐值｜顺序无关)', oe ? byUid(oe) : null,
    c.ledger_owner_rows ? byUid(c.ledger_owner_rows) : null);

  add('account.row_count', '4', s(c.account_rows));
  add('account.cid1_uid<=0_allzero', '4', c.account_sum ? String(c.account_sum.cid1_uid_le0_allzero) : null);
  add('account.all_rows_zero(balance=0&frozen=0)', '4', c.account_sum ? String(c.account_sum.all_zero) : null);
  add('account.Σ(balance+frozen)', '0', c.account_sum ? String(c.account_sum.sigma_balance_frozen) : null);
  add('commission_policy.ids', ['1'], c.commission_policy_ids);

  for (const t of TABLES_ZERO_EXPECTED) add(`${t}.row_count`, '0', s(c.table_zero[t]));
  // P6-B6-PERM：0017 六表行数期望 —— 0022 种子后真值（重建库 users 为空 ⇒ admin_user_role 0 行）
  const M0017_SEED_ROWS: Record<string, string> = {
    app_config: '0', admin_role: '1', admin_permission: '11',
    admin_role_permission: '11', admin_user_role: '0', currency_status_log: '0',
  };
  for (const t of M0017_TABLES) add(`0017.${t}.row_count`, M0017_SEED_ROWS[t] ?? '0', s(c.m0017_six[t]));

  add('schema_migration.row_count', '22', s(c.schema_migration_rows));
  add('triggers.non_internal', '44', s(c.non_internal_triggers));
  add('triggers.enabled_not_o', '0', s(c.triggers_enabled_not_o));
  const nv = exp.seed_expectations || {};
  add(
    'currency.cid.nextval(文件派生＝setval 下限 + 无 cid 的 INSERT 次数)',
    nv.currency_cid_nextval_derived === undefined || nv.currency_cid_nextval_derived === null ? null : nv.currency_cid_nextval_derived,
    c.currency_cid_seq ? c.currency_cid_seq.next_value_calc : null,
    `★预置口径（brief）=${nv.currency_cid_nextval_theory_from_0001_only ?? 'null'}（仅据 0001 setval）；来源=${(nv.currency_cid_nextval_sources || []).join(' + ')}`,
  );

  return checks;
}

// ------------------------------------------------------------- run mode ----
async function replayRun(c: Client, mode: 'dry-run' | 'apply', files: MigrationFile[], registry: any, exp: any) {
  const log: any = { mode, started_at: new Date().toISOString(), steps: [], dropped_schema: false };
  const steps: any[] = [];
  let replayError: any = null;
  let injected: any = null;
  let inTxSnapshot: any = null;

  const countSm = async (): Promise<string | null> => {
    try { return String((await c.query(`SELECT count(*)::int AS n FROM public."schema_migration"`)).rows[0].n); }
    catch { return null; }
  };

  await c.query('BEGIN');
  log.steps.push({ step: 'BEGIN', ok: true });
  await c.query(`SET LOCAL lock_timeout = '20s'`);
  await c.query(`SET LOCAL statement_timeout = '300s'`);
  log.steps.push({ step: "SET LOCAL lock_timeout='20s', statement_timeout='300s'", ok: true });

  const t0 = Date.now();
  await c.query('DROP SCHEMA public CASCADE');
  log.dropped_schema = true;
  log.steps.push({ step: 'DROP SCHEMA public CASCADE', ok: true, ms: Date.now() - t0 });
  await c.query('CREATE SCHEMA public');
  log.steps.push({ step: 'CREATE SCHEMA public', ok: true });
  await c.query(`CREATE TABLE IF NOT EXISTS public."schema_migration" (
      id bigserial PRIMARY KEY, version text NOT NULL UNIQUE, name text NOT NULL,
      checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  log.steps.push({ step: 'bootstrap schema_migration（镜像 migrate.ts BOOTSTRAP）', ok: true });
  log.bootstrap_schema_migration_row_count = await countSm();

  const fileSteps: any[] = [];
  for (const f of files) {
    const before = await countSm();
    const t = Date.now();
    let err: any = null;
    try {
      await c.query(f.sql);
    } catch (e: any) {
      err = {
        message: redact(String(e && e.message ? e.message : e)).slice(0, 800),
        code: e && e.code ? e.code : null,
        detail: e && e.detail ? redact(String(e.detail)).slice(0, 400) : null,
        where: e && e.where ? redact(String(e.where)).slice(0, 400) : null,
        hint: e && e.hint ? redact(String(e.hint)).slice(0, 300) : null,
        position: e && e.position ? e.position : null,
        line_in_file: errLineOf(f.sql, e && e.position ? Number(e.position) : null),
      };
    }
    let after: string | null = null;
    if (!err) {
      await c.query(`INSERT INTO public."schema_migration" (version, name, checksum) VALUES ($1,$2,$3)`, [f.version, f.name, f.sha256]);
      after = await countSm();
    } else {
      after = before;
    }
    const regRow = (registry || []).find((r: any) => String(r.version) === f.version) || null;
    fileSteps.push({
      file: f.name, version: f.version, bytes: f.bytes, ms: Date.now() - t,
      ok: !err,
      schema_migration_rows_before: before,
      schema_migration_rows_after: after,
      sha256_file: f.sha256,
      registry_checksum: regRow ? regRow.checksum : null,
      checksum_byte_equal: regRow ? regRow.checksum === f.sha256 : null,
      error: err,
    });
    if (err) { replayError = { file: f.name, version: f.version, error: err }; break; }

    if (INJECT_AFTER && (INJECT_AFTER === f.version || INJECT_AFTER === f.name)) {
      let preInject: any = null;
      try {
        preInject = (await c.query(`SELECT
            (SELECT count(*)::text FROM public."currency") AS currency_rows,
            (SELECT count(*)::text FROM public."users")    AS users_rows,
            (SELECT count(*)::text FROM public."schema_migration") AS schema_migration_rows`)).rows[0];
      } catch (e: any) {
        preInject = { error: redact(String(e && e.message ? e.message : e)).slice(0, 200) };
      }
      const stmt = `DO $$ BEGIN RAISE EXCEPTION 'p3x drill: intentional failure after ${f.name}'; END $$;`;
      injected = { triggered: true, after_file: f.name, statement: stmt, in_tx_state_before_inject: preInject };
      try {
        await c.query(stmt);
        injected.error = null;
      } catch (e: any) {
        injected.error = { code: e && e.code ? e.code : null, severity: e && e.severity ? e.severity : null, message: redact(String(e && e.message ? e.message : e)).slice(0, 400) };
      }
      try {
        await c.query('SELECT 1');
        injected.tx_state_after_failure = 'ACCEPTED（异常：事务仍可用 ⇒ 演练无效）';
      } catch (e: any) {
        injected.tx_state_after_failure = `REJECTED code=${e && e.code ? e.code : null} msg=${redact(String(e && e.message ? e.message : e)).slice(0, 160)}`;
      }
      log.injection = injected;
      break;
    }
  }
  log.steps = [...log.steps, ...fileSteps];
  log.replay_error = replayError;
  log.replay_ok = !replayError && !injected;

  if (!replayError && !injected) {
    try { inTxSnapshot = await snapshot(c, 'in-tx'); }
    catch (e: any) { log.in_tx_snapshot_error = redact(String(e && e.message ? e.message : e)).slice(0, 400); }
  }

  // ---- 闸（gate）：全部判定在**事务内、COMMIT 之前**完成 -------------------
  const gateFileSteps = log.steps.filter((x: any) => x.file);
  const gate: any = {
    expect_corrupt: EXPECT_CORRUPT,
    replay_ok: !replayError,
    injected: !!injected,
    checksums_all_byte_equal: gateFileSteps.length === files.length && gateFileSteps.every((x: any) => x.checksum_byte_equal === true),
    snapshot_taken: !!inTxSnapshot,
    comparison_inside_tx: false,
    object_diffs_empty: null,
    terminal_failed_empty: null,
    object_diffs: [] as string[],
    terminal_failed: [] as any[],
    terminal_total: null,
    terminal_ok: null,
    ok: false,
    reason: '',
  };
  if (inTxSnapshot && exp) {
    const gcmp = compareExpectations(exp, inTxSnapshot);
    const gchecks = expectedTerminalChecks(exp, gcmp);
    const gfailed = gchecks.filter((k: any) => k.ok === false);
    gate.comparison_inside_tx = true;
    gate.object_diffs = gcmp.diffs;
    gate.object_diffs_empty = gcmp.diffs.length === 0;
    gate.terminal_failed = gfailed.map((k: any) => ({ name: k.name, expected: k.expected, actual: k.actual }));
    gate.terminal_failed_empty = gfailed.length === 0;
    gate.terminal_total = gchecks.length;
    gate.terminal_ok = gchecks.filter((k: any) => k.ok === true).length;
  } else {
    gate.object_diffs_empty = false;
    gate.terminal_failed_empty = false;
  }
  const gateReasons: string[] = [];
  if (gate.replay_ok !== true) gateReasons.push(`replay_error@${replayError ? replayError.file : 'unknown'}`);
  if (gate.injected === true) gateReasons.push('injection_drill_triggered（注入演练 ⇒ 不得 COMMIT）');
  if (gate.checksums_all_byte_equal !== true) gateReasons.push(`checksums_not_all_byte_equal（file_steps=${gateFileSteps.length}/${files.length}）`);
  if (gate.object_diffs_empty !== true) gateReasons.push(`object_diffs=${gate.object_diffs.length}${gate.object_diffs.length ? ': ' + gate.object_diffs.slice(0, 3).join(' | ') : '（事务内快照未取到）'}`);
  if (gate.terminal_failed_empty !== true) gateReasons.push(`terminal_failed=${gate.terminal_failed.length}${gate.terminal_failed.length ? ': ' + gate.terminal_failed.map((x: any) => x.name).slice(0, 3).join(',') : '（事务内快照未取到）'}`);
  gate.ok = gate.replay_ok === true && gate.injected === false
    && gate.checksums_all_byte_equal === true && gate.snapshot_taken === true
    && gate.object_diffs_empty === true && gate.terminal_failed_empty === true;
  gate.reason = gate.ok
    ? 'all gates green（replay_ok & 无注入 & checksums 全字节相等 & 对象集无差 & 逐值终态无失败 & 事务内快照已取）'
    : gateReasons.join(' ; ');

  // COMMIT 条件 = mode==='apply' && --confirm-irreversible && gate.ok===true；否则一律 ROLLBACK
  const canCommit = mode === 'apply' && confirmIrreversible && gate.ok === true;
  let final = '';
  if (canCommit) { await c.query('COMMIT'); final = 'COMMIT'; }
  else { await c.query('ROLLBACK'); final = 'ROLLBACK'; }
  gate.commit_allowed = canCommit;
  gate.tx_final = final;
  log.tx_final = final;
  log.finished_at = new Date().toISOString();
  return { log, inTxSnapshot, gate };
}

function errLineOf(sql: string, position: number | null): number | null {
  if (!position || position <= 0) return null;
  return sql.slice(0, position).split('\n').length;
}

// ---------------------------------------------------------------- main -----
(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  const exit = (code: number) => process.exit(code);

  if (argv.includes('--help')) {
    console.log('p3x-00-rebuild-replay: --dry-run(default) | --inject-fail-after=<ver|file> | --expect-corrupt | --apply --confirm-irreversible');
    return exit(0);
  }
  if (!URL) { console.log(json({ ok: false, fatal: 'missing DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING' })); return exit(2); }
  if (MODE === 'apply' && !confirmIrreversible) {
    console.log(json({ ok: false, refused: '--apply 需要 --confirm-irreversible（Phase 2 未获授权）。本单不得执行。' }));
    return exit(2);
  }

  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const runTag = `${MODE === 'apply' ? 'p3x-00-apply' : 'p3x-00-dry'}-${stamp}-${INJECT_AFTER ? 'inject' + INJECT_AFTER : (EXPECT_CORRUPT ? 'corrupt' : 'plain')}`;
  const runDir = path.join(ART_ROOT, runTag);
  if (fs.existsSync(runDir)) { console.log(json({ ok: false, fatal: `artifact run dir exists（同名拒写）: ${runTag}` })); return exit(2); }
  fs.mkdirSync(runDir, { recursive: true });

  const summary: any = {
    run_tag: runTag, mode: MODE, inject_fail_after: INJECT_AFTER,
    driver: 'backend-ts/scripts/p3x-00-rebuild-replay.ts',
    connection: {
      driver: '@neondatabase/serverless Client（单连接，非 Pool）',
      url_source: process.env.DATABASE_URL_UNPOOLED ? 'DATABASE_URL_UNPOOLED' : 'POSTGRES_URL_NON_POOLING',
      pooler_used: String(URL).includes('-pooler'), url: '[REDACTED]',
    },
    node: process.version, started_at: new Date().toISOString(),
  };

  const files = loadMigrations();
  summary.migration_files = files.map((f) => ({ version: f.version, name: f.name, bytes: f.bytes, sha256: f.sha256 }));
  summary.version_order_ok = JSON.stringify(files.map((f) => f.version)) === JSON.stringify(VERSION_ORDER);

  const client = new Client({ connectionString: URL });
  try {
    await client.connect();
    summary.connected = true;

    const preA = await snapshot(client, 'A-pre-state');
    writeArtifact(runDir, 'A-pre-state.json', preA);
    summary.A_pre_state = {
      public_base_table_count: preA.public_base_table_count,
      business_table_count: preA.business_table_count,
      business_tables: preA.business_tables,
      table_row_counts: preA.table_row_counts,
      schema_migration_row_count: preA.schema_migration_row_count,
      non_internal_triggers: preA.triggers.non_internal,
      enabled_not_o: preA.triggers.enabled_not_o,
      catalog: preA.catalog,
      key_functions_md5: preA.key_functions_md5,
      currency_cid1: preA.currency_row,
      account_sum: preA.account_sum,
      ledger_owner_rows: preA.ledger_owner_rows,
      commission_policy_ids: preA.commission_policy_ids,
      currency_cid_seq: preA.currency_cid_seq,
    };

    const connB = await connectionRegistry(client);
    writeArtifact(runDir, 'B-connections.json', connB);
    summary.B_connections = {
      self_pid: connB.self.pid, others_count: connB.others_count,
      idle_in_transaction_count: connB.idle_in_transaction_count,
      ungranted_locks_by_others: connB.ungranted_locks_by_other_pids.length,
      others: connB.others.map((o: any) => ({ pid: o.pid, application_name: o.application_name, state: o.state, state_change: o.state_change, usename: o.usename })),
      idle_in_transaction: connB.idle_in_transaction,
    };

    if (connB.idle_in_transaction_count > 0) {
      writeArtifact(runDir, 'BLOCKED-idle-in-transaction.json', { connB, note: '另有会话 idle in transaction；按铁律 3 登记后停手，不清理、不 kill。' });
      summary.ok = false;
      summary.blocked = 'idle in transaction by another session';
      summary.exit_code = 6;
      writeArtifact(runDir, 'SUMMARY.json', summary);
      console.log(json(summary));
      await client.end().catch(() => undefined);
      return exit(6);
    }

    const registry = preA.schema_migration || [];
    const exp = deriveExpectations(files, EXPECT_CORRUPT);
    const { log, inTxSnapshot, gate } = await replayRun(client, MODE, files, registry, exp);
    writeArtifact(runDir, 'E-gate.json', gate);
    console.log(`gate.ok=${gate.ok} reason=${gate.reason}`);
    writeArtifact(runDir, 'C-replay-log.json', log);
    summary.C_replay = {
      tx_final: log.tx_final,
      bootstrap_row_count: log.bootstrap_schema_migration_row_count,
      steps: log.steps.map((x: any) => ({
        file: x.file ?? null, step: x.step ?? null, ok: x.ok,
        before: x.schema_migration_rows_before ?? null, after: x.schema_migration_rows_after ?? null,
        checksum_byte_equal: x.checksum_byte_equal ?? null, ms: x.ms ?? null, error: x.error ?? null,
      })),
      replay_ok: log.replay_ok, replay_error: log.replay_error,
      checksum_all_byte_equal: log.steps.filter((x: any) => x.file).every((x: any) => x.checksum_byte_equal === true),
      in_tx_snapshot_error: log.in_tx_snapshot_error ?? null,
    };
    if (log.injection) summary.E_injection = log.injection;

    writeArtifact(runDir, 'D-expectations-from-files.json', exp);

    if (inTxSnapshot) {
      writeArtifact(runDir, 'D-in-tx-state.json', inTxSnapshot);
      const cmp = compareExpectations(exp, inTxSnapshot);
      const checks = expectedTerminalChecks(exp, cmp);
      writeArtifact(runDir, 'D-comparison.json', { comparison: cmp, terminal_checks: checks });
      const failed = checks.filter((k) => k.ok === false);
      summary.D_comparison = {
        expected_from_files: {
          TABLE: cmp.objects.TABLE.expected_count, VIEW: cmp.objects.VIEW.expected_count,
          FUNCTION: cmp.objects.FUNCTION.expected_count, PROCEDURE: cmp.objects.PROCEDURE.expected_count,
          TRIGGER: cmp.objects.TRIGGER.expected_count, SEQUENCE: cmp.objects.SEQUENCE.expected_count_identity_serial_bootstrap,
        },
        actual_in_tx: cmp.catalog,
        object_diffs: cmp.diffs,
        terminal_total: checks.length, terminal_ok: checks.filter((k) => k.ok === true).length,
        terminal_failed: failed, terminal_not_measured: checks.filter((k) => k.ok === null).map((k) => k.name),
        key_functions_md5_equal_to_prestate: JSON.stringify(inTxSnapshot.key_functions_md5) === JSON.stringify(preA.key_functions_md5),
        in_tx_table_row_counts: inTxSnapshot.table_row_counts,
      };
      summary.D_pass = cmp.diffs.length === 0 && failed.length === 0;
    } else {
      summary.D_comparison = 'NOT_MEASURED（事务内快照未取到：见 C.replay_error / E 注入中止）';
      summary.D_pass = null;
    }

    const postF = await snapshot(client, 'F-post-state');
    writeArtifact(runDir, 'F-post-state.json', postF);
    const netDiff = diffObjects(preA, postF, '');
    summary.F_net_zero = {
      identical: netDiff.length === 0, diff_count: netDiff.length, diffs: netDiff,
      A_hash: stableHash({ ...preA, at: null, label: null }),
      F_hash: stableHash({ ...postF, at: null, label: null }),
    };

    summary.G_not_verified = [
      '--apply（真实 COMMIT / Phase 2）未执行 —— 未获授权，脚本内需 --apply + --confirm-irreversible 双闸，本单未调用。',
      '重建期间与在线服务（seafood-api 等）的真实并发锁竞争未在负载下压测（仅登记 B 段连接快照）。',
      '回滚后备库可回灌性 NOT_MEASURED —— 本机无 pg_dump，A/F 是观测快照，不是可回灌备份（忠实回灌需绕过 append-only 守卫）。',
      '重建后应用层（backend-ts/src/**）端到端可用性 NOT_MEASURED（本单只做数据层 dry-run）。',
      'Neon 平台侧分支/PITR 能力 NOT_MEASURED（超出本机工具面）。',
      'statement_timeout=300s / lock_timeout=20s 下本次未超时 ≠ 无长事务风险（仅本次观测）。',
    ];
    summary.G_probe_caveats = [
      '期望对象集由 stripSql() 词法剥离注释/字符串/$$体后按 token 抽取；若某文件在 DO/EXECUTE 里动态建对象会被漏（本次 grep 未见动态 CREATE，且与实测计数相符）。',
      '序列期望只能按「IDENTITY 声明数 + SERIAL 声明数 + 1 bootstrap」计数，无法从声明推序列名（文件内 CREATE SEQUENCE 语句 = 0）。',
      '函数按 proname 去重；重载会被折叠为 1 个名字（另报 pg_proc 原始行数）。',
      'currency.cid 下一值由只读 `SELECT last_value,is_called` 推断（不 nextval，以免事务外写库）；若 is_called=false 则不 +1。',
      'supply_cap 期望 NULL 与「未取到」不可区分 ⇒ 记为 NOT_MEASURED，不计入判负。',
    ];

    let code = 0;
    if (log.replay_error) code = 4;
    else if (inTxSnapshot && !summary.D_pass && summary.D_pass !== null) code = 3;
    if (!summary.F_net_zero.identical) code = 5;
    if (log.injection && !summary.F_net_zero.identical) code = 5;
    summary.ok = code === 0;
    summary.exit_code = code;
    summary.finished_at = new Date().toISOString();
    writeArtifact(runDir, 'SUMMARY.json', summary);
    console.log(json(summary));
    await client.end().catch(() => undefined);
    return exit(code);
  } catch (e: any) {
    summary.ok = false;
    summary.fatal = redact(String(e && e.message ? e.message : e)).slice(0, 600);
    summary.fatal_code = e && e.code ? e.code : null;
    try { await client.query('ROLLBACK'); summary.rollback_after_fatal = true; } catch { summary.rollback_after_fatal = false; }
    summary.exit_code = 4;
    try { writeArtifact(runDir, 'SUMMARY.json', summary); } catch { /* ignore */ }
    console.log(json(summary));
    await client.end().catch(() => undefined);
    return exit(4);
  }
})();
