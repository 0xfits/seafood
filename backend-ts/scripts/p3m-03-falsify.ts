/**
 * P3-M-03 · 判负自证（尺子必须会响）。
 *
 * 做法（**主工作区文件永不被碰**）：
 *   ① 只读 `migrations/0016_market.sql` ⇒ 在 **scratch 副本**里把一处**结构性保证**改坏：
 *      `market_order_status_transition_ok` 的 `ELSE false`（终态无出边）⇒ `ELSE true`（终态出边被打开）。
 *   ② 在**一个事务**内：先量绿（原版必拒）→ 装入坏版（字节取自 scratch 副本）→ 量红 → `ROLLBACK`（**红态修复自带**）。
 *   ③ 复原 = 用 pristine 字节回写 scratch 副本 ⇒ sha256 前后相等；主工作区 sha256/mtime 不变；再量绿。
 * 冲突行核验：所有 `market_order` / `market_trade` 行必须是本单命名空间（`cli:kong16-` / uid 9905xx），
 *   否则**立即停手上报**（`foreign_rows_present != []`）。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mkPool, raw1, save, sha256, errInfo, RUN, REPO } from './p3m-lib';

const FN_RE = /CREATE OR REPLACE FUNCTION public\.market_order_status_transition_ok\(p_from text, p_to text\)[\s\S]*?\$\$;/;

const main = async () => {
  const p = mkPool(2);
  const src = path.resolve(REPO, 'migrations', '0016_market.sql');
  const pristineBytes = fs.readFileSync(src);
  const pristine = pristineBytes.toString('utf8');
  const pristineSha = sha256(pristineBytes);
  const st0 = fs.statSync(src);
  const scratchDir = process.env.TMPDIR || os.tmpdir();
  const brokenPath = path.join(scratchDir, `p3m-0016-scratch-${RUN}.sql`);
  const restorePath = path.join(scratchDir, `p3m-0016-pristine-${RUN}.sql`);
  try {
    // ---------- 冲突行核验（不通过 ⇒ 立停）
    const foreign = await raw1<any>(p, `SELECT
        (SELECT count(*)::text FROM public.market_order WHERE create_key NOT LIKE 'cli:kong16-%') AS foreign_order_rows,
        (SELECT count(*)::text FROM public.market_order WHERE owner_uid NOT BETWEEN 990501 AND 990599) AS foreign_order_owners,
        (SELECT count(*)::text FROM public.market_trade WHERE taker_uid NOT BETWEEN 990501 AND 990599) AS foreign_trade_takers,
        (SELECT count(*)::text FROM public.ledger_entry WHERE ref_type = 'market_order' AND ref_id IS NULL) AS null_ref_rows`);
    const foreignRowsPresent: unknown[] = [];
    for (const [k, v] of Object.entries(foreign)) if (k !== 'null_ref_rows' && String(v) !== '0') foreignRowsPresent.push({ [k]: v });
    if (foreignRowsPresent.length) {
      save('falsify-ABORT', { foreign_rows_present: foreignRowsPresent, raw: foreign });
      console.error('p3m-03 ABORT: foreign rows present', JSON.stringify(foreignRowsPresent));
      process.exit(4);
    }

    const target = await raw1<any>(p, `SELECT order_id::text AS order_id, status, create_key,
        owner_uid::text AS owner_uid, (amount - amount_filled) AS rem
      FROM public.market_order WHERE status = 'filled' AND create_key LIKE 'cli:kong16-%'
      ORDER BY order_id LIMIT 1`);
    if (!target) throw new Error('no filled fixture order — run scripts/p3m-02-cases.ts first');
    const fid = String(target.order_id);
    const fnBefore = await raw1<any>(p, `SELECT octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND p.proname='market_order_status_transition_ok'`);
    const ledgerBefore = (await raw1<any>(p, 'SELECT count(*)::text AS n FROM public.ledger_entry'))?.n;

    // ---------- ① scratch 副本 + 单点改坏
    const mt = pristine.match(FN_RE);
    if (!mt) throw new Error('whitelist function not found in migration file');
    const fnPristine = mt[0];
    const fnBroken = fnPristine.replace('ELSE false', 'ELSE true');
    if (fnBroken === fnPristine) throw new Error('patch did not change the function text');
    fs.writeFileSync(brokenPath, pristine.replace(fnPristine, fnBroken));
    fs.writeFileSync(restorePath, pristineBytes);
    const brokenSha = sha256(fs.readFileSync(brokenPath));

    const updSql = `UPDATE public.market_order SET status='cancelled' WHERE order_id=$1::bigint`;
    const fnSql = `SELECT public.market_post_event($1::jsonb) AS r`;
    const fnPayload = JSON.stringify({ op: 'cancel', order_id: fid });
    const measureUpd = async (c: any) => {
      try { const r = await c.query(updSql, [fid]); return { rejected: false, rows: r.rowCount, err: null }; }
      catch (e) { return { rejected: true, rows: 0, err: errInfo(e) }; }
    };
    const measureFn = async (c: any) => {
      try { const r = await c.query(fnSql, [fnPayload]); return { rejected: false, reason: null, ret: r.rows?.[0]?.r ?? null }; }
      catch (e) { const i = errInfo(e); return { rejected: true, reason: i.reason, sqlstate: i.sqlstate, message: i.message }; }
    };
    const fnMd5Now = async (c: any) =>
      (await c.query(`SELECT md5(p.prosrc) AS md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname='market_order_status_transition_ok'`)).rows[0].md5;

    // ---------- ② 单事务内：绿 → 装坏 → 红 → ROLLBACK（红态修复自带）
    const c = await p.connect();
    let greenUpd: any, redUpd: any, greenFn: any, redFn: any, fnMd5Broken: string | null = null;
    try {
      await c.query('BEGIN');
      await c.query('SAVEPOINT s1');
      greenUpd = await measureUpd(c);                    // 期望：被拒（LD011 / MARKET_ORDER_STATE_INVALID）
      await c.query('ROLLBACK TO SAVEPOINT s1');
      greenFn = await measureFn(c);                       // 期望：reason = MARKET_ORDER_STATE_INVALID
      await c.query('ROLLBACK TO SAVEPOINT s1');
      await c.query(fnBroken);                            // 装坏（字节取自 scratch 副本）
      fnMd5Broken = await fnMd5Now(c);
      await c.query('SAVEPOINT s2');
      redUpd = await measureUpd(c);                       // 期望：**不再被拒** ⇒ 红
      await c.query('ROLLBACK TO SAVEPOINT s2');
      redFn = await measureFn(c);                         // 期望：reason 变为 market_order_nothing_to_release ⇒ 红
      await c.query('ROLLBACK TO SAVEPOINT s2');
      await c.query('ROLLBACK');                          // 整事务回滚 ⇒ 坏版函数被撤销
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally { c.release(); }

    // ---------- ③ 复原（scratch 副本逐字节回写）+ 再量绿
    fs.copyFileSync(restorePath, brokenPath);
    const restoredSha = sha256(fs.readFileSync(brokenPath));
    const fnAfter = await raw1<any>(p, `SELECT octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname='public' AND p.proname='market_order_status_transition_ok'`);
    const c2 = await p.connect();
    let greenUpd2: any, greenFn2: any;
    try {
      greenUpd2 = await measureUpd(c2);
      greenFn2 = await measureFn(c2);
    } finally { c2.release(); }
    const st1 = fs.statSync(src);
    const srcShaAfter = sha256(fs.readFileSync(src));
    const after = await raw1<any>(p, `SELECT
        (SELECT status FROM public.market_order WHERE order_id=$1::bigint) AS order_status,
        (SELECT count(*)::text FROM public.ledger_entry) AS ledger_total`, [fid]);

    const out = {
      run: RUN,
      scratch: { dir: scratchDir, broken_copy: brokenPath, restore_source: restorePath,
                 sha256_pristine: pristineSha, sha256_broken: brokenSha, sha256_restored: restoredSha,
                 restored_equals_pristine: restoredSha === pristineSha },
      main_workspace_file: { path: src, sha256_before: pristineSha, sha256_after: srcShaAfter,
                             untouched: srcShaAfter === pristineSha && st0.mtimeMs === st1.mtimeMs,
                             mtime_before: st0.mtime.toISOString(), mtime_after: st1.mtime.toISOString(),
                             size_before: st0.size, size_after: st1.size },
      structural_change: { target: 'public.market_order_status_transition_ok',
                           change: "ELSE false  ->  ELSE true（终态无出边 ⇒ 终态出边被打开）",
                           patched_function_text_sha256: sha256(fnBroken) },
      fn_md5: { before: fnBefore?.md5, in_tx_broken: fnMd5Broken, after_rollback: fnAfter?.md5,
                bytes_before: fnBefore?.bytes, bytes_after: fnAfter?.bytes },
      ledger_rows_before: ledgerBefore, ledger_rows_after: after?.ledger_total,
      foreign_rows_present: foreignRowsPresent, foreign_raw: foreign,
      target_fixture: { ...target, status_before: target.status, status_after: after?.order_status },
      GREEN_before: { upd: greenUpd, fn: greenFn },
      RED_broken: { upd: redUpd, fn: redFn },
      GREEN_restored: { upd: greenUpd2, fn: greenFn2 },
      verdict: {
        green_before_rejects: greenUpd?.rejected === true && greenFn?.reason === 'MARKET_ORDER_STATE_INVALID',
        red_broken_upd_succeeds: redUpd?.rejected === false && redUpd?.rows === 1,
        red_broken_fn_reason_changed: redFn?.reason === 'market_order_nothing_to_release',
        green_restored_rejects: greenUpd2?.rejected === true && greenFn2?.reason === 'MARKET_ORDER_STATE_INVALID',
        sha_after_equal_pristine: restoredSha === pristineSha,
        workspace_untouched: srcShaAfter === pristineSha,
        zero_perturbation: after?.order_status === target.status && after?.ledger_total === ledgerBefore,
      },
    };
    const file = save('falsify', out);
    console.log(JSON.stringify({ artifact: file, verdict: out.verdict,
      sha: { pristine: pristineSha, broken: brokenSha, restored: restoredSha },
      GREEN_before: { upd: greenUpd, fn_reason: greenFn?.reason, fn_sqlstate: greenFn?.sqlstate },
      RED_broken: { upd: redUpd, fn_reason: redFn?.reason, fn_sqlstate: redFn?.sqlstate },
      GREEN_restored: { upd: greenUpd2, fn_reason: greenFn2?.reason },
      fn_md5: out.fn_md5, foreign_rows_present: foreignRowsPresent,
      target: out.target_fixture, ledger: `${ledgerBefore} -> ${after?.ledger_total}` }, null, 2));
    if (!Object.values(out.verdict).every(Boolean)) process.exitCode = 5;
  } finally { await p.end().catch(() => undefined); }
};
main().catch((e) => { console.error('p3m-03 fatal:', String((e as Error)?.message || e).slice(0, 500)); process.exit(2); });
