// market-mm-setup.ts — 方案 C 外部做市 · MM 账户与库存一次性初始化
// ============================================================================
// 职责（派单 · 方案 C 交付①）：
//   1. 生成/读取 MM 钱包：私钥只存 ~/.config/seafood/mm.env（0600，MM_PRIVATE_KEY=…），
//      绝不入库 / 提交 / 打印（运行报告里私钥一律 [REDACTED]）。
//   2. 建 users 行（EVM 地址；已有则复用）—— 走平台既有 `findOrCreateUserByEvm`
//      （钱包登录同一条创建路径，含注册 batt 赠腿的平台既有副作用）。
//   3. 一次性注库存：mint $ 1,000,000 + mint ₿ BTTC 10,000（走 ledger mint op，
//      两个 mint 同一事务（withTransaction + ex 注入）、幂等键；金额可 env 覆盖）。
// 运行：cd backend-ts && npx ts-node --transpile-only scripts/market-mm-setup.ts [--env <path>]
// 纪律：不改撮合引擎、零新路由；写库面 = users + account/ledger_entry（经 ledger 函数）。
// ============================================================================
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Wallet } from 'ethers';
import { closePools, readQuery, withTransaction } from '../src/db';
import { postEvent } from '../src/ledger';
import { DatabaseService } from '../src/database';

const argv = process.argv.slice(2);
const argValue = (name: string): string | null => {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
};

const ENV_PATH = path.resolve(argValue('--env') || path.join(os.homedir(), '.config/seafood/mm.env'));

/** 读既有 env 文件为键值表（不改写 process.env；写回时保留非本脚本管理的键）。 */
const readEnvFile = (file: string): Record<string, string> => {
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k) out[k] = v;
  }
  return out;
};

const writeEnvFile = (file: string, kv: Record<string, string>): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${Object.entries(kv).map(([k, v]) => `${k}=${v}`).join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
};

const assertPositiveAmount = (raw: string, name: string): string => {
  const v = String(raw).trim();
  if (!/^\d+(\.\d+)?$/.test(v) || Number(v) <= 0) {
    throw new Error(`${name} must be a positive decimal number, got ${JSON.stringify(raw)}`);
  }
  return v;
};

(async () => {
  // ① 钱包：有则复用，无则生成；私钥只落 env 文件（0600），全程不打印
  const existing = readEnvFile(ENV_PATH);
  const existingKey = String(existing.MM_PRIVATE_KEY || '').trim();
  let wallet: Pick<Wallet, 'address' | 'privateKey'>;
  let generated = false;
  if (existingKey) {
    wallet = new Wallet(existingKey);
  } else {
    wallet = Wallet.createRandom();
    generated = true;
  }
  writeEnvFile(ENV_PATH, { ...existing, MM_PRIVATE_KEY: wallet.privateKey });
  const evm = wallet.address.toLowerCase();

  // ② users 行：已有则复用（平台既有登录创建路径）
  const user = await DatabaseService.findOrCreateUserByEvm(evm);
  const uid = Number(user.uID);

  // ③ 币种解析：quote = $（cid 1）；base = 平台币 BTTC（name='BTTC' 且 is_platform_coin；
  //    symbol 已改 '₿'，不按 symbol 字面定位 —— 0066 口径；dev cid 399 / 生产 cid 4 两库不同）
  const rows = await readQuery<{
    cid: string; symbol: string; name: string; owner_uid: string;
    decimals: string; status: string; is_platform_coin: boolean | null;
  }>(
    `SELECT cid, symbol, name, owner_uid, decimals, status, is_platform_coin
       FROM currency WHERE cid = 1 OR is_platform_coin = true OR symbol IN ('₿', 'BTTC') ORDER BY cid`,
  );
  const quoteRow = rows.find((r) => Number(r.cid) === 1);
  const baseRows = rows.filter((r) => r.name === 'BTTC' && Number(r.cid) !== 1);
  if (!quoteRow) throw new Error('quote currency $ (cid 1) not found');
  if (baseRows.length !== 1) {
    throw new Error(`expected exactly one platform BTTC row, got ${baseRows.length}: ${JSON.stringify(baseRows.map((r) => r.cid))}`);
  }
  const baseRow = baseRows[0];
  const quoteCid = Number(quoteRow.cid);
  const baseCid = Number(baseRow.cid);

  // ④ 注库存（同事务 + 幂等键；金额可 env 覆盖；platform 标志按行 owner 现取 —— R23）
  const mintUsd = assertPositiveAmount(process.env.MM_MINT_USD || '1000000', 'MM_MINT_USD');
  const mintBase = assertPositiveAmount(process.env.MM_MINT_BASE || '10000', 'MM_MINT_BASE');
  const epoch = String(process.env.MM_SETUP_KEY_EPOCH || '1').replace(/[^\w-]/g, '') || '1';
  const keyUsd = `ops:mm:setup:mint:usd:e${epoch}`;
  const keyBase = `ops:mm:setup:mint:base:e${epoch}`;
  const platformUsd = Number(quoteRow.owner_uid) === 0;
  const platformBase = Number(baseRow.owner_uid) === 0;

  const { usd, base } = await withTransaction(async (tx) => {
    const usdLeg = await postEvent({
      op: 'mint', uid, cid: quoteCid, amount: mintUsd, platform: platformUsd,
      idempotencyKey: keyUsd, memo: 'market maker inventory seeding (USD quote)', ex: tx,
    });
    const baseLeg = await postEvent({
      op: 'mint', uid, cid: baseCid, amount: mintBase, platform: platformBase,
      idempotencyKey: keyBase, memo: 'market maker inventory seeding (BTTC base)', ex: tx,
    });
    return { usd: usdLeg, base: baseLeg };
  });

  // ⑤ 读回账户快照 + 输出运行报告（私钥 [REDACTED]）
  const accounts = await readQuery<{ uid: string; cid: string; balance: string; frozen: string }>(
    'SELECT uid, cid, balance, frozen FROM account WHERE uid = $1 ORDER BY cid',
    [String(uid)],
  );

  const report = {
    env_file: ENV_PATH,
    env_file_mode: '0600',
    private_key: '[REDACTED]',
    key_generated: generated,
    evm_address: evm,
    uid,
    user_created: !existingKey || generated ? 'created_or_reused_by_evm_lookup' : 'reused_by_evm_lookup',
    currencies: {
      quote: { cid: quoteCid, symbol: quoteRow.symbol, decimals: Number(quoteRow.decimals), status: quoteRow.status },
      base: { cid: baseCid, symbol: baseRow.symbol, name: baseRow.name, decimals: Number(baseRow.decimals), status: baseRow.status },
    },
    mints: [
      {
        cid: quoteCid, amount: mintUsd, idempotency_key: keyUsd,
        idempotent_replay: usd.idempotent_replay, txid: usd.txid,
      },
      {
        cid: baseCid, amount: mintBase, idempotency_key: keyBase,
        idempotent_replay: base.idempotent_replay, txid: base.txid,
      },
    ],
    same_transaction: true,
    accounts_after: accounts.map((a) => ({ cid: Number(a.cid), balance: a.balance, frozen: a.frozen })),
  };
  console.log(JSON.stringify(report, null, 2));
  await closePools();
})().catch(async (e) => {
  console.error('MM SETUP FAILED:', (e as Error)?.message ?? e);
  await closePools().catch(() => undefined);
  process.exit(1);
});
