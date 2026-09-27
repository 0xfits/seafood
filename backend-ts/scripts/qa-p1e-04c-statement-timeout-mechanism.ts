/**
 * QA-P1E-04c · 「函数内 set_config('statement_timeout') 到底生不生效」机制隔离实验（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-04c-statement-timeout-mechanism.ts
 *
 * 背景：QA-P1E-04b 实测函数在**累计等待 15.58s** 后才以 55P03（lock_timeout 3s）失败，
 * 而函数内在 C1 声明了 `statement_timeout = 10000` ⇒ 10s 时该被 57014 打断却**没有**。
 * 本探针用三个最小实验隔离机制（全部只读，不改库）：
 *   (a) 同一条语句内 `set_config('statement_timeout','1500',true)`（= 函数做法，GUC_ACTION_SAVE）
 *   (b) 同一条语句内 `set_config('statement_timeout','1500',false)`（会话级）
 *   (c) 前置独立语句 `SET statement_timeout='1500'` 再跑慢语句（对照：应生效）
 * 每个实验都跑一条 4s 的 pg_sleep，看是否在 1.5s 处被打断（57014）。
 */
import { closePools } from '../src/db';
import { mkPool, pgInfo, raw } from './qa-p1e-lib';

const sleep = (m: number) => new Promise((r) => setTimeout(r, m));

(async () => {
  const out: Record<string, unknown> = {};
  const p = mkPool(2);
  await p.query('SELECT 1');   // 握手预热

  const timed = async (label: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      await fn();
      return { label, elapsed_ms: Date.now() - t0, canceled: false, sqlstate: null, message: null };
    } catch (e) {
      const i = pgInfo(e);
      return { label, elapsed_ms: Date.now() - t0, canceled: true, sqlstate: i.code, message: i.message };
    }
  };

  out.a_same_stmt_local_save = await timed('set_config(statement_timeout,1500,true) + pg_sleep(4) 同一语句', () =>
    raw(p, `SELECT pg_sleep(4) WHERE set_config('statement_timeout', '1500', true) IS NOT NULL`));

  out.b_same_stmt_session = await timed('set_config(statement_timeout,1500,false) + pg_sleep(4) 同一语句', () =>
    raw(p, `SELECT pg_sleep(4) WHERE set_config('statement_timeout', '1500', false) IS NOT NULL`));

  // 对照 (c)：先独立语句 SET，再跑慢语句（同一连接，max=2 池下必须串行占用同一连接）
  const q = mkPool(1);
  await q.query('SELECT 1');
  await raw(q, `SET statement_timeout = '1500'`);
  out.c_separate_stmt_session = await timed('SET statement_timeout=1500（独立语句）+ pg_sleep(4)', () =>
    raw(q, 'SELECT pg_sleep(4)'));
  // 复位
  await raw(q, `SET statement_timeout = 0`).catch(() => undefined);
  await q.end().catch(() => undefined);

  // 对照 (d)：函数内 lock_timeout 确实生效（函数内 set_config local）——用 04 的读数复核
  out.d_note = 'QA-P1E-04 已实测：函数内 set_config(lock_timeout,3000,true) 生效（4s 后 55P03）⇒ 说明 set_config 本身生效，差异在 statement_timeout 的定时器语义';

  out.server_defaults = await raw(p, `SELECT name, setting FROM pg_settings WHERE name IN ('statement_timeout','lock_timeout')`);
  console.log(JSON.stringify(out, null, 1));
  await sleep(50);
  await p.end().catch(() => undefined);
  await closePools().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
