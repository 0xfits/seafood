/**
 * P1e · 延迟前后对比探针（同一脚本、同一环境，前后各跑一次）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1e-01-latency.ts <phase>
 *   phase = before | after   （只用于生成互不冲突的幂等键，使两次都是「首次生效」冷路径）
 *
 * 读数：
 *   ① transfer 串行 3 次（无并发）：逐次毫秒 + 中位数
 *   ② BEGIN…COMMIT 基线 3 次（withTransaction + SELECT 1）
 *   ③ mint 串行 2 次（参照，非必跑项）
 *   ④ 落账后余额读数（证明真的生效，不是空跑）
 *
 * 纪律：uid 一律 92xxxx；symbol 前缀 p1e；幂等键 ops:p1e:*；不碰 cid=1 与平台账户。
 */
import { closePools, readQuery, txQuery, withTransaction } from '../src/db';
import { getAccount, mint, transfer } from '../src/ledger';

const PHASE = String(process.argv[2] || 'before');
const OWNER = 920001n;   // p1eGLD owner（唯一可铸）
const PEER = 920002n;    // 收款方
const RUN = Date.now().toString(36).slice(-6);
const SYMBOL = 'p1eGLD';

const ms = async (fn: () => Promise<unknown>): Promise<number> => {
  const t0 = Date.now();
  await fn();
  return Date.now() - t0;
};

const ensureCurrency = async (): Promise<string> => {
  const found = await readQuery<{ cid: string }>('SELECT cid FROM currency WHERE symbol = $1', [SYMBOL]);
  if (found.length) return found[0].cid;
  const rows = await withTransaction(async (tx) =>
    txQuery<{ cid: string }>(
      tx,
      `INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
       VALUES ($1, $2, $3, 0, 0, NULL, 'listed', now()) RETURNING cid`,
      [SYMBOL, 'P1e 延迟测试金', OWNER.toString()],
    ));
  return rows[0].cid;
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};

(async () => {
  const out: Record<string, unknown> = { phase: PHASE, run: RUN };
  const cid = await ensureCurrency();
  out.cid = cid;

  // 种子：铸 100000 给 OWNER（固定键，只生效一次）
  const seed = await mint({ uid: OWNER, cid, amount: 100000n, idempotencyKey: 'ops:p1e:seed:mint', memo: 'p1e seed' });
  out.seed = { txid: seed.txid, replay: seed.idempotent_replay, supply_after: seed.extra.supply_after };

  // 热身（不计时；把连接/语句缓存的首次成本排除在读数外）
  await transfer({ fromUid: OWNER, toUid: PEER, cid, amount: 1n, idempotencyKey: `ops:p1e:warm:${PHASE}:${RUN}`, memo: 'warmup' });

  // ① transfer  ×3
  const transferMs: number[] = [];
  const sample: Array<Record<string, unknown>> = [];
  for (let i = 1; i <= 3; i += 1) {
    const k = `ops:p1e:lat:${PHASE}:${RUN}:transfer:${i}`;
    const t0 = Date.now();
    const r = await transfer({ fromUid: OWNER, toUid: PEER, cid, amount: 1n, idempotencyKey: k, memo: 'p1e lat' });
    const dt = Date.now() - t0;
    transferMs.push(dt);
    sample.push({ i, ms: dt, txid: r.txid, entries: r.entries.length, replay: r.idempotent_replay });
  }
  out.transfer_ms = transferMs;
  out.transfer_median_ms = median(transferMs);
  out.transfer_samples = sample;

  // ② BEGIN…COMMIT 基线 ×3
  const txMs: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    txMs.push(await ms(() => withTransaction(async (tx) => txQuery(tx, 'SELECT 1'))));
  }
  out.begin_commit_ms = txMs;
  out.begin_commit_median_ms = median(txMs);

  // ③ mint ×2（参照）
  const mintMs: number[] = [];
  for (let i = 1; i <= 2; i += 1) {
    mintMs.push(await ms(() => mint({
      uid: OWNER, cid, amount: 1n, idempotencyKey: `ops:p1e:lat:${PHASE}:${RUN}:mint:${i}`, memo: 'p1e lat',
    })));
  }
  out.mint_ms = mintMs;
  out.mint_median_ms = median(mintMs);

  // ④ 余额读数
  out.accounts = {
    owner: await getAccount(OWNER, cid),
    peer: await getAccount(PEER, cid),
  };

  console.log(JSON.stringify(out, null, 2));
  await closePools();
})().catch(async (e) => {
  console.error('PROBE FAILED:', (e as Error)?.stack ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
