/**
 * P1F-00 · 修复前环境取证 + 机制隔离实验（Kong 自写，独立于 QA 资产）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1f-00-probe-env.ts
 *
 * 目的（为 F1/F2/F3 的修复方案提供事实前提）：
 *   ① 库状态：schema_version / 表 / ledger_entry 行数 / 现存含 '#' 的键（派生 vs 根键）
 *   ② 会话默认 GUC 读数（statement_timeout / lock_timeout / deadlock_timeout）
 *   ③ **连接级 `options=-c statement_timeout=N` 是否真生效**（pooled 与 direct 两条串）
 *      —— 这是「F3(a) 让语句超时真正生效」的候选机制之一，必须实测才能写进报告
 *   ④ 同语句内 set_config('statement_timeout') 的对照（复现质检 qa-p1e-04c 的结论）
 *   ⑤ lock_timeout 逐次获取生效的对照
 *   ⑥ ALTER DATABASE 级默认值：**只读探测**（是否允许 / 当前值），不做任何写入
 */
import { Pool } from '@neondatabase/serverless';
import { DIRECT_URL, POOLED_URL, gucs, mkPool, raw, sleep, pgInfo } from './p1f-lib';

const timed = async (fn: () => Promise<unknown>): Promise<{ ms: number; error?: ReturnType<typeof pgInfo> }> => {
  const t0 = Date.now();
  try { await fn(); return { ms: Date.now() - t0 }; } catch (e) { return { ms: Date.now() - t0, error: pgInfo(e) }; }
};

/** 用 `options` 建池并读回 SHOW statement_timeout + 计时 pg_sleep(3) */
const optionsProbe = async (label: string, url: string, opts: string) => {
  const p = new Pool({ connectionString: url, max: 1, options: opts, connectionTimeoutMillis: 20_000 });
  try {
    await p.query('SELECT 1'); // 握手预热
    const show = (await raw<{ statement_timeout: string }>(p, 'SHOW statement_timeout'))[0];
    const sleepRes = await timed(() => p.query('SELECT pg_sleep(3)'));
    return { label, options: opts, backend_show_statement_timeout: show?.statement_timeout ?? null,
      pg_sleep3_ms: sleepRes.ms, cancelled: !!sleepRes.error, sqlstate: sleepRes.error?.code ?? null,
      message: sleepRes.error?.message ?? null };
  } catch (e) {
    return { label, options: opts, fatal: pgInfo(e) };
  } finally {
    await p.end().catch(() => undefined);
  }
};

(async () => {
  const out: Record<string, unknown> = { run: Date.now().toString(36).slice(-5) };
  const p = mkPool(2);

  // ---------------- ① 库状态
  out.db = {
    schema_migration: await raw(p, 'SELECT version, name FROM schema_migration ORDER BY version'),
    public_tables: (await raw<{ table_name: string }>(p, `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`)).map((r) => r.table_name),
    ledger_entry_rows: await raw(p, 'SELECT count(*)::text AS n FROM ledger_entry'),
    server: (await raw(p, 'SELECT current_database() AS db, inet_server_addr()::text AS addr, '
      + 'current_setting(\'max_connections\') AS max_conns'))[0],
    session_gucs: await gucs(p),
  };

  // ---------------- ② 现存含 '#' 的键：是派生键（根键也在库里）还是根键本身
  out.hash_keys = {
    count_with_hash: await raw(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE position('#' IN idempotency_key) > 0`),
    rows: await raw(p, `SELECT idempotency_key, request_fingerprint, uid, cid, delta
                          FROM ledger_entry WHERE position('#' IN idempotency_key) > 0 ORDER BY txid LIMIT 60`),
    /** 含 '#' 的键里，其 split 出的「根」是否也在表里（= 是派生键） */
    derived_like: await raw(p, `
      SELECT count(*)::text AS n FROM ledger_entry e
       WHERE position('#' IN e.idempotency_key) > 0
         AND EXISTS (SELECT 1 FROM ledger_entry r WHERE r.idempotency_key = split_part(e.idempotency_key, '#', 1))`),
    root_like: await raw(p, `
      SELECT idempotency_key FROM ledger_entry e
       WHERE position('#' IN e.idempotency_key) > 0
         AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.idempotency_key = split_part(e.idempotency_key, '#', 1))
       ORDER BY txid LIMIT 20`),
  };

  // ---------------- ③ 连接级 options 是否生效
  out.options_mechanism = {
    direct_ok: await optionsProbe('direct + options=-c statement_timeout=1500', DIRECT_URL, '-c statement_timeout=1500'),
    pooled_ok: await optionsProbe('pooled + options=-c statement_timeout=1500', POOLED_URL, '-c statement_timeout=1500'),
    direct_via_url: await optionsProbe('direct + URL ?options=...',
      `${DIRECT_URL}${DIRECT_URL.includes('?') ? '&' : '?'}options=-c%20statement_timeout%3D1500`, ''),
  };

  // ---------------- ④ 同语句内 set_config 无效（对照）
  {
    const q = mkPool(1);
    await q.query('SELECT 1');
    out.same_stmt_setconfig = {
      local_save_true: await timed(() => raw(q, `SELECT pg_sleep(4) WHERE set_config('statement_timeout','1500',true) IS NOT NULL`)),
      session_false: await timed(() => raw(q, `SELECT pg_sleep(4) WHERE set_config('statement_timeout','1500',false) IS NOT NULL`)),
      separate_stmt_control: await timed(async () => {
        await raw(q, `SET statement_timeout = '1500'`);
        try { return await raw(q, 'SELECT pg_sleep(3)'); } finally { await raw(q, `SET statement_timeout = 0`).catch(() => undefined); }
      }),
      after_reset: (await raw<{ statement_timeout: string }>(q, `SHOW statement_timeout`))[0],
    };
    await q.end().catch(() => undefined);
  }

  // ---------------- ⑤ lock_timeout 逐次获取生效（同语句内 set_config local）
  {
    const holder = mkPool(1); const caller = mkPool(1);
    await holder.query('SELECT 1'); await caller.query('SELECT 1');
    await holder.query('BEGIN');
    await holder.query('SELECT balance FROM account WHERE uid = 0 AND cid = 1 FOR UPDATE');
    out.lock_timeout_in_stmt = await timed(() => raw(caller,
      `SELECT 1 FROM account WHERE uid = 0 AND cid = 1 FOR UPDATE
         WHERE set_config('lock_timeout','1200',true) IS NOT NULL`));
    await holder.query('ROLLBACK').catch(() => undefined);
    await holder.end().catch(() => undefined); await caller.end().catch(() => undefined);
  }

  // ---------------- ⑥ ALTER DATABASE 级默认值（只读探测）
  out.db_defaults_probe = {
    pg_db_role_setting_rows: await raw(p, `SELECT setdatabase::text, setrole::text, setconfig FROM pg_db_role_setting`),
    note: '连接级 options 若生效则无需改库级默认值；本项仅留证',
  };

  await sleep(50);
  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
