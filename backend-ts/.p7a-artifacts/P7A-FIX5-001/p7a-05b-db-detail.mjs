/**
 * p7a-05b-db-detail.mjs — 批 7-A 收口五 · **DB 侧同族判据的 `reason` 现取（DETAIL，非转抄）**
 * ============================================================================
 * 背景：Neon HTTP 驱动**不surface** RAISE 的 `DETAIL`（`p7a-05-db-family.json` 里 detail=null）。
 * 手段：把 `ledger_int_amount` / `ledger_cid_arg` 包在 **匿名 DO 块**里，用
 *   `GET STACKED DIAGNOSTICS ... = PG_EXCEPTION_DETAIL` 把 DETAIL 捕获后**原样重抛为 MESSAGE**
 *   ⇒ 客户端能逐字读到 `reason`。
 * **不建任何持久对象**（匿名 DO 块 + 会话临时捕获；无 DDL / 无表 / 无行）。
 * 用法：cd backend-ts && node .p7a-artifacts/<RUN>/p7a-05b-db-detail.mjs
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) { console.error('NO_DB_URL'); process.exit(2); }
const sql = neon(url);

/** 单条 DO 块：调 fn(raw, [field])，把异常的 SQLSTATE / MESSAGE / DETAIL 一并带出（重抛 MESSAGE） */
const probe = async (label, fnSql, raw, field) => {
  const body = field === undefined
    ? `PERFORM public.${fnSql}(${raw === null ? 'NULL::text' : `'${raw}'`}); RAISE EXCEPTION 'NO_THROW';`
    : `PERFORM public.${fnSql}(${raw === null ? 'NULL::text' : `'${raw}'`}, '${field}'); RAISE EXCEPTION 'NO_THROW';`;
  const q = `DO $$ BEGIN
    BEGIN
      ${body}
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS _d = PG_EXCEPTION_DETAIL;
      RAISE EXCEPTION 'CAPTURED::%::%', SQLSTATE, _d;
    END;
  END $$;`.replace('_d', 'v_detail');
  // 需要先声明变量
  const q2 = `DO $$ DECLARE v_detail text; BEGIN
    BEGIN
      ${body}
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
      RAISE EXCEPTION 'CAPTURED::%::%', SQLSTATE, v_detail;
    END;
  END $$;`;
  try {
    // neon v0.6 的 tag 无 `.query()`（实测 `sql.query is not a function`）⇒ 用合成 TemplateStringsArray 调 tag
    //   （同 p7a-01-http.ts:58 的既有做法）。
    const strings = Object.assign([q2], { raw: [q2] });
    await sql(strings);
    return { label, outcome: 'NO_THROW' };
  } catch (e) {
    const m = String(e?.message || '');
    const mm = /^CAPTURED::([^:]*)::(.*)$/s.exec(m);
    if (mm) {
      let detail = null;
      try { detail = JSON.parse(mm[2]); } catch { detail = mm[2]; }
      return { label, outcome: 'raised', sqlstate: mm[1], detail };
    }
    return { label, outcome: 'client_error', message: m.slice(0, 200) };
  }
};

const main = async () => {
  const out = { probe: 'p7a-05b-db-detail', run: process.env.P7A_RUN || 'UNKNOWN', started_at: new Date().toISOString() };
  out.cases = {};
  // ledger_int_amount（field 无关；before_txid / cid / uid 逐格对拍）
  const ia = [
    ['ia_xyz_before_txid', 'ledger_int_amount', 'xyz', 'before_txid'],
    ['ia_neg9_before_txid', 'ledger_int_amount', '-9', 'before_txid'],
    ['ia_zero_before_txid', 'ledger_int_amount', '0', 'before_txid'],
    ['ia_23digits_before_txid', 'ledger_int_amount', '99999999999999999999999', 'before_txid'],
    ['ia_maxplus1_before_txid', 'ledger_int_amount', '9223372036854775808', 'before_txid'],
    ['ia_maxplus1_cid', 'ledger_int_amount', '9223372036854775808', 'cid'],
    ['ia_23digits_cid', 'ledger_int_amount', '99999999999999999999999', 'cid'],
    ['ia_null_before_txid', 'ledger_int_amount', null, 'before_txid'],
  ];
  for (const [k, fn, raw, field] of ia) out.cases[k] = await probe(k, fn, raw, field);
  const ca = [
    ['ca_abc', 'ledger_cid_arg', 'abc'],
    ['ca_empty', 'ledger_cid_arg', ''],
    ['ca_zero', 'ledger_cid_arg', '0'],
    ['ca_neg5', 'ledger_cid_arg', '-5'],
    ['ca_over19', 'ledger_cid_arg', '99999999999999999999999'],
  ];
  for (const [k, fn, raw] of ca) out.cases[k] = await probe(k, fn, raw, undefined);
  out.finished_at = new Date().toISOString();
  const dir = path.dirname(new URL(import.meta.url).pathname);
  fs.writeFileSync(path.join(dir, 'p7a-05b-db-detail.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
};
main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e); process.exit(1); });
