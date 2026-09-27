/**
 * QA-P1E-03 · **未映射 SQLSTATE 面**攻击（Neng 高危项 ②）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-03-malformed.ts
 *
 * 攻击面：函数只在 **C6 写入段**（`BEGIN … EXCEPTION`）里做 SQLSTATE 归类；
 * C0–C5（信封解析 / 金额解析 / 分录组装 / 配对不变式 / 加锁）**没有** EXCEPTION 兜底。
 * ⇒ 若 C0–C5 里出现**裸 PG 异常**（不是 `ledger_raise` 抛的自定义 SQLSTATE），
 *    它会原样冒到 TS；`ledgerErrorFromDbError` 只认 LD001..LD033 ⇒ 不认 ⇒
 *    落 `normalizeLedgerError` 的 `default` 兜底。
 *
 * 每例只调一次函数（避免二次副作用），逐例记录：
 *   ① DB 侧原始 SQLSTATE / MESSAGE / DETAIL / CONSTRAINT
 *   ② TS 侧最终 code + status（把**真实异常对象**喂给 ledgerErrorFromDbError → normalizeLedgerError）
 *   ③ 该 SQLSTATE 是否落在 §14.1 关闭集的 DB 投影（LD001..LD033 + LD999 兜底）之内
 */
import { closePools } from '../src/db';
import { ledgerErrorFromDbError, normalizeLedgerError } from '../src/ledger';
import { attempt, attemptText, callFn, callFnText, ensureCurrency, mkPool, pgInfo, raw } from './qa-p1e-lib';

const RUN = Date.now().toString(36).slice(-5);
const SYM = `qaeM${RUN}`;
const U1 = 935001n;
const U2 = 935002n;

const LD_CLOSED = new Set(
  Array.from({ length: 33 }, (_, i) => `LD${String(i + 1).padStart(3, '0')}`).concat(['LD999']));

interface Row {
  id: string; what: string; payload: string;
  sqlstate: string | null; message: string | null; detail: string | null; constraint: string | null;
  ts_code: string; ts_status: number | null; ts_details: unknown;
  in_closed_set: boolean; unmapped_escape: boolean;
}

(async () => {
  const out: Record<string, unknown> = { run: RUN, symbol: SYM };
  const p = mkPool(3);
  const cid = await ensureCurrency(p, SYM, U1, 0, 'listed', '1000');
  out.cid = cid;
  await attempt(p, { op: 'mint', uid: String(U1), cid, amount_units: '100', idempotency_key: `ops:qae:${RUN}:mal:seed` });

  const rows: Row[] = [];
  const k = (s: string) => `ops:qae:${RUN}:mal:${s}`;

  /** 一次直调 + 两路取证；永不抛 */
  const probe = async (id: string, what: string, payload: unknown, asText = false): Promise<void> => {
    const payloadText = asText ? String(payload) : JSON.stringify(payload);
    try {
      const r = asText ? await callFnText(p, payloadText) : await callFn(p, payload);
      rows.push({
        id, what, payload: payloadText.slice(0, 200), sqlstate: null, message: null, detail: null, constraint: null,
        ts_code: 'OK(success)', ts_status: null,
        ts_details: { ok: (r as Record<string, unknown>).ok === true, replay: (r as Record<string, unknown>).idempotent_replay === true, txid: (r as Record<string, unknown>).txid ?? null },
        in_closed_set: true, unmapped_escape: false,
      });
    } catch (e) {
      const info = pgInfo(e);
      const mapped = ledgerErrorFromDbError(e) ?? normalizeLedgerError(e);
      const m = mapped as unknown as { code: string; status?: number | null; details?: unknown };
      rows.push({
        id, what, payload: payloadText.slice(0, 200),
        sqlstate: info.code, message: (info.message ?? '').slice(0, 140), detail: (info.detail ?? '').slice(0, 200),
        constraint: info.constraint,
        ts_code: m.code, ts_status: m.status ?? null, ts_details: m.details ?? null,
        in_closed_set: info.code !== null && LD_CLOSED.has(info.code),
        unmapped_escape: info.code !== null && !LD_CLOSED.has(info.code),
      });
    }
  };

  // -------- ① 裸 bigint 溢出：ledger_int_amount 的长度闸只拦「> 19 位」，19 位溢出会直接 ::bigint 炸
  await probe('M01', 'amount_units = 19 个 9（> bigint max 9.22e18）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '9999999999999999999', idempotency_key: k('m1'),
  });
  await probe('M02', 'from_uid = 19 个 9', {
    op: 'transfer', from_uid: '9999999999999999999', to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m2'),
  });
  await probe('M03', 'ref_id = 19 个 9', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m3'),
    ref_type: 'system', ref_id: '9999999999999999999',
  });
  await probe('M04', 'entries[0].delta = 19 个 9', {
    op: 'entries', idempotency_key: k('m4'), entries: [
      { uid: String(U1), cid, delta: '9999999999999999999', kind: 'transfer' },
      { uid: String(U2), cid, delta: '-1', kind: 'transfer' },
    ],
  });
  await probe('M05', 'business_frozen_cap = 19 个 9', {
    op: 'hold', uid: String(U1), cid, amount_units: '1', idempotency_key: k('m5'),
    ref_type: 'job', ref_id: '1', business_frozen_cap: '9999999999999999999',
  });
  // -------- ② C3 求和溢出（发生在余额/配对判定之前）
  await probe('M06', 'entries 两条正 delta 使 Σdelta 溢出 bigint', {
    op: 'entries', idempotency_key: k('m6'), entries: [
      { uid: String(U1), cid, delta: '9223372036854775807', kind: 'transfer' },
      { uid: String(U2), cid, delta: '1', kind: 'transfer' },
    ],
  });
  // -------- ③ 布尔转型（mint 分支 `(payload->>'platform')::boolean`）
  await probe('M07', 'mint platform = "maybe"（::boolean 非法输入）', {
    op: 'mint', uid: String(U1), cid, amount_units: '1', idempotency_key: k('m7'), platform: 'maybe',
  });
  // -------- ④ JSON 形状
  await probe('M08', 'payload = JSON 数组文本 [1,2,3]', '[1,2,3]', true);
  await probe('M09', 'payload = JSON 标量字符串 "hello"', '"hello"', true);
  await probe('M10', 'payload = JSON 数字 123', '123', true);
  await probe('M11', 'payload = JSON null', 'null', true);
  await probe('M12', 'payload = 空对象（op 缺失）', {});
  // -------- ⑤ 金额 / id 形态
  await probe('M13', 'amount 是 JSON number（浮点 1.5）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount: 1.5, idempotency_key: k('m13'),
  });
  await probe('M14', 'amount_units 是 JSON number', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: 5, idempotency_key: k('m14'),
  });
  await probe('M15', 'cid = "abc"', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid: 'abc', amount_units: '1', idempotency_key: k('m15'),
  });
  await probe('M16', 'cid 是 JSON number（类型闸缺口对照）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid: Number(cid), amount_units: '1', idempotency_key: k('m16'),
  });
  await probe('M32', 'from_uid = " 935001 "（带空格）', {
    op: 'transfer', from_uid: ' 935001 ', to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m32'),
  });
  // -------- ⑥ entries 形状
  await probe('M17', 'entries 是对象（非数组）', { op: 'entries', idempotency_key: k('m17'), entries: { a: 1 } });
  await probe('M18', 'entries 是空数组', { op: 'entries', idempotency_key: k('m18'), entries: [] });
  await probe('M19', 'entries 33 条（超上限 32）', {
    op: 'entries', idempotency_key: k('m19'),
    entries: Array.from({ length: 33 }, () => ({ uid: String(U1), cid, delta: '0', frozen_delta: '1', kind: 'transfer' })),
  });
  await probe('M20', 'entries[i] 是数字', { op: 'entries', idempotency_key: k('m20'), entries: [7, 8] });
  await probe('M21', 'entries[i].kind = "bogus"', {
    op: 'entries', idempotency_key: k('m21'), entries: [
      { uid: String(U1), cid, delta: '1', kind: 'bogus' }, { uid: String(U2), cid, delta: '-1', kind: 'transfer' },
    ],
  });
  await probe('M22', 'entries[i].kind 是对象', {
    op: 'entries', idempotency_key: k('m22'), entries: [
      { uid: String(U1), cid, delta: '1', kind: { x: 1 } }, { uid: String(U2), cid, delta: '-1', kind: 'transfer' },
    ],
  });
  await probe('M23', 'entries 同 uid 双正 delta（Σ != 0）', {
    op: 'entries', idempotency_key: k('m23'), entries: [
      { uid: String(U1), cid, delta: '1', kind: 'transfer' }, { uid: String(U1), cid, delta: '2', kind: 'transfer' },
    ],
  });
  await probe('M24', 'entries[i].delta = "1.5"（非整数）', {
    op: 'entries', idempotency_key: k('m24'), entries: [
      { uid: String(U1), cid, delta: '1.5', kind: 'transfer' }, { uid: String(U2), cid, delta: '-1', kind: 'transfer' },
    ],
  });
  await probe('M25', 'memo 是深层嵌套对象', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m25'),
    memo: { deep: { nested: [1, 2, { x: 'y' }] } },
  });
  // -------- ⑦ 语义闸
  await probe('M26', 'ref_type 白名单外', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m26'),
    ref_type: 'nope', ref_id: '1',
  });
  await probe('M27', '幂等键无前缀（nope:1）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: 'nope:1',
  });
  await probe('M28', '幂等键 2000 字符（> 256）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1',
    idempotency_key: `ops:${'x'.repeat(2000)}`,
  });
  await probe('M29', 'settle kind = "bogus"', {
    op: 'settle', kind: 'bogus', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: k('m29'),
  });
  await probe('M30', 'hold 无业务单（ref 缺失）', {
    op: 'hold', uid: String(U1), cid, amount_units: '1', idempotency_key: k('m30'),
  });
  await probe('M31', 'amount_units 超单笔上限 1e15（19 位内）', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1000000000000001', idempotency_key: k('m31'),
  });
  await probe('M33', 'op = "bogus"', { op: 'bogus', idempotency_key: k('m33') });
  await probe('M34', 'idempotency_key 是 JSON number', {
    op: 'transfer', from_uid: String(U1), to_uid: String(U2), cid, amount_units: '1', idempotency_key: 5,
  });

  out.cases = rows;
  out.summary = {
    total: rows.length,
    ok_cases: rows.filter((r) => r.ts_code === 'OK(success)').map((r) => r.id),
    unmapped_escape_count: rows.filter((r) => r.unmapped_escape).length,
    unmapped_escapes: rows.filter((r) => r.unmapped_escape).map((r) => ({
      id: r.id, sqlstate: r.sqlstate, ts_code: r.ts_code, ts_status: r.ts_status, what: r.what,
    })),
    status_500_cases: rows.filter((r) => r.ts_status === 500).map((r) => ({
      id: r.id, sqlstate: r.sqlstate, ts_code: r.ts_code, ts_details: r.ts_details, what: r.what,
    })),
    distinct_sqlstates_observed: [...new Set(rows.map((r) => r.sqlstate).filter((x): x is string => !!x))],
    distinct_ts_codes: [...new Set(rows.map((r) => r.ts_code))],
    LD_codes_hit: [...new Set(rows.map((r) => r.sqlstate).filter((x): x is string => !!x && x.startsWith('LD')))].sort(),
    non_LD_codes_hit: [...new Set(rows.map((r) => r.sqlstate).filter((x): x is string => !!x && !x.startsWith('LD')))].sort(),
  };
  out.section11 = await raw(p, `
    WITH ev AS (SELECT ref_type, ref_id, SUM(delta+frozen_delta) AS net FROM ledger_entry
                 WHERE ref_type IS NOT NULL GROUP BY 1,2)
    SELECT count(*)::text AS j8_rows FROM ev WHERE net <> 0`);
  out.negatives = (await raw(p, `SELECT count(*)::text AS n FROM account WHERE balance < 0 OR frozen < 0`))[0].n;

  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
