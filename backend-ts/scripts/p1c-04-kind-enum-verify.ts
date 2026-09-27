/**
 * P1c 第 2 件 · 取证：DB 侧 kind 关闭集 == 代码侧 LEDGER_KINDS == spec §2.1 DDL（新口径）
 *   ① 从 pg_get_constraintdef 解析 DB 现存的 kind 白名单（排序后逐字打印）
 *   ② 与 src/ledger.ts 的 LEDGER_KINDS 求对称差（应为空）
 *   ③ 与 docs/ledger.spec.md §2.1 DDL 列表求对称差
 *   ④ 判负：真的往库里插一条被删 kind 的分录（事务内，必失败 ⇒ 回滚，零残留）
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1c-04-kind-enum-verify.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools } from '../src/db';
import { LEDGER_KINDS, HOLD_KINDS, FROZEN_SETTLE_KINDS } from '../src/ledger';
import { normalizeLedgerError } from '../src/ledger-errors';

const DELETED = ['listing_deposit_refund', 'listing_deposit_forfeit'];

const sorted = (xs: Iterable<string>): string[] => [...xs].sort();
const diff = (a: string[], b: string[]): { only_in_a: string[]; only_in_b: string[] } => ({
  only_in_a: a.filter((x) => !b.includes(x)),
  only_in_b: b.filter((x) => !a.includes(x)),
});

const parseDbKindValues = async (): Promise<string[]> => {
  const rows = await readQuery<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid='ledger_entry'::regclass AND conname='ledger_kind_enum'`,
  );
  const def = rows[0]?.def ?? '';
  const vals = [...def.matchAll(/'([^']+)'::text/g)].map((m) => m[1]);
  return sorted(vals);
};

const parseSpecKindValues = (): { values: string[]; line_no: number } => {
  const p = path.resolve(__dirname, '..', '..', 'docs', 'ledger.spec.md');
  const text = fs.readFileSync(p, 'utf8');
  const m = text.match(/CONSTRAINT ledger_kind_enum\s+CHECK \(kind IN \(([\s\S]*?)\n\s*\)\)/);
  if (!m) return { values: [], line_no: -1 };
  const body = m[1].split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const vals = [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]);
  const line_no = text.slice(0, m.index ?? 0).split('\n').length;
  return { values: sorted(new Set(vals)), line_no };
};

const negativeProbe = async () => {
  const out: Array<{ kind: string; db_rejected: boolean; pg_code: string | null; constraint: string | null; classified: string }> = [];
  for (const kind of DELETED) {
    try {
      await withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO ledger_entry (uid, cid, delta, frozen_delta, balance_after, frozen_after, kind, idempotency_key, memo)
           VALUES (999001, 1, 100, 0, 100, 0, $1, $2, 'p1c negative probe')`,
          [kind, `ops:p1c:negative:${kind}`],
        );
        // 不该走到这里：DB 必须拒绝
        throw new Error('PROBE_UNEXPECTED_ACCEPT');
      });
      out.push({ kind, db_rejected: false, pg_code: null, constraint: null, classified: 'ACCEPTED(!!)' });
    } catch (e) {
      const anyE = e as { code?: unknown; constraint?: unknown; message?: unknown };
      const norm = normalizeLedgerError(e);
      out.push({
        kind,
        db_rejected: true,
        pg_code: String(anyE?.code ?? '') || null,
        constraint: String(anyE?.constraint ?? '') || null,
        classified: `${norm.code}/${norm.status}`,
      });
    }
  }
  return out;
};

(async () => {
  const dbValues = await parseDbKindValues();
  const spec = parseSpecKindValues();
  const codeValues = sorted(LEDGER_KINDS);

  console.log(JSON.stringify({
    case: 'p1c-04-kind-enum-verify',
    db_kind_values_count: dbValues.length,
    db_kind_values: dbValues,
    code_ledger_kinds_count: codeValues.length,
    code_ledger_kinds: codeValues,
    spec_2_1_ddl_line: spec.line_no,
    spec_2_1_ddl_count: spec.values.length,
    diff_db_minus_code: diff(dbValues, codeValues),
    diff_code_minus_db: diff(codeValues, dbValues),
    diff_spec_ddl_minus_db: diff(spec.values, dbValues),
    diff_db_minus_spec_ddl: diff(dbValues, spec.values),
    hold_kinds: sorted(HOLD_KINDS),
    frozen_settle_kinds: sorted(FROZEN_SETTLE_KINDS),
    deleted_values_absent_from_db: DELETED.filter((k) => !dbValues.includes(k)),
    deleted_values_absent_from_code: DELETED.filter((k) => !codeValues.includes(k)),
    negative_probe_insert_deleted_kind: await negativeProbe(),
  }, null, 2));
})()
  .catch((e) => {
    console.error('probe fatal:', String((e as Error)?.message || e).slice(0, 500));
    process.exitCode = 2;
  })
  .finally(async () => {
    await closePools();
  });
