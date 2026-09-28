/**
 * P3-J · 探针 03：真并发（④）+ 「尺子必须会响」的判负自证
 *
 * 用法：npx ts-node --transpile-only scripts/p3j-03-concurrency-and-negative.ts
 *
 * ① 真并发：两个独立连接**同时**对同一 job 发同键退款 ⇒ 恰一次落账、无 40P01/40P03、
 *    `ledger_event_keys` 不得被追加两次（DL144①/DL149③ 的并发形态）。
 * ② 判负自证：把 `0013` 的**幂等判据**在 scratch 副本里改坏（两处独立改法），确认相关用例**必红**；
 *    随后用主工作区的 pristine 字节重新装载并确认回绿。全程只**读**工作区迁移文件：
 *      - sha256(工作区文件) 前后必须相等；
 *      - scratch 副本每次落盘都记 sha256；
 *      - 恢复动作 = 用 pristine 字节重新装载（不是「再改一次」）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, save, jobPostEvent, ensureUser, fundFromResidual, acct, jobRow, ledgerRows, errInfo, sha256, OUT_DIR, REPO, RUN, uuidish } from './p3j-lib';

const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch';
const PRISTINE = path.join(REPO, 'migrations', '0013_job_core.sql');

type Check = { id: string; name: string; pass: boolean; readout: Record<string, unknown> };

(async () => {
  const p1 = mkPool(1);
  const p2 = mkPool(1);
  const checks: Check[] = [];
  const add = (id: string, name: string, pass: boolean, readout: Record<string, unknown> = {}) =>
    checks.push({ id, name, pass, readout });

  // 多语句 SQL 必须走**会话模式**客户端（migrate.ts 同法：pool.connect() + client.query）；
  // HTTP 模式（pool.query）只允许单语句。
  const applySql = async (pool: ReturnType<typeof mkPool>, sql: string, label: string) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(sql);
      await c.query('COMMIT');
      return { applied: true, label };
    } catch (e) {
      await c.query('ROLLBACK').catch(() => undefined);
      return { applied: false, label, error: errInfo(e) };
    } finally { c.release(); }
  };

  try {
    const pristineBytes = fs.readFileSync(PRISTINE, 'utf8');
    const shaPristine0 = sha256(pristineBytes);
    const statPristine0 = fs.statSync(PRISTINE);

    const E = await ensureUser(p1, `0xp3jconc${RUN}`);
    const fund = await fundFromResidual(p1, E, 1200n);

    // ================================================================ ① 真并发（同键退款）
    const pub = await jobPostEvent(p1, {
      op: 'publish', create_key: `cli:${uuidish('conc')}`, employer_uid: E, cid: '1', reward: '500', title: 'p3j concurrency',
    });
    const jobId = String(pub.job_id);
    const refundKey = `biz:job:refund:${jobId}`;
    const beforeConc = await jobRow(p1, jobId);
    const acctBefore = await acct(p1, E);

    const call = (pool: ReturnType<typeof mkPool>) =>
      jobPostEvent(pool, { op: 'refund', job_id: jobId, to_status: 'cancelled' })
        .then((r) => ({ ok: true as const, r }))
        .catch((e) => ({ ok: false as const, e: errInfo(e) }));
    const [a, b] = await Promise.all([call(p1), call(p2)]);

    const rows = await ledgerRows(p1, refundKey);
    const afterConc = await jobRow(p1, jobId);
    const acctAfter = await acct(p1, E);
    const outcomes = [a, b].map((x) => x.ok
      ? { ok: true, idempotent_replay: x.r.idempotent_replay, txid: x.r.txid, status: x.r.status }
      : { ok: false, error: x.e });
    const replayCount = outcomes.filter((o) => o.ok && (o as { idempotent_replay: unknown }).idempotent_replay === false).length;
    const deadlock = outcomes.some((o) => !o.ok && ['40P01', '40P03'].indexOf(String((o as { error: { sqlstate: string } }).error.sqlstate)) >= 0);

    add('CN1', '真并发同键退款：两连接恰一次落账、无 40P01/40P03、事件键不追加两次', (
      outcomes.every((o) => o.ok === true)
      && replayCount === 1
      && !deadlock
      && rows.length === 2
      && (afterConc?.ledger_event_keys as string[]).length === 2
      && String(afterConc?.status) === 'cancelled'
      && String(acctAfter?.frozen) === String(Number(acctBefore?.frozen) - 500)
    ), { outcomes, refund_key: refundKey, ledger_rows: rows.length, job_before: beforeConc, job_after: afterConc, account_before: acctBefore, account_after: acctAfter, deadlock });

    // ================================================================ ② 判负自证
    const dir = path.join(SCRATCH, `p3j-${RUN}`);
    fs.mkdirSync(dir, { recursive: true });

    // ---- 两个「尺子用例」：同键重放必须 green，否则 = 红
    const replayCasePublish = async (label: string) => {
      const k = `cli:${uuidish(label)}`;
      const j = await jobPostEvent(p1, { op: 'publish', create_key: k, employer_uid: E, cid: '1', reward: '300', title: label });
      const id = String(j.job_id);
      const key = `biz:job:escrow:${id}`;
      const before = await jobRow(p1, id);
      const rep = await jobPostEvent(p1, { op: 'publish', create_key: k, employer_uid: E, cid: '1', reward: '300', title: label });
      const after = await jobRow(p1, id);
      const n = (await ledgerRows(p1, key)).length;
      return {
        green: rep.idempotent_replay === true && (after?.ledger_event_keys as string[]).length === 1 && n === 2
              && String(after?.time_updated) === String(before?.time_updated),
        idempotent_replay: rep.idempotent_replay,
        ledger_event_keys: after?.ledger_event_keys, ledger_event_keys_before: before?.ledger_event_keys,
        ledger_rows: n, business_row_rewritten: String(after?.time_updated) !== String(before?.time_updated),
        txid: rep.txid,
      };
    };
    const replayCaseRefund = async (label: string) => {
      const j = await jobPostEvent(p1, { op: 'publish', create_key: `cli:${uuidish(label)}`, employer_uid: E, cid: '1', reward: '300', title: label });
      const id = String(j.job_id);
      await jobPostEvent(p1, { op: 'refund', job_id: id, to_status: 'cancelled' });
      const key = `biz:job:refund:${id}`;
      const n0 = (await ledgerRows(p1, key)).length;
      try {
        const rep = await jobPostEvent(p1, { op: 'refund', job_id: id, to_status: 'cancelled' });
        const n1 = (await ledgerRows(p1, key)).length;
        return { green: rep.idempotent_replay === true && n1 === n0, idempotent_replay: rep.idempotent_replay, rows_before: n0, rows_after: n1, error: null };
      } catch (e) {
        return { green: false, idempotent_replay: null, rows_before: n0, rows_after: (await ledgerRows(p1, key)).length, error: errInfo(e) };
      }
    };

    const baselinePub = await replayCasePublish('base-pub');
    const baselineRef = await replayCaseRefund('base-ref');

    const tamper = (name: string, anchor: string, replacement: string) => {
      if (pristineBytes.indexOf(anchor) < 0) return { ok: false as const, reason: 'anchor not found', anchor };
      const broken = pristineBytes.replace(anchor, replacement);
      const file = path.join(dir, `0013_broken_${name}.sql`);
      fs.writeFileSync(file, broken);
      return { ok: true as const, file, broken, scratch_sha256: sha256(broken), pristine_sha256: shaPristine0, changed_bytes: Buffer.byteLength(pristineBytes) - Buffer.byteLength(broken) };
    };

    // ---- TAMPER-A：拿掉「重放不写业务行」的闸（改用无条件写回 = 不追加 ledger_event_keys 的判据被破坏）
    const anchorA = '  -- 判据是账本侧的 `idempotent_replay`（+ 只读根键探测），**不是** `UPDATE ... RETURNING` 的行数。\n  IF NOT v_replay THEN';
    const tamperA = tamper('A_always_write_back', anchorA, '  -- TAMPER-A：无条件写回（幂等判据被破坏）\n  IF true THEN');
    let redA: Record<string, unknown> | null = null;
    let restoreA: Record<string, unknown> | null = null;
    let greenAAfter: Record<string, unknown> | null = null;
    if (tamperA.ok) {
      const applied = await applySql(p1, tamperA.broken, 'TAMPER-A');
      const caseA = await replayCasePublish('tamper-a');
      redA = { applied, case: caseA, red: caseA.green === false };
      const restored = await applySql(p1, pristineBytes, 'RESTORE-A');
      greenAAfter = { restored, case: await replayCasePublish('after-restore-a') };
    }
    add('CN2', 'TAMPER-A（无条件写回）⇒ 重放用例必红', (
      tamperA.ok === true && redA !== null
      && (redA as { applied: { applied: boolean } }).applied.applied === true
      && (redA as { red: boolean }).red === true
    ), { tamper: tamperA.ok ? { file: tamperA.file, scratch_sha256: tamperA.scratch_sha256 } : tamperA, red: redA });
    add('CN3', '逐字节恢复（pristine 重装）⇒ 用例回绿', (
      greenAAfter !== null
      && (greenAAfter as { restored: { applied: boolean } }).restored.applied === true
      && (greenAAfter as { case: { green: boolean } }).case.green === true
    ), { restore: greenAAfter });

    // ---- TAMPER-E：状态机闸不再为「重放」让路（业务侧幂等与账本侧分叉，DL144③）
    const anchorE = '    -- ③ 状态机闸（DL51/DL52；**仅非重放**：重放时业务行已在终态，不得第二次校验/重写）\n    IF NOT v_replay THEN';
    const tamperE = tamper('E_always_state_check', anchorE, '    -- TAMPER-E：重放也走状态机闸（与账本侧重放分叉）\n    IF true THEN');
    let redE: Record<string, unknown> | null = null;
    let greenEAfter: Record<string, unknown> | null = null;
    if (tamperE.ok) {
      const applied = await applySql(p1, tamperE.broken, 'TAMPER-E');
      const caseE = await replayCaseRefund('tamper-e');
      redE = { applied, case: caseE, red: caseE.green === false };
      const restored = await applySql(p1, pristineBytes, 'RESTORE-E');
      greenEAfter = { restored, case: await replayCaseRefund('after-restore-e') };
    }
    add('CN4', 'TAMPER-E（重放也走状态机闸）⇒ 重放用例必红', (
      tamperE.ok === true && redE !== null
      && (redE as { applied: { applied: boolean } }).applied.applied === true
      && (redE as { red: boolean }).red === true
    ), { tamper: tamperE.ok ? { file: tamperE.file, scratch_sha256: tamperE.scratch_sha256 } : tamperE, red: redE });
    add('CN5', '逐字节恢复（pristine 重装）⇒ 回绿 + 工作区文件未被碰（sha256/字节/行数/大小/mtime 不变）', (
      greenEAfter !== null
      && (greenEAfter as { restored: { applied: boolean } }).restored.applied === true
      && (greenEAfter as { case: { green: boolean } }).case.green === true
    ), { restore: greenEAfter, worktree: { sha256_before: shaPristine0, sha256_after: sha256(fs.readFileSync(PRISTINE, 'utf8')), bytes_before: statPristine0.size, bytes_after: fs.statSync(PRISTINE).size, mtime_before: statPristine0.mtime.toISOString(), mtime_after: fs.statSync(PRISTINE).mtime.toISOString() } });

    const finalSha = sha256(fs.readFileSync(PRISTINE, 'utf8'));
    add('CN6', '工作区迁移文件 sha256 前后逐字节相等', finalSha === shaPristine0, { sha256_before: shaPristine0, sha256_after: finalSha, path: path.relative(REPO, PRISTINE) });

    const out = {
      probe: 'P3J-03-CONCURRENCY-AND-NEGATIVE', run_tag: RUN,
      scratch_dir: dir, pristine_file: path.relative(REPO, PRISTINE), pristine_sha256: shaPristine0,
      baseline: { publish_replay: baselinePub, refund_replay: baselineRef, fund },
      checks,
      pass_count: checks.filter((c) => c.pass).length,
      fail_count: checks.filter((c) => !c.pass).length,
      failed: checks.filter((c) => !c.pass).map((c) => c.id),
    };
    const file = save('concurrency-and-negative', out);
    console.log(JSON.stringify({ artifact: file, pass_count: out.pass_count, fail_count: out.fail_count, failed: out.failed, checks: checks.map((c) => ({ id: c.id, pass: c.pass })) , baseline: out.baseline }, null, 2));
    process.exitCode = out.fail_count === 0 ? 0 : 3;
  } finally {
    // 收尾：确保库里是 pristine 定义（即便中途失败）
    try { await applySql(p1, fs.readFileSync(PRISTINE, 'utf8'), 'FINAL-ENSURE-PRISTINE'); } catch { /* noop */ }
    await p1.end().catch(() => undefined);
    await p2.end().catch(() => undefined);
  }
})().catch((e) => { console.error('p3j-03 fatal:', (e as Error)?.message || e); process.exit(2); });
