/**
 * Neng 独立质检 · 静态门套（AC6）
 * --------------------------------------------------------------------------------
 * 只读：`tsc --noEmit` / `p7b-03` 离线门 / `git diff --name-status be483cc..b8a076e` /
 * 路由注册点计数 / 错误码闭集。零 DB、零网络、零写仓（门脚本只写 gitignored 的
 * `backend-ts/.p7b-artifacts/`）。
 *
 * 跑法：node ops/recon-alert/qa/probe/qa-static.mjs
 */
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QA_ROOT = path.resolve(HERE, '..');
const REPO = path.resolve(QA_ROOT, '../../..');
const BACKEND = path.join(REPO, 'backend-ts');
const LOGS = path.join(QA_ROOT, 'logs');
const READINGS = path.join(QA_ROOT, 'readings');
fs.mkdirSync(LOGS, { recursive: true });
fs.mkdirSync(READINGS, { recursive: true });

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
};

const acs = [];
const t = (id, pass, detail) => acs.push({ id, pass: Boolean(pass), detail });

// ---- ① tsc --noEmit -----------------------------------------------------------
const tsc = run('npx', ['tsc', '--noEmit', '-p', 'tsconfig.json'], BACKEND);
fs.writeFileSync(path.join(LOGS, 'qa-tsc.log'), `exit=${tsc.code}\n${tsc.out}\n`, 'utf8');
t('AC6-1_tsc_noemit_exit0', tsc.code === 0, `exit=${tsc.code} bytes=${tsc.out.length}`);

// ---- ② p7b-03 离线门 -----------------------------------------------------------
const before = new Set(fs.existsSync(path.join(BACKEND, '.p7b-artifacts'))
  ? fs.readdirSync(path.join(BACKEND, '.p7b-artifacts')).filter((f) => f.startsWith('p7b-03-offline-gates'))
  : []);
const gate = run('npx', ['ts-node', '--transpile-only', '-P', 'tsconfig.json', 'scripts/p7b-03-offline-gates.ts'], BACKEND);
fs.writeFileSync(path.join(LOGS, 'qa-p7b-03-gate.log'), `exit=${gate.code}\n${gate.out}\n`, 'utf8');
const after = fs.readdirSync(path.join(BACKEND, '.p7b-artifacts')).filter((f) => f.startsWith('p7b-03-offline-gates'));
const fresh = after.filter((f) => !before.has(f)).sort();
const artifactPath = fresh.length > 0 ? path.join(BACKEND, '.p7b-artifacts', fresh[fresh.length - 1]) : null;
const artifact = artifactPath ? JSON.parse(fs.readFileSync(artifactPath, 'utf8')) : null;

t('AC6-2_gate_exit0', gate.code === 0, `exit=${gate.code}`);
t('AC6-3_gate_37_of_37', Boolean(artifact) && artifact.summary.total === 37 && artifact.summary.passed === 37 && artifact.summary.failed === 0,
  artifact ? JSON.stringify(artifact.summary) : 'no artifact');
const regCheck = artifact?.checks?.find((c) => c.id === 'AC10-2');
const codeCheck = artifact?.checks?.find((c) => c.id === 'AC10-1');
const regPoints = Number((/(\d+)/.exec(String(regCheck?.reading ?? '')) ?? [])[1] ?? NaN);
const codesCount = Number((/(\d+)/.exec(String(codeCheck?.reading ?? 'codes=')) ?? [])[1] ?? NaN);
t('AC6-4_registration_points_107', regPoints === 107 && regCheck?.pass === true, `reading=${regCheck?.reading} parsed=${regPoints}`);
t('AC6-5_codes_33', codesCount === 33 && codeCheck?.pass === true, `reading=${codeCheck?.reading} parsed=${codesCount}`);

// ---- ③ 路由注册点直接复算（与门独立）------------------------------------------
const indexSrc = fs.readFileSync(path.join(BACKEND, 'src/index.ts'), 'utf8');
const routeRe = /^app\.(get|post|put|delete|patch)\(/gm;
const perVerb = { get: 0, post: 0, put: 0, delete: 0, patch: 0 };
for (const m of indexSrc.matchAll(routeRe)) perVerb[m[1]] += 1;
const routeTotal = Object.values(perVerb).reduce((a, b) => a + b, 0);
t('AC6-6_route_count_107', routeTotal === 107, `total=${routeTotal} ${JSON.stringify(perVerb)}`);
const opsRoutes = [...indexSrc.matchAll(/^app\.(get|post)\(\s*'\/api\/ops\/recon\/ledger'/gm)].map((m) => m[1]);
t('AC6-7_ops_recon_single_get_route', opsRoutes.length === 1 && opsRoutes[0] === 'get', `matches=${JSON.stringify(opsRoutes)}`);

// ---- ④ git diff 面（无 vercel.json / 无 frontend / 无迁移 / 无 i18n）------------
const nameStatus = execFileSync('git', ['diff', '--name-status', 'be483cc..b8a076e'], { cwd: REPO, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((l) => l.split('\t'));
const files = nameStatus.map((p) => p[1]);
const hit = (re) => files.filter((f) => re.test(f));
const vercel = hit(/^vercel\.json$/);
const frontend = hit(/^frontend\//);
const migrations = hit(/^backend-ts\/migrations\//);
const i18n = hit(/i18n|locale/i);
t('AC6-8_no_vercel_json', vercel.length === 0, JSON.stringify(vercel));
t('AC6-9_no_frontend', frontend.length === 0, JSON.stringify(frontend));
t('AC6-10_no_migrations', migrations.length === 0, JSON.stringify(migrations));
t('AC6-11_no_i18n_files', i18n.length === 0, JSON.stringify(i18n));

const opsAlertOnly = files.every((f) => f === 'backend-ts/src/ops-alert.ts'
  || f === 'backend-ts/src/index.ts'
  || f.startsWith('ops/recon-alert/'));
t('AC6-12_touched_surface_limited', opsAlertOnly, JSON.stringify(nameStatus.map((p) => `${p[0]} ${p[1]}`)));

// ops-alert 未被其它模块引用（零新路由面）
const consumers = execFileSync('git', ['grep', '-l', 'ops-alert', 'b8a076e', '--', 'backend-ts/src'], { cwd: REPO, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const importers = consumers.filter((f) => !f.endsWith('backend-ts/src/ops-alert.ts')); // 自身文件命中的是自述注释
t('AC6-13_only_index_imports_ops_alert', importers.length === 1 && importers[0].endsWith('backend-ts/src/index.ts'), JSON.stringify({ consumers, importers }));

const out = {
  probe: 'qa-static',
  at: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
  parent: 'be483cc',
  gate_artifact: artifactPath,
  tsc_log: path.join(LOGS, 'qa-tsc.log'),
  gate_log: path.join(LOGS, 'qa-p7b-03-gate.log'),
  diff_name_status: nameStatus.map((p) => ({ status: p[0], file: p[1] })),
  route_count: { total: routeTotal, per_verb: perVerb },
  assertions: acs,
  failed: acs.filter((a) => !a.pass).map((a) => a.id),
  all_pass: acs.every((a) => a.pass),
};
const file = path.join(READINGS, 'AC6-static.json');
fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
console.log(JSON.stringify({ saved: file, failed: out.failed, all_pass: out.all_pass, gate: artifact?.summary, reg: regPoints, codes: codesCount, routes: routeTotal }));
process.exit(out.all_pass ? 0 : 1);
