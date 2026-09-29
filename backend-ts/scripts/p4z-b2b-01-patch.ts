// p4z-b2b-01-patch.ts — P4-B2b 代码补丁器（**命中数断言，不符即中止不写文件**）
// Usage: ts-node --transpile-only scripts/p4z-b2b-01-patch.ts <outDir>
//   · 备份改动前的 src/database.ts / src/index.ts 到 <outDir>/orig/
//   · database.ts：插入 4 个非资金写方法（读 <outDir>/database-methods.snippet）
//   · index.ts：5 个商品面写口 ⇒ 410（admin/prize/create|update|delete, shard/redeem, chest/:bID/open）
//   · 断言：端点注册点数**仍为 51**；JWT 不落盘；写 patch-log.json
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const root = path.join(__dirname, '..');
const outDir = process.argv[2] || path.join(root, '.p4-artifacts', 'b2b-unknown');
const origDir = path.join(outDir, 'orig');
fs.mkdirSync(origDir, { recursive: true });

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const log: Record<string, unknown> = { generated_at: new Date().toISOString(), steps: [] };

const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const backup = (rel: string) => {
  const name = rel.replace(/[\/]/g, '_') + '.orig';
  const p = path.join(origDir, name);
  if (!fs.existsSync(p)) fs.writeFileSync(p, read(rel));
  return path.relative(root, p);
};

/** 以「签名行 → 下一个 `\n});\n`」为界替换整个 handler（对内部缩进/内容不敏感） */
const replaceHandler = (src: string, signature: string, newBody: string) => {
  const start = src.indexOf(signature);
  if (start < 0) throw new Error(`signature NOT FOUND: ${signature}`);
  if (src.indexOf(signature, start + 1) >= 0) throw new Error(`signature NOT UNIQUE: ${signature}`);
  const endMarker = '\n});\n';
  const end = src.indexOf(endMarker, start);
  if (end < 0) throw new Error(`end NOT FOUND for: ${signature}`);
  return src.slice(0, start) + newBody + src.slice(end + endMarker.length);
};

// ---------------------------------------------------------------- database.ts
const anchor = '  /** §3.1/DL111：解析 :identifier（application_id 或 job_id）→ 该 worker 的申请；他人申请返回 ownership=\'other\' */';
let db = read('src/database.ts');
log.db_before_sha = sha(db);
log.db_backup = backup('src/database.ts');
if (db.includes('createListingRow')) throw new Error('database.ts 已含 createListingRow（重复打补丁？）');
const snippet = fs.readFileSync(path.join(outDir, 'database-methods.snippet'), 'utf8');
if (db.indexOf(anchor) < 0 || db.indexOf(anchor) !== db.lastIndexOf(anchor)) throw new Error('anchor 未命中或不唯一');
db = db.replace(anchor, snippet + anchor);
fs.writeFileSync(path.join(root, 'src/database.ts'), db);
log.steps.push({ file: 'src/database.ts', action: 'insert 4 methods', at: 'before resolveJobApplication', db_after_sha: sha(db), bytes: db.length });

// ---------------------------------------------------------------- index.ts
let ix = read('src/index.ts');
log.index_before_sha = sha(ix);
log.index_backup = backup('src/index.ts');

// (1) 过期日常量（§5.1 逐行「过期日」列）
if (ix.includes('ADMIN_PRIZE_SUNSET')) throw new Error('index.ts 已含 ADMIN_PRIZE_SUNSET（重复打补丁？）');
const sunsetAnchor = "const ADMIN_TASK_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';\n";
if (ix.indexOf(sunsetAnchor) !== ix.lastIndexOf(sunsetAnchor) || ix.indexOf(sunsetAnchor) < 0) throw new Error('ADMIN_TASK_SUNSET 常量锚未命中或不唯一');
ix = ix.replace(sunsetAnchor, sunsetAnchor + [
  "// P4-B2b：商品面弃用面的过期日（逐字取自 §5.1 每行的「过期日」列；未决 §7-1 ⇒ 上线日待 Kevin 定）",
  "const ADMIN_PRIZE_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';",
  "const LEGACY_REWARD_WRITE_SUNSET = '批 3 末删除路径（§5.1 碎片写口①/宝箱写口；未决 §7-1：过期日待 Kevin 定）';",
  '',
].join('\n'));
log.steps.push({ file: 'src/index.ts', action: 'add 2 sunset constants' });

// (2) 后台发布商品三写口 ⇒ 410（§1 #42/#43/#44 + §5.1 + C3 ①）
const goneComment = (refId: string) => [
  `  // P4-B2b：§1 #${refId} + §5.1「后台发布商品」+ C3 ①（整体删除）⇒ 一律 410 + R107 形状。`,
  '  // 撤 `requireAdmin` 前置：本仓 `resolveActor` 把 DB 异常吞成 401（B2a-HTTP §2 实测）⇒',
  '  // 弃用面**不得**把「已下线」伪装成「未授权」（与 `/api/admin/task/*` 同口径）。',
].join('\n');

const newHandler = (signature: string, comment: string, refPath: string, sunset: string) => (
  [
    signature.replace('async (req, res) => {', 'async (_req, res) => {'),
    comment,
    `  return sendGone(res, '${refPath}', ${sunset});`,
    '});',
    '',
  ].join('\n')
);

ix = replaceHandler(ix, "app.post('/api/admin/prize/create', async (req, res) => {",
  newHandler("app.post('/api/admin/prize/create', async (req, res) => {", goneComment('42'), '/api/admin/prize/create', 'ADMIN_PRIZE_SUNSET'));
ix = replaceHandler(ix, "app.post('/api/admin/prize/update', async (req, res) => {",
  newHandler("app.post('/api/admin/prize/update', async (req, res) => {", goneComment('43'), '/api/admin/prize/update', 'ADMIN_PRIZE_SUNSET'));
ix = replaceHandler(ix, "app.post('/api/admin/prize/delete', async (req, res) => {",
  newHandler("app.post('/api/admin/prize/delete', async (req, res) => {", goneComment('44'), '/api/admin/prize/delete', 'ADMIN_PRIZE_SUNSET'));

// (3) 碎片写口 / 宝箱写口 ⇒ 410（§1 #23/#24 + §5.1）
const legacyComment = (refId: string, why: string) => [
  `  // P4-B2b：§1 #${refId} + §5.1 ⇒ 写口一律 410（**不得**用 200 空态冒充成功）：${why}`,
  '  // 撤 `requireActor` 前置：弃用面不返回 401（否则「已下线」被伪装成「未授权」）。',
].join('\n');

ix = replaceHandler(ix, "app.post('/api/shard/redeem', async (req, res) => {",
  newHandler("app.post('/api/shard/redeem', async (req, res) => {", legacyComment('23', '碎片兑换在 `cid` 模型里无对应语义（等值动作 = 交易所 `trade` / `transfer`）'), '/api/shard/redeem', 'LEGACY_REWARD_WRITE_SUNSET'));
ix = replaceHandler(ix, "app.post('/api/chest/:bID/open', async (req, res) => {",
  newHandler("app.post('/api/chest/:bID/open', async (req, res) => {", legacyComment('24', '「凭空调入余额」与 `DL5` 双分录正面冲突'), '/api/chest/:bID/open', 'LEGACY_REWARD_WRITE_SUNSET'));

// 断言：端点注册点数不变（派单硬口径 #2）
const routeCount = (src: string) => (src.match(/^app\.(get|post|put|delete|patch)\(/gm) || []).length;
log.routes_before = routeCount(ix.replace(/P4-B2b/g, ''));
log.routes_after = routeCount(ix);
if (log.routes_after !== 51) throw new Error(`端点注册点数 = ${log.routes_after}，须为 51 ⇒ 中止`);
log.index_after_sha = sha(ix);
log.steps.push({ file: 'src/index.ts', action: 'admin/prize/{create,update,delete} + shard/redeem + chest/:bID/open ⇒ 410', routes_after: log.routes_after, bytes: ix.length });
fs.writeFileSync(path.join(root, 'src/index.ts'), ix);

// 自检：产物/代码内不得出现 JWT 三段式首段前缀（token 不落盘）
const leaked = [read('src/index.ts'), read('src/listing-service.ts'), read('src/database.ts')]
  .reduce((acc, s) => acc + (s.match(/e[y]J/g) || []).length, 0);
log.jwt_like_tokens_in_src = leaked;
if (leaked !== 0) throw new Error(`src/** 内出现 ${leaked} 处 JWT 形态串`);

fs.writeFileSync(path.join(outDir, 'patch-log.json'), JSON.stringify(log, null, 2));
console.log('PATCH_OK ' + JSON.stringify(log));
