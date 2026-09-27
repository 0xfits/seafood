/**
 * P2d-01 · **测试夹具修复**：把本单自己留下的 951xxx 分区的 `referral.depth` 修回不变式值
 * ============================================================================
 * 为什么需要这支脚本（诚实登记，不藏）
 *   本单首轮探针把 10 层链的边**按「叶在前」的顺序**插入（`W→A1` 先于 `A1→A2`）。
 *   而 `0007` 的 `trg_referral_cycle_guard` 只在**插入那一刻**算 `depth := 1 + COALESCE(depth(父), 0)`：
 *   父行还没插入 ⇒ 该边得到 `depth = 1`；父行随后插入**也不会**回填 ⇒ 13 行的 `depth` 与
 *   §11.8 M9 的 `depth = max(步数)` 不一致（`bad_depth = 13`，`cycles = 0`）。
 *   —— 这正是 spec §3.2「**既有边会被后来的插入追溯破坏**」的机械复现（`depth` 只校验新边），
 *      与「防环靠构造不成立」是同一个根因 ⇒ **构图顺序是调用方的责任**，探针已就地改为「由深到浅」。
 *
 *   因为 `referral` 是 INSERT-only（`BEFORE UPDATE OR DELETE` 触发器），修复必须走**管理员旁路**
 *   （`ALTER TABLE … DISABLE TRIGGER trg_referral_append_only`，与仓库内 `purge-test-data.ts` 同法；
 *   见 spec §2.2 的诚实边界：这不是「绝对不可变」）。本脚本**只**动 **child_uid ∈ [951000, 951999]**
 *   这一测试分区，**不碰**其它任何 uid（含 cid=1 / 平台账户 / 既有 p2b 夹具）。
 *
 * 用法
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p2d-01-testdata-depth-repair.ts            # 干跑：只打印差异
 *   npx ts-node --transpile-only scripts/p2d-01-testdata-depth-repair.ts --apply    # 实际修复（事务内）
 * 落盘：`.p2d-artifacts/p2d-01-depth-repair-<RUN>.json`（run-tagged）
 * ============================================================================
 */
import './p1f-lib';
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw } from './p1f-lib';

const RUN = process.env.P2D_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const APPLY = process.argv.includes('--apply');
const PARTITION = `child_uid BETWEEN 951000 AND 951999`;

const MX_SQL = `
  WITH RECURSIVE anc AS (
    SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
    UNION ALL
    SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
  SELECT x.child_uid::text AS child_uid, x.parent_uid::text AS parent_uid, x.depth::text AS depth,
         t.mx::text AS expected_depth, (x.depth <> t.mx) AS bad
    FROM referral x
    JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid
   WHERE ${PARTITION}
   ORDER BY x.child_uid`;

(async () => {
  const pool = mkPool(4);
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString(), apply: APPLY,
    partition: 'child_uid ∈ [951000, 951999]' };
  const before = await raw(pool, MX_SQL);
  out.before = before;
  out.bad_before = before.filter((r) => String(r.bad) === 'true').length;
  // 全局 M9 读数（修复前后各取一次；只读）
  const cyclesNow = async (): Promise<string> => String((await raw(pool, `
    WITH RECURSIVE up AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
    SELECT count(*)::text AS cycles FROM up WHERE cur = start`))[0].cycles);
  const badDepthNow = async (): Promise<string> => String((await raw(pool, `
    WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT count(*)::text AS bad_depth FROM referral x
      JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`))[0].bad_depth);
  const globalBefore = { cycles: await cyclesNow(), bad_depth: await badDepthNow() };
  out.global_before = globalBefore;

  if (APPLY) {
    const conn = await pool.connect();
    try {
      await conn.query('BEGIN');
      await conn.query('ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only');
      const r = await conn.query(`
        WITH RECURSIVE anc AS (
          SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
          UNION ALL
          SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
        UPDATE referral x SET depth = t.mx
          FROM (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t
         WHERE t.start = x.child_uid AND x.depth <> t.mx AND x.child_uid BETWEEN 951000 AND 951999`);
      out.updated_rows = r.rowCount;
      await conn.query('COMMIT');
    } catch (e) {
      await conn.query('ROLLBACK').catch(() => undefined);
      out.error = String((e as Error).message).slice(0, 200);
    } finally { conn.release(); }
  }

  const after = await raw(pool, MX_SQL);
  out.after = after;
  out.bad_after = after.filter((r) => String(r.bad) === 'true').length;
  const globalAfter = { cycles: await cyclesNow(), bad_depth: await badDepthNow() };
  out.global_after = globalAfter;
  out.ok = out.bad_after === 0 && globalAfter.bad_depth === '0' && globalAfter.cycles === '0';

  fs.mkdirSync(path.resolve(__dirname, '..', '.p2d-artifacts'), { recursive: true });
  const file = path.resolve(__dirname, '..', '.p2d-artifacts', `p2d-01-depth-repair-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ file, bad_before: out.bad_before, bad_after: out.bad_after,
    global_before: out.global_before, global_after: out.global_after, updated_rows: out.updated_rows ?? null,
    ok: out.ok }, null, 1));
  await pool.end();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
