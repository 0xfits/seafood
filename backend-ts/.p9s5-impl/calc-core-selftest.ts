/**
 * P9⑤ 计算核心功能自证（**纯函数，不连库**）：两级最大余数法 + 名单构建（上3∪下3 / 截断留痕 / M=0）。
 * 探针落 .p9s5-impl/（不入 scripts/ 扫面根）。
 */
import {
  splitPool, splitPoolTwoLevel, splitPoolByWeights, buildCommissionRoster,
  assertReferralChainInvariants, type PoolLayer, type ReferralChain, type ReferralDownChain,
} from '../src/commission';

const W6 = [2600, 1700, 700, 2600, 1700, 700];
const policy = { levels: 6, weights_bp: W6 };

const upChain = (uids: string[]): ReferralChain => ({
  nodes: uids.map((u, i) => ({ beneficiary_uid: u, level: i + 1 })),
  chain_depth: uids.length, truncated: false,
  assertions: { contiguous_levels: true, within_cap: true, all_user_uids: true, no_duplicate_uid: true },
});
const downChain = (byLevel: Record<number, string[]>): ReferralDownChain => {
  const nodes = Object.entries(byLevel).flatMap(([lv, uids]) =>
    uids.map((u, i) => ({ descendant_uid: u, level: Number(lv), bound_at: `2026-10-0${Number(lv)}T0${i}:00:00Z` })));
  const maxL = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const lvls = new Set(nodes.map((n) => n.level));
  let contig = true; for (let L = 1; L <= maxL; L++) if (!lvls.has(L)) contig = false;
  return { nodes, down_depth: maxL, truncated: false,
    assertions: { contiguous_levels: contig, within_cap: true, all_user_uids: true, no_duplicate_uid: true } };
};
const mkLayers = (spec: [number, 'up' | 'down', number, number, string[]][]): PoolLayer[] =>
  spec.map(([layer, direction, distance, weight_bp, uids]) => ({ layer, direction, distance, weight_bp, beneficiaries: uids.map((u) => ({ uid: u })) }));
const sum = (xs: string[]): string => xs.reduce((a, x) => a + BigInt(x), 0n).toString();

const out: Record<string, unknown> = {};

// A. 6 层各 1 人 / pool = 10000 ⇒ 层额应逐字 = 权重（sum 10000）
{
  const L = mkLayers([[1,'up',1,2600,['u1']],[2,'up',2,1700,['u2']],[3,'up',3,700,['u3']],
    [4,'down',1,2600,['d1']],[5,'down',2,1700,['d2']],[6,'down',3,700,['d3']]]);
  const a = splitPoolTwoLevel('10000', L);
  out.A_equal_weights = { layer_x: a.layers.map((l)=>l.x), sum: a.sum_x, ok: a.sum_x === '10000' };
}
// B. pool = 1001（非整除）⇒ 构造性 Σ == 1001；层额最大余数法
{
  const L = mkLayers([[1,'up',1,2600,['u1']],[2,'up',2,1700,['u2']],[3,'up',3,700,['u3']],
    [4,'down',1,2600,['d1']],[5,'down',2,1700,['d2']],[6,'down',3,700,['d3']]]);
  const a = splitPoolTwoLevel('1001', L);
  out.B_1001 = { layer_x: a.layers.map((l)=>l.x), sum: a.sum_x, plus_one: a.plus_one_layers, ok: a.sum_x === '1001' };
}
// C. 层内多人均分（D1 三人）⇒ 层内 (r DESC, uid ASC) 退化为 uid ASC；Σ 构造性
{
  const L = mkLayers([[1,'up',1,2600,['u1']],[2,'up',2,1700,['u2']],[3,'up',3,700,['u3']],
    [4,'down',1,2600,['d3','d1','d2']],[5,'down',2,1700,['d4']],[6,'down',3,700,['d5']]]);
  const a = splitPoolTwoLevel('1000', L);
  const d1 = a.entries.filter((e)=>e.layer===4).map((e)=>`${e.uid}:${e.x}`);
  out.C_intra_split = { layer4: a.layers.find((l)=>l.layer===4)?.x, d1_entries: d1, sum: a.sum_x, ok: a.sum_x === '1000' };
}
// D. M=0（无上下级）⇒ roster.M=0；splitPoolTwoLevel(0,[]) 空；splitPoolTwoLevel(1000,[]) 抛
{
  const r = buildCommissionRoster('900', upChain([]), downChain({}), policy);
  let throwMsg = 'NO_THROW';
  try { splitPoolTwoLevel('1000', []); } catch (e) { throwMsg = String((e as Error).message).slice(0, 40); }
  out.D_m0 = { roster_M: r.M, roster_uids: r.uids, empty_ok: splitPoolTwoLevel('0', []).sum_ok, nonzero_throws: throwMsg !== 'NO_THROW' };
}
// E. 层内截断留痕（capLayer=2，D1 五人）⇒ dropped_total=3，截断序 bound_at ASC→uid ASC
{
  const r = buildCommissionRoster('900', upChain(['u1']), downChain({ 1: ['d1','d2','d3','d4','d5'] }), policy,
    { capLayer: 2, capTotal: 384 });
  out.E_cap = { kept_L4: r.layers.find((l)=>l.layer===4)?.beneficiaries.map((b)=>b.uid),
    dropped_total: r.truncation.dropped_total, dropped_by_layer: r.truncation.dropped_by_layer, truncated: r.truncation.truncated };
}
// F. 名单构建：上3+下3 ⇒ 存在层 6；M；weights_bp 序位
{
  const r = buildCommissionRoster('900', upChain(['u1','u2','u3']), downChain({ 1:['d1'],2:['d2'],3:['d3'] }), policy);
  out.F_roster = { M: r.M, layers: r.layers.map((l)=>`L${l.layer}:${l.direction}/${l.weight_bp}:${l.beneficiaries.map((b)=>b.uid).join('+')}`), uids: r.uids };
}
// G. 只有上行 2 层 ⇒ 存在层 2（重归一化 W = 2600+1700 = 4300）
{
  const r = buildCommissionRoster('900', upChain(['u1','u2']), downChain({}), policy);
  out.G_up2 = { M: r.M, W: r.W, layers: r.layers.filter((l)=>l.beneficiaries.length>0).map((l)=>`L${l.layer}`) };
}
// H. Worker 结构性剔除 + 防御断言（名单含 worker ⇒ 抛 500 reason）
{
  let caught = 'NO_THROW';
  try {
    assertReferralChainInvariants(upChain(['900','u2']), { worker_uid: '900', roster_uids: ['900','u2'] });
  } catch (e) { caught = `${(e as { code?: string }).code}:${(e as { httpStatus?: number }).httpStatus}`; }
  out.H_worker_in_roster = caught;
}
// I. 旧一级原语逐字保留：splitPool(P, weights) ≡ splitPoolByWeights
{
  const s1 = splitPool('1001', ['2600','1700','700','2600','1700','700']);
  const s2 = splitPoolByWeights('1001', ['2600','1700','700','2600','1700','700']);
  out.I_legacy = { sum: (s1 as { sum_x: string }).sum_x, same_as_primitive: s1.sum_x === s2.sum_x, ok: s1.sum_x === '1001' };
}
// J. getDownChain-like level semantics: levels=4 ⇒ span=4（只取 U1..U3,D1）
{
  const r = buildCommissionRoster('900', upChain(['u1','u2','u3']), downChain({1:['d1'],2:['d2'],3:['d3']}), { levels: 4, weights_bp: W6 });
  out.J_levels4 = { layer_span: r.layer_span, M: r.M, present_L: r.layers.filter((l)=>l.beneficiaries.length>0).map((l)=>l.layer) };
}

console.log(JSON.stringify(out, null, 2));
const allOk = ['A_equal_weights','B_1001','C_intra_split'].every((k)=> (out[k] as { ok: boolean }).ok)
  && (out.I_legacy as { ok: boolean }).ok;
process.exit(allOk ? 0 : 1);
