/**
 * p2qa-05 · 补证（独立质检 Neng）：**3 节点以上环**的拒绝 reason ＋ 0010 守卫检查顺序钉桩
 * ============================================================================
 * 背景：上一轮只验了 2-环（X→Y 后 Y→X ⇒ REFERRAL_CYCLE_REJECTED）。本脚本补 3-环 / 4-环，
 *       并把 0010 文件头声明的检查顺序（① 自指 → ② 串行化 → ③ 祖先检查(环) → ④ 已有下级 → ⑤ depth）
 *       用**同一份夹具**逐格钉住：同一个 child 同时满足 ③ 与 ④ 时，必须先报 ③（环）。
 * 手法：全部破坏性动作在**同一事务内**，末尾一律 ROLLBACK；同文件取「事务前 / 事务内 / 回滚后」三份读数。
 *       每条会失败的语句都包在 **SAVEPOINT** 里（否则一次报错整事务 aborted ⇒ 后续格子全是假读数）。
 *       每条路径（referral_bind / 裸 INSERT）**各用独立新 uid**（同一条语句先跑的那路会占掉 child 的
 *       PK ⇒ 第二路只会得到 referral_pk 假读数）。本脚本**不** ALTER TABLE、**不** DISABLE 触发器。
 * 测试数据：uid 9548xx；symbol p1u0*；辅助键 ops:p1u:*。绝不触碰 cid = 1 与平台既有余额。
 */
import {
  mkPool, save, inRollbackTx, ensureUsers, ensureCurrency, trySql, errInfo,
  RUN, type Qx,
} from './p2qa-lib';
import { readGraphInvariants, type Queryable } from '../src/commission';

const C3 = [954851, 954852, 954853];   // 3-环：954851(A)→954852(B)→954853(C，根)；闭环尝试 C→A
const C4 = [954861, 954862, 954863, 954864];  // 4-环：A2→B2→C2→D2(D2 根)；闭环尝试 D2→A2
const C2 = [954871, 954872];           // 2-环（既有判负，不回归）：X→Y；闭环尝试 Y→X
const LEAF = 954888;                   // 合法叶（④ 用例的「安全父目标」）
const F = [954890, 954891, 954892, 954893, 954894];  // 每条路径独立新 uid
const G = 954895;                      // 全新根：④ 用例的安全父目标（与 C 无任何边关系 ⇒ 不成环）
const ALL = [...C3, ...C4, ...C2, LEAF, G, ...F];

const TRIG_SQL = `
  SELECT c.relname AS tbl, t.tgname, t.tgenabled
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
   ORDER BY 1,2`;

interface SpRes<T> { ok: boolean; rows: T[]; error?: Record<string, unknown> }
const pick = (r: { ok: boolean; rows: unknown[]; error?: Record<string, unknown> }): Record<string, unknown> => {
  if (r.ok) {
    const row = r.rows[0] as { j?: { depth?: string }; depth?: string } | undefined;
    return { ok: true, rows: r.rows.length, depth: row?.j?.depth ?? row?.depth ?? null };
  }
  return { ok: false, sqlstate: r.error?.sqlstate ?? null, reason: r.error?.reason ?? null,
    constraint: r.error?.constraint ?? null, message: String(r.error?.message ?? '').slice(0, 120) };
};

(async () => {
  process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX = process.env.SEAFOOD_LEDGER_WRITE_POOL_MAX || '8';
  const p = mkPool(8);
  const q = p as unknown as Queryable;
  const out: Record<string, unknown> = {
    script: 'scripts/p2qa-05-cycle3-and-order.ts', run: RUN,
    question: '3/4 节点环被拒的 reason 是什么？0010 的 ③(环) 与 ④(已有下级) 谁先？两路（referral_bind / 裸 INSERT）报的闸是否同一道？',
  };

  const cid = await ensureCurrency(p, 'p1u5' + RUN.slice(-5).toUpperCase().replace(/[^A-Z0-9]/g, 'Z'), '954001', 0);
  out.setup = { cid, uid_window: ALL };

  const invPre = await readGraphInvariants(q);
  const trigPre = await trySql<Record<string, string>>(p, TRIG_SQL);
  const residuePre = await trySql<Record<string, string>>(p, `
    SELECT count(*)::text AS referral_rows FROM referral WHERE child_uid = ANY($1::bigint[])`, [ALL.map(String)]);
  out.pre = { invariants: invPre, triggers: trigPre.rows,
    triggers_disabled: trigPre.rows.filter((t) => t.tgenabled !== 'O'), my_window_referral_rows: residuePre.rows };

  const tx = await inRollbackTx(p, async (c) => {
    const ex = c as unknown as Qx;
    const exQ = c as unknown as Queryable;
    await ensureUsers(ex, ALL);
    let n = 0;
    /** SAVEPOINT 包住的 trySql：失败只回滚到 savepoint，事务继续 */
    const spTry = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<SpRes<T>> => {
      const sp = `p2qa_sp_${++n}`;
      await ex.query(`SAVEPOINT ${sp}`);
      try {
        const r = await ex.query(sql, params);
        await ex.query(`RELEASE SAVEPOINT ${sp}`);
        return { ok: true, rows: r.rows as T[], error: undefined };
      } catch (e) {
        try { await ex.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* noop */ }
        return { ok: false, rows: [] as T[], error: errInfo(e) };
      }
    };
    const bind = (child: number, parent: number) =>
      spTry<{ j?: unknown }>('SELECT referral_bind($1::bigint,$2::bigint) AS j', [String(child), String(parent)]);
    const ins = (child: number, parent: number, depth = 0) =>
      spTry<{ depth: string }>('INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,$3) RETURNING depth::text AS depth',
        [String(child), String(parent), String(depth)]);
    const chain = async (worker: number, anc: number[]): Promise<Array<Record<string, unknown>>> => {
      const steps: Array<Record<string, unknown>> = [];
      for (let i = anc.length - 1; i >= 0; i--) {
        const child = i === 0 ? worker : anc[i - 1];
        const r = await bind(child, anc[i]);
        steps.push({ edge: `${child}->${anc[i]}`, ok: r.ok, depth: (r.rows[0] as { j?: { depth?: string } })?.j?.depth ?? null, err: r.error ?? null });
      }
      return steps;
    };

    const setup3 = await chain(C3[0], [C3[1], C3[2]]);
    const setup4 = await chain(C4[0], [C4[1], C4[2], C4[3]]);
    const setup2 = await chain(C2[0], [C2[1]]);
    const setupLeaf = await chain(LEAF, [C3[2]]);
    const edgeRows = await spTry(`    
      SELECT child_uid::text, parent_uid::text, depth::text FROM referral
       WHERE child_uid = ANY($1::bigint[]) ORDER BY child_uid`, [ALL.map(String)]);

    const cells: Array<Record<string, unknown>> = [];
    /** mode: both = 两路各用独立 uid（避免第二路吃 referral_pk 假读数） */
    const cell = async (tag: string, childB: number, childI: number, parent: number, depthForge?: number, mode: 'both' | 'bind' | 'insert' = 'both') => {
      const o: Record<string, unknown> = { tag, parent };
      if (mode !== 'insert') o.via_referral_bind = pick(await bind(childB, parent));
      if (mode !== 'bind') o.via_raw_insert = pick(await ins(childI, parent, depthForge ?? 0));
      cells.push(o);
    };

    // ---- ① 自指（child = parent，且它已有下级）
    await cell('c1_self_bind', C3[2], 0, C3[2], undefined, 'bind');
    await cell('c1b_self_bind_via_raw_insert', 0, C3[2], C3[2], undefined, 'insert');
    // ---- ③ 3-环：C→A（A 在 C 的下行链里）；C 同时「已有下级(B)」⇒ 必须报 CYCLE，不得报 WOULD_STALE_DEPTH
    await cell('c2_cycle3_with_descendant', C3[2], C3[2], C3[0], undefined, 'both');
    // ---- ③ 4-环：D2→A2
    await cell('c3_cycle4_with_descendant', C4[3], C4[3], C4[0], undefined, 'both');
    // ---- ③ 2-环（既有判负不回归）：Y→X
    await cell('c4_cycle2_baseline', C2[1], C2[1], C2[0], undefined, 'both');
    // ---- ④ 根且已有下级（自身无 parent 行）⇒ 新绑定，必须 WOULD_STALE_DEPTH（两路同码）
    await cell('c5_root_with_descendants', C3[2], C3[2], G, undefined, 'bind');
    await cell('c5b_root_with_descendants_via_raw_insert', 0, C3[2], G, undefined, 'insert');
    // ---- ④ 的旁证：已被绑的 child 且已有下级 ⇒ referral_bind 走 ②(referral_pk/已绑)，裸 INSERT 走 ④
    await cell('c5c_already_bound_with_descendant', C3[1], C3[1], LEAF, undefined, 'both');
    // ---- 正对照：全新叶 → 根（③④ 都不成立）⇒ 放行
    await cell('c6_legal_leaf_to_root', F[0], F[1], C3[2], undefined, 'both');
    // ---- ⑤ depth：裸 INSERT 传 depth=7 ⇒ 触发器必须覆写（父 = 根 D2 ⇒ 1）
    await cell('c7_depth_forge_parent_is_root', 0, F[2], C4[3], 7, 'insert');
    // ---- ⑤ depth：裸 INSERT 传 depth=7，父 = C2(954863，depth 应为 1) ⇒ 必须覆写为 2
    await cell('c7b_depth_forge_parent_depth1', 0, F[3], C4[2], 7, 'insert');

    const invInTx = await readGraphInvariants(exQ);
    const trigInTx = await trySql<Record<string, string>>(ex, TRIG_SQL);
    return { setup3, setup4, setup2, setupLeaf, edge_rows_after_setup: edgeRows.rows, cells,
      invariants_in_tx: invInTx, triggers_in_tx: trigInTx.rows,
      triggers_disabled_in_tx: trigInTx.rows.filter((t) => t.tgenabled !== 'O') };
  });

  out.in_tx = tx.result;
  out.tx_error = tx.error ? String((tx.error as { message?: string })?.message ?? tx.error).slice(0, 400) : null;

  const invPost = await readGraphInvariants(q);
  const trigPost = await trySql<Record<string, string>>(p, TRIG_SQL);
  const residuePost = await trySql<Record<string, string>>(p, `
    SELECT count(*)::text AS referral_rows FROM referral WHERE child_uid = ANY($1::bigint[])`, [ALL.map(String)]);
  const usersPost = await trySql<Record<string, string>>(p, `
    SELECT count(*)::text AS users_rows FROM users WHERE uid = ANY($1::bigint[])`, [ALL.map(String)]);
  const acctPost = await trySql<Record<string, string>>(p, `
    SELECT count(*)::text AS account_rows FROM account WHERE uid = ANY($1::bigint[])`, [ALL.map(String)]);

  out.post = { invariants: invPost, triggers: trigPost.rows,
    triggers_disabled: trigPost.rows.filter((t) => t.tgenabled !== 'O'),
    my_window_referral_rows: residuePost.rows, my_window_users_rows: usersPost.rows, my_window_account_rows: acctPost.rows };
  out.restored = {
    invariants_identical: JSON.stringify(invPre) === JSON.stringify(invPost),
    triggers_identical: JSON.stringify(trigPre.rows) === JSON.stringify(trigPost.rows),
    all_triggers_enabled: trigPost.rows.length > 0 && trigPost.rows.every((t) => t.tgenabled === 'O'),
    zero_residue_in_window:
      residuePost.rows[0]?.referral_rows === '0' && usersPost.rows[0]?.users_rows === '0' && acctPost.rows[0]?.account_rows === '0',
    rolled_back: tx.rolled_back,
  };

  const cells0 = (tx.result as { cells?: Array<Record<string, unknown>> })?.cells ?? [];
  const g = (tag: string): Record<string, unknown> | undefined => cells0.find((x) => x.tag === tag);
  const reasonOf = (tag: string, path: 'via_referral_bind' | 'via_raw_insert'): string | null =>
    ((g(tag)?.[path] as { reason?: string | null })?.reason ?? null);
  const depthOf = (tag: string, path: 'via_referral_bind' | 'via_raw_insert'): string | null =>
    (((g(tag)?.[path] as { depth?: string | null })?.depth) ?? null);
  out.verdict_cells = {
    'c1 自指 → REFERRAL_SELF_BIND': reasonOf('c1_self_bind', 'via_referral_bind') === 'REFERRAL_SELF_BIND',
    'c1b 自指(裸 INSERT 路) → REFERRAL_SELF_BIND': reasonOf('c1b_self_bind_via_raw_insert', 'via_raw_insert') === 'REFERRAL_SELF_BIND',
    'c2 3-环 → REFERRAL_CYCLE_REJECTED（③ 先于 ④）': reasonOf('c2_cycle3_with_descendant', 'via_referral_bind') === 'REFERRAL_CYCLE_REJECTED',
    'c2 3-环(裸 INSERT 路) → REFERRAL_CYCLE_REJECTED': reasonOf('c2_cycle3_with_descendant', 'via_raw_insert') === 'REFERRAL_CYCLE_REJECTED',
    'c3 4-环 → REFERRAL_CYCLE_REJECTED': reasonOf('c3_cycle4_with_descendant', 'via_referral_bind') === 'REFERRAL_CYCLE_REJECTED',
    'c4 2-环（不回归） → REFERRAL_CYCLE_REJECTED': reasonOf('c4_cycle2_baseline', 'via_referral_bind') === 'REFERRAL_CYCLE_REJECTED',
    'c5 根且有下级 → REFERRAL_BIND_WOULD_STALE_DEPTH': reasonOf('c5_root_with_descendants', 'via_referral_bind') === 'REFERRAL_BIND_WOULD_STALE_DEPTH',
    'c5b 同上(裸 INSERT 路) → REFERRAL_BIND_WOULD_STALE_DEPTH': reasonOf('c5b_root_with_descendants_via_raw_insert', 'via_raw_insert') === 'REFERRAL_BIND_WOULD_STALE_DEPTH',
    'c6 新叶→根 放行': (g('c6_legal_leaf_to_root')?.via_referral_bind as { ok?: boolean })?.ok === true,
    'c7 depth 伪造(父=根) 被覆写为 1': depthOf('c7_depth_forge_parent_is_root', 'via_raw_insert') === '1',
    'c7b depth 伪造(父 depth=1) 被覆写为 2': depthOf('c7b_depth_forge_parent_depth1', 'via_raw_insert') === '2',
  };
  out.verdict_all_green = Object.values(out.verdict_cells as Record<string, boolean>).every(Boolean)
    && (out.restored as { all_triggers_enabled: boolean; zero_residue_in_window: boolean }).all_triggers_enabled
    && (out.restored as { zero_residue_in_window: boolean }).zero_residue_in_window;

  const f = save('p2qa-05-cycle3-and-order', out);
  console.log(JSON.stringify({ saved: f, verdict: out.verdict_cells, restored: out.restored }, null, 1));
  await p.end();
})().catch((e) => { console.error('FATAL', errInfo(e)); process.exit(1); });
