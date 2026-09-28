/**
 * P3-S1b · 探针 01：★ 类级断言 —— 「运行期 schema 变更语句」全集扫描
 *
 * 用法：npx ts-node --transpile-only scripts/p3s1b-01-class-assert-runtime-ddl.ts <root> <label> [outFile]
 *   <root>  扫描根（默认 = 本仓 backend-ts，即 resolve(__dirname,'..')）
 *   <label> 读数标签（写进产物名与 JSON）
 *   outFile 可选，默认 <本仓>/.p3s1-artifacts/p3s1b-classassert-<label>.json
 *
 * 只读：仅读文件系统（fs），不连库、不写被检仓库、无任何 DDL/DML。
 *
 * 设计要点（回应 Step 1b 立项的唯一理由）：
 *  上一轮「类级断言」的失败形态 = 只 grep 那两个已知函数名，结果漏掉同族的第二处 DDL。
 *  本探针先**枚举类**（schema 变更语句的语句型 token 全集），再对**全集**逐行扫描并断言
 *  「请求路径上的应为 0 的集 == 0」。类与判定规则在下面的 CLASSES / 状态机里硬编码，
 *  新增类只需往 CLASSES 加一行 —— 断言对象永远是整个 CLASSES 全集，不是某个函数名。
 *
 * 扫描面（全量遍历，非抽样）：
 *   - 请求路径 request path : <root>/src/**\/*.ts      （tsconfig rootDir=./src，main=dist/index.js ⇒ 进服务器）
 *   - 非请求路径 non-request: <root>/scripts/**\/*.ts   （tsconfig.scripts.json，noEmit，不入 bundle）
 *                             <root>/migrations/**\/*.sql（迁移文书，非运行期代码）
 *
 * 判定三档（按命中所在词法状态）：
 *   comment（行注释/块注释）        → 允许集（纯注释行）
 *   string （'…' / "…" / `…`）      → 「应为 0 的集」当且仅当位于请求路径
 *   code   （裸标识符/散文）        → 单列登记（非可执行 DDL），不计入「应为 0 的集」
 *
 * 退出码：0 = 断言通过（应为 0 的集为空）；3 = 断言失败（发现非零命中）；2 = 致命错误。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── 类枚举（schema 变更语句全集；至少含派单方点名的 10 条，另扩 15 条同族语句）────────────
const CLASSES: Array<{ id: string; name: string; re: RegExp }> = [
  { id: 'C01', name: 'CREATE TABLE',              re: /(?<![\w.])CREATE\s+(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE\b/gi },
  { id: 'C02', name: 'CREATE INDEX',              re: /(?<![\w.])CREATE\s+(?:UNIQUE\s+)?INDEX\b/gi },
  { id: 'C03', name: 'CREATE [OR REPLACE] FUNCTION', re: /(?<![\w.])CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/gi },
  { id: 'C04', name: 'ALTER TABLE',               re: /(?<![\w.])ALTER\s+TABLE\b/gi },
  { id: 'C05', name: 'DROP TABLE',                re: /(?<![\w.])DROP\s+TABLE\b/gi },
  { id: 'C06', name: 'DROP INDEX',                re: /(?<![\w.])DROP\s+INDEX\b/gi },
  { id: 'C07', name: 'TRUNCATE',                  re: /(?<![\w.])TRUNCATE\b/gi },
  { id: 'C08', name: 'DO $$ (plpgsql 匿名块)',     re: /\bdo\s+\$/gi },
  { id: 'C09', name: 'RENAME TO',                 re: /(?<![\w.])RENAME\s+TO\b/gi },
  { id: 'C10', name: 'to_regclass',               re: /(?<![\w.])to_regclass\b/gi },
  // —— 同族扩展（证明断言对象是「类」而非某两个函数名）——
  { id: 'C11', name: 'ALTER INDEX',               re: /(?<![\w.])ALTER\s+INDEX\b/gi },
  { id: 'C12', name: 'ALTER FUNCTION',            re: /(?<![\w.])ALTER\s+(?:FUNCTION|PROCEDURE)\b/gi },
  { id: 'C13', name: 'DROP FUNCTION',             re: /(?<![\w.])DROP\s+(?:FUNCTION|PROCEDURE)\b/gi },
  { id: 'C14', name: 'CREATE SCHEMA',             re: /(?<![\w.])CREATE\s+SCHEMA\b/gi },
  { id: 'C15', name: 'DROP SCHEMA',               re: /(?<![\w.])DROP\s+SCHEMA\b/gi },
  { id: 'C16', name: 'CREATE TRIGGER',            re: /(?<![\w.])CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\b/gi },
  { id: 'C17', name: 'DROP TRIGGER',              re: /(?<![\w.])DROP\s+TRIGGER\b/gi },
  { id: 'C18', name: 'CREATE/ALTER/DROP SEQUENCE',re: /(?<![\w.])(?:CREATE|ALTER|DROP)\s+SEQUENCE\b/gi },
  { id: 'C19', name: 'CREATE/ALTER/DROP TYPE',    re: /(?<![\w.])(?:CREATE|ALTER|DROP)\s+TYPE\b/gi },
  { id: 'C20', name: 'CREATE/ALTER/DROP VIEW',    re: /(?<![\w.])(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\b/gi },
  { id: 'C21', name: 'CREATE EXTENSION',          re: /(?<![\w.])CREATE\s+EXTENSION\b/gi },
  { id: 'C22', name: 'CREATE/ALTER/DROP POLICY',  re: /(?<![\w.])(?:CREATE|ALTER|DROP)\s+POLICY\b/gi },
  { id: 'C23', name: 'ADD CONSTRAINT / ALTER COLUMN', re: /(?<![\w.])ADD\s+CONSTRAINT\b|(?<![\w.])ALTER\s+COLUMN\b/gi },
  { id: 'C24', name: 'COMMENT ON',                re: /(?<![\w.])COMMENT\s+ON\b/gi },
  { id: 'C25', name: 'GRANT / REVOKE',            re: /(?<![\w.])(?:GRANT|REVOKE)\b/gi },
];

// ── 词法状态机：给每个字符打上 CODE/LINE/BLOCK/SQ/DQ/BT 标记 ────────────────────────────
const ST_CODE = 0, ST_LINE = 1, ST_BLOCK = 2, ST_SQ = 3, ST_DQ = 4, ST_BT = 5;
function lexStates(src: string): Uint8Array {
  const n = src.length;
  const st = new Uint8Array(n);
  let s = ST_CODE; let i = 0;
  while (i < n) {
    const c = src[i];
    st[i] = s;
    if (s === ST_CODE) {
      if (c === '/' && src[i + 1] === '/') { st[i] = ST_LINE; i++; if (i < n) { st[i] = ST_LINE; i++; } s = ST_LINE; continue; }
      if (c === '/' && src[i + 1] === '*') { st[i] = ST_BLOCK; i++; if (i < n) { st[i] = ST_BLOCK; i++; } s = ST_BLOCK; continue; }
      if (c === "'") { i++; s = ST_SQ; continue; }
      if (c === '"') { i++; s = ST_DQ; continue; }
      if (c === '`') { i++; s = ST_BT; continue; }
      i++; continue;
    }
    if (s === ST_LINE) { if (c === '\n') s = ST_CODE; i++; continue; }
    if (s === ST_BLOCK) { if (c === '*' && src[i + 1] === '/') { st[i] = ST_BLOCK; i++; if (i < n) { st[i] = ST_BLOCK; i++; } s = ST_CODE; continue; } i++; continue; }
    if (s === ST_SQ) { if (c === '\\') { i += 2; continue; } if (c === "'") { i++; s = ST_CODE; continue; } i++; continue; }
    if (s === ST_DQ) { if (c === '\\') { i += 2; continue; } if (c === '"') { i++; s = ST_CODE; continue; } i++; continue; }
    if (s === ST_BT) { if (c === '\\') { i += 2; continue; } if (c === '`') { i++; s = ST_CODE; continue; } i++; continue; }
  }
  return st;
}
function stateName(v: number): 'code' | 'comment' | 'string' {
  if (v === ST_LINE || v === ST_BLOCK) return 'comment';
  if (v === ST_SQ || v === ST_DQ || v === ST_BT) return 'string';
  return 'code';
}

// ── 全量遍历 ───────────────────────────────────────────────────────────────────────
function walk(dir: string, filter: (f: string) => boolean, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
      walk(p, filter, acc);
    } else if (filter(p)) acc.push(p);
  }
  return acc;
}

interface Hit {
  class_id: string; class_name: string; file: string; line: number; col: number;
  state: 'code' | 'comment' | 'string'; surface: 'request' | 'non-request';
  verdict: 'allowed-comment' | 'should-be-zero' | 'bare-code'; text: string;
}

(function main() {
  const root = path.resolve(process.argv[2] || path.resolve(__dirname, '..'));
  const label = process.argv[3] || 'run';
  const outFile = process.argv[4]
    || path.resolve(__dirname, '..', '.p3s1-artifacts', `p3s1b-classassert-${label}.json`);

  const surfaces: Array<{ id: string; key: 'request' | 'non-request'; dir: string; filter: (f: string) => boolean; note: string }> = [
    { id: 'request-src',        key: 'request',     dir: path.join(root, 'src'),        filter: (f) => f.endsWith('.ts'),  note: '请求路径：tsconfig rootDir=./src / main=dist/index.js ⇒ 进 API 进程' },
    { id: 'nonreq-scripts',     key: 'non-request', dir: path.join(root, 'scripts'),    filter: (f) => f.endsWith('.ts'),  note: '非请求路径：tsconfig.scripts.json(noEmit)，工具脚本不入 bundle' },
    { id: 'nonreq-migrations',  key: 'non-request', dir: path.join(root, 'migrations'), filter: (f) => f.endsWith('.sql'), note: '非请求路径：迁移文书（SQL 文件，非运行期代码）' },
  ];

  const filesBySurface: Record<string, string[]> = { request: [], 'non-request': [] };
  const filesBySurfaceId: Record<string, number> = {};
  const filesScanned: string[] = [];
  const sourceHashes: Array<{ file: string; surface: string; sha256: string; bytes: number; lines: number }> = [];
  const hits: Hit[] = [];

  for (const surf of surfaces) {
    const files = walk(surf.dir, surf.filter).sort();
    filesBySurface[surf.key].push(...files);
    filesBySurfaceId[surf.id] = files.length;
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const rel = path.relative(root, f);
      filesScanned.push(rel);
      const st = lexStates(src);
      const lineStarts: number[] = [0];
      for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStarts.push(i + 1);
      sourceHashes.push({
        file: rel, surface: surf.key, bytes: Buffer.byteLength(src),
        lines: lineStarts.length, sha256: crypto.createHash('sha256').update(src).digest('hex'),
      });
      const lineOf = (off: number) => {
        let lo = 0, hi = lineStarts.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= off) lo = mid; else hi = mid - 1; }
        return lo;
      };
      for (const cls of CLASSES) {
        cls.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = cls.re.exec(src)) !== null) {
          if (m.index === cls.re.lastIndex) cls.re.lastIndex++;
          const ln = lineOf(m.index);
          const lStart = lineStarts[ln];
          const lEnd = ln + 1 < lineStarts.length ? lineStarts[ln + 1] - 1 : src.length;
          const rawLine = src.slice(lStart, lEnd).replace(/\r$/, '');
          const sn = stateName(st[m.index] ?? ST_CODE);
          const verdict = sn === 'comment' ? 'allowed-comment'
            : sn === 'string' ? (surf.key === 'request' ? 'should-be-zero' : 'allowed-comment')
            : 'bare-code';
          hits.push({
            class_id: cls.id, class_name: cls.name, file: rel, line: ln + 1,
            col: m.index - lStart + 1, state: sn, surface: surf.key,
            verdict, text: rawLine.trim().slice(0, 200),
          });
        }
      }
    }
  }

  const reqHits = hits.filter((h) => h.surface === 'request');
  const shouldBeZero = reqHits.filter((h) => h.verdict === 'should-be-zero');
  const allowedComment = reqHits.filter((h) => h.verdict === 'allowed-comment');
  const bareCode = reqHits.filter((h) => h.verdict === 'bare-code');
  const nonReqHits = hits.filter((h) => h.surface === 'non-request');

  const classTable = CLASSES.map((c) => {
    const hs = hits.filter((h) => h.class_id === c.id);
    return {
      class_id: c.id, class_name: c.name, pattern: c.re.source,
      hits_total: hs.length,
      hits_request_path: hs.filter((h) => h.surface === 'request').length,
      hits_should_be_zero: hs.filter((h) => h.verdict === 'should-be-zero').length,
      hits_allowed_comment_on_req: hs.filter((h) => h.surface === 'request' && h.verdict === 'allowed-comment').length,
      hits_non_request_allowed: hs.filter((h) => h.surface === 'non-request').length,
    };
  });

  const reqFp = crypto.createHash('sha256')
    .update(sourceHashes.filter((s) => s.surface === 'request')
      .map((s) => `${s.file}:${s.sha256}:${s.bytes}`).sort().join('\n')).digest('hex');

  const out = {
    probe: 'P3S1B-01-CLASS-ASSERT-RUNTIME-DDL',
    label, root, ts: new Date().toISOString(),
    scan_surfaces: surfaces.map((s) => ({
      id: s.id, key: s.key, dir: path.relative(root, s.dir) || '.', note: s.note,
      files: filesBySurfaceId[s.id] ?? 0,
    })),
    class_count: CLASSES.length,
    class_enumeration: classTable,
    files_scanned: filesScanned,
    files_scanned_count: filesScanned.length,
    source_fingerprint_sha256_request_path: reqFp,
    source_hashes: sourceHashes,
    request_path: {
      files: filesBySurface.request.length,
      hits_total: reqHits.length,
      allowed_comment: allowedComment.length,
      should_be_zero: shouldBeZero.length,
      bare_code: bareCode.length,
    },
    non_request_path: { hits_total: nonReqHits.length, files: filesBySurface['non-request'].length },
    assertion: {
      name: '请求路径上的「运行期 schema 变更语句」（应为 0 的集）== 0',
      expected_zero_set_size: shouldBeZero.length,
      pass: shouldBeZero.length === 0,
    },
    should_be_zero_hits: shouldBeZero,
    allowed_comment_hits_on_request_path: allowedComment,
    bare_code_hits_on_request_path: bareCode,
    non_request_hits: nonReqHits.map((h) => ({ class_id: h.class_id, class_name: h.class_name, file: h.file, line: h.line, text: h.text })),
    positive_control: null as unknown,
    exit_code: shouldBeZero.length === 0 ? 0 : 3,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exitCode = out.exit_code;
})();
