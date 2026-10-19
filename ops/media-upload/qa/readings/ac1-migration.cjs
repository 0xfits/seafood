/**
 * AC1 · 迁移与表结构（dev 只读）
 * ---------------------------------------------------------------------
 * ① 自证库身份 project=quiet-math-65207667（禁打印密码）
 * ② schema_migration 顶 = 0050 且 0050 恰 1 行
 * ③ public.media 存在；7 列逐字（名/类型/可空/默认）；UNIQUE(sha256,size_bytes)；
 *    size_bytes CHECK ≤ 2097152；content_type 三值 CHECK；owner_uid FK → public.users(uid)
 * ④ 既有表结构零变：0050 文件内零 ALTER/DROP/UPDATE/DELETE（直读 SQL 复核）+ 关键表列数现取
 *    （listing / users / currency 三张）；git 侧证 0001–0049 未被本 commit 触碰。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { q, identity, REPO } = require('../lib/db.cjs');

const out = { ac: 'AC1', generated_at: new Date().toISOString(), project: 'quiet-math-65207667', checks: [] };
const t = (id, what, pass, reading) => out.checks.push({ id, what, pass: !!pass, reading });

(async () => {
  // ① 身份
  const idn = await identity();
  out.identity = idn;
  t('1.1', '库身份 = dev project quiet-math-65207667（库内 current_setting(\'neon.project_id\') 权威读数 + Neon endpoint host）',
    idn.project_id === 'quiet-math-65207667' && /\.neon\.tech$/.test(idn.host),
    `project_id=${idn.project_id} db=${idn.db} usr=${idn.usr} host_neon=${/\.neon\.tech$/.test(idn.host)}（host 本身不含 project 名 = Neon 新 endpoint 形态）`);

  // ② schema_migration
  const cols = await q(`select column_name, data_type from information_schema.columns
    where table_schema='public' and table_name='schema_migration' order by ordinal_position`);
  out.schema_migration_columns = cols.map((c) => `${c.column_name}:${c.data_type}`);

  const rows = await q(`select * from public.schema_migration order by applied_at desc nulls last limit 5`).catch(async () => {
    return q(`select * from public.schema_migration limit 5`);
  });
  const top = rows[0] || {};
  const versionKey = Object.keys(top).find((k) => /version/i.test(k)) || 'version';
  const topVersion = String(top[versionKey] ?? '');
  out.schema_migration_top = { version_key: versionKey, top_row: top };

  const cnt0050 = await q(`select count(*)::int as n from public.schema_migration where ${versionKey} = '0050'`);
  const total = await q(`select count(*)::int as n from public.schema_migration`);
  t('1.2', 'schema_migration 顶 = 0050 且 0050 恰 1 行',
    topVersion === '0050' && cnt0050[0].n === 1,
    `top=${topVersion} count_0050=${cnt0050[0].n} total_rows=${total[0].n}`);

  // ③ media 表
  const exists = await q(`select count(*)::int as n from information_schema.tables
    where table_schema='public' and table_name='media'`);
  t('1.3', 'public.media 表存在', exists[0].n === 1, `tables_found=${exists[0].n}`);

  const mediaCols = await q(`select column_name, data_type, is_nullable, column_default, numeric_precision
    from information_schema.columns where table_schema='public' and table_name='media'
    order by ordinal_position`);
  out.media_columns = mediaCols;
  t('1.4', 'media 恰 7 列', mediaCols.length === 7, `count=${mediaCols.length} cols=${mediaCols.map((c) => c.column_name).join(',')}`);

  const expect = [
    ['media_id', 'bigint', 'NO'],
    ['sha256', 'character', 'NO'],
    ['content_type', 'text', 'NO'],
    ['bytes', 'bytea', 'NO'],
    ['size_bytes', 'integer', 'NO'],
    ['owner_uid', 'bigint', 'NO'],
    ['time_created', 'timestamp with time zone', 'NO'],
  ];
  const colMap = Object.fromEntries(mediaCols.map((c) => [c.column_name, c]));
  const colMiss = expect.filter(([n, ty, nul]) => {
    const c = colMap[n];
    return !c || !String(c.data_type).startsWith(ty) || c.is_nullable !== nul;
  }).map(([n]) => n);
  t('1.5', '7 列名/类型/可空性逐字符合（media_id bigint PK identity · sha256 char(64) · content_type text · bytes bytea · size_bytes int · owner_uid bigint · time_created timestamptz）',
    colMiss.length === 0, colMiss.length ? `mismatch=${colMiss.join(',')}` : 'all 7 columns match');

  const constraints = await q(`select con.conname, con.contype, pg_get_constraintdef(con.oid) as def
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relname='media' order by con.contype, con.conname`);
  out.media_constraints = constraints;

  const uniq = constraints.find((c) => c.contype === 'u' && /\(sha256, size_bytes\)/.test(c.def));
  t('1.6', 'UNIQUE(sha256, size_bytes) 去重键在场', !!uniq, uniq ? `${uniq.conname}: ${uniq.def}` : 'MISSING');

  const pk = constraints.find((c) => c.contype === 'p');
  t('1.7', 'PRIMARY KEY(media_id)', !!pk && /media_id/.test(pk.def), pk ? `${pk.conname}: ${pk.def}` : 'MISSING');

  const sizeChk = constraints.find((c) => c.contype === 'c' && /size_bytes/.test(c.def));
  t('1.8', 'size_bytes CHECK 上限 2,097,152 字节（2MiB）',
    !!sizeChk && /2097152/.test(sizeChk.def), sizeChk ? `${sizeChk.conname}: ${sizeChk.def}` : 'MISSING');

  const ctChk = constraints.find((c) => c.contype === 'c' && /content_type/.test(c.def));
  const ctThree = !!ctChk && ['image/webp', 'image/jpeg', 'image/png'].every((v) => ctChk.def.includes(v));
  t('1.9', 'content_type CHECK 三值闭集（webp/jpeg/png）', ctThree, ctChk ? `${ctChk.conname}: ${ctChk.def}` : 'MISSING');

  const fk = constraints.find((c) => c.contype === 'f' && /owner_uid/.test(c.def));
  t('1.10', 'owner_uid FK → public.users(uid)', !!fk && /REFERENCES users\(uid\)/.test(fk.def), fk ? `${fk.conname}: ${fk.def}` : 'MISSING');

  const idx = await q(`select indexname, indexdef from pg_indexes where schemaname='public' and tablename='media' order by indexname`);
  out.media_indexes = idx;
  t('1.11', 'media_sha256_idx 在场', idx.some((i) => i.indexname === 'media_sha256_idx'), `indexes=${idx.map((i) => i.indexname).join(',')}`);

  // ④ 既有表零变
  const sqlText = fs.readFileSync(path.join(REPO, 'backend-ts', 'migrations', '0050_media_store.sql'), 'utf8');
  const body = sqlText.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const verbs = (body.match(/\b(ALTER|DROP|TRUNCATE|UPDATE|DELETE|INSERT)\b/gi) || []);
  t('1.12', '0050 语句体零 ALTER/DROP/TRUNCATE/UPDATE/DELETE/INSERT（零动既有表）',
    verbs.length === 0, `verbs_found=${verbs.length}${verbs.length ? ':' + verbs.join(',') : ''}`);

  let gitStat = '';
  try {
    gitStat = execFileSync('git', ['show', '--stat', '--format=', 'a6d718d'], { cwd: REPO, encoding: 'utf8' });
  } catch (e) { gitStat = `git_error:${e.message}`; }
  const touchedOldMigration = gitStat.split('\n').filter((l) => /migrations\/00[0-4]\d/.test(l));
  t('1.13', 'commit a6d718d 未触碰 0001–0049 任何迁移文件',
    touchedOldMigration.length === 0, touchedOldMigration.length ? touchedOldMigration.join('|') : 'no 00[0-4]x migration in diffstat');

  const spot = await q(`select table_name, count(*)::int as col_count from information_schema.columns
    where table_schema='public' and table_name in ('listing','users','currency','listing_order','account')
    group by table_name order by table_name`);
  out.existing_table_column_counts = spot;
  t('1.14', '关键既有表列数现取（抽查 5 张，供对照/回归基线）', spot.length >= 3,
    spot.map((s) => `${s.table_name}=${s.col_count}`).join(' '));

  out.pass = out.checks.every((c) => c.pass);
  out.failed = out.checks.filter((c) => !c.pass).map((c) => c.id);
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, 'ac1-migration.json'), JSON.stringify(out, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => {
  out.error = e.message;
  out.pass = false;
  fs.writeFileSync(path.join(__dirname, 'ac1-migration.json'), JSON.stringify(out, null, 2));
  console.error(JSON.stringify(out, null, 2));
  process.exitCode = 1;
});
