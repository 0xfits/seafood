// p4z-b3b-03-legs.ts — P4-B3b 分录逐腿取证（**只读**）
// ============================================================================
// 探针教训（§5.7 ④「读数异常先怀疑自己的探针」）：`ledger_entry.txid` 是**逐行**的，
//   同一事件的多条腿**各有各的 txid**（对照 FIX-A 读数「txid 28 / 29」= 同一事件两腿）
//   ⇒ 取「一个事件的全部分录」必须按 **`idempotency_key`**（事件键）分组，不能按 txid。
// 本脚本按事件键逐腿 dump 并复算断言（供 Zang 自算）。
// 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-b3b-03-legs.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3b-run'));
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}
/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));

type Row = Record<string, string>;
const KEY = (s: string) => `cli:p4b3b:${RUN}:${s}`;
/** ★ 探针教训 ②：`sql(\`…${x}…\`)` 是**调用式** ⇒ JS 先把插值**内联**成字符串（数值侥幸成立、
 *   文本直接语法错）⇒ 必须用**标签模板** `sql\`…${x}…\``（变量走 driver 绑定）。 */
const tq = sql as unknown as (t: TemplateStringsArray, ...v: unknown[]) => Promise<Row[]>;
/** ★ 探针教训 ③：一条事件的多条腿**不是**同一个 `idempotency_key` —— 账本按 `K`,`K#2`,`K#3`… 派生
 *   （`route-layer.spec` §4.4-1 的 `{K, K#2}` 语义）⇒ 取「一个事件的全部分录」必须 `= K OR LIKE K#%`。 */
const legsOf = async (key: string) =>
  (await tq`SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
                     frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
                     frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id,
                     idempotency_key
              FROM public.ledger_entry
              WHERE idempotency_key = ${key} OR idempotency_key LIKE ${key + '#%'}
              ORDER BY txid`) as Row[];

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), run: RUN, mode: 'READ-ONLY' };
  const keys: Array<[string, string]> = [
    ['C1_happy_currency_create_fee', KEY('c1-create')],
    ['C1_server_default_fee', KEY('c1-default')],
    ['C2_happy_list', KEY('c2-list')],
    ['C2_server_default_list', KEY('c2-default')],
    ['C2_not_owner_should_be_empty', KEY('c2-notowner')],
    ['C2_insufficient_should_be_empty', KEY('c2-insuf')],
    ['C1_insufficient_should_be_empty', KEY('c1-insuf')],
  ];
  for (const [label, key] of keys) out[label] = { key, legs: await legsOf(key) };

  const c2: Row[] = ((out.C2_happy_list as { legs: Row[] }).legs) || [];
  const c2def: Row[] = ((out.C2_server_default_list as { legs: Row[] }).legs) || [];
  const asrt = (legs: Row[]) => ({
    legs: legs.length,
    kinds: legs.map((l) => l.kind),
    all_frozen_delta_zero: legs.every((l) => l.frozen_delta === '0'),
    frozen_delta_values: legs.map((l) => l.frozen_delta),
    uid_set: Array.from(new Set(legs.map((l) => l.uid))).sort(),
    balance_legs_only: legs.filter((l) => l.kind === 'listing_deposit').every((l) => l.frozen_delta === '0'),
    listing_deposit_legs: legs.filter((l) => l.kind === 'listing_deposit'),
    delta_sum_zero: legs.reduce((a, l) => a + BigInt(l.delta), 0n).toString(),
    frozen_sum_zero: legs.reduce((a, l) => a + BigInt(l.frozen_delta), 0n).toString(),
  });
  out.assertions = {
    c2_happy: asrt(c2),
    c2_server_default: asrt(c2def),
    take_away_ok: {
      both_events_4_legs: c2.length === 4 && c2def.length === 4,
      no_frozen_anywhere: [...c2, ...c2def].every((l) => l.frozen_delta === '0'),
      listing_deposit_credits_neg1: [...c2, ...c2def].some((l) => l.kind === 'listing_deposit' && l.uid === '-1' && BigInt(l.delta) > 0n),
      listing_deposit_debits_owner: [...c2, ...c2def].some((l) => l.kind === 'listing_deposit' && l.uid === '970001' && BigInt(l.delta) < 0n),
    },
  };

  fs.writeFileSync(path.join(outDir, 'b3b-03-legs.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3b-03-legs.json'));
  for (const [label, key] of keys) {
    const legs = (out[label] as { legs: Row[] }).legs;
    console.log(label + ' (' + key + ') legs=' + legs.length);
    for (const l of legs) console.log(`   txid=${l.txid} uid=${l.uid} cid=${l.cid} delta=${l.delta} frozen_delta=${l.frozen_delta} kind=${l.kind} bal_after=${l.balance_after} frz_after=${l.frozen_after} ref=${l.ref_type}/${l.ref_id}`);
  }
  console.log('ASSERTIONS ' + JSON.stringify(out.assertions, null, 1));
};

main().then(() => process.exit(0)).catch((e) => { console.error('FAILED ' + String(e)); process.exit(1); });
