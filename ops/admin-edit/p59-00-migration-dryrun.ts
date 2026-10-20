/**
 * 0059 迁移「准 apply」干跑（**ROLLBACK ⇒ 零残留、不写版本表**）
 *   · 真跑整份 SQL（含尾部 DO 自检）：自检任一面红 ⇒ 本脚本立刻报红
 *   · 再验三条负控臂：闭集外字段 / NULL 元素 / UPDATE·DELETE 篡改 必须被拒
 * 用法：cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only <本文件>
 */
import * as fs from 'fs';
import * as path from 'path';
import { inRollbackTx, mkPool, raw1, raw, sp, pgErr, type Qx } from '../../backend-ts/scripts/p7b-lib';

const MIG = fs.readFileSync(path.resolve(__dirname, '../../backend-ts/migrations/0059_listing_edit_log.sql'), 'utf8');

/** `$$` 感知的语句切分（函数体外壳里含 `;` ⇒ 不能裸 split(';')） */
const splitStatements = (src: string): string[] => {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < src.length; i += 1) {
    const two = src.slice(i, i + 2);
    if (two === '$$') { inDollar = !inDollar; buf += two; i += 1; continue; }
    const ch = src[i];
    if (!inDollar && ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/--[^\n]*/g, '').trim().length > 0);
};

const STMTS = splitStatements(MIG);
/** DDL 段（= 除尾部 `DO $$` 自检外的全部语句）：用于验「反复 apply 落同一终态」 */
const isDoBlock = (s: string) => /(^|\n)\s*DO\s+\$\$/.test(s);
const DDL_STMTS = STMTS.filter((s) => !isDoBlock(s));
const CHECK_STMTS = STMTS.filter((s) => isDoBlock(s));

(async () => {
  const pool = mkPool(1);
  const res = await inRollbackTx(pool, async (c: Qx) => {
    const r: Record<string, unknown> = {};
    // ① 首次 apply：DDL 段跑两遍（幂等自证）
    for (const s of DDL_STMTS) await c.query(s);
    for (const s of DDL_STMTS) await c.query(s);
    r.ddl_idempotent_passes = 2;
    // ② 尾部 `DO $$` 自检（此刻表内 0 行 ⇒ ⑪ 的「存量行 = 0」面可过）
    for (const s of CHECK_STMTS) await c.query(s);
    r.self_check_arms = CHECK_STMTS.length;
    r.statements = STMTS.length;

    r.cols = (await raw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }>(c,
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='listing_edit_log' ORDER BY ordinal_position`)).map((x) => x.column_name);
    r.checks = await raw(c,
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='public.listing_edit_log'::regclass AND contype='c' ORDER BY conname`);
    r.triggers = await raw(c,
      `SELECT t.tgname, t.tgenabled, (t.tgtype & 2) <> 0 AS before, (t.tgtype & 8) <> 0 AS del, (t.tgtype & 16) <> 0 AS upd
         FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
        WHERE n.nspname='public' AND cl.relname='listing_edit_log' AND NOT t.tgisinternal`);
    r.fk = (await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.listing_edit_log'::regclass AND contype='f'"))?.n;
    r.idx = (await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND tablename='listing_edit_log'"))?.n;

    // 正控：合法行可插
    const okIns = await sp(c, () => raw1(c,
      `INSERT INTO public.listing_edit_log (listing_id, actor_uid, owner_uid, admin_edit, changed_fields)
       VALUES (1, 2, 3, true, ARRAY['description','price']::text[]) RETURNING log_id`));
    r.ok_insert = { ok: okIns.ok, id: String((okIns.value as Record<string, unknown>)?.log_id ?? '') };

    // 负控 ①：闭集外字段名必须被 CHECK 拒
    const badField = await sp(c, () => raw1(c,
      `INSERT INTO public.listing_edit_log (listing_id, actor_uid, owner_uid, admin_edit, changed_fields)
       VALUES (1, 2, 3, true, ARRAY['title']::text[]) RETURNING log_id`));
    r.bad_field = { ok: badField.ok, err: badField.ok ? null : pgErr(badField.error) };

    // 负控 ②：NULL 元素必须被 CHECK 拒（闭集 `<@` 单独抓不住这一形态）
    const nullElem = await sp(c, () => raw1(c,
      `INSERT INTO public.listing_edit_log (listing_id, actor_uid, owner_uid, admin_edit, changed_fields)
       VALUES (1, 2, 3, true, ARRAY['price', NULL]::text[]) RETURNING log_id`));
    r.null_elem = { ok: nullElem.ok, err: nullElem.ok ? null : pgErr(nullElem.error) };

    // 正控：空数组合法（同值保存 ⇒ changed_fields = {}）
    const emptyArr = await sp(c, () => raw1(c,
      `INSERT INTO public.listing_edit_log (listing_id, actor_uid, owner_uid, admin_edit, changed_fields)
       VALUES (1, 2, 3, true, '{}'::text[]) RETURNING log_id`));
    r.empty_arr = { ok: emptyArr.ok };

    // 负控 ③：篡改审计行（UPDATE / DELETE）必须被触发器拒
    const up = await sp(c, () => raw1(c,
      `UPDATE public.listing_edit_log SET changed_fields = ARRAY['price']::text[] WHERE listing_id = 1`));
    r.update_blocked = { ok: up.ok, err: up.ok ? null : pgErr(up.error) };
    const del = await sp(c, () => raw1(c, 'DELETE FROM public.listing_edit_log WHERE listing_id = 1'));
    r.delete_blocked = { ok: del.ok, err: del.ok ? null : pgErr(del.error) };

    // 幂等（DDL 面部）：再跑一遍 DDL 段（已存在行时不重跑 DO 自检 —— 其 ⑪ 面按「fresh apply 0 行」设计）
    for (const s of DDL_STMTS) await c.query(s);
    r.rerun_ok = true;
    r.triggers_after_rerun = (await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=cl.relnamespace
       WHERE n.nspname='public' AND cl.relname='listing_edit_log' AND NOT t.tgisinternal AND t.tgenabled='O'`))?.n;
    return r;
  });
  await pool.end();

  const r = (res.result ?? {}) as Record<string, any>;
  const verdict = {
    self_check_passed: res.error === null,
    error: res.error ? String((res.error as Error).message).slice(0, 500) : null,
    sqlstate: res.error ? pgErr(res.error).sqlstate : null,
    rolled_back: res.rolled_back,
    ms: res.ms,
    statements: r.statements, self_check_arms: r.self_check_arms, ddl_idempotent_passes: r.ddl_idempotent_passes,
    cols: r.cols, checks: r.checks, triggers: r.triggers, fk: r.fk, idx: r.idx,
    ok_insert: r.ok_insert, empty_arr: r.empty_arr,
    bad_field_rejected: r.bad_field?.ok === false, bad_field_err: r.bad_field?.err,
    null_elem_rejected: r.null_elem?.ok === false, null_elem_err: r.null_elem?.err,
    update_blocked: r.update_blocked?.ok === false, update_err: r.update_blocked?.err,
    delete_blocked: r.delete_blocked?.ok === false, delete_err: r.delete_blocked?.err,
    rerun_ok: r.rerun_ok, triggers_after_rerun: r.triggers_after_rerun,
  };
  const dir = path.resolve(__dirname, 'readings');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `p59-00-migration-dryrun-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}Z.json`);
  fs.writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), ...verdict }, null, 2));
  console.log(JSON.stringify({ saved: f, ...verdict }, null, 1));
  const red = [
    verdict.self_check_passed, verdict.bad_field_rejected, verdict.null_elem_rejected,
    verdict.update_blocked, verdict.delete_blocked, verdict.ok_insert?.ok, verdict.empty_arr?.ok,
    verdict.fk === 0, verdict.idx === 1, verdict.rerun_ok, verdict.triggers_after_rerun === 1,
  ].filter((x) => x !== true);
  if (red.length) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
