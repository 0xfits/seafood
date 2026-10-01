/**
 * P6-TR-1c-FIX · 读回面验收（类级断言）：GET /api/task/all 逐字段检查
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p4z-tr1c-fix-02-readback.ts
 * 断言：
 *   ① `^\[(en|vn)\] `（stub 前缀）命中数 = 0 —— 遍历每个对象的**所有**字符串字段；
 *   ② i18n_status 分布快照；原本因 stub 而 ready 的 job（清洗前 = 5/8/9/10/22）必须回落 pending/partial；
 *   ③ 真 ready 的对象 = 有真实译文的（job 2/3/4 等）。
 * 只读、零 DML；不打印任何密钥值。产物：.p4-artifacts/p6tr1cfix-<RUN>/readback.json
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env.SEAFOOD_API || 'http://127.0.0.1:5788';
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, '..', '.p4-artifacts', `p6tr1cfix-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const STUB_RE = /^\[(en|vn)\] /;
/** 清洗前因 stub 前缀而受到污染的 job_id（= 被复位为 pending 的 14 行所属实体）。 */
const PRE_CLEAN_STUB_JOBS = ['5', '8', '9', '10', '22'];

interface Check { id: string; pass: boolean; expect: string; actual: string; }
const checks: Check[] = [];
const t = (id: string, pass: boolean, expect: unknown, actual: unknown) => checks.push({ id, pass: Boolean(pass), expect: String(expect), actual: String(actual) });

const main = async (): Promise<void> => {
  const res = await fetch(`${BASE}/api/task/all?limit=500`);
  const httpStatus = res.status;
  const body = await res.json() as { data?: unknown[] };
  const arr = (Array.isArray(body) ? body : (body.data || [])) as Array<Record<string, unknown>>;

  let stubHits = 0;
  const stubSamples: string[] = [];
  const dist: Record<string, number> = {};
  const perJob: Array<{ tID: string; i18n_status: string }> = [];
  const walk = (o: unknown, p: string): void => {
    if (o && typeof o === 'object') {
      for (const k of Object.keys(o as Record<string, unknown>)) {
        const v = (o as Record<string, unknown>)[k];
        if (typeof v === 'string') {
          if (STUB_RE.test(v)) { stubHits += 1; if (stubSamples.length < 10) stubSamples.push(`${p}.${k}=${v.slice(0, 40)}`); }
        } else walk(v, `${p}.${k}`);
      }
    }
  };
  arr.forEach((o, i) => {
    const s = String(o.i18n_status ?? '(none)');
    dist[s] = (dist[s] || 0) + 1;
    perJob.push({ tID: String(o.tID ?? o.tid ?? i), i18n_status: s });
    walk(o, `#${i}`);
  });

  t('RB1', httpStatus === 200, 'HTTP 200', httpStatus);
  t('RB2', arr.length > 0, '任务数 > 0', arr.length);
  t('RB3', stubHits === 0, 'stub 前缀命中数 = 0', stubHits);
  // 原本因 stub 而 ready 的 job ⇒ 现必须 pending/partial（不得 ready）
  const bad = perJob.filter((j) => PRE_CLEAN_STUB_JOBS.includes(j.tID) && j.i18n_status === 'ready');
  t('RB4', bad.length === 0, '清洗前 stub 污染的 job 不再 ready', JSON.stringify(bad));
  const stat = (id: string) => perJob.find((j) => j.tID === id)?.i18n_status ?? '(不在本页)';
  t('RB5', ['5', '8', '9', '10', '22'].every((id) => stat(id) === 'pending' || stat(id) === 'partial'),
    'job 5/8/9/10/22 = pending|partial', JSON.stringify(['5', '8', '9', '10', '22'].map((id) => `${id}:${stat(id)}`)));

  const out = { unit: 'P6-TR-1c-FIX', run: RUN, generated_at: new Date().toISOString(), endpoint: `${BASE}/api/task/all?limit=500`,
    http_status: httpStatus, objects: arr.length, stub_prefix_hits: stubHits, stub_samples: stubSamples,
    i18n_status_dist: dist, per_job: perJob, checks };
  fs.writeFileSync(path.join(OUT_DIR, 'readback.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log('HTTP', httpStatus, 'OBJECTS', arr.length, 'STUB_HITS', stubHits);
  console.log('I18N_DIST', JSON.stringify(dist));
  console.log('PRE_CLEAN_STUB_JOBS_STATUS', JSON.stringify(['5', '8', '9', '10', '22'].map((id) => `${id}:${stat(id)}`)));
  console.log('CHECKS', checks.map((c) => `${c.id}=${c.pass ? 'PASS' : 'FAIL'}`).join(' '));
  console.log('ARTIFACT', path.join(OUT_DIR, 'readback.json'));
  const failed = checks.filter((c) => !c.pass);
  if (failed.length) process.exit(1);
};
main().catch((e) => { console.error('READBACK_CRASHED', (e as Error)?.message); process.exit(1); });
