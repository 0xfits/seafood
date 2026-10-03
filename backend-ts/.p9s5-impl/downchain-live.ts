/**
 * P9⑤ 下行链 SQL 真库只读自证：对活体 referral 的某个 parent_uid 跑 getDownChain / getReferralChain，
 * 验证递归 CTE（idx_referral_parent 路径）与断言结构。**只读**。
 */
import { readQuery, closePools } from '../src/db';
import { getDownChain, getReferralChain } from '../src/commission';

(async () => {
  const out: Record<string, unknown> = {};
  try {
    const rows = await readQuery<{ child: string; parent: string; depth: number }>(
      `SELECT child_uid::text AS child, parent_uid::text AS parent, depth FROM public.referral ORDER BY depth`);
    out.referral_rows = rows;
    // 找一个有下级的 parent
    const parentsWithKids = await readQuery<{ parent: string; n: number }>(
      `SELECT parent_uid::text AS parent, count(*)::int AS n FROM public.referral GROUP BY parent_uid ORDER BY 2 DESC LIMIT 1`);
    out.parent_with_kids = parentsWithKids[0] ?? null;
    if (parentsWithKids[0]) {
      const p = parentsWithKids[0].parent;
      out.down = await getDownChain(p, 3);
      out.down_up = await getReferralChain(p, 3);
    }
    // 另取一个叶子 child 验证空下行
    if (rows[0]) {
      const leaf = rows.map((r) => r.child).find((c) => !rows.some((r) => r.parent === c));
      if (leaf) { out.leaf_uid = leaf; out.leaf_down = await getDownChain(leaf, 3); }
    }
  } catch (e) {
    out.ERROR = (e as Error).message;
  }
  console.log(JSON.stringify(out, null, 2));
  await closePools().catch(() => {});
})();
