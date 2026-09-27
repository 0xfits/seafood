/**
 * P1J-READ · 只读取证（恢复轮）—— 不写产品代码、不做迁移
 * ============================================================================
 * 取以下读数（逐条对应 P1i 收口单的验收项）：
 *   ① schema_migration.checksum  vs  迁移文件 sha256（0001–0005 逐条对齐）
 *   ② ledger_entry 行数：总数 / event_root_key IS NULL（历史行）/ NOT NULL（新协议行）
 *   ③ 归属列结构守卫反例行数（wrong_root_rows，必须 0）
 *   ④ §11 判据 1（账户级守恒差异）
 *   ⑤ §11 判据 8 键族 —— **两种口径**：①归属列优先（COALESCE(event_root_key, split_part)）
 *                                        ②纯键前缀算术（无视归属列，历史行口径）
 *   ⑥ §11 判据 8 ref 形状
 *   ⑦ R79 meta.lock_trace：mint（currency→account）与 entries（多账户 uid 升序）
 *   ⑧ 平台账户 uid 0 / -1 / -2 / -3 在 cid=1 的 balance / frozen（只读）
 * 测试数据分区：uid 943xxx / symbol 前缀 p1j / 键前缀 ops:p1j:*
 * 用法：npx ts-node --transpile-only scripts/p1j-read.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  mkPool, raw, attempt, ensureCurrency, accountOf, judgement1, judgement8ByKey, judgement8ByRef, jstr,
} from './p1f-lib';

const RUN = Date.now().toString(36).toUpperCase();
const SYM = `P1J${RUN}`.slice(0, 12);
const U1 = 943001n, U2 = 943002n, U3 = 943003n;
const K = (s: string) => `ops:p1j:${RUN}:read:${s}`;

const main = async () => {
  const p = mkPool(3);
  const out: Record<string, unknown> = { probe: 'P1J-READ', run: RUN, symbol: SYM };

  // ---------------------------------------------------------------- ① checksum 对齐
  const migDir = path.resolve(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const fileSums = files.map((f) => ({
    version: (f.match(/^(\d+)/) as RegExpMatchArray)[1],
    name: f,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(migDir, f), 'utf8'), 'utf8').digest('hex'),
  }));
  const regRows = await raw<{ version: string; name: string; checksum: string; applied_at: string }>(
    p, 'SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version');
  const regMap = new Map(regRows.map((r) => [r.version, r]));
  out.checksum_alignment = fileSums.map((f) => {
    const r = regMap.get(f.version);
    return {
      version: f.version, file: f.name, file_sha256: f.sha256,
      registered_checksum: r?.checksum ?? null, in_registry: !!r,
      match: !!r && r.checksum === f.sha256, applied_at: r?.applied_at ?? null,
    };
  });
  out.all_checksums_match = fileSums.every((f) => regMap.get(f.version)?.checksum === f.sha256);
  out.schema_version = regRows.length ? regRows[regRows.length - 1].version : null;
  out.registry_versions = regRows.map((r) => r.version);

  // ---------------------------------------------------------------- ② 行数与归属列
  const cnt = (await raw<{ total: string; root_null: string; root_not_null: string }>(p, `
    SELECT count(*)::text AS total,
           count(*) FILTER (WHERE event_root_key IS NULL)::text     AS root_null,
           count(*) FILTER (WHERE event_root_key IS NOT NULL)::text AS root_not_null
      FROM ledger_entry`))[0];
  out.ledger_entry = cnt;

  // ---------------------------------------------------------------- ③ 归属列结构守卫
  out.wrong_root_rows = (await raw<{ n: string }>(p, `
    SELECT count(*)::text AS n FROM ledger_entry
     WHERE event_root_key IS NOT NULL AND event_root_key <> split_part(idempotency_key, '#'::text, 1)`))[0].n;

  // ---------------------------------------------------------------- ④ 判据 1
  const j1 = await judgement1(p);
  out.judgement1_rows = j1.length;
  out.judgement1_sample = j1.slice(0, 5);

  // ---------------------------------------------------------------- ⑤ 判据 8 键族（两种口径）
  const j8k = await judgement8ByKey(p);
  out.judgement8_bykey_mixed_rows = j8k.length;
  out.judgement8_bykey_mixed_sample = j8k.slice(0, 5);
  const j8kLegacy = await raw(p, `
    WITH ev AS (
      SELECT split_part(idempotency_key, '#'::text, 1) AS base_key,
             SUM(delta + frozen_delta) AS net_sum, count(*) AS entries,
             bool_or(kind IN ('mint','burn')) AS has_mint_burn
        FROM ledger_entry GROUP BY 1)
    SELECT * FROM ev WHERE net_sum <> 0 AND NOT has_mint_burn`);
  out.judgement8_bykey_prefixonly_rows = j8kLegacy.length;
  out.judgement8_bykey_prefixonly_sample = j8kLegacy.slice(0, 5);

  // ---------------------------------------------------------------- ⑥ 判据 8 ref 形状
  const j8r = await judgement8ByRef(p);
  out.judgement8_byref_rows = j8r.length;
  out.judgement8_byref_sample = j8r.slice(0, 5);

  // ---------------------------------------------------------------- ⑦ R79 lock_trace
  const CID = await ensureCurrency(p, SYM, U1, 2, 'listed', '100000000000');
  out.cid = CID;
  const mint = await attempt(p, {
    op: 'mint', idempotency_key: K('seed:mint'), uid: String(U1), cid: CID, amount_units: '2000000',
  });
  out.mint_ok = mint.ok; out.mint_error = mint.error ?? null;
  out.lock_trace_mint = mint.lock_trace ?? null;
  for (const u of [U2, U3]) {
    const r = await attempt(p, {
      op: 'transfer', idempotency_key: K(`seed:xfer:${u}`), from_uid: String(U1), to_uid: String(u),
      cid: CID, amount_units: '500000',
    });
    if (!r.ok) { out[`seed_xfer_${u}_error`] = r.error ?? null; }
  }
  // 多账户 entries op：payload 里故意乱序（943003,943001,943002），锁序必须升序
  const ent = await attempt(p, {
    op: 'entries', idempotency_key: K('order:entries'),
    entries: [
      { uid: String(U3), cid: CID, kind: 'transfer', delta: '600' },
      { uid: String(U1), cid: CID, kind: 'transfer', delta: '-1000' },
      { uid: String(U2), cid: CID, kind: 'transfer', delta: '400' },
    ],
  });
  out.entries_ok = ent.ok; out.entries_error = ent.error ?? null;
  out.lock_trace_entries = ent.lock_trace ?? null;
  out.lock_trace_entries_expect_uid_asc = [String(U1), String(U2), String(U3)];
  out.balances_after = {
    U1: await accountOf(p, U1, CID), U2: await accountOf(p, U2, CID), U3: await accountOf(p, U3, CID),
  };

  // ---------------------------------------------------------------- ⑧ 平台账户（只读，cid=1）
  out.platform_accounts_cid1 = await raw(p, `
    SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
      FROM account WHERE cid = 1 AND uid IN (0, -1, -2, -3) ORDER BY uid`);

  // ---------------------------------------------------------------- 写后重读判据 1 / 8
  const j1b = await judgement1(p);
  const j8kb = await judgement8ByKey(p);
  out.post_write_judgement1_rows = j1b.length;
  out.post_write_judgement8_bykey_rows = j8kb.length;
  out.post_write_judgement1_sample = j1b.slice(0, 3);

  console.log(JSON.stringify(out, null, 2));
  await p.end();
};

main().catch((e) => { console.error('P1J-READ FATAL', jstr(e)); process.exit(2); });
