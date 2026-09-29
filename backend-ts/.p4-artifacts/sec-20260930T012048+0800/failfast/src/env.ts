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

export const ENV_REPO_ROOT = repoRoot;
