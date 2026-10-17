/**
 * 独立质检 · 静态面探针（Neng 自写，不采信实现方日志）
 * ---------------------------------------------------------------------------
 * 覆盖：AC1 只读性 / AC2 符号与基线（静态部分）/ AC4 端点形态（静态部分）/ AC7 零副作用
 * 用法：node ops/recon-cron/qa/probe/qa-static.mjs
 * 产出：ops/recon-cron/qa/readings/AC{1,2,4,7}-*.json
 *
 * 判据口径（与派单一致，不自创）：
 *   AC1 必须在**剥注释后**的代码面断言 —— 否则「无 INSERT/UPDATE/DELETE」会被它自己的
 *       头注释命中（假阴性）。原样命中作为披露项一并登记。
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(HERE, '../../../..');
const QA = path.resolve(HERE, '..');
const OUT = path.join(QA, 'readings');
fs.mkdirSync(OUT, { recursive: true });

const SRC_PATH = path.join(REPO, 'backend-ts/src/ops-recon.ts');
const IDX_PATH = path.join(REPO, 'backend-ts/src/index.ts');
const src = fs.readFileSync(SRC_PATH, 'utf8');
const idx = fs.readFileSync(IDX_PATH, 'utf8');
const srcLines = src.split('\n');

const now = () => new Date().toISOString();
const write = (name, obj) => {
  const f = path.join(OUT, name);
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n');
  return f;
};
const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' });

/* ---------------------------------------------------------------- 注释剥离 */
/** 状态机剥注释：保留字符串与模板字面量原文（SQL 在模板里，不能剥掉） */
function stripComments(text) {
  let out = '';
  let i = 0;
  let quote = null;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += text[i + 1] ?? ''; i += 2; continue; }
      if (c === quote) quote = null;
      i += 1; continue;
    }
    if (c === '/' && d === '/') { while (i < n && text[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; i += 1; continue; }
    out += c; i += 1;
  }
  return out;
}
const code = stripComments(src);
const codeLines = code.split('\n');

const hitsOf = (hay, re) => {
  const out = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(hay)) !== null) {
    const line = hay.slice(0, m.index).split('\n').length;
    out.push({ line, token: m[1] ?? m[0] });
    if (m.index === g.lastIndex) g.lastIndex += 1;
  }
  return out;
};

/* ================================================================ AC1 只读性 */
const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|BEGIN|COMMIT|ledger_post_event)\b/;
const forbiddenInCode = hitsOf(code, FORBIDDEN);
const forbiddenInRaw = hitsOf(src, FORBIDDEN);

const sqlOf = (name) => {
  const re = new RegExp('export const ' + name + '\\s*=\\s*`([\\s\\S]*?)`;');
  const m = re.exec(src);
  return m ? m[1] : null;
};
const SQLS = {
  supply_vs_ledger: sqlOf('SUPPLY_VS_LEDGER_SQL'),
  account_vs_ledger: sqlOf('ACCOUNT_VS_LEDGER_SQL'),
  batt_account_vs_batt_entry: sqlOf('BATT_VS_ENTRY_SQL'),
};

const sqlAudit = Object.entries(SQLS).map(([id, sql]) => {
  if (sql === null) return { id, parsed: false };
  const body = sql.trim();
  const semis = (body.match(/;/g) || []).length;
  return {
    id,
    parsed: true,
    starts_with_select: /^SELECT\b/i.test(body),
    select_count: (body.match(/\bSELECT\b/gi) || []).length,
    semicolons: semis,
    single_statement: semis === 0 || /;\s*$/.test(body) && (body.match(/;/g) || []).length === 1,
    dml_hits: (body.match(/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER|TRUNCATE|COPY|GRANT|BEGIN|COMMIT|ROLLBACK)\b/gi) || []),
    stmt_keyword: (body.match(/\b(WITH|SELECT|INSERT|UPDATE|DELETE)\b/i) || [])[1] ?? null,
    has_semicolon_separated_second_stmt: /;\s*[A-Za-z]/.test(body),
    first_line: body.split('\n')[0].slice(0, 80),
  };
});

const stripDqa = src.replace(/\/\*[\s\S]*?\*\//g, '');
const readQueryCalls = (code.match(/\breadQuery\s*[<(]/g) || []).length;
const readQueryImport = /import\s*\{[^}]*\breadQuery\b[^}]*\}\s*from\s*'\.\/db'/.test(stripDqa);

const ac1 = {
  ac: 'AC1',
  title: '只读性：无 DML / 无事务 / 三条 SQL 均单语句 SELECT / 走 readQuery 只读池',
  measured_at: now(),
  subject: path.relative(REPO, SRC_PATH),
  subject_lines: srcLines.length,
  assertions: {
    no_forbidden_keywords_in_code: { pass: forbiddenInCode.length === 0, hits: forbiddenInCode },
    three_sql_parsed: { pass: sqlAudit.every((s) => s.parsed), found: Object.keys(SQLS).filter((k) => SQLS[k] !== null) },
    all_sql_start_with_select: { pass: sqlAudit.every((s) => s.starts_with_select === true) },
    all_sql_single_statement: { pass: sqlAudit.every((s) => !s.has_semicolon_separated_second_stmt) },
    all_sql_no_dml: { pass: sqlAudit.every((s) => s.dml_hits.length === 0) },
    readQuery_imported: { pass: readQueryImport },
    readQuery_used_for_all_three: { pass: readQueryCalls === 3, calls: readQueryCalls },
    no_direct_pool_or_tx: {
      pass: !/getPool\s*\(|getWritePool\s*\(|withTransaction\s*\(|\.connect\s*\(|pool\.query/.test(code),
      hits: hitsOf(code, /getPool\s*\(|getWritePool\s*\(|withTransaction\s*\(|\.connect\s*\(|pool\.query/).map((h) => h.token),
    },
    no_ledger_post_event_call: { pass: !/ledger_post_event/.test(code) },
  },
  sql_audit: sqlAudit,
  raw_sql: SQLS,
  disclosures: {
    keyword_hits_on_raw_source_disclosure: {
      note: '原文命中 = 文件头注释里的自述（"无 INSERT/UPDATE/DELETE / 无 ledger_post_event"）⇒ 属注释、非代码；判据必须剥注释后取，否则该 AC 结构上不可达 PASS。此处登记以免「原文 grep = 0」被当成假证。',
      hits: forbiddenInRaw,
    },
  },
  pass: false,
};
ac1.pass = Object.values(ac1.assertions).every((a) => a.pass === true);

/* ================================================================ AC2 符号与基线 */
const supplySql = SQLS.supply_vs_ledger ?? '';
const judgeStart = src.indexOf('const judgeSupply');
const judgeEnd = src.indexOf('const judgeZeroRows');
const judgeBody = judgeStart >= 0 && judgeEnd > judgeStart ? src.slice(judgeStart, judgeEnd) : '';
const judgeCode = stripComments(judgeBody);

const baselineBlock = (() => {
  const m = /export const KNOWN_SUPPLY_OFFSET[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(src);
  if (!m) return null;
  const entries = [...m[1].matchAll(/'([^']+)'\s*:\s*'([^']*)'/g)].map((e) => [e[1], e[2]]);
  return { frozen: true, raw: m[0].replace(/\s+/g, ' ').slice(0, 200), entries: Object.fromEntries(entries), count: entries.length };
})();

const ac2 = {
  ac: 'AC2',
  title: '符号 Σmint+Σburn（非减）/ 基线显式常量表 + 严格相等 / BigInt 严格比较 / 小数残差 ⇒ FAIL',
  measured_at: now(),
  assertions: {
    supply_sum_is_plus: {
      pass: /COALESCE\(l\.sum_mint,0\)\s*\+\s*COALESCE\(l\.sum_burn,0\)/.test(supplySql)
        && !/COALESCE\(l\.sum_mint,0\)\s*-\s*COALESCE\(l\.sum_burn,0\)/.test(supplySql)
        && !/sum_mint,0\)-COALESCE\(l\.sum_burn,0\)/.test(supplySql),
      evidence_expr: (supplySql.match(/COALESCE\(l\.sum_mint,0\)[^,\n]*COALESCE\(l\.sum_burn,0\)/g) || [''])[0],
      minus_pattern_hits: (supplySql.match(/COALESCE\(l\.sum_mint,0\)\s*-\s*COALESCE\(l\.sum_burn,0\)/g) || []).length,
    },
    burn_not_abs: {
      pass: /SUM\(delta\)\s*FILTER\s*\(\s*WHERE\s+kind\s*=\s*'burn'\s*\)/.test(supplySql) && !/ABS\s*\(/i.test(supplySql),
      note: 'burn 分录存负 delta ⇒ 直接 SUM(delta)，不得取绝对值或改号为 +',
    },
    baseline_is_explicit_frozen_table: {
      pass: baselineBlock !== null && baselineBlock.frozen === true && baselineBlock.count === 2
        && baselineBlock.entries['1'] === '2000000' && baselineBlock.entries['21'] === '1',
      table: baselineBlock,
      expected: { '1': '2000000', '21': '1' },
    },
    unregistered_cid_defaults_zero: {
      pass: /KNOWN_SUPPLY_OFFSET\[cid\]\s*\?\?\s*'0'/.test(src),
      evidence: (src.match(/baselineOffsetOf[\s\S]{0,160}/) || [''])[0].slice(0, 160),
    },
    strict_equality_judgement: {
      pass: /parsed\.big\s*===\s*baseline/.test(judgeCode),
      evidence: (judgeCode.match(/const pass = [^;]+;/) || [''])[0],
    },
    no_inequality_or_tolerance: {
      pass: !/[<>]=?\s*baseline|baseline\s*[<>]=?|Math\.abs\s*\(|epsilon|tolerance/i.test(judgeCode),
      hits: (judgeCode.match(/[<>]=?\s*baseline|baseline\s*[<>]=?|Math\.abs\s*\(|\bepsilon\b|\btolerance\b/gi) || []),
    },
    no_swallow_trycatch_in_judge: {
      pass: !/\btry\s*\{|\bcatch\s*\(/.test(judgeCode),
      hits: (judgeCode.match(/\btry\s*\{|\bcatch\s*\(/g) || []),
    },
    no_fail_to_skip: {
      pass: !/SKIP|'skip'/.test(judgeCode) && /status: failed \? 'FAIL' : 'PASS'/.test(judgeCode),
      evidence: (judgeCode.match(/status: [^,\n]+/) || [''])[0],
    },
    bigint_strict_compare: {
      pass: /BigInt\(/.test(code) && /big:\s*bigint/.test(code) && !/Number\(\s*row\.(diff|total_supply)/.test(code),
      bigint_uses: (code.match(/BigInt\(/g) || []).length,
      number_casts: (code.match(/Number\s*\(/g) || []).length,
    },
    decimal_residual_rejected_statically: {
      pass: /const exact = !m\[3\] \|\| \/\^0\+\$\/\.test\(m\[3\]\)/.test(src) && /parsed\.exact\s*&&/.test(judgeCode),
      evidence: (src.match(/const exact = [^;]+;/) || [''])[0],
      note: '小数残差（非全 0 小数位）⇒ exact=false ⇒ pass 必 false；行为臂见 readings/AC2-judgement.json',
    },
  },
  pass: false,
};
ac2.pass = Object.values(ac2.assertions).every((a) => a.pass === true);

/* ================================================================ AC4 端点形态（静态） */
const REG = /^app\.(get|post|put|delete|patch)\(/;
const regLines = idx.split('\n').map((l, i) => ({ n: i + 1, l })).filter((x) => REG.test(x.l));
const verbCounts = regLines.reduce((acc, x) => {
  const v = REG.exec(x.l)[1];
  acc[v] = (acc[v] || 0) + 1;
  return acc;
}, {});
const reconReg = regLines.filter((x) => x.l.includes("'/api/ops/recon/ledger'"));
const gateConst = /regs === (\d+)/.exec(fs.readFileSync(path.join(REPO, 'backend-ts/scripts/p7b-03-offline-gates.ts'), 'utf8'));

const ac4 = {
  ac: 'AC4',
  title: '端点形态：仅 GET、POST 同路径 404、注册点 107、p7b-03 37/37、tsc exit 0',
  measured_at: now(),
  assertions: {
    only_one_registration_for_path: { pass: reconReg.length === 1, hits: reconReg },
    registration_verb_is_get: { pass: reconReg.length === 1 && /app\.get\(/.test(reconReg[0].l), verb: (REG.exec(reconReg[0]?.l ?? '') || [])[1] ?? null },
    registration_count_107: { pass: regLines.length === 107, measured: regLines.length, expected: 107 },
    gate_constant_matches_measured: {
      pass: gateConst !== null && Number(gateConst[1]) === regLines.length,
      gate_constant: gateConst ? Number(gateConst[1]) : null,
    },
    verb_breakdown: { pass: true, ...verbCounts },
  },
  registration_count_measured: regLines.length,
  verb_breakdown: verbCounts,
  recon_registration_line: reconReg,
  pass: false,
};
ac4.pass = Object.values(ac4.assertions).every((a) => a.pass === true);

/* ================================================================ AC7 零副作用 */
const BASE = '0537ea8';
const changed = git('diff', '--name-status', `${BASE}..HEAD`).trim().split('\n').filter(Boolean)
  .map((l) => { const [st, p] = l.split('\t'); return { status: st, path: p }; });
const files = changed.map((c) => c.path);
const migrationHits = files.filter((f) => /(^|\/)migrations?\//.test(f) || /\.sql$/.test(f));
const frontendHits = files.filter((f) => /^frontend\//.test(f));
const i18nHits = files.filter((f) => /(^|\/)locales?\/|i18n|(^|\/)lang\//.test(f));
const vercelNumstat = git('diff', '--numstat', `${BASE}..HEAD`, '--', 'vercel.json').trim();
const [vAdd, vDel] = vercelNumstat.split('\t').map(Number);
const vercelBase = JSON.parse(execFileSync('git', ['show', `${BASE}:vercel.json`], { cwd: REPO, encoding: 'utf8' }));
const vercelHead = JSON.parse(fs.readFileSync(path.join(REPO, 'vercel.json'), 'utf8'));
const numstatAll = git('diff', '--numstat', `${BASE}..HEAD`).trim().split('\n').filter(Boolean);

const ac7 = {
  ac: 'AC7',
  title: '零副作用：无迁移/无新表/无前端/无 i18n；vercel.json 纯追加 + JSON 合法 + crons 恰 2 条',
  measured_at: now(),
  range: `${BASE}..HEAD`,
  changed_files: changed,
  assertions: {
    no_migration_files: { pass: migrationHits.length === 0, hits: migrationHits },
    no_frontend_changes: { pass: frontendHits.length === 0, hits: frontendHits },
    no_i18n_key_changes: { pass: i18nHits.length === 0, hits: i18nHits },
    new_tables_none: {
      pass: !files.some((f) => /\.sql$/.test(f)),
      note: '本批无 .sql ⇒ 结构上不可能建表；真库侧另由 AC8 只读探针核 schema_migration 顶未变',
    },
    vercel_json_pure_append: { pass: vDel === 0 && vAdd > 0, added: vAdd, deleted: vDel, numstat: vercelNumstat },
    vercel_json_valid: { pass: true, parsed_crons: Array.isArray(vercelHead.crons) ? vercelHead.crons.length : null },
    crons_exactly_two: { pass: vercelHead.crons.length === 2, crons: vercelHead.crons },
    existing_cron_untouched: {
      pass: vercelHead.crons[0].path === vercelBase.crons[0].path
        && vercelHead.crons[0].schedule === vercelBase.crons[0].schedule,
      base_first: vercelBase.crons[0], head_first: vercelHead.crons[0],
    },
    head_adds_only_recon_cron: {
      pass: JSON.stringify(vercelHead.crons.slice(1)) === JSON.stringify([{ path: '/api/ops/recon/ledger', schedule: '30 18 * * *' }]),
      appended: vercelHead.crons.slice(1),
    },
  },
  diff_numstat_total: numstatAll,
  pass: false,
};
ac7.pass = Object.values(ac7.assertions).every((a) => a.pass === true);

/* ================================================================ 落盘 */
const filesOut = {
  AC1: write('AC1-readonly.json', ac1),
  AC2: write('AC2-symbol-baseline.json', ac2),
  AC4: write('AC4-endpoint-static.json', ac4),
  AC7: write('AC7-zero-side-effects.json', ac7),
};

const summary = {
  probe: 'qa-static.mjs',
  measured_at: now(),
  head: git('rev-parse', '--short', 'HEAD').trim(),
  results: Object.fromEntries(Object.entries({ AC1: ac1, AC2: ac2, AC4: ac4, AC7: ac7 }).map(([k, v]) => [k, v.pass])),
  failed_assertions: Object.fromEntries(
    Object.entries({ AC1: ac1, AC2: ac2, AC4: ac4, AC7: ac7 })
      .map(([k, v]) => [k, Object.entries(v.assertions).filter(([, a]) => a.pass !== true).map(([n]) => n)])
      .filter(([, arr]) => arr.length > 0),
  ),
  files: filesOut,
};
write('qa-static-summary.json', summary);
console.log(JSON.stringify(summary, null, 2));
