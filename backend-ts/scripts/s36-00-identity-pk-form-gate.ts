/**
 * s36-00 · ★ 类级 fail-loud 门 —— 「同表双形态」隐式 identity-PK 插入（零 DB / 零网络 / 只读）
 * ============================================================================
 * 口径（类级，非单点）：
 *   受体（recipient）= 三层里任一 `INSERT INTO <identity-PK 表>`（src / migrations / scripts）。
 *   命中（hit）     = 一处「省略 identity-PK」的插入，且**其表**在全量三层面中同时存在 ≥1 处
 *                     「显式给号」插入，且该插入落在**测试/校验面**：
 *                       · scripts/**  （探针 / 夹具 / 门）
 *                       · migrations 的 `DO $$ … $$` 块（迁移内自检探针）
 *                     —— 这正是 S29 已处理的撞号机制：夹具省略 PK 取 nextval，与同表某处
 *                        写死的固定号在同一取值域内 ⇒ 序列落后时必撞。
 *   产品写路径（src/** 与迁移里的 `CREATE FUNCTION` 体）不作本门命中：它们归 S36 §5 的 R1/R3 面。
 *   基线 = 43（独立盘点 S36/B14 `implicit-inserts.json` 的 level==R2 全集，登记于同名 .baseline.json）。
 *   新增命中 = 零容忍 ⇒ 红。
 *
 * 自证口径（同 `p4z-i18nviol-global` 家族）：**打印扫描面 / 受体数 / 命中数 / 基线数**；
 *   受体数 == 0 或 命中数 == 0 ⇒ 断言**无效**（INVALID），一律不得当「零违例」。
 *
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts
 *     [--root <dir>]        扫描根（默认 = resolve(__dirname,'..')，即本仓 backend-ts）
 *     [--json <path>]       追加产物落盘
 *     [--selftest]          内存判负（不落盘、不改仓）：红/绿四例
 *   退出码：0 = 绿（无新增命中）；3 = 红（有新增命中 / 受体或命中为 0 的无效断言）；2 = 致命错误。
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_BACKEND = path.resolve(__dirname, '..');

// ── 基线（只读；内容 = 独立盘点产物，见 baseline_provenance）────────────────────────────
type IdPk = { table: string; column: string };
type BaselineRow = { file: string; line: number; table: string; column: string; layer: string; context: string; reason: string };
type BaselineFile = { identity_pk: IdPk[]; identity_pk_count: number; baseline: BaselineRow[]; baseline_count: number };

const loadBaseline = (p: string): BaselineFile => JSON.parse(fs.readFileSync(p, 'utf8')) as BaselineFile;
const BASELINE_PATH = path.resolve(__dirname, 's36-00-identity-pk-form-gate.baseline.json');

// ── 注释感知（保留行数：注释内容等长空白替换）──────────────────────────────────────────
function stripComments(text: string, isSql: boolean): string {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (isSql) out = out.replace(/--[^\n]*/g, (m) => ' '.repeat(m.length));
  else out = out.replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + ' '.repeat(m.length - p1.length));
  return out;
}

// ── INSERT 词法（逐字沿用 S36 盘点扫描器，保证与独立盘点同口径）────────────────────────
const INSERT_RE =
  /INSERT\s+INTO\s+([A-Za-z0-9_."]+)(?:\s+AS\s+([A-Za-z0-9_]+))?\s*(?:\(([\s\S]*?)\)\s*)?(VALUES|SELECT|OVERRIDING\s+SYSTEM\s+VALUE|DEFAULT\s+VALUES)/gis;

const normTable = (t: string) => t.replace(/^public\./i, '').replace(/"/g, '').toLowerCase();

// ── SQL 作用域分类（dollar-quote 感知）：DO 块 = 测试面；CREATE FUNCTION 体 / 顶层 = 产品面 ──
type SqlBlock = { start: number; end: number; kind: 'do' | 'function' | 'other' };

function classifyTail(before: string): 'do' | 'function' | 'other' {
  const chunks = before.split(';');
  let tail = '';
  for (let k = chunks.length - 1; k >= 0; k--) if (chunks[k].trim()) { tail = chunks[k]; break; }
  if (/\bDO\b\s*(LANGUAGE\s+\w+)?\s*$/i.test(tail)) return 'do';
  if (/\bCREATE\s+(OR\s+REPLACE\s+)?(FUNCTION|PROCEDURE)\b/i.test(tail)) return 'function';
  return 'other';
}

function sqlBlocks(sql: string): SqlBlock[] {
  const out: SqlBlock[] = [];
  let i = 0;
  let segStart = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'") { // 单引号串（'' 转义）
      i++;
      while (i < sql.length) { if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; } if (sql[i] === "'") { i++; break; } i++; }
      continue;
    }
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z_0-9]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const open = i;
        const close = sql.indexOf(tag, i + tag.length);
        if (close === -1) { i = sql.length; continue; }
        out.push({ start: open, end: close + tag.length, kind: classifyTail(sql.slice(segStart, open)) });
        i = close + tag.length;
        segStart = i;
        continue;
      }
    }
    i++;
  }
  return out;
}

const scopeOf = (blocks: SqlBlock[], off: number): 'do' | 'function' | 'other' | 'toplevel' => {
  for (const b of blocks) if (off >= b.start && off < b.end) return b.kind;
  return 'toplevel';
};

// ── 扫描 ────────────────────────────────────────────────────────────────────────────
export type Layer = 'src' | 'migrations' | 'scripts';
export type Surface = 'test' | 'product';
export interface Hit {
  layer: Layer; file: string; line: number; table: string;
  column: string; form: 'explicit' | 'omitted' | 'partial-omitted' | 'no-column-list(positional)';
  scope: string; surface: Surface; raw: string;
}
export interface Source { rel: string; layer: Layer; ext: string; content: string }

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name.startsWith('.') || e.name === 'node_modules') continue; walk(p, exts, acc); }
    else if (exts.some((x) => e.name.endsWith(x))) acc.push(p);
  }
  return acc;
}

/** 自帚：本门自身的源码含判负夹具字面量（字符串里的 INSERT），不得计入受体 */
const SELF_REL = path.relative(REPO_BACKEND, path.resolve(__dirname, 's36-00-identity-pk-form-gate.ts'));

export function collectRepo(root: string, idMap: Map<string, string[]>): Source[] {
  const layers: Array<[Layer, string, string[]]> = [
    ['src', path.join(root, 'src'), ['.ts']],
    ['migrations', path.join(root, 'migrations'), ['.sql']],
    ['scripts', path.join(root, 'scripts'), ['.ts', '.js', '.mjs', '.cjs']],
  ];
  const out: Source[] = [];
  for (const [layer, dir, exts] of layers)
    for (const f of walk(dir, exts)) {
      const rel = path.relative(root, f);
      if (rel === SELF_REL) continue; // 自帚
      out.push({ rel, layer, ext: path.extname(f), content: fs.readFileSync(f, 'utf8') });
    }
  return out;
}

export function scanSources(sources: Source[], idMap: Map<string, string[]>): Hit[] {
  const hits: Hit[] = [];
  for (const s of sources) {
    const isSql = s.ext === '.sql';
    const stripped = stripComments(s.content, isSql);
    const blocks = isSql ? sqlBlocks(stripped) : [];
    let m: RegExpExecArray | null;
    INSERT_RE.lastIndex = 0;
    while ((m = INSERT_RE.exec(stripped))) {
      const table = normTable(m[1]);
      const idCols = idMap.get(table);
      if (!idCols || idCols.length === 0) continue;
      const colsRaw = m[3];
      const idx = m.index;
      const line = stripped.slice(0, idx).split('\n').length;
      const columns = colsRaw
        ? colsRaw.split(',').map((c) => c.trim().split(/\s+/)[0].replace(/^"|"$/g, '').toLowerCase()).filter(Boolean)
        : [];
      const omitted = idCols.filter((c) => !columns.includes(c.toLowerCase()));
      let form: Hit['form'] = 'explicit';
      if (!colsRaw) form = 'no-column-list(positional)';
      else if (omitted.length === idCols.length) form = 'omitted';
      else if (omitted.length > 0) form = 'partial-omitted';
      const scope = isSql ? scopeOf(blocks, idx) : s.layer;
      const surface: Surface = s.layer === 'scripts' ? 'test' : s.layer === 'src' ? 'product' : scope === 'do' ? 'test' : 'product';
      hits.push({ layer: s.layer, file: s.rel, line, table, column: idCols[0], form, scope, surface,
        raw: stripped.slice(idx, Math.min(idx + 140, stripped.length)).replace(/\s+/g, ' ') });
    }
  }
  return hits.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

export interface Verdict {
  scan_surfaces: Array<{ layer: Layer; files: number; recipients: number }>;
  recipients: number;              // 受体数 = 全部 INSERT INTO <identity-PK 表>
  tables_with_identity: number;
  both_form_tables: string[];      // 同表双形态的表
  hits: Hit[];                     // 命中数 = 测试面上、双形态表里的省略-PK 插入
  baseline_count: number;
  new_hits: Hit[];
  invalid: boolean;                // 受体==0 或 命中==0
  invalid_reason: string | null;
  stale_baseline: string[];        // 基线登记里不复现的项（提示，不致命）
  red: boolean;
}

export function evaluate(hits: Hit[], filesByLayer: Record<Layer, number>, baseline: BaselineFile): Verdict {
  const recipients = hits.length;
  const formsByTable = new Map<string, Set<Hit['form']>>();
  for (const h of hits) {
    if (!formsByTable.has(h.table)) formsByTable.set(h.table, new Set());
    formsByTable.get(h.table)!.add(h.form === 'explicit' ? 'explicit' : 'omitted');
  }
  const both = [...formsByTable.entries()].filter(([, s]) => s.has('explicit') && s.has('omitted')).map(([t]) => t).sort();
  const bothSet = new Set(both);
  const violating = hits.filter((h) => h.form !== 'explicit' && h.surface === 'test' && bothSet.has(h.table));
  const key = (h: { file: string; line: number; table: string }) => `${h.file}:${h.line}:${h.table}`;
  const baseKeys = new Set(baseline.baseline.map(key));
  const newHits = violating.filter((h) => !baseKeys.has(key(h)));
  const presentKeys = new Set(violating.map(key));
  const stale = baseline.baseline.map(key).filter((k) => !presentKeys.has(k));
  const invalid = recipients === 0 || (baseline.baseline_count > 0 && violating.length === 0);
  const invalidReason = recipients === 0
    ? '受体数=0（扫描面失效／identity 表映射为空）'
    : baseline.baseline_count > 0 && violating.length === 0
      ? '命中数=0 但基线非空（判据未生效／扫描面失效）'
      : null;
  const scan_surfaces = (['src', 'migrations', 'scripts'] as Layer[]).map((l) => ({
    layer: l, files: filesByLayer[l] ?? 0, recipients: hits.filter((h) => h.layer === l).length,
  }));
  return { scan_surfaces, recipients, tables_with_identity: baseline.identity_pk_count, both_form_tables: both,
    hits: violating, baseline_count: baseline.baseline.length, new_hits: newHits, invalid, invalid_reason: invalidReason,
    stale_baseline: stale, red: invalid || newHits.length > 0 };
}

// ── 内存判负（不落盘）────────────────────────────────────────────────────────────────
function runSelftest(): number {
  const idMap = new Map<string, string[]>([['currency', ['cid']], ['users', ['uid']]]);
  const B: BaselineFile = { identity_pk: [{ table: 'currency', column: 'cid' }, { table: 'users', column: 'uid' }], identity_pk_count: 2, baseline: [], baseline_count: 0 };
  const ev = (srcs: Source[], base = B) => evaluate(scanSources(srcs, idMap), { src: 0, migrations: 0, scripts: 0 }, base);
  const S = (rel: string, layer: Layer, ext: string, content: string): Source => ({ rel, layer, ext, content });

  // NEG1（必红）：scripts 夹具省略 currency.cid + 同表另处显式给号
  const neg1 = ev([S('scripts/a.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (symbol, name) VALUES ($1,$2)");',),
                   S('scripts/b.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (cid, symbol) VALUES (7,$1)");')]);
  // POS1（必绿）：只有省略、同表无显式 ⇒ 非双形态
  const pos1 = ev([S('scripts/c.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (symbol) VALUES ($1)");')]);
  // NEG2（必红）：migrations DO 块里省略 currency.cid + 顶层显式给号 ⇒ 测试面命中
  const neg2 = ev([S('migrations/x.sql', 'migrations', '.sql', 'INSERT INTO currency (cid, symbol) VALUES (1,$q$d$q$);\nDO $b$\nBEGIN\n  INSERT INTO currency (symbol, name) VALUES (\'p\',\'p\');\nEND; $b$ LANGUAGE plpgsql;')]);
  // POS2（必绿）：同表双形态，但省略方落在函数体（产品面）⇒ 不命中
  const pos2 = ev([S('migrations/y.sql', 'migrations', '.sql', 'INSERT INTO currency (cid, symbol) VALUES (1,$q$d$q$);\nCREATE OR REPLACE FUNCTION f() RETURNS void AS $b$\nBEGIN\n  INSERT INTO currency (symbol, name) VALUES (\'p\',\'p\');\nEND; $b$ LANGUAGE plpgsql;')]);
  // NEG3（必红）：受体数=0 ⇒ 断言无效
  const neg3 = ev([S('scripts/empty.ts', 'scripts', '.ts', 'const x = 1;')]);
  // NEG5（必红）：基线非空但命中为 0 ⇒ 断言无效（不得当零违例）
  const neg5 = ev([S('scripts/only-explicit.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (cid, symbol) VALUES (1,$1)");')],
                  { ...B, baseline: [{ file: 'scripts/z.ts', line: 9, table: 'currency', column: 'cid', layer: 'scripts', context: 'scripts', reason: 'selftest' }], baseline_count: 1 });

  const checks: Array<[string, boolean, string]> = [
    ['NEG1 scripts 双形态 ⇒ 红', neg1.new_hits.length === 1 && neg1.red && !neg1.invalid, `hits=${neg1.hits.length} new=${neg1.new_hits.length} red=${neg1.red}`],
    ['POS1 仅省略、同表无显式 ⇒ 绿', !pos1.red && pos1.hits.length === 0 && pos1.recipients === 1, `hits=${pos1.hits.length} recipients=${pos1.recipients} red=${pos1.red}`],
    ['NEG2 migrations DO 块省略 + 顶层显式 ⇒ 红', neg2.new_hits.length === 1 && neg2.red, `hits=${neg2.hits.length} scope=${neg2.hits[0] ? neg2.hits[0].scope : 'n/a'} red=${neg2.red}`],
    ['POS2 同表双形态但省略在函数体（产品面）⇒ 绿', !pos2.red && pos2.recipients === 2, `hits=${pos2.hits.length} recipients=${pos2.recipients} red=${pos2.red}`],
    ['NEG3 受体数=0 ⇒ 断言无效（非绿）', neg3.invalid && neg3.red && neg3.recipients === 0, `recipients=${neg3.recipients} invalid=${neg3.invalid}`],
    ['NEG5 基线非空但命中=0 ⇒ 断言无效（非绿）', neg5.invalid && neg5.red, `recipients=${neg5.recipients} hits=${neg5.hits.length} invalid=${neg5.invalid}`],
    ['NEG4 基线登记命中 ⇒ 不报新（绿）', ev([S('scripts/a.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (symbol) VALUES ($1)");'),
                                            S('scripts/b.ts', 'scripts', '.ts', 'await q("INSERT INTO currency (cid, symbol) VALUES (7,$1)");')],
                                            { ...B, baseline: [{ file: 'scripts/a.ts', line: 1, table: 'currency', column: 'cid', layer: 'scripts', context: 'scripts', reason: 'selftest' }], baseline_count: 1 }).new_hits.length === 0, 'baselined hit suppressed'],
  ];
  for (const [id, pass, r] of checks) console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  [${r}]`);
  const ok = checks.every(([, p]) => p);
  console.log(`SELFTEST ${ok ? 'PASS' : 'FAIL'} (${checks.filter(([, p]) => p).length}/${checks.length})`);
  return ok ? 0 : 1;
}

// ── main ───────────────────────────────────────────────────────────────────────────
function main(): number {
  if (process.argv.includes('--selftest')) return runSelftest();
  const ai = process.argv.indexOf('--root');
  const root = path.resolve(ai >= 0 && process.argv[ai + 1] ? process.argv[ai + 1] : REPO_BACKEND);
  try {
    const baseline = loadBaseline(BASELINE_PATH);
    const idMap = new Map<string, string[]>(baseline.identity_pk.map((c) => [c.table, [c.column]]));
    const sources = collectRepo(root, idMap);
    const filesByLayer: Record<Layer, number> = { src: 0, migrations: 0, scripts: 0 };
    for (const s of sources) filesByLayer[s.layer] += 1;
    const hits = scanSources(sources, idMap);
    const v = evaluate(hits, filesByLayer, baseline);

    const report = {
      gate: 'scripts/s36-00-identity-pk-form-gate.ts',
      root, ts: new Date().toISOString(),
      criterion: '命中 = 测试面(scripts/** 或 migrations DO $$ 块)上、其表在全量三层面中同时存在显式给号的『省略 identity-PK』插入',
      self_proof: {
        scan_surfaces: v.scan_surfaces,
        scan_surface_count: v.scan_surfaces.length,
        recipients: v.recipients,
        tables_with_identity: v.tables_with_identity,
        hits: v.hits.length,
        baseline: v.baseline_count,
        new_hits: v.new_hits.length,
        invalid: v.invalid, invalid_reason: v.invalid_reason,
      },
      both_form_tables: v.both_form_tables,
      hits_by_table: v.both_form_tables.map((t) => ({ table: t, hits: v.hits.filter((h) => h.table === t).length })),
      new_hits: v.new_hits,
      stale_baseline_entries: v.stale_baseline,
      verdict: v.red ? 'RED' : 'GREEN',
      exit_code: v.red ? 3 : 0,
    };
    const ji = process.argv.indexOf('--json');
    if (ji >= 0 && process.argv[ji + 1]) {
      const p = path.resolve(process.argv[ji + 1]);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify({ ...report, hits: v.hits, all_recipients: hits }, null, 2));
      (report as Record<string, unknown>).saved = p;
    }
    console.log(JSON.stringify(report, null, 1));
    console.log(
      `\n[自证] 扫描面=${v.scan_surfaces.length}层(${v.scan_surfaces.map((s) => `${s.layer}:${s.files}文件/${s.recipients}受体`).join(' ')})  受体数=${v.recipients}  命中数=${v.hits.length}  基线数=${v.baseline_count}  新增=${v.new_hits.length}`
    );
    if (v.invalid) console.log(`[INVALID] ${v.invalid_reason} ⇒ 断言无效，不得当「零违例」。`);
    else if (v.new_hits.length > 0) for (const h of v.new_hits) console.log(`[NEW] ${h.file}:${h.line} ${h.table}.${h.column} (${h.surface}/${h.scope})`);
    if (v.stale_baseline.length > 0) console.log(`[STALE-WARN] 基线登记中 ${v.stale_baseline.length} 项已不复现（不致命；若为修复所致请同步收紧基线）：${v.stale_baseline.slice(0, 5).join(', ')}${v.stale_baseline.length > 5 ? ' …' : ''}`);
    return v.red ? 3 : 0;
  } catch (e) {
    console.error('FATAL', e);
    return 2;
  }
}
process.exit(main());
