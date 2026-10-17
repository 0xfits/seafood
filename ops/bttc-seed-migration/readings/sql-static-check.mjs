/**
 * 0049_seed_bttc_currency.sql 静态体检（零数据库连接 · 零网络 · 不跑 psql/pg）
 * 用法：node ops/bttc-seed-migration/readings/sql-static-check.mjs
 * 出口：全 PASS ⇒ 0；任一 FAIL ⇒ 1。读数同时打到 stdout 与 sql-static-check.json。
 *
 * 口径说明：这是**词法/结构**体检（括号、$$ 配对、语句数、列值位数、破坏性语句缺席、
 * 与 database.ts `ensureBttcCurrency` 的列清单与值逐字比对、自检 DO 块断言在场）。
 * 它**不**替代真库语法校验 —— apply 由 Zang 在 dev/生产执行（本单不连库）。
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/kevin/bistro/seafood';
const SQL_PATH = path.join(REPO, 'backend-ts/migrations/0049_seed_bttc_currency.sql');
const DB_PATH = path.join(REPO, 'backend-ts/src/database.ts');

const sql = fs.readFileSync(SQL_PATH, 'utf8');
const dbSrc = fs.readFileSync(DB_PATH, 'utf8');
const checks = [];
const ok = (id, pass, expect, actual) => checks.push({ id, pass: !!pass, expect, actual });
const decomment = (s) => s.replace(/--[^\n]*/g, '');
const stringsBlank = (s) => s.replace(/'(?:[^']|'')*'/g, "''");

// ── 切出 `DO $$ … $$` 块内 / 块外两半 ────────────────────────────────────────────────
const doStart = sql.indexOf('DO $$');
const doEnd = sql.lastIndexOf('$$');
const doBlock = doStart >= 0 && doEnd > doStart ? sql.slice(doStart, doEnd + 2) : '';
const outsideDo = doStart >= 0 && doEnd > doStart ? sql.slice(0, doStart) + sql.slice(doEnd + 2) : sql;
const doBody = decomment(doBlock);

// ── 1 事务包装：DO 块外不得出现 BEGIN / COMMIT / ROLLBACK（migrate.ts 逐文件包事务）
//    ★ 块内的 `BEGIN … END` 是 PL/pgSQL 块起头，不是事务控制，不在此列。
const stmtLines = outsideDo.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('--'));
const txnLines = stmtLines.filter((l) => /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(l));
ok('no-begin-commit', txnLines.length === 0, 'DO 块外 0 条以 BEGIN/COMMIT/ROLLBACK 开头的语句', JSON.stringify(txnLines));

// ── 2 注释不含以 `/*` 结尾的路径字面（仓内审计脚本按正则剥块注释，会吞掉后续代码）
ok('no-block-comment-marker', sql.indexOf('/*') === -1, "出现 0 次 '/*'", `${sql.split('/*').length - 1} 次`);

// ── 3 词法平衡：圆括号 / $$ 配对
const flat = stringsBlank(decomment(sql));
const bal = (s, a, b) => [...s].reduce((n, ch) => (ch === a ? n + 1 : ch === b ? n - 1 : n), 0);
ok('paren-balance', bal(flat, '(', ')') === 0, '圆括号净差 = 0', bal(flat, '(', ')'));
ok('dollar-quote-pairs', (sql.match(/\$\$/g) || []).length === 2, '$$ 恰好 2 次（1 个 DO 块）', (sql.match(/\$\$/g) || []).length);

// ── 4 语句结构：DO 块外恰好 1 条语句（顶层 INSERT）；IF / END IF 平衡
const topStmts = decomment(outsideDo).split(';').map((s) => s.trim()).filter(Boolean);
ok('stmt-count-outside-do', topStmts.length === 1 && /^INSERT INTO public\.currency/i.test(topStmts[0]),
  'DO 块外恰好 1 条且为 INSERT INTO public.currency', `n=${topStmts.length} head=${(topStmts[0] || '').slice(0, 32)}`);
const endIfN = (doBody.match(/\bEND IF\b/g) || []).length;
const standaloneIfN = (doBody.match(/\bIF\b/g) || []).length - endIfN;  // `END IF` 里也含 IF，先扣掉
ok('if-endif-balance', standaloneIfN === endIfN && endIfN > 0, '独立 IF 数 == END IF 数（>0）', `${standaloneIfN} / ${endIfN}`);

// ── 5 幂等形态（与 ensureBttcCurrency 同形：谓词闸 + 唯一约束兜底）
ok('idempotent-not-exists', /WHERE NOT EXISTS \(SELECT 1 FROM public\.currency AS c WHERE c\.symbol = 'BTTC'\)/.test(sql),
  'INSERT … SELECT … WHERE NOT EXISTS (symbol=BTTC)', '命中');
ok('idempotent-on-conflict', /ON CONFLICT \(symbol\) DO NOTHING/.test(sql), 'ON CONFLICT (symbol) DO NOTHING', '命中');

// ── 6 破坏性语句缺席（只允许 INSERT 业务行 + 只读自检）
const destructive = ['UPDATE', 'DELETE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'];
const found = destructive.filter((k) => new RegExp(`(^|[;\\s])${k}\\b`, 'i').test(decomment(outsideDo)));
ok('no-destructive-stmt', found.length === 0, 'DO 块外零 UPDATE/DELETE/TRUNCATE/DROP/ALTER/CREATE', JSON.stringify(found));

// ── 7 列清单 / 值 与 database.ts `ensureBttcCurrency` 逐字比对（唯一口径源）
const ensureBlock = dbSrc.slice(dbSrc.indexOf('static async ensureBttcCurrency'), dbSrc.indexOf('R1 · 用户 BTTC 资产读口'));
const colsOf = (src) => (src.match(/INSERT INTO public\.currency\s*\n?\s*\(([^)]*)\)/) || [, ''])[1]
  .split(',').map((s) => s.trim()).filter(Boolean);
const valuesOf = (src) => ((src.match(/SELECT\s+('BTTC'[\s\S]*?)\s*WHERE NOT EXISTS/) || [, ''])[1])
  .replace(/\s+/g, ' ').trim();  // ★ 含 symbol 字面本身（不剥 'BTTC'，否则 symbol 值比对是空门）
const ensureCols = colsOf(ensureBlock);
const migCols = colsOf(decomment(sql));
const ensureValues = valuesOf(ensureBlock);
const migValues = valuesOf(decomment(sql));
ok('columns-identical', JSON.stringify(ensureCols) === JSON.stringify(migCols),
  `ensure 列清单 = ${JSON.stringify(ensureCols)}`, `迁移列清单 = ${JSON.stringify(migCols)}`);
ok('values-identical', ensureValues === migValues, `ensure 值 = ${ensureValues}`, `迁移值 = ${migValues}`);
ok('columns-vs-values-count', migCols.length === migValues.split(',').filter((s) => s.trim()).length,
  `列数 == 值数（${migCols.length}）`, `${migCols.length} == ${migValues.split(',').filter((s) => s.trim()).length}`);

// ── 8 自检 DO 块：五条必需断言 + 附加列回读 + 必抛异常
for (const [id, re, expect] of [
  ['selfcheck-exactly-1-row', /count\(\*\)::int INTO v_rows[\s\S]*?v_rows <> 1/, 'BTTC 行数 = 1'],
  ['selfcheck-status-listed', /v_status IS DISTINCT FROM 'listed'/, "status = 'listed'"],
  ['selfcheck-platform-coin', /v_platform IS DISTINCT FROM true/, 'is_platform_coin = true'],
  ['selfcheck-decimals-0', /v_decimals IS DISTINCT FROM 0::smallint/, 'decimals = 0'],
  ['selfcheck-listed-at', /v_listed_at IS NULL/, 'listed_at IS NOT NULL'],
  ['selfcheck-name', /v_name IS DISTINCT FROM 'battcoin'/, "name = 'battcoin'"],
  ['selfcheck-owner', /v_owner IS DISTINCT FROM 0::bigint/, 'owner_uid = 0'],
  ['selfcheck-deposit', /v_dep_amt IS DISTINCT FROM 0::bigint/, 'deposit_amount = 0'],
  ['selfcheck-deposit-cid', /v_dep_cid IS DISTINCT FROM 1::bigint/, 'deposit_cid = 1'],
  ['selfcheck-supply-cap-null', /v_cap IS NOT NULL/, 'supply_cap IS NULL'],
  ['selfcheck-supply-nonneg', /v_supply IS NULL OR v_supply < 0/, 'total_supply >= 0（不硬判 =0，重跑免疫）'],
  ['selfcheck-raises', /RAISE EXCEPTION/, '不满足即 RAISE EXCEPTION'],
]) ok(id, re.test(doBody), expect, re.test(doBody) ? '命中' : '未命中');

// ── 9 落盘 + 输出
const failed = checks.filter((c) => !c.pass);
const report = { generated_at: new Date().toISOString(), file: SQL_PATH, checks, total: checks.length, passed: checks.length - failed.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'sql-static-check.json'), JSON.stringify(report, null, 2));
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.id} :: ${c.actual}`);
console.log(`\n${report.verdict} ${report.passed}/${report.total}`);
process.exit(failed.length ? 1 : 0);
