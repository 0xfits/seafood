/**
 * P1i · 一次性工具：**遗忘**某个 migration 版本行（仅用于「已应用后又修正了未登记完毕的迁移文件」）
 * ============================================================================
 * ⚠️⚠️ 使用范围（Zang 裁定 D，逐字遵守）⚠️⚠️
 *   **本工具只能用于「尚未交付」的迁移文件；任何已经 commit / push / 已交付给下游的迁移
 *     —— 一律不得使用本工具。**
 *   理由：删掉 `schema_migration` 行会让库里出现「文件已改、注册表无记录」的
 *   **撒谎态**（P1i 轮已真实发生过一次：注册表记 0004、而 pg_proc 里是首版 0005 函数）。
 *   已交付的迁移要改，只能**新建**一个后续迁移（如 0006）来修正，不得回头改历史。
 *
 * 背景：`scripts/migrate.ts` 有 checksum 漂移保护 —— 已应用的文件再改，会 ABORT（exit 3）而不是
 * 静默重放。只有当某个迁移**尚未交付**、且其文件内容刚被修正时，才需要：
 *   ① 删掉 `schema_migration` 里那一行；② 重跑 migrate 重新应用。
 *
 * 闸门（三道，缺一不可；**任何一道不过就直接拒绝，且不打开任何 DB 连接、不动任何行**）：
 *   ① 必须给出 `<version>` 参数（否则 USAGE，exit 3）；
 *   ② 必须显式带 `--force`（否则 FORCE_REQUIRED，exit 3）—— 防手滑、防脚本误调；
 *   ③ `0001`–`0004` 基座**硬拒**（需额外 `--allow-base`，本单绝不使用）。
 *
 * 纪律：只碰 `schema_migration` 一张表、一行；打印删除前后的行，留证。
 *
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1i-forget-migration.ts <version> --force
 * 退出码：0 = 真的删了；3 = 被闸门拒绝（什么都没做）；2 = 其它致命错误。
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const PROTECTED = ['0001', '0002', '0003', '0004'];

/** 拒绝出口：**不建池、不连库、不写任何行**，只打印可机读拒绝记录 */
const refuse = (reason: string, detail: Record<string, unknown> = {}): never => {
  console.log(JSON.stringify({
    ok: false,
    refused: true,
    reason,
    db_connections_opened: 0,
    rows_deleted: 0,
    ...detail,
    note: '闸门拒绝：什么都没做。本工具只能用于**尚未交付**的迁移；已 push 的迁移不得使用。',
  }, null, 2));
  process.exit(3);
};

(async () => {
  const argv = process.argv.slice(2);
  const version: string = argv.find((a) => !a.startsWith('--')) ?? '';

  if (version === '') {
    refuse('USAGE', {
      usage: 'npx ts-node --transpile-only scripts/p1i-forget-migration.ts <version> --force',
    });
  }
  // ② `--force` 显式闸（Zang 裁定 D）：不带就拒绝
  if (!argv.includes('--force')) {
    refuse('FORCE_REQUIRED', {
      version,
      hint: '必须显式带 --force 才会执行删行；且仅限**尚未交付**的迁移。已 push 的迁移一律新建后续迁移修正。',
    });
  }
  // ③ 0001–0004 基座硬拒
  if (PROTECTED.includes(version) && !argv.includes('--allow-base')) {
    refuse('BASE_PROTECTED', {
      version,
      protected_versions: PROTECTED,
      hint: '0001–0004 属基座，本工具只允许动 0005+（确需请显式 --allow-base，仍须 --force）',
    });
  }

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
  if (!url) throw new Error('缺少 DATABASE_URL_UNPOOLED / DATABASE_URL');

  const p = new Pool({ connectionString: url, max: 1 });
  try {
    const before = await p.query('SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version');
    const del = await p.query('DELETE FROM schema_migration WHERE version = $1 RETURNING version, name, checksum', [version]);
    const after = await p.query('SELECT version, name, checksum, applied_at FROM schema_migration ORDER BY version');
    console.log(JSON.stringify({
      ok: true,
      forced: true,
      deleted: del.rows,
      rows_before: before.rows.map((r) => r.version),
      rows_after: after.rows.map((r) => r.version),
      kept_untouched: after.rows.filter((r) => PROTECTED.includes(String(r.version))).map((r) => `${r.version}:${String(r.checksum).slice(0, 12)}`),
    }, null, 2));
  } finally {
    await p.end().catch(() => undefined);
  }
  process.exit(0);
})().catch((e) => {
  console.error('forget-migration fatal:', String((e as Error)?.message || e).slice(0, 300));
  process.exit(2);
});
