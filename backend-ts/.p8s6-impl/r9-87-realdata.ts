/**
 * R-9-87 · 真方法 × 真数据（只读，零写）交叉读数
 * ============================================================================
 * 主仓 `DatabaseService.resolveJobApplication`（修复后） vs **仓外副本** `nopri`（去本人优先键）。
 * 真库现存撞车点（.p8s6-impl/recon.out.json 现取）：X=11 → app 11(worker 1) ∧ app 9(job 11, worker 6)。
 * 判据：主仓 ⇒ self；nopri ⇒ other（解析到他人）。控制臂（无撞车 X=24/uid 12）两者同值。
 * 用法（cwd = backend-ts）：npx ts-node --transpile-only .p8s6-impl/r9-87-realdata.ts
 */
import { DatabaseService } from '../src/database';
import { closePools } from '../src/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const NegDb = require('/Users/kevin/.hermes/profiles/zang/cache/scratch/r9-8687-neg/nopri/src/database') as {
  DatabaseService: { resolveJobApplication: (identifier: number, workerUid: number) => Promise<{ applicationId: number; workerUid: number; ownership: 'self' | 'other' } | null> };
};

const CASES: Array<{ id: string; X: number; uid: number; note: string }> = [
  { id: 'collision-11', X: 11, uid: 6, note: 'app 11(uid1) ∧ app 9(job 11,uid6) 同时存在（真库撞车）' },
  { id: 'collision-4', X: 4, uid: 970102, note: 'app 4(uid970002) ∧ app 5(job 4,uid970102)（真库撞车）' },
  { id: 'control-24', X: 24, uid: 12, note: '无撞车：application_id=24 属 uid12（对照，臂应同值 self）' },
  { id: 'tolerance-job23', X: 23, uid: 12, note: '仅 job_id 面命中（app 24 on job 23）⇒ 容错语义' },
];

const main = async () => {
  const out: Record<string, unknown> = { cases: [] as unknown[], assertions: {}, failures: [] as string[] };
  const cases: Array<Record<string, unknown>> = [];
  for (const c of CASES) {
    const fixed = await DatabaseService.resolveJobApplication(c.X, c.uid);
    const broken = await NegDb.DatabaseService.resolveJobApplication(c.X, c.uid);
    cases.push({ ...c, fixed, broken, diverge: JSON.stringify(fixed) !== JSON.stringify(broken) });
  }
  out.cases = cases;
  const by = (id: string) => cases.find((c) => c.id === id) as Record<string, any>;
  const a = {
    collision11_fixed_self: by('collision-11').fixed?.ownership === 'self' && by('collision-11').fixed.applicationId === 9,
    collision11_broken_other: by('collision-11').broken?.ownership === 'other' && by('collision-11').broken.applicationId === 11,
    collision4_fixed_self: by('collision-4').fixed?.ownership === 'self' && by('collision-4').fixed.applicationId === 5,
    collision4_broken_other: by('collision-4').broken?.ownership === 'other' && by('collision-4').broken.applicationId === 4,
    control_same_value: JSON.stringify(by('control-24').fixed) === JSON.stringify(by('control-24').broken)
      && by('control-24').fixed?.applicationId === 24,
    tolerance_kept: by('tolerance-job23').fixed?.applicationId === 24 && by('tolerance-job23').fixed?.ownership === 'self',
  };
  out.assertions = a;
  out.failures = Object.entries(a).filter(([, v]) => !v).map(([k]) => k);
  console.log('R987_REALDATA=' + JSON.stringify(out, null, 2));
  await closePools();
  process.exit((out.failures as string[]).length ? 1 : 0);
};

main().catch(async (e) => { console.error('R987_REALDATA_FAIL', e); await closePools().catch(() => undefined); process.exit(2); });
