/**
 * p7a-05-db-family.mjs — 批 7-A 收口五（Kong）· **DB 侧同族判据「现取」**
 * ============================================================================
 * 目的（逐字对齐派单）：`before_txid` 非 `bigint` 范围是否也归 `OUT_OF_BIGINT_RANGE`
 *   ⇒ **以 DB 侧现有同类判据现取为准（不得发明）**。
 * 手段：直调 DB 侧**既有**族函数 `ledger_int_amount(p_raw, p_field)` / `ledger_cid_arg(p_raw)`，
 *   逐格取原始 SQLSTATE(=LD0nn) / MESSAGE / DETAIL。**只读**：不写账本、不建表、不插行。
 * 用法：cd backend-ts && node .p7a-artifacts/<RUN>/p7a-05-db-family.mjs > .p7a-artifacts/<RUN>/p7a-05-db-family.json
 * 口径：**禁用 pkill/killall**；本脚本不启任何服务实例。
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

const caseOut = async (label, fn) => {
  try {
    const rows = await fn();
    return { label, ok: true, rows };
  } catch (e) {
    return {
      label, ok: false,
      sqlstate: e?.code ?? null,
      message: e?.message ?? null,
      detail: e?.detail ?? null,
    };
  }
};

const main = async () => {
  const out = {
    probe: 'p7a-05-db-family · DB 侧同族判据现取',
    run: process.env.P7A_RUN || 'UNKNOWN',
    started_at: new Date().toISOString(),
    note: '只读：ledger_int_amount / ledger_cid_arg 直调；不写账本、不建表',
  };

  out.env = {
    schema_version: await sql`SELECT value AS v FROM schema_version WHERE key = 'schema_version'`.catch(() => [{ v: null }]),
  };

  // ---- 族原语 ledger_int_amount（field 无关；DB 侧「同类判据」= 同一函数 + 同一 reason 词表）----
  const f = {
    before_txid_xyz: ['xyz', 'before_txid'],
    before_txid_neg9: ['-9', 'before_txid'],
    before_txid_zero: ['0', 'before_txid'],
    before_txid_over19: ['99999999999999999999999', 'before_txid'],
    before_txid_bigint_max_plus1: ['9223372036854775808', 'before_txid'],
    before_txid_bigint_min_minus1: ['-9223372036854775809', 'before_txid'],
    before_txid_valid_312: ['312', 'before_txid'],
    cid_xyz: ['xyz', 'cid'],
    cid_over19: ['99999999999999999999999', 'cid'],
    cid_neg5: ['-5', 'cid'],
    cid_zero: ['0', 'cid'],
    uid_zero: ['0', 'uid'],
    uid_neg5: ['-5', 'uid'],
  };
  out.ledger_int_amount = {};
  for (const [k, [raw, field]] of Object.entries(f)) {
    out.ledger_int_amount[k] = await caseOut(`${k}`, () => sql`SELECT public.ledger_int_amount(${raw}, ${field}) AS v`);
  }

  // ---- cid 族函数 ledger_cid_arg（形状闸 + ≤0 归「不存在」）----
  const c = {
    cid_arg_abc: 'abc',
    cid_arg_empty: '',
    cid_arg_zero: '0',
    cid_arg_neg5: '-5',
    cid_arg_absent: '999999999999',
    cid_arg_over19: '99999999999999999999999',
  };
  out.ledger_cid_arg = {};
  for (const [k, raw] of Object.entries(c)) {
    out.ledger_cid_arg[k] = await caseOut(`${k}`, () => sql`SELECT public.ledger_cid_arg(${raw}) AS v`);
  }

  // ---- 缺失（NULL）----
  out.ledger_int_amount.before_txid_null = await caseOut('before_txid_null', () => sql`SELECT public.ledger_int_amount(${null}, 'before_txid') AS v`);

  // ---- 库侧零位移自证 ----
  out.rows_touched = {
    ledger_entry: String((await sql`SELECT count(*)::text AS n FROM public.ledger_entry`)[0].n),
  };
  out.finished_at = new Date().toISOString();

  const dir = path.dirname(new URL(import.meta.url).pathname);
  fs.writeFileSync(path.join(dir, 'p7a-05-db-family.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
};

main().then(() => process.exit(0)).catch((e) => { console.error('ERR', e); process.exit(1); });
