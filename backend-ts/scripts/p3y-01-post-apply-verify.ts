/**
 * P3Y-01 · S2 事后独立只读对拍（POST-APPLY VERIFY）
 * ============================================================================
 * 单：P3-D20-REBUILD-APPLY（Kong）· Unit J2
 * 目的：**独立于 scripts/p3x-00-rebuild-replay.ts 自身的结论**，在事务外用只读探针
 *       逐项实测「重建目标态」，并把每一项的 SQL/期望/实测值落盘。
 *
 * 只读保证：单连接 Client + `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`；
 *          全脚本无 INSERT/UPDATE/DELETE/DDL；序列只用 `SELECT last_value,is_called`
 *          推断（**绝不 nextval**）。
 * 连接：单连接 `new Client({ connectionString: DATABASE_URL_UNPOOLED })`（禁 Pool / 禁 pooler）。
 * 产物：.p3y-artifacts/p3y-01-post-apply-<RUN>.-plain/{value-checks.json,object-set.json,
 *        checksums.json,catalog-facts.json,sequence.json,key-functions.json,ns-scan.json,
 *        POST-APPLY-REPORT.json}（同名拒写）
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/p3y-01-post-apply-verify.ts
 * 退出码：0 = 全部 hard 检查通过（NOT_MEASURED 不计负）；3 = 有 hard 检查失败；2 = 环境/参数错
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
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const RUN_DIR = path.join(ROOT, '.p3y-artifacts', `p3y-01-post-apply-${RUN}.-plain`);
// pre-state（只读引用，不改不删）
const PRE_STATE_A = path.join(ROOT, '.p3x-artifacts', 'p3x-00-dry-20260928174808.-plain', 'A-pre-state.json');

const VERSION_ORDER = ['0001','0002','0003','0004','0005','0006','0007','0008','0009','0010','0011','0012','0013','0014','0015','0016','0017'];

const redact = (s: string): string => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');
const qident = (n: string): string => '"' + String(n).replace(/"/g, '""') + '"';

const ZERO_TABLES = ['users','referral','ledger_entry','job','job_application','job_submission','listing','listing_order','market_order','market_trade'];
const M0017_TABLES = ['app_config','admin_role','admin_permission','admin_role_permission','admin_user_role','currency_status_log'];
const KEY_FUNCTIONS = ['ledger_post_event','job_post_event','listing_post_event','market_post_event','ledger_assert_commission_conservation'];
const LEDGER_OWNER_EXPECT = [
  { uid: '0', owner_type: 'platform', name: '平台主体' },
  { uid: '-1', owner_type: 'platform', name: '手续费归集账户' },
  { uid: '-2', owner_type: 'platform', name: '佣金池' },
  { uid: '-3', owner_type: 'platform', name: '罚没账户' },
];

type Check = { id: string; group: string; sql?: string; expect: unknown; actual: unknown; pass: boolean | 'NOT_MEASURED'; note?: string };

function writeArtifact(name: string, obj: unknown): string {
  const p = path.join(RUN_DIR, name);
  if (fs.existsSync(p)) throw new Error(`artifact 同名拒写: ${name}`);
  fs.writeFileSync(p, redact(JSON.stringify(obj, null, 1)) + '\n', 'utf8');
  return p;
}

// ---------------------------------------------------- 迁移文件词法剥离 ----
function stripSql(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '-' && src[i + 1] === '-') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === "'") { out += ' '; i++; while (i < n) { if (src[i] === "'" && src[i + 1] === "'") { i += 2; continue; } if (src[i] === "'") { i++; break; } i++; } continue; }
    if (c === '$') { const m = /^\$[A-Za-z_]*\$/.exec(src.slice(i)); if (m) { const tag = m[0]; const end = src.indexOf(tag, i + tag.length); i = end === -1 ? n : end + tag.length; out += ' '; continue; } }
    out += c; i++;
  }
  return out;
}

const bare = (raw: string): string => raw.replace(/^"|"$/g, '').replace(/^public\./i, '').replace(/"/g, '');
function extract(src: string, re: RegExp): string[] {
  const s = stripSql(src);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const r = new RegExp(re.source, 'gi');
  while ((m = r.exec(s)) !== null) out.push(bare(m[1]));
  return out;
}

const main = async (): Promise<void> => {
  const cs = process.env.DATABASE_URL_UNPOOLED;
  if (!cs) { console.error('[p3y-01] FATAL: DATABASE_URL_UNPOOLED missing'); process.exit(2); }
  if (fs.existsSync(RUN_DIR)) { console.error(`[p3y-01] 同名拒写: ${RUN_DIR}`); process.exit(3); }
  fs.mkdirSync(RUN_DIR, { recursive: true });

  const c = new Client({ connectionString: cs });
  await c.connect();
  await c.query(`SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`);
  await c.query(`SET statement_timeout = '180s'`);
  const q = async <R = any>(sql: string, params: unknown[] = []): Promise<R[]> => ((await c.query(sql, params as any)).rows as R[]);
  const one = async (sql: string, params: unknown[] = []): Promise<string | null> => {
    const r = await q<{ v: string | null }>(sql, params);
    return r[0] ? r[0].v : null;
  };

  const checks: Check[] = [];
  const push = (c0: Omit<Check, 'pass'> & { pass: boolean | 'NOT_MEASURED' }) => { checks.push(c0 as Check); return c0.pass; };

  // ============================ 1. 逐值终态 ============================
  const cnt = async (t: string): Promise<string> => (await one(`SELECT count(*)::text AS v FROM public.${qident(t)}`)) ?? 'NOT_MEASURED';

  const curRows = await q(`SELECT cid::text AS cid, symbol, name, owner_uid::text AS owner_uid, decimals::text AS decimals,
                                  total_supply::text AS total_supply, status, listed_at IS NOT NULL AS listed_at_notnull
                             FROM public."currency" ORDER BY cid`);
  const curN = await cnt('currency');
  push({ id: 'currency.count=1', group: 'V', sql: 'SELECT count(*) FROM public."currency"', expect: '1', actual: curN, pass: curN === '1' });
  const cur0 = curRows[0] ?? {};
  const curTuple = { cid: cur0.cid ?? null, symbol: cur0.symbol ?? null, total_supply: cur0.total_supply ?? null, status: cur0.status ?? null };
  push({
    id: 'currency.$-row(cid=1,symbol=$,total_supply=0,status=listed)', group: 'V',
    sql: 'SELECT cid,symbol,total_supply,status FROM public."currency"',
    expect: JSON.stringify({ cid: '1', symbol: '$', total_supply: '0', status: 'listed' }),
    actual: JSON.stringify(curTuple),
    pass: curTuple.cid === '1' && curTuple.symbol === '$' && curTuple.total_supply === '0' && curTuple.status === 'listed',
    note: '另记 name/owner_uid/decimals/listed_at_notnull 于 value-checks.json 的 currency_full_row',
  });

  const loRows = await q(`SELECT uid::text AS uid, owner_type, name FROM public."ledger_owner" ORDER BY uid`);
  const loN = await cnt('ledger_owner');
  push({ id: 'ledger_owner.count=4', group: 'V', sql: 'SELECT count(*) FROM public."ledger_owner"', expect: '4', actual: loN, pass: loN === '4' });
  const loActual = loRows.map((r) => ({ uid: String(r.uid), owner_type: String(r.owner_type), name: String(r.name) }));
  const byUid = (a: { uid: string }, b: { uid: string }) => Number(a.uid) - Number(b.uid);
  const loActualSorted = [...loActual].sort(byUid);
  const loExpectSorted = [...LEDGER_OWNER_EXPECT].sort(byUid);
  push({
    id: 'ledger_owner.rows(uid -3/-2/-1/0 + 名字逐字 + owner_type=platform)', group: 'V',
    sql: 'SELECT uid,owner_type,name FROM public."ledger_owner" ORDER BY uid；比对前两侧按 uid 数值升序规范化',
    expect: JSON.stringify(loExpectSorted), actual: JSON.stringify(loActualSorted),
    pass: JSON.stringify(loActualSorted) === JSON.stringify(loExpectSorted),
    note: '口径修正记录：DB 的 ORDER BY uid 返回 -3,-2,-1,0；首轮探针误按 seed 书写顺序(0,-1,-2,-3)直接比较而报 FAIL —— 属探针口径错，非数据错。修正为两侧按 uid 数值升序规范化后逐字节比较。',
  });

  const accAll = await cnt('account');
  push({ id: 'account.count=4(口径:全表)', group: 'V', sql: 'SELECT count(*) FROM public."account"', expect: '4', actual: accAll, pass: accAll === '4' });
  const accRows = await q(`SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
                             FROM public."account" WHERE uid <= 0 ORDER BY uid, cid`);
  const accUidN = await one(`SELECT count(DISTINCT uid)::text AS v FROM public."account" WHERE uid <= 0`);
  const accBad = await one(`SELECT count(*)::text AS v FROM public."account" WHERE uid <= 0 AND NOT (cid = 1 AND balance = 0 AND frozen = 0)`);
  push({
    id: 'account.uid<=0 行=4 且每行 cid=1 且 balance=0 且 frozen=0', group: 'V',
    sql: `SELECT count(*) FROM public."account" WHERE uid<=0 AND NOT (cid=1 AND balance=0 AND frozen=0)`,
    expect: 'distinct_uid=4 且 违例行=0', actual: `distinct_uid=${accUidN} 违例行=${accBad} rows=${JSON.stringify(accRows)}`,
    pass: accUidN === '4' && accBad === '0',
  });

  const cpN = await cnt('commission_policy');
  const cpIds = await q(`SELECT policy_id::text AS policy_id FROM public."commission_policy" ORDER BY policy_id`);
  push({
    id: 'commission_policy.count=1 且 policy_id=1', group: 'V',
    sql: 'SELECT policy_id FROM public."commission_policy" ORDER BY policy_id',
    expect: '["1"]', actual: JSON.stringify(cpIds.map((r) => r.policy_id)),
    pass: cpN === '1' && cpIds.length === 1 && String(cpIds[0].policy_id) === '1',
  });

  const tableCounts: Array<{ table: string; rows: string }> = [];
  for (const t of ZERO_TABLES) tableCounts.push({ table: t, rows: await cnt(t) });
  push({
    id: `10 业务表全 0（${ZERO_TABLES.join('/')}）`, group: 'V',
    sql: ZERO_TABLES.map((t) => `SELECT count(*) FROM public.${qident(t)}`).join(' ; '),
    expect: '全部 0', actual: JSON.stringify(tableCounts),
    pass: tableCounts.every((r) => r.rows === '0'),
  });

  const m17Counts: Array<{ table: string; rows: string }> = [];
  for (const t of M0017_TABLES) m17Counts.push({ table: t, rows: await cnt(t) });
  push({
    id: `0017 六表全 0（${M0017_TABLES.join('/')}）`, group: 'V',
    sql: M0017_TABLES.map((t) => `SELECT count(*) FROM public.${qident(t)}`).join(' ; '),
    expect: '全部 0', actual: JSON.stringify(m17Counts),
    pass: m17Counts.every((r) => r.rows === '0'),
  });

  const smN = await cnt('schema_migration');
  push({ id: 'schema_migration.count=17', group: 'V', sql: 'SELECT count(*) FROM public."schema_migration"', expect: '17', actual: smN, pass: smN === '17' });

  // ============================ 4. 触发器/基表计数 ============================
  const trgUser = await one(`SELECT count(*)::text AS v FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`);
  const trgNotO = await one(`SELECT count(*)::text AS v FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled <> 'O'`);
  push({ id: 'public 非 internal 触发器 = 43', group: 'V', sql: 'pg_trigger ... nspname=public AND NOT tgisinternal', expect: '43', actual: trgUser, pass: trgUser === '43' });
  push({ id: 'public 非 internal 且 tgenabled <> \'O\' = 0', group: 'V', sql: '... AND tgenabled <> \'O\'', expect: '0', actual: trgNotO, pass: trgNotO === '0' });

  const baseTables = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)).map((r) => String(r.table_name));
  const views = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='VIEW' ORDER BY 1`)).map((r) => String(r.table_name));
  push({ id: 'public 基表计数（口径: information_schema BASE TABLE）', group: 'V', sql: 'information_schema.tables table_type=BASE TABLE', expect: '21（文件期望 20 + registry 表 schema_migration）', actual: String(baseTables.length), pass: baseTables.length === 21 });
  push({ id: 'public 视图计数（口径: information_schema VIEW）', group: 'V', sql: 'information_schema.tables table_type=VIEW', expect: '1', actual: String(views.length), pass: views.length === 1 });

  // ============================ 5. 序列下一值 ============================
  const seqR = await q(`SELECT last_value::text AS last_value, is_called FROM public.currency_cid_seq`);
  const lv = Number(seqR[0]?.last_value ?? NaN);
  const isCalled = seqR[0]?.is_called === true;
  const nextCalc = Number.isNaN(lv) ? null : (isCalled ? lv + 1 : lv);
  const seqObj = {
    probe: 'read-only SELECT last_value,is_called FROM public.currency_cid_seq（未调用 nextval）',
    seq_name: 'public.currency_cid_seq', last_value: seqR[0]?.last_value ?? null, is_called: seqR[0]?.is_called ?? null,
    next_value_calc: nextCalc, pre_state_last_value: 293,
    expected_next_after_rebuild: 4,
    note: '口径：0011:413 / 0012:1180 各一句无 cid 的 INSERT INTO currency 位于子事务+哨兵回滚块内 ⇒ 行回滚但序列推进不撤；0001 显式给 cid=1 ⇒ 序列仅 setval(1,true)。故重建后下一值 = 4，≠ pre-state(294)，属预期。',
  };
  push({ id: 'currency.cid 序列下一值 = 4（只读推断）', group: 'V', sql: 'SELECT last_value,is_called FROM public.currency_cid_seq', expect: '4', actual: String(nextCalc), pass: nextCalc === 4, note: seqObj.note });

  // ============================ 6. 关键函数 md5(prosrc) ============================
  const fnRows = await q(
    `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, md5(p.prosrc) AS md5
       FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = ANY($1) ORDER BY p.proname`, [KEY_FUNCTIONS]);
  const preA = fs.existsSync(PRE_STATE_A) ? JSON.parse(fs.readFileSync(PRE_STATE_A, 'utf8')) : null;
  const preFns: any[] = (preA && preA.key_functions_md5) || [];
  const kfCmp = fnRows.map((r) => {
    const p = preFns.find((x) => x.proname === r.proname);
    return { proname: r.proname, args: r.args, md5_now: r.md5, md5_pre: p ? p.md5 : 'NOT_MEASURED', equal: p ? p.md5 === r.md5 : 'NOT_MEASURED' };
  });
  push({
    id: '5 关键函数 md5(prosrc) 与 pre-state 相等', group: 'V',
    sql: 'SELECT proname, pg_get_function_identity_arguments, md5(prosrc) FROM pg_proc WHERE nspname=public AND proname IN (5)',
    expect: '5/5 相等（pre-state = .p3x-artifacts/p3x-00-dry-20260928174808.-plain/A-pre-state.json .key_functions_md5，口径 md5(prosrc)）',
    actual: JSON.stringify(kfCmp),
    pass: kfCmp.length === 5 && kfCmp.every((x) => x.equal === true),
  });

  // ============================ 2. 对象集对拍 ============================
  const files = VERSION_ORDER.map((v) => {
    const hit = fs.readdirSync(MIG_DIR).filter((f) => f.startsWith(v) && f.endsWith('.sql'));
    return hit.length === 1 ? hit[0] : null;
  });
  const missingFiles = files.filter((f) => !f);
  const expT: string[] = []; const expV: string[] = []; const expF: string[] = []; const expP: string[] = []; const expG: string[] = []; const expS: string[] = [];
  const renames: Array<{ from: string; to: string; file: string }> = [];
  let identityDecls = 0, serialDecls = 0;
  for (const f of files) {
    if (!f) continue;
    const src = fs.readFileSync(path.join(MIG_DIR, f), 'utf8');
    // 迁移文件内的**静态改名**（含 DO/EXECUTE 里的字符串形式）：ALTER TABLE x RENAME TO y
    for (const m of src.matchAll(/ALTER\s+TABLE\s+(?:public\.)?("?[\w$]+"?)\s+RENAME\s+TO\s+("?[\w$]+"?)/gi)) {
      renames.push({ from: bare(m[1]), to: bare(m[2]), file: f });
    }
    expT.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[A-Za-z_][\w$.]*"?)/));
    expV.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+("?[A-Za-z_][\w$.]*"?)/));
    expF.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+("?[A-Za-z_][\w$.]*"?)/));
    expP.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+("?[A-Za-z_][\w$.]*"?)/));
    expG.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?(?:CONSTRAINT\s+)?TRIGGER\s+("?[A-Za-z_][\w$]*"?)/));
    expS.push(...extract(src, /CREATE\s+(?:OR\s+REPLACE\s+)?SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[A-Za-z_][\w$.]*"?)/));
    const s = stripSql(src);
    identityDecls += (s.match(/GENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY/gi) || []).length;
    serialDecls += (s.match(/(?:smallint|integer|bigint)\s+SERIAL|SERIAL[48]?\b/gi) || []).length;
  }
  const dedup = (a: string[]): string[] => Array.from(new Set(a)).sort();
  // 文件声明名 → 重建终态名：应用迁移文件内自身的静态改名（本库 0006 DO/EXECUTE 里把 "user" 改名为 users）
  const rmap = new Map(renames.map((r) => [r.from, r.to]));
  const expTfinal = expT.map((n) => rmap.get(n) ?? n);
  const actualFns = dedup((await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'`)).map((r) => String(r.proname)));
  const actualFnsRawRows = await one(`SELECT count(*)::text AS v FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'`);
  const actualProc = dedup((await q(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='p'`)).map((r) => String(r.proname)));
  const actualSeqs = dedup((await q(`SELECT cl.relname FROM pg_class cl JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND cl.relkind='S'`)).map((r) => String(r.relname)));
  const actualTrgs = dedup((await q(`SELECT t.tgname FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`)).map((r) => String(r.tgname)));

  const setDiff = (exp: string[], act: string[], knownExtra: string[] = []) => {
    const E = dedup(exp); const A = dedup(act);
    const missing = E.filter((x) => !A.includes(x));
    const extraRaw = A.filter((x) => !E.includes(x));
    const extra_known = extraRaw.filter((x) => knownExtra.includes(x));
    const extra_unexplained = extraRaw.filter((x) => !knownExtra.includes(x));
    return { expected_count: E.length, actual_count: A.length, missing, extra_raw: extraRaw, extra_known, extra_unexplained, missing_names: missing, extra_names: extra_unexplained };
  };
  const objSet = {
    source: '派生口径：对 migrations/0001..0017 原文做 stripSql()（剥 -- 行注释 / 块注释 / 单引号字面量 / 美元引用体），'
      + '再用正则抽取 CREATE [OR REPLACE] TABLE|VIEW|FUNCTION|PROCEDURE|TRIGGER|SEQUENCE 的对象名（去 public. 前缀与引号），按对象名去重。',
    files_missing: missingFiles,
    renames_from_files: renames,
    expected_tables_pre_rename: dedup(expT),
    expectations_from_files: { TABLE: dedup(expTfinal).length, VIEW: dedup(expV).length, FUNCTION: dedup(expF).length, PROCEDURE: dedup(expP).length, TRIGGER: dedup(expG).length, SEQUENCE_create_statement: dedup(expS).length },
    actual: { base_tables: baseTables.length, views: views.length, functions_names: actualFns.length, functions_raw_rows: actualFnsRawRows, procedures_names: actualProc.length, triggers: actualTrgs.length, sequences: actualSeqs.length },
    TABLE: setDiff(expTfinal, baseTables, ['schema_migration']),
    VIEW: setDiff(expV, views),
    FUNCTION: setDiff(expF, actualFns),
    PROCEDURE: setDiff(expP, actualProc),
    TRIGGER: setDiff(expG, actualTrgs),
    SEQUENCE: {
      note: '口径：迁移文件内 CREATE SEQUENCE 语句 = 0，序列名无法由文件声明推出；期望按「IDENTITY 声明数 + SERIAL 声明数 + 1 bootstrap（0001 的 pg_get_serial_sequence(\'currency\',\'cid\') setval）」计数对拍数量，名字比对记为 NOT_MEASURED。',
      identity_decls: identityDecls, serial_decls: serialDecls, bootstrap: 1,
      expected_count_by_declaration: identityDecls + serialDecls + 1,
      actual_count: actualSeqs.length, actual_names: actualSeqs,
      name_level_compare: 'NOT_MEASURED',
      pass_count: identityDecls + serialDecls + 1 === actualSeqs.length,
    },
  };
  push({
    id: '对象集：TABLE missing=0 / extra 仅 schema_migration（迁移文件外，由 registry 创建）', group: 'O',
    sql: 'information_schema.tables WHERE table_schema=public AND table_type=BASE TABLE',
    expect: 'missing=[] ; extra=[schema_migration]', actual: `missing=${JSON.stringify(objSet.TABLE.missing)} extra_unexplained=${JSON.stringify(objSet.TABLE.extra_unexplained)}`,
    pass: objSet.TABLE.missing.length === 0 && objSet.TABLE.extra_unexplained.length === 0,
  });
  for (const [k, label] of [['VIEW', 'VIEW'], ['FUNCTION', 'FUNCTION'], ['PROCEDURE', 'PROCEDURE'], ['TRIGGER', 'TRIGGER']] as const) {
    const d = (objSet as any)[k];
    push({
      id: `对象集 ${label}：missing 空 / extra 空`, group: 'O',
      sql: k === 'VIEW' ? 'information_schema.tables table_type=VIEW'
        : k === 'TRIGGER' ? 'pg_trigger NOT tgisinternal'
        : `pg_proc prokind='${k === 'PROCEDURE' ? 'p' : 'f'}'`,
      expect: 'missing=[] ; extra=[]（含口径见 object-set.json）',
      actual: `exp=${d.expected_count} act=${d.actual_count} missing=${JSON.stringify(d.missing)} extra=${JSON.stringify(d.extra_unexplained)}`,
      pass: d.missing.length === 0 && d.extra_unexplained.length === 0,
    });
  }
  push({
    id: '对象集 SEQUENCE：数量对拍（名字级 NOT_MEASURED）', group: 'O', sql: 'pg_class relkind=S',
    expect: String(identityDecls + serialDecls + 1), actual: String(actualSeqs.length),
    pass: identityDecls + serialDecls + 1 === actualSeqs.length, note: objSet.SEQUENCE.note,
  });

  // ============================ 3. checksum 逐字节 ============================
  const smRows = await q(`SELECT version, name, checksum, applied_at::text AS applied_at FROM public."schema_migration" ORDER BY version`);
  const ck = smRows.map((r) => {
    const fp = path.join(MIG_DIR, String(r.name));
    const exists = fs.existsSync(fp);
    const sha = exists ? crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex') : 'FILE_MISSING';
    return { version: String(r.version), name: String(r.name), db_checksum: String(r.checksum), file_sha256: sha, byte_equal: sha === String(r.checksum), applied_at: r.applied_at };
  });
  const ckOk = ck.filter((x) => x.byte_equal).length;
  push({
    id: `schema_migration.checksum vs sha256(migrations/*.sql) 逐字节相等 ${ckOk}/17`, group: 'C',
    sql: 'SELECT version,name,checksum FROM public."schema_migration"; 本地 crypto.createHash(sha256) 重算',
    expect: '17/17', actual: `${ckOk}/${ck.length}`, pass: ckOk === 17 && ck.length === 17,
  });

  // ============================ 7. 残留命名空间扫描 ============================
  const needles = ['cli:', 'p3p:', 'p3q:', 'p3x:', 'p3y:', '99xxx'];
  const uidPrefixes = ['9903', '9904', '9905', '9906', '9907', '9908'];
  const rowCountsAll: Array<{ table: string; rows: string }> = [];
  for (const t of baseTables) rowCountsAll.push({ table: t, rows: await cnt(t) });
  const nonEmpty = rowCountsAll.filter((r) => r.rows !== '0');
  const scanCols = await q(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema='public' AND data_type IN ('text','character varying') AND table_name = ANY($1)
      ORDER BY table_name, column_name`, [nonEmpty.map((r) => r.table)]);
  const nsHits: Array<{ col: string; needle: string; n: string }> = [];
  let nsQueries = 0;
  for (const col of scanCols) {
    for (const needle of needles) {
      const n = await one(`SELECT count(*)::text AS v FROM public.${qident(String(col.table_name))} WHERE ${qident(String(col.column_name))} LIKE $1`, [`%${needle}%`]);
      nsQueries++;
      if (n !== '0') nsHits.push({ col: `${col.table_name}.${col.column_name}`, needle, n: n ?? 'NOT_MEASURED' });
    }
  }
  const uidWin: any[] = [];
  for (const [tbl, col] of [['users', 'uid'], ['account', 'uid'], ['currency', 'owner_uid']] as const) {
    const n = await one(`SELECT count(*)::text AS v FROM public.${qident(tbl)} WHERE left(${qident(col)}::text,4) = ANY($1)`, [uidPrefixes]);
    uidWin.push({ table: `${tbl}.${col}`, uid_prefix_window: uidPrefixes, rows: n });
  }
  const nsScan = {
    scope: '口径：needle 扫描仅覆盖**行数>0 的 public 基表**的 text/varchar 列（重建后 21 表中仅 5 表非空）；uid 窗口用 left(uid::text,4) = ANY(6 个取样前缀)。',
    table_row_counts_all: rowCountsAll, tables_non_empty: nonEmpty.map((r) => r.table),
    needles, text_columns_scanned: scanCols.length, scan_queries: nsQueries,
    needle_hits: nsHits, uid_window_checks: uidWin,
  };
  push({
    id: '残留扫描：needle(cli:/p3*:/99xxx) 命中 = 0 且 uid 窗口(9903..9908) 行 = 0', group: 'N',
    sql: `LIKE '%needle%' over ${scanCols.length} text cols of ${nonEmpty.length} non-empty tables; left(uid::text,4) window`,
    expect: '命中=[] ; 窗口行=0', actual: `hits=${JSON.stringify(nsHits)} uidWin=${JSON.stringify(uidWin)}`,
    pass: nsHits.length === 0 && uidWin.every((x) => x.rows === '0'),
  });

  // ============================ 汇总 ============================
  const hard = checks.filter((x) => x.pass !== 'NOT_MEASURED');
  const failed = hard.filter((x) => x.pass !== true);
  const notMeasured = checks.filter((x) => x.pass === 'NOT_MEASURED');
  const totals = { checks_total: checks.length, ok: hard.filter((x) => x.pass === true).length, failed: failed.length, not_measured: notMeasured.length, failed_ids: failed.map((x) => x.id) };

  writeArtifact('value-checks.json', {
    probe: 'P3Y-01 value checks', run: RUN, currency_full_row: curRows, ledger_owner_rows: loActual,
    account_uid_le_0_rows: accRows, commission_policy_ids: cpIds.map((r) => r.policy_id),
    zero_table_counts: tableCounts, m0017_counts: m17Counts, schema_migration_rows: smN,
    table_row_counts_all: rowCountsAll, checks: checks.filter((x) => x.group === 'V'),
  });
  writeArtifact('object-set.json', objSet);
  writeArtifact('checksums.json', { source: 'public.schema_migration.checksum vs sha256(migrations/<name>)', rows: ck, byte_equal_count: ckOk, of: ck.length, all_equal: ckOk === 17 && ck.length === 17 });
  writeArtifact('catalog-facts.json', { base_tables: baseTables, base_table_count: baseTables.length, views, view_count: views.length, triggers_non_internal: trgUser, triggers_not_enabled_not_O: trgNotO, sequences: actualSeqs, functions_raw_rows: actualFnsRawRows, functions_names: actualFns.length, procedures_names: actualProc.length });
  writeArtifact('sequence.json', seqObj);
  writeArtifact('key-functions.json', { source_pre_state: '.p3x-artifacts/p3x-00-dry-20260928174808.-plain/A-pre-state.json (read-only)', metric: 'md5(p.prosrc)', rows: kfCmp });
  writeArtifact('ns-scan.json', nsScan);

  const report = {
    probe: 'P3Y-01 · S2 事后独立只读对拍（POST-APPLY VERIFY）',
    author: 'Kong (Unit J2) / 单 P3-D20-REBUILD-APPLY',
    run_tag: `p3y-01-post-apply-${RUN}.-plain`, started_at: RUN,
    mode: 'READ_ONLY (SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY)；无 DML/DDL；序列仅只读推断',
    connection: { driver: '@neondatabase/serverless Client（单连接）', url_env: 'DATABASE_URL_UNPOOLED', pool: false, pooler: false },
    totals, checks,
    caveats: [
      'NOT_MEASURED 语义：本探针未取到或口径不可比的项标 NOT_MEASURED，不计入判负；本 run 的 NOT_MEASURED 项见 totals.not_measured（若为 0 表示 32 项全部 hard 通过）。',
      'SEQUENCE 名字级期望无法由迁移文件声明推出（文件内 CREATE SEQUENCE = 0），只做数量对拍，名字比对 NOT_MEASURED。',
      '对象集期望由正则+词法剥离派生；DO/EXECUTE 内动态建对象会被漏（本 run 未见）。',
      '函数按 proname 去重比对；另报 pg_proc 原始行数（functions_raw_rows）。',
      'needle 扫描只覆盖行数>0 的 5 张非空表的 text/varchar 列（空表无行可含残留，故不扫）。',
      'currency.supply_cap 期望 NULL 与「未取到」不可区分 ⇒ 未纳入 hard（dry-run 口径一致，记为 NOT_MEASURED 类）。',
      '本探针为事务外只读观测；它证明的是「此刻库的状态」，不证明应用层端到端可用性。',
    ],
    artifacts_dir: RUN_DIR,
  };
  writeArtifact('POST-APPLY-REPORT.json', report);

  console.log(`RUN=${RUN} artifact_dir=${RUN_DIR}`);
  for (const x of checks) console.log(`  [${x.pass === true ? 'PASS' : x.pass === 'NOT_MEASURED' ? 'N/M ' : 'FAIL'}] ${x.group} ${x.id}`);
  console.log(`TOTALS total=${totals.checks_total} ok=${totals.ok} failed=${totals.failed} not_measured=${totals.not_measured}`);
  console.log(`checksums=${ckOk}/${ck.length} triggers_non_internal=${trgUser} triggers_not_O=${trgNotO} base_tables=${baseTables.length} views=${views.length} seqs=${actualSeqs.length} fn_names=${actualFns.length} raw_fn_rows=${actualFnsRawRows} seq_next=${nextCalc}`);
  if (failed.length) { console.log('FAILED_IDS=' + JSON.stringify(failed.map((x) => x.id))); await c.end(); process.exit(3); }
  await c.end();
};
main().then(() => process.exit(0)).catch((e) => { console.error('[p3y-01] FAILED', e && e.stack ? e.stack : e); process.exit(1); });
