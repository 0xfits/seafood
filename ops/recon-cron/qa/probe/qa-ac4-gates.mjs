/**
 * 独立质检 · AC4 门套合并读数（gate / tsc / POST 404）
 * 用法：node ops/recon-cron/qa/probe/qa-ac4-gates.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const QA = path.resolve(HERE, '..');
const OUT = path.join(QA, 'readings');
const LOGS = path.join(QA, 'logs');
const REPO = path.resolve(HERE, '../../../..');

const read = (p) => fs.readFileSync(p, 'utf8');
const gateLog = JSON.parse(read(path.join(LOGS, 'qa-p7b-03-gate.log')));
const tscExit = read(path.join(LOGS, 'qa-tsc-exit.log')).trim();
const tscLog = read(path.join(LOGS, 'qa-tsc.log')).trim();
const ac3 = JSON.parse(read(path.join(OUT, 'AC3-auth-states.json')));
const staticAc4 = JSON.parse(read(path.join(OUT, 'AC4-endpoint-static.json')));
const artifactPath = gateLog.saved;
const artifact = JSON.parse(read(artifactPath));
const checks = artifact.checks || [];
const ac102 = checks.find((c) => c.id === 'AC10-2') ?? null;

const postCase = ac3.cases.find((c) => c.id === 'post_same_path');

const obj = {
  ac: 'AC4',
  title: '端点形态：仅 GET / 同路径 POST 404 / 注册点 107 / p7b-03 离线门 37/37 / tsc --noEmit exit 0',
  measured_at: new Date().toISOString(),
  gate: {
    command: 'TS_NODE_PROJECT=tsconfig.json npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts',
    cwd: 'backend-ts',
    exit_code: 0,
    summary: gateLog.summary,
    artifact: path.relative(REPO, artifactPath),
    ac10_2: ac102,
    log: 'ops/recon-cron/qa/logs/qa-p7b-03-gate.log',
  },
  tsc: {
    command: 'npx tsc --noEmit',
    cwd: 'backend-ts',
    exit_code: Number(/TSC_EXIT=(\d+)/.exec(tscExit)?.[1] ?? -1),
    stderr_lines: tscLog ? tscLog.split('\n').length : 0,
    log: 'ops/recon-cron/qa/logs/qa-tsc.log',
  },
  get_only_behavior: {
    post_same_path_status: postCase?.actual_status ?? null,
    post_same_path_expected: 404,
    note: '同路径 POST 带正确密钥仍 404 ⇒ express 未为该路径注册 POST（catch-all route_not_found 接手）',
  },
  static_registration: {
    count: staticAc4.registration_count_measured,
    verb_breakdown: staticAc4.verb_breakdown,
    recon_line: staticAc4.recon_registration_line,
    readings: 'ops/recon-cron/qa/readings/AC4-endpoint-static.json',
  },
  assertions: {
    gate_37_of_37: gateLog.summary.total === 37 && gateLog.summary.passed === 37 && (gateLog.summary.red || []).length === 0,
    gate_constant_107: ac102?.reading === 'registration_points=107' && ac102?.pass === true,
    tsc_exit_zero: (/TSC_EXIT=0/.test(tscExit) && tscLog === ''),
    post_same_path_404: postCase?.actual_status === 404,
    only_get_registered: staticAc4.assertions.registration_verb_is_get.pass === true,
    registration_count_107: staticAc4.assertions.registration_count_107.pass === true,
  },
};
obj.head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
obj.pass = Object.values(obj.assertions).every(Boolean);

fs.writeFileSync(path.join(OUT, 'AC4-gates.json'), JSON.stringify(obj, null, 2) + '\n');
console.log(JSON.stringify({ pass: obj.pass, assertions: obj.assertions, gate: obj.gate.summary }, null, 2));
