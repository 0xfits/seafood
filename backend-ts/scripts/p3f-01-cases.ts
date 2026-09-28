/**
 * P3-F · 探针 01：行为用例 ①–⑥（**全部在单事务内**，末尾 ROLLBACK ⇒ 零残差）
 * 用法：npx ts-node --transpile-only scripts/p3f-01-cases.ts
 *
 * ① 同一 (job_id, worker_uid) 二次报名 ⇒ UNIQUE 拒（23505）
 * ② 顺序形状的「同一 job 最多一条 accepted」⇒ 部分唯一索引拒（23505）【真并发在 p3f-02】
 * ③ job_application.status 白名单 正/负全集
 * ④ job_submission.review_status 白名单 + 重复提交 + 列级不可变
 * ⑤ create_key 幂等（同键重放 ⇒ 唯一约束拒，不双写）
 * ⑥ 边界：不存在的 job_id（FK）/ worker_uid = employer_uid 自雇 / create_key 异内容
 */
import type { Pool } from '@neondatabase/serverless';
import { mkPool, errInfo, save, RUN, REPO, ensureUser, ensureFixtureJob, addApplication, applyRow, submissionRow, raw1 } from './p3f-lib';

type Check = { id: string; name: string; pass: boolean; readout: Record<string, unknown> };
const stage = (m: string) => console.log(`### ${m}`);

(async () => {
  const pool = mkPool(1);
  const checks: Check[] = [];
  const add = (id: string, name: string, pass: boolean, readout: Record<string, unknown> = {}) =>
    checks.push({ id, name, pass, readout });
  let clientRef: unknown = null;
  try {
    const client = await pool.connect();
    clientRef = client;
    const c = client as unknown as Pool;
    await c.query('BEGIN');

    const expectFail = async (label: string, fn: () => Promise<unknown>) => {
      await c.query('SAVEPOINT sp');
      try {
        await fn();
        await c.query('ROLLBACK TO SAVEPOINT sp');
        return { label, rejected: false, sqlstate: null as string | null, constraint: null as string | null, reason: null as string | null, message: null as string | null };
      } catch (e) {
        const i = errInfo(e);
        await c.query('ROLLBACK TO SAVEPOINT sp');
        return { label, rejected: true, sqlstate: i.sqlstate, constraint: i.constraint, reason: i.reason, message: i.message };
      }
    };

    stage('fixture');
    const E = await ensureUser(c, `0xp3fcase${RUN}E`);
    const W1 = await ensureUser(c, `0xp3fcase${RUN}W1`);
    const W2 = await ensureUser(c, `0xp3fcase${RUN}W2`);
    const W3 = await ensureUser(c, `0xp3fcase${RUN}W3`);
    const J = await ensureFixtureJob(c, E, '1', '100', 'cases');       // ① ② ④ ⑤ ⑥
    const JS = await ensureFixtureJob(c, E, '1', '100', 'status');     // ③ 专用
    stage(`fixture ok job=${J} statusJob=${JS}`);

    // ================================================================ ① 同一 (job_id,worker_uid) 二次报名
    stage('case C1');
    const a1 = await addApplication(c, J, W1, 'a1');
    const r1 = await expectFail('dup-job-worker', () => c.query(
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES ($1::bigint,$2::bigint,$3)`,
      [J, W1, `cli:p3f-${RUN}-apply-a1-dup`]));
    add('C1', '同一 (job_id,worker_uid) 二次报名 ⇒ UNIQUE(job_id,worker_uid) 拒绘', (
      r1.rejected && r1.sqlstate === '23505' && r1.constraint === 'job_application_job_worker_uniq'
    ), { first_insert: a1, second: r1 });

    // ================================================================ ② 同一 job 最多一条 accepted（顺序形状）
    stage('case C2');
    const a2 = await addApplication(c, J, W2, 'a2');
    const a3 = await addApplication(c, J, W3, 'a3');
    await c.query(`UPDATE public.job_application SET status='accepted' WHERE application_id=$1::bigint`, [a2.application_id]);
    const r2 = await expectFail('second-accept', () => c.query(
      `UPDATE public.job_application SET status='accepted' WHERE application_id=$1::bigint`, [a3.application_id]));
    const acceptedCount = await raw1<{ n: string }>(c,
      `SELECT count(*)::text AS n FROM public.job_application WHERE job_id=$1::bigint AND status='accepted'`, [J]);
    add('C2', '同一 job 第二条 accepted ⇒ 部分唯一索引 uniq_job_application_accepted 拒绘（恰一条 accepted）', (
      r2.rejected && r2.sqlstate === '23505' && r2.constraint === 'uniq_job_application_accepted' && acceptedCount?.n === '1'
    ), { second_accept: r2, accepted_count: acceptedCount?.n, accepted_application_id: a2.application_id });

    // ================================================================ ③ job_application.status 白名单 正/负全集（JS 专用）
    stage('case C3');
    const appA = await addApplication(c, JS, W1, 'st-a');
    const appR = await addApplication(c, JS, W2, 'st-r');
    const appW = await addApplication(c, JS, W3, 'st-w');
    const pos: Record<string, unknown>[] = [];
    await c.query(`UPDATE public.job_application SET status='accepted' WHERE application_id=$1::bigint`, [appA.application_id]);
    pos.push({ to: 'accepted', ok: true, status: (await applyRow(c, appA.application_id))?.status });
    await c.query(`UPDATE public.job_application SET status='rejected' WHERE application_id=$1::bigint`, [appR.application_id]);
    pos.push({ to: 'rejected', ok: true, status: (await applyRow(c, appR.application_id))?.status });
    await c.query(`UPDATE public.job_application SET status='withdrawn' WHERE application_id=$1::bigint`, [appW.application_id]);
    pos.push({ to: 'withdrawn', ok: true, status: (await applyRow(c, appW.application_id))?.status });

    const negSpecs: Array<[string, string, string]> = [
      ['accepted', 'applied', appA.application_id],
      ['accepted', 'rejected', appA.application_id],
      ['accepted', 'withdrawn', appA.application_id],
      ['rejected', 'accepted', appR.application_id],
      ['rejected', 'withdrawn', appR.application_id],
      ['withdrawn', 'accepted', appW.application_id],
    ];
    const neg: Record<string, unknown>[] = [];
    for (const [from, to, id] of negSpecs) {
      const rf = await expectFail(`neg-${from}-to-${to}`, () => c.query(
        `UPDATE public.job_application SET status=$1 WHERE application_id=$2::bigint`, [to, id]));
      neg.push({ from, to, rejected: rf.rejected, sqlstate: rf.sqlstate, reason: rf.reason });
    }
    // 状态 CHECK 的真身：UPDATE 路径被 BEFORE UPDATE 守卫（LD011）抢先，须用 **INSERT** 触达 CHECK（23514）
    const W5 = await ensureUser(c, `0xp3fcase${RUN}W5`);
    const badStatusIns = await expectFail('bad-status-insert', () => c.query(
      `INSERT INTO public.job_application (job_id, worker_uid, status, create_key) VALUES ($1::bigint,$2::bigint,'bogus',$3)`,
      [JS, W5, `cli:p3f-${RUN}-badstatus`]));
    add('C3', 'job_application.status 白名单：正全集全通 + 负全集全拒（LD011 + JOB_APPLICATION_STATE_INVALID）+ INSERT 异值触达 CHECK（23514）', (
      pos.every((x) => x.ok) && neg.every((x) => x.rejected && x.sqlstate === 'LD011' && x.reason === 'JOB_APPLICATION_STATE_INVALID')
      && badStatusIns.rejected && badStatusIns.sqlstate === '23514' && badStatusIns.constraint === 'job_application_status_enum'
    ), { positive: pos, negative: neg, bad_status_insert: badStatusIns,
         note: 'UPDATE 路径由 BEFORE UPDATE 守卫（LD011）先拒 ⇒ 桌级 CHECK 仅能由 INSERT 触达（实测 23514 / job_application_status_enum）' });

    // ================================================================ ④ job_submission 白名单 + 重复提交 + 不可变
    stage('case C4');
    const s1 = await raw1<{ submission_id: string }>(c,
      `INSERT INTO public.job_submission (job_id, worker_uid, deliverable, create_key)
       VALUES ($1::bigint,$2::bigint,'交付物链接',$3) RETURNING submission_id::text AS submission_id`,
      [J, W1, `cli:p3f-${RUN}-submit-s1`]);
    const sId = String(s1?.submission_id);
    const W6 = await ensureUser(c, `0xp3fcase${RUN}W6`);
    const r4a = await expectFail('bad-review-status-insert', () => c.query(
      `INSERT INTO public.job_submission (job_id, worker_uid, deliverable, review_status, create_key)
       VALUES ($1::bigint,$2::bigint,'x','bogus',$3)`, [J, W6, `cli:p3f-${RUN}-badreview`]));
    await c.query(`UPDATE public.job_submission SET review_status='approved', reviewed_by=$2::bigint, reviewed_at=now(), review_memo='ok'
                    WHERE submission_id=$1::bigint`, [sId, E]);
    const r4b = await expectFail('mutate-deliverable', () => c.query(
      `UPDATE public.job_submission SET deliverable='篡改' WHERE submission_id=$1::bigint`, [sId]));
    const r4c = await expectFail('flip-verdict', () => c.query(
      `UPDATE public.job_submission SET review_status='rejected' WHERE submission_id=$1::bigint`, [sId]));
    const r4d = await expectFail('mutate-reviewed-by', () => c.query(
      `UPDATE public.job_submission SET reviewed_by=$2::bigint WHERE submission_id=$1::bigint`, [sId, W2]));
    const r4e = await expectFail('dup-create-key', () => c.query(
      `INSERT INTO public.job_submission (job_id, worker_uid, deliverable, create_key)
       VALUES ($1::bigint,$2::bigint,'x',$3)`, [J, W1, `cli:p3f-${RUN}-submit-s1`]));
    const sFinal = await submissionRow(c, sId);
    add('C4', 'job_submission：review_status 白名单（INSERT 触达 CHECK 23514）+ 结论冻结 + deliverable/create_key 不可变 + 重复提交拒', (
      r4a.rejected && r4a.sqlstate === '23514' && r4a.constraint === 'job_submission_review_status_enum'
      && String(sFinal?.review_status) === 'approved'
      && r4b.rejected && r4b.reason === 'job_submission_core_immutable'
      && r4c.rejected && r4c.reason === 'job_review_status_invalid'
      && r4d.rejected && r4d.reason === 'job_review_immutable'
      && r4e.rejected && r4e.sqlstate === '23505' && r4e.constraint === 'job_submission_create_key_uniq'
    ), { bad_review_status_insert: r4a, mutate_deliverable: r4b, flip_verdict: r4c, mutate_reviewed_by: r4d, dup_create_key: r4e, final: sFinal });

    // ================================================================ ⑤ create_key 幂等（同键重放不双写）
    stage('case C5');
    const W4 = await ensureUser(c, `0xp3fcase${RUN}W4`);
    const k = `cli:p3f-${RUN}-idem`;
    const ins1 = await raw1<{ application_id: string }>(c,
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES ($1::bigint,$2::bigint,$3)
       RETURNING application_id::text AS application_id`, [J, W4, k]);
    const r5 = await expectFail('replay-same-create-key', () => c.query(
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES ($1::bigint,$2::bigint,$3)`, [J, W4, k]));
    const n5 = await raw1<{ n: string }>(c, `SELECT count(*)::text AS n FROM public.job_application WHERE create_key=$1`, [k]);
    add('C5', 'create_key 幂等：同键重放被 UNIQUE(create_key) 拒（不双写；200 重放语义属路由层，本片不建）', (
      r5.rejected && r5.sqlstate === '23505' && r5.constraint === 'job_application_create_key_uniq' && n5?.n === '1'
    ), { first: ins1, replay: r5, rows_with_key: n5?.n });

    // ================================================================ ⑥ 边界
    stage('case C6');
    const b1 = await expectFail('nonexistent-job', () => c.query(
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES (999999999,$1::bigint,$2)`,
      [W1, `cli:p3f-${RUN}-bad-job`]));
    const selfApply = await raw1<{ application_id: string }>(c,
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES ($1::bigint,$2::bigint,$3)
       RETURNING application_id::text AS application_id`, [J, E, `cli:p3f-${RUN}-self`]);
    const b3 = await expectFail('create-key-diff-content', () => c.query(
      `INSERT INTO public.job_application (job_id, worker_uid, create_key) VALUES ($1::bigint,$2::bigint,$3)`,
      [J, W3, `cli:p3f-${RUN}-apply-a2`]));
    add('C6', '边界：不存在的 job_id ⇒ FK 23503；自雇（worker=employer）DB 层**允许**（spec 无 DB 级禁止）；create_key 异内容 ⇒ 23505', (
      b1.rejected && b1.sqlstate === '23503'
      && selfApply !== null
      && b3.rejected && b3.sqlstate === '23505'
    ), { nonexistent_job: b1, self_apply_allowed: selfApply !== null, create_key_diff_content: b3,
         note: 'spec DL54/DL55 未定义「自雇」DB 级禁止 ⇒ 实测为允许（属路由/应用层约束，本片不越权加约束）' });

    stage('rollback');
    await c.query('ROLLBACK');
    client.release();
    clientRef = null;
    const pool2 = mkPool(1);
    const residual = await raw1<{ n: string }>(pool2,
      `SELECT (SELECT count(*) FROM public.job_application WHERE job_id IN ($1::bigint,$2::bigint))
            + (SELECT count(*) FROM public.job_submission WHERE job_id IN ($1::bigint,$2::bigint)) AS n`, [J, JS]);
    await pool2.end().catch(() => undefined);
    stage(`residual=${residual?.n}`);

    const out = {
      probe: 'P3F-01-CASES', run_tag: RUN, repo: REPO, fixture: { employer: E, workers: [W1, W2, W3], job: J, status_job: JS },
      transactional: { begin: true, ended_with: 'ROLLBACK', residual_rows_for_fixture_jobs: residual?.n ?? null },
      checks, pass_count: checks.filter((x) => x.pass).length, fail_count: checks.filter((x) => !x.pass).length,
      failed: checks.filter((x) => !x.pass).map((x) => x.id),
    };
    const file = save('cases', out);
    console.log(JSON.stringify({ artifact: file, pass_count: out.pass_count, fail_count: out.fail_count, failed: out.failed,
      checks: checks.map((x) => ({ id: x.id, pass: x.pass })), residual: out.transactional }, null, 2));
    process.exitCode = out.fail_count === 0 ? 0 : 3;
  } catch (e) {
    if (clientRef) { try { await (clientRef as { query: (s: string) => Promise<unknown> }).query('ROLLBACK'); } catch { /* noop */ } }
    console.error('p3f-01 fatal:', (e as Error)?.message || e);
    process.exitCode = 2;
  } finally {
    if (clientRef) { try { (clientRef as { release: () => void }).release(); } catch { /* noop */ } }
    await pool.end().catch(() => undefined);
  }
})();
