/**
 * P6-VERCEL-SHAPE 探针：**同一条命令**分别跑「改前模块」与「改后模块」，取 env 面读数，
 * 用于证明 **本地零变化**；并附带**阳性对照**口径（`SF_*` 回退是否真会触发）。
 * ----------------------------------------------------------------------------
 * 用法： `npx ts-node scripts/p4z-p6vs-env-probe.ts <spec> <label>`
 *   spec = `cur`      ⇒ 被测模块 = `../src/env`（改后）
 *   spec = `head`     ⇒ 被测模块 = `./p4z-p6vs-env-head-baseline`（`git show HEAD:backend-ts/src/env.ts` 的逐字副本）
 *   spec = <路径>     ⇒ 任意路径（用于阳性对照：把 env.ts 放到**没有 .env.local 的 repoRoot** 下）
 *
 * 判据字段（**只出摘要，绝不出明文/密钥**）：
 *   · `values_after`：每键「未设=null / 已设=值前 12 位 sha256」；
 *   · `fallback_fired`：改前缺 → 改后有的键（即 **`SF_*` 回退真触发**的键）；本地期望 = `[]`；
 *   · `overwrote_existing`：改前有、改后被**改成别的值**的键（本地期望 = `[]` ⇒ 不覆盖）；
 *   · `canonical_equals_prefixed_after`：规范名与带前缀名**同值**的键（= 回退赋值的直接证据）；
 *   · `unchanged_keys`：改前改后逐键相同的集合（本地期望 = 全体键）。
 * 探针自曝：本探针不经 HTTP、不经服务进程，直接在**新进程**里 require 被测模块 ⇒
 *   读数与 `npm run dev` 拉起时的加载序**同构**（`src/index.ts` 首 import 亦为该模块）。
 */
import * as crypto from 'crypto';
import * as path from 'path';

const KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
  'SF_DATABASE_URL',
  'SF_DATABASE_URL_UNPOOLED',
  'SF_POSTGRES_URL',
  'SF_POSTGRES_URL_NON_POOLING',
  'SECRET_KEY',
];

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['DATABASE_URL', 'SF_DATABASE_URL'],
  ['DATABASE_URL_UNPOOLED', 'SF_DATABASE_URL_UNPOOLED'],
  ['POSTGRES_URL', 'SF_POSTGRES_URL'],
  ['POSTGRES_URL_NON_POOLING', 'SF_POSTGRES_URL_NON_POOLING'],
];

const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);

const snapshot = (): Record<string, string | null> => Object.fromEntries(
  KEYS.map((key) => {
    const value = process.env[key];
    return [key, value === undefined ? null : digest(value)];
  }),
);

const spec = process.argv[2] ?? 'cur';
const label = process.argv[3] ?? spec;
const target = spec === 'cur'
  ? path.resolve(__dirname, '..', 'src', 'env')
  : spec === 'head'
    ? path.resolve(__dirname, 'p4z-p6vs-env-head-baseline')
    : path.resolve(process.cwd(), spec);

const before = snapshot();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loaded = require(target) as { ENV_REPO_ROOT?: string };
const after = snapshot();

console.log(JSON.stringify({
  label,
  target,
  env_repo_root: loaded.ENV_REPO_ROOT ?? null,
  cwd: process.cwd(),
  // 「回退映射真触发」= 启动时**规范名缺失** + 带前缀名**存在** + 加载后规范名 == 那个带前缀名。
  // 注意：只看「缺失→已有」会把 dotenv 的加载也算进来（首轮探针即踩到该误读）——本字段与
  // `absent_at_start_filled_after` **分开报**，两者之差即 dotenv 的贡献。
  canonical_filled_from_prefixed: PAIRS
    .filter(([c, p]) => !before[c] && !!before[p] && after[c] === before[p])
    .map(([c, p]) => `${c}<-${p}`),
  // dotenv / 回退的**合计**效果：启动时缺失、模块加载后已设（来源不限）
  absent_at_start_filled_after: PAIRS.filter(([c]) => !before[c] && !!after[c]).map(([c]) => c),
  overwrote_existing: PAIRS.filter(([c]) => !!before[c] && after[c] !== before[c]).map(([c]) => c),
  canonical_equals_prefixed_after: PAIRS
    .filter(([c, p]) => !!after[c] && !!after[p] && after[c] === after[p])
    .map(([c]) => c),
  unchanged_keys: KEYS.filter((k) => before[k] === after[k]),
  values_after: after,
  at: new Date().toISOString(),
}));
