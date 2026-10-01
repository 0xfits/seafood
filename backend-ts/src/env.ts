/**
 * P4-SEC · 进程级环境加载的**唯一入口**。
 * ============================================================================
 * 缺陷（实测）：`src/auth.ts:3` 在**模块加载期**读 `process.env.SECRET_KEY`，
 * 而 dotenv 的调用点在 `src/database.ts` / `src/db.ts` 顶部；`src/index.ts` 先 import `./auth`
 * （第 4 行）再 import `./database`（第 11 行）⇒ auth 的模块初始化**早于** dotenv，
 * `process.env.SECRET_KEY` 恒为 undefined ⇒ 实际生效的是硬编码兑底常量。
 *
 * 裁定：本模块只做一件事 —— 在任何业务模块（尤其是 `./auth`）被求值之前，
 * 把 `.env.local` / `.env` 注入 `process.env`；`src/index.ts` **第一行** import 它。
 *
 * 路径口径（实测取证，非假设）：服务进程 5788 的 cwd == `/Users/kevin/bistro/seafood/backend-ts`
 * （lsof -a -p <pid> -d cwd；面板 `/api/status` 的 `seafood-api.cwd` 同值）。
 * 即便如此，这里仍按**模块位置**（`__dirname`）解析，不依赖 cwd —— 面板/脚本/测试以别的 cwd
 * 拉起本服务时同样成立。
 *
 * 优先级（dotenv 默认**不覆盖**已存在的变量 ⇒ 先加载者胜）：
 *   ① 显式外部注入的 process.env（最高，dotenv 不动它）
 *   ② <repo>/.env.local   ← 本地凭据真源（Vercel/Neon 风格）
 *   ③ <repo>/.env
 *   ④ cwd/.env（历史行为兜底）
 */
import * as path from 'path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(repoRoot, '.env.local') });
dotenv.config({ path: path.join(repoRoot, '.env') });
dotenv.config();

/**
 * P6-VERCEL-SHAPE：Vercel 环境变量 **前缀回退映射**（单点小表）。
 * ============================================================================
 * 引证来源（均为**现取**，非推断）：
 *   · Vercel 项目 `alwaysfit/seafood` 的**环境变量名单**（`vercel env` 面，Kong/Zang 现取）：
 *     库连接串**全部带 `SF_` 前缀** —— `SF_DATABASE_URL` / `SF_DATABASE_URL_UNPOOLED`
 *     / `SF_POSTGRES_URL` / `SF_POSTGRES_URL_NON_POOLING`；
 *   · 而本仓业务面读的是**不带前缀**的规范名（现取 grep：`src/database.ts:60-66`、
 *     `src/db.ts:34-48`、`src/ledger.ts:988`、`src/ledger.ts:1014`）；
 *   · serverless 运行时**没有 dotenv 文件**可兜底（`.env.local` 属本地凭据，不入仓）⇒
 *     规范名 undefined ⇒ 读库/事务直接抛（外部实测：`GET /api/home` = 500）。
 *   · `SECRET_KEY` **不需要**映射：它已由 Zang 以**不带前缀**的名字写入 Vercel
 *     （Production + Preview/main），故**不在**本表内。
 *
 * 规则（"先到先得"，本地零变化）：
 *   ① 仅当**规范名缺失**（`!process.env[canonical]`）**且**带前缀名存在时才赋值；
 *   ② 已存在的值**永不覆盖** ⇒ 本地 `.env.local` / 显式注入的 `process.env` 一律优先；
 *   ③ 本模块是 `src/index.ts` 的**首 import** ⇒ 映射早于任何业务模块（auth/db/database/ledger）求值。
 */
const VERCEL_PREFIX_FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ['DATABASE_URL', 'SF_DATABASE_URL'],
  ['DATABASE_URL_UNPOOLED', 'SF_DATABASE_URL_UNPOOLED'],
  ['POSTGRES_URL', 'SF_POSTGRES_URL'],
  ['POSTGRES_URL_NON_POOLING', 'SF_POSTGRES_URL_NON_POOLING'],
];

for (const [canonical, vercelName] of VERCEL_PREFIX_FALLBACKS) {
  if (!process.env[canonical] && process.env[vercelName]) {
    process.env[canonical] = process.env[vercelName];
  }
}

export const ENV_REPO_ROOT = repoRoot;
