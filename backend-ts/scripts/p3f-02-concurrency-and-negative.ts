/**
 * P3-F · 探针 02：真并发（同一 job 两条 accept）+ 「尺子必须会响」判负自证
 * 用法：npx ts-node --transpile-only scripts/p3f-02-concurrency-and-negative.ts
 *
 * 尺子用例（ruler）= 两条**独立连接**同时把同一 job 的两条报名置 accepted：
 *   · 有部分唯一索引 ⇒ conn2 **阻塞**（唯一索引项互斥）⇒ 被 statement_timeout 取消（57014）
 *   · 无部分唯一索引 ⇒ conn2 **立即成功**（两行 accepted 并存 ⇒ 缺陷）
 * 判负自证：在 scratch 副本造「拿掉部分唯一索引」的改写件 ⇒ DROP 库内索引 ⇒ 尺子**必红**；
 *   随后按迁移原文**逐字节重建**（indexdef 与 drop 前相等）⇒ 回绿；主工作区文件 sha256 前后相等。
 * 全程：只**读**工作区迁移文件；只操作本片新建对象（DROP/CREATE 该索引），不动既有表数据。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw1, save, errInfo, sha256, RUN, REPO, ensureUser, ensureFixtureJob, addApplication } from './p3f-lib';

const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch';
const PRISTINE = path.join(REPO, 'migrations', '0014_job_flow.sql');
const IDX = 'uniq_job_application_accepted';

type Check = { id: string; name: string; pass: boolean; readout: Record<string, unknown> };
const stage = (m: string) => console.log(`### ${m}`);

(async () => {
  const setup = mkPool(1);
  const c1Pool = mkPool(1);
  const c2Pool = mkPool(1);
  const checks: Check[] = [];
  const add = (id: string, name: string, pass: boolean, readout: Record<string, unknown> = {}) =>
    checks.push({ id, name, pass, readout });
  const opened: Array<{ release: () => void }> = [];
  try {
    const pristineBytes = fs.readFileSync(PRISTINE, 'utf8');
    const shaPristine0 = sha256(pristineBytes);
    const stat0 = fs.statSync(PRISTINE);
    const idxDef0 = (await raw1<{ indexdef: string }>(setup,
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='job_application' AND indexname=$1`, [IDX]))?.indexdef ?? null;

    // ---------------------------------------------------------------- 夹具（committed：两条独立连接须可见）
    stage('fixture');
    const E = `0xp3fconc${RUN}E`;
    const W1 = `0xp3fconc${RUN}W1`;
    const W2 = `0xp3fconc${RUN}W2`;
    const eU = await ensureUser(setup, E);
    const w1U = await ensureUser(setup, W1);
    const w2U = await ensureUser(setup, W2);
    const J = await ensureFixtureJob(setup, eU, '1', '100', 'conc');
    const A1 = await addApplication(setup, J, w1U, 'conc1');
    const A2 = await addApplication(setup, J, w2U, 'conc2');
    stage(`fixture job=${J} A1=${A1.application_id} A2=${A2.application_id}`);

    // ---------------------------------------------------------------- 尺子用例（可复用于 green / red）
    const ruler = async (label: string) => {
      const c1 = await c1Pool.connect(); opened.push(c1);
      const c2 = await c2Pool.connect(); opened.push(c2);
      let r2: Record<string, unknown> = {};
      let dt = 0;
      try {
        await c1.query('BEGIN');
        await c1.query(`UPDATE public.job_application SET status='accepted' WHERE application_id=$1::bigint`, [A1.application_id]);
        await c2.query('BEGIN');
        await c2.query("SET LOCAL statement_timeout='1500ms'");
        const t0 = Date.now();
        try {
          await c2.query(`UPDATE public.job_application SET status='accepted' WHERE application_id=$1::bigint`, [A2.application_id]);
          r2 = { ok: true, sqlstate: null, constraint: null };
        } catch (e) {
          const i = errInfo(e);
          r2 = { ok: false, sqlstate: i.sqlstate, constraint: i.constraint, message: i.message };
        }
        dt = Date.now() - t0;
      } finally {
        await c1.query('ROLLBACK').catch(() => undefined);
        await c2.query('ROLLBACK').catch(() => undefined);
        c1.release(); c2.release();
        opened.pop(); opened.pop();
      }
      return { label, dt_ms: dt, conn2: r2, blocked: (dt >= 1400) || (r2.ok === false && String(r2.sqlstate) === '57014') };
    };

    stage('ruler green (index present)');
    const g1 = await ruler('green-1');
    const greenBlocked = g1.dt_ms >= 1400 && g1.conn2.ok === false && String(g1.conn2.sqlstate) === '57014';
    add('F1', '真并发（有部分唯一索引）：conn2 被索引互斥阻塞 ⇒ statement_timeout 取消（57014），零 accepted 落库', (
      greenBlocked
    ), { ruler: g1, note: 'conn1 未提交即持有 accepted 索引项；conn2 等待其事务 ⇒ 证明唯一索引在**并发**下串行化 accept' });

    // ---------------------------------------------------------------- scratch 改写件（拿掉部分唯一索引）
    stage('tamper in scratch');
    const dir = path.join(SCRATCH, `p3f-${RUN}`);
    fs.mkdirSync(dir, { recursive: true });
    const idxLine = 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_job_application_accepted';
    const idxBlock = pristineBytes.slice(pristineBytes.indexOf(idxLine), pristineBytes.indexOf(idxLine) + pristineBytes.slice(pristineBytes.indexOf(idxLine)).indexOf(';') + 1);
    const tampered = pristineBytes.replace(idxBlock, `-- TAMPER: 部分唯一索引被移除（拿掉这条 ⇒ 尺子必须红）`);
    const tamperFile = path.join(dir, '0014_job_flow.NO_PARTIAL_UNIQUE_INDEX.sql');
    if (tampered !== pristineBytes && !fs.existsSync(tamperFile)) fs.writeFileSync(tamperFile, tampered);

    // 库内应用改写：DROP 索引（迁移已应用 ⇒ 用 DROP 复现「索引不存在」态）
    await setup.query(`DROP INDEX IF EXISTS public.${IDX}`);
    const idxDefGone = (await raw1<{ indexdef: string }>(setup,
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='job_application' AND indexname=$1`, [IDX]))?.indexdef ?? null;

    stage('ruler red (index dropped)');
    const r1 = await ruler('red-1');
    const redNotBlocked = r1.dt_ms < 1400 && r1.conn2.ok === true;
    add('F2', '判负自证：拿掉部分唯一索引 ⇒ 尺子必红（conn2 立即成功，两行 accepted 并存）', (
      idxDefGone === null && redNotBlocked
    ), { index_after_drop: idxDefGone, tamper_file: path.relative(REPO, tamperFile), ruler: r1,
         note: 'DROP INDEX 复现「迁移未建该索引」态；scratch 改写件留存为证（sha256 见下）' });

    // ---------------------------------------------------------------- 逐字节重建索引 ⇒ 回绿
    stage('restore index');
    await setup.query(`CREATE UNIQUE INDEX ${IDX} ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)`);
    const idxDefBack = (await raw1<{ indexdef: string }>(setup,
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='job_application' AND indexname=$1`, [IDX]))?.indexdef ?? null;
    const r2 = await ruler('green-after-restore');
    const restoreBlocked = r2.dt_ms >= 1400 && r2.conn2.ok === false && String(r2.conn2.sqlstate) === '57014';
    add('F3', '按迁移原文重建部分唯一索引 ⇒ indexdef 与 drop 前逐字符相等 + 尺子回绿', (
      idxDefBack !== null && idxDefBack === idxDef0 && restoreBlocked
    ), { indexdef_before: idxDef0, indexdef_after_restore: idxDefBack, indexdef_equal: idxDefBack === idxDef0, ruler: r2 });

    // ---------------------------------------------------------------- 工作区文件未被碰
    const finalSha = sha256(fs.readFileSync(PRISTINE, 'utf8'));
    const stat1 = fs.statSync(PRISTINE);
    add('F4', '主工作区迁移文件未被碰（sha256/字节/mtime 前后相等）', (
      finalSha === shaPristine0 && stat1.size === stat0.size && stat1.mtime.toISOString() === stat0.mtime.toISOString()
    ), { path: path.relative(REPO, PRISTINE), sha256_before: shaPristine0, sha256_after: finalSha,
         bytes_before: stat0.size, bytes_after: stat1.size, mtime_before: stat0.mtime.toISOString(), mtime_after: stat1.mtime.toISOString(),
         tamper_scratch_sha256: fs.existsSync(tamperFile) ? sha256(fs.readFileSync(tamperFile, 'utf8')) : null,
         tamper_pristine_delta_bytes: fs.existsSync(tamperFile) ? Buffer.byteLength(pristineBytes) - Buffer.byteLength(fs.readFileSync(tamperFile, 'utf8')) : null });

    // ---------------------------------------------------------------- 库终态：索引在位
    const idxFinal = (await raw1<{ indexdef: string }>(setup,
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='job_application' AND indexname=$1`, [IDX]))?.indexdef ?? null;
    add('F5', '库终态：部分唯一索引在位（与迁移原文一致）', idxFinal === idxDef0, { indexdef_final: idxFinal });

    const out = {
      probe: 'P3F-02-CONCURRENCY-AND-NEGATIVE', run_tag: RUN, repo: REPO, scratch_dir: dir,
      pristine_file: path.relative(REPO, PRISTINE), pristine_sha256: shaPristine0,
      index_name: IDX, indexdef_pristine: idxDef0,
      fixture: { job: J, applications: [A1.application_id, A2.application_id] },
      checks, pass_count: checks.filter((x) => x.pass).length, fail_count: checks.filter((x) => !x.pass).length,
      failed: checks.filter((x) => !x.pass).map((x) => x.id),
    };
    const file = save('concurrency-and-negative', out);
    console.log(JSON.stringify({ artifact: file, pass_count: out.pass_count, fail_count: out.fail_count, failed: out.failed,
      green: { dt_ms: g1.dt_ms, conn2: g1.conn2 }, red: { dt_ms: r1.dt_ms, conn2: r1.conn2 }, restore: { dt_ms: r2.dt_ms, conn2: r2.conn2 } }, null, 2));
    process.exitCode = out.fail_count === 0 ? 0 : 3;
  } catch (e) {
    console.error('p3f-02 fatal:', (e as Error)?.message || e);
    // 兜底：确保索引在位（不改变定义）
    try {
      await setup.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${IDX} ON public.job_application USING btree (job_id) WHERE (status = 'accepted'::text)`);
    } catch { /* noop */ }
    process.exitCode = 2;
  } finally {
    for (const c of opened) { try { c.release(); } catch { /* noop */ } }
    await setup.end().catch(() => undefined);
    await c1Pool.end().catch(() => undefined);
    await c2Pool.end().catch(() => undefined);
  }
})();
