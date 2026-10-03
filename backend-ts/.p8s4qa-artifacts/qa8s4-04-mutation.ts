/**
 * QA 8④ 终审质检 · 自写探针 04：C2 审核闸 L2 承重面 —— 现取真语句三类变异（必红）· 只读事务。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-04-mutation.ts
 * ★ 从 src/database.ts **现取** LIST_CURRENCY_WITH_DEPOSIT_SQL 常量（非硬编码副本），
 *   在**仓外字符串层**施加三类变异，逐变体在**同一事务内**跑真语句路径；末尾哨兵 ⇒ ROLLBACK。
 * ★ 判据：真语句（有闸）对未审 draft ⇒ applied=0；任一变异 ⇒ applied≥1（未审可自助上市）⇒ 判负。
 * ★ 绝不 COMMIT；生产库零净写。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { withTransaction, closePools, txQuery, readQuery, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, `qa8s4-04-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const FEE = 10000;
const DEPOSIT = 50000;
const SENTINEL = 'qa8s4-rollback-04';

// —— 现取真语句（从源文件抽取反引号常量）——
const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'database.ts'), 'utf8');
const m = SRC.match(/const LIST_CURRENCY_WITH_DEPOSIT_SQL = `([\s\S]*?)`;/);
if (!m) throw new Error('PRECONDITION: LIST_CURRENCY_WITH_DEPOSIT_SQL not found in database.ts');
const REAL_SQL = m[1];

const GATE_RE = /AND EXISTS \(\s*SELECT 1 FROM public\.currency_review_log AS r\s*WHERE r\.cid = \$1::bigint AND r\.result = 'approved'\s*\)/;
if (!GATE_RE.test(REAL_SQL)) throw new Error('PRECONDITION: gate predicate not found verbatim in real SQL');
const M1_SQL = REAL_SQL.replace(GATE_RE, '');                      // ① 去闸
const M2_SQL = REAL_SQL.replace('AND EXISTS (', 'AND NOT EXISTS ('); // ② 反形
const M3_SQL = REAL_SQL.replace(GATE_RE, 'AND TRUE');               // ③ 恒真

interface Check { id: string; pass: boolean; detail: unknown; neg: string; }
const checks: Check[] = [];
const rec = (id: string, pass: boolean, detail: unknown, neg: string): void => { checks.push({ id, pass: Boolean(pass), detail, neg }); };

const fp = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const tok = (i: number): string => createHash('sha256').update(`${RUN}:${i}`).digest('hex').slice(0, 5);
const insertDraft = async (tx: TxClient, cid: number, symbol: string, owner: number): Promise<void> => {
  await txQuery(tx,
    `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, status, deposit_cid)
     VALUES ($1::bigint, $2::text, $3::text, $4::bigint, 0, 'draft', 1)`,
    [String(cid), symbol, `qa8s4 mut ${symbol}`, String(owner)]);
};
const runList = async (tx: TxClient, sql: string, cid: number, owner: number, key: string): Promise<{ applied: number; cur_status: string }> => {
  const params = [cid, key, DEPOSIT, owner, `list:${cid}`, fp(['list', cid, owner, FEE, DEPOSIT]),
    String(cid), String(-FEE), String(FEE), String(-DEPOSIT), String(DEPOSIT)];
  const rows = await txQuery<{ applied: number; cur_status: string }>(tx, sql, params as never[]);
  return { applied: Number(rows[0]?.applied ?? -1), cur_status: String(rows[0]?.cur_status ?? '') };
};

const main = async (): Promise<void> => {
  const summary: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx) => {
      const ownerRow = (await txQuery<{ uid: string; balance: string }>(tx,
        `SELECT a.uid::text AS uid, a.balance::text AS balance FROM public.account a
          WHERE a.cid=1 AND a.uid>0 AND a.balance >= ${FEE + DEPOSIT} ORDER BY a.balance DESC, a.uid ASC LIMIT 1`))[0];
      if (!ownerRow) throw new Error('PRECONDITION: no funded owner');
      const owner = Number(ownerRow.uid);
      summary.owner_uid = owner;
      summary.gate_present_in_real_sql = GATE_RE.test(REAL_SQL);
      summary.mutant_has_gate_removed = !/currency_review_log/.test(M1_SQL);

      const base = 921000000 + (parseInt(createHash('sha256').update(RUN).digest('hex').slice(0, 6), 16) % 100000) * 10;
      const cids = { real: base + 1, m1: base + 2, m2: base + 3, m3: base + 4 };
      summary.cids = cids;

      // 基线：真语句（有闸）对未审 draft
      await insertDraft(tx, cids.real, `qa8s4m${tok(1)}`, owner);
      const rReal = await runList(tx, REAL_SQL, cids.real, owner, `biz:currency:list:${cids.real}`);
      summary.real_gated = rReal;
      rec('M0', rReal.applied === 0 && rReal.cur_status === 'draft', rReal, '真语句（有闸）未审 draft ⇒ applied=0 / status=draft ⇒ 产行 ⇒ 判负');

      for (const [id, label, sql, cid] of [
        ['M1', '① 去闸', M1_SQL, cids.m1],
        ['M2', '② 反形 NOT EXISTS', M2_SQL, cids.m2],
        ['M3', '③ 恒真谓词', M3_SQL, cids.m3],
      ] as const) {
        await insertDraft(tx, cid, `qa8s4m${tok(Number(id.slice(1)) + 1)}`, owner);
        const r = await runList(tx, sql, cid, owner, `biz:currency:list:${cid}`);
        // cur_status 是 `cur` CTE 的**快照**（改前值）；真值须另取 currency.status
        const post = String((await txQuery<{ status: string }>(tx, `SELECT status FROM public.currency WHERE cid=$1::bigint`, [String(cid)]))[0]?.status ?? '');
        summary[id] = { label, ...r, status_post: post };
        rec(id, r.applied >= 1 && post === 'listed', { label, ...r, status_post: post }, `${label} ⇒ 未审 draft 自助上市（applied≥1 / status_post=listed）⇒ 仍 applied=0 ⇒ 变异未被捕获 ⇒ 判负`);
      }

      throw new Error(SENTINEL);
    }, { statementTimeoutMs: 30000 });
    rec('Z', false, { note: 'no sentinel' }, '须哨兵结束并回滚');
  } catch (e) {
    if ((e as Error)?.message === SENTINEL) rec('Z', true, { rolled_back: true }, '末尾哨兵 ⇒ ROLLBACK');
    else rec('Z', false, { error: (e as Error)?.message }, '探针内异常（已回滚但属失败）');
  }

  const residue = (await readQuery<Record<string, unknown>>(
    `SELECT
       (SELECT count(*)::int FROM public.currency WHERE cid BETWEEN 921000000 AND 931000000) AS probe_cur,
       (SELECT count(*)::int FROM public.currency WHERE symbol LIKE 'qa8s4m%') AS probe_sym,
       (SELECT count(*)::int FROM public.currency_status_log WHERE cid BETWEEN 921000000 AND 931000000) AS probe_slog,
       (SELECT max(cid)::text FROM public.currency) AS max_cid`))[0];
  summary.residue_after = residue;
  rec('R1', Number(residue?.probe_cur ?? -1) + Number(residue?.probe_sym ?? -1) + Number(residue?.probe_slog ?? -1) === 0, residue, '回滚后探针残渣=0 ⇒ 非0 ⇒ 判负');

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'QA8S4-04-MUTATION', run: RUN, mode: 'single-tx + ROLLBACK', total: checks.length, passed: checks.length - failed.length, failed: failed.length, summary, checks };
  fs.writeFileSync(path.join(OUT_DIR, 'mutation.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ run: RUN, total: report.total, passed: report.passed, failed: report.failed, failed_ids: failed.map((f) => f.id), summary }, null, 1));
  console.log(`ARTIFACT ${path.join(OUT_DIR, 'mutation.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
};

main().catch(async (e) => { console.error('FAIL', (e as Error)?.message); await closePools(); process.exit(2); });
