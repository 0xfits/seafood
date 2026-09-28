/**
 * P3-P-03 · 判负自证（尺子必须会响）—— 破一处结构性保证 ⇒ 对应用例必红；同一事务内 ROLLBACK ⇒ 回绿。
 * 手法：① 在 **scratch 副本**里把 `0017_platform_config.sql` 的结构保证改坏（去掉 append-only / key-immutable
 *         触发器创建块）并记录 sha256（证明改动**只落 scratch**）；
 *       ② 真库侧用「同一事务内 `DROP TRIGGER` → 跑用例（应绿变红）→ `ROLLBACK TO SAVEPOINT`（触发器恢复）」
 *         复现「改坏结构 ⇒ 用例变红」；函数/触发器改动**全在同一事务内并 ROLLBACK**。
 * 全程只读主工作区迁移文件；**不改** migrations / src / docs。读法：npx ts-node --transpile-only scripts/p3p-03-falsify.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, save, mkChecks, txn, ensureUser, foreignRows, sha256File, sha256, OUT_DIR, RUN, MIGRATION_FILE, NS_UID_MIN, NS_UID_MAX } from './p3p-lib';

const main = async () => {
  const { add, list } = mkChecks();

  // ============================================================ ① scratch 副本改坏
  const shaA = sha256File(MIGRATION_FILE);
  const sqlPristine = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const scratchDir = path.join(OUT_DIR, `scratch-${RUN}`);
  fs.mkdirSync(scratchDir, { recursive: true });

  const stripBlock = (sql: string, dropStmt: string): string => {
    const re = new RegExp(dropStmt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?FOR EACH ROW EXECUTE FUNCTION[^;]*;\\n');
    const out = sql.replace(re, `-- [FALSIFY ${RUN}] structural guarantee removed\n`);
    if (out === sql) throw new Error(`falsify: pattern not found for ${dropStmt}`);
    return out;
  };

  const brokenAppendOnly = stripBlock(sqlPristine, 'DROP TRIGGER IF EXISTS trg_currency_status_log_append_only');
  const brokenKeyImmutable = stripBlock(sqlPristine, 'DROP TRIGGER IF EXISTS trg_app_config_key_immutable');

  const p1 = path.join(scratchDir, '0017-broken-no-append-only.sql');
  const p2 = path.join(scratchDir, '0017-broken-no-key-immutable.sql');
  if (fs.existsSync(p1) || fs.existsSync(p2)) throw new Error('refuse to overwrite scratch copies');
  fs.writeFileSync(p1, brokenAppendOnly);
  fs.writeFileSync(p2, brokenKeyImmutable);
  const shaB1 = sha256File(p1);
  const shaB2 = sha256File(p2);

  add('N1', 'scratch 破件 1 与原件**不同**（append-only 触发器块已删）', shaB1 !== shaA, { shaA, shaB1 });
  add('N2', 'scratch 破件 2 与原件**不同**（app_config key-immutable 触发器块已删）', shaB2 !== shaA, { shaA, shaB2 });
  add('N3', '两破件互不相同（各自只动一处）', shaB1 !== shaB2, { shaB1, shaB2 });

  // ============================================================ ② 真库侧：破 → 红 → 回绿（同一事务）
  const p = mkPool();
  const c = await p.connect();
  const db = c as unknown as Parameters<typeof raw>[0];
  try {
    await txn.begin(db);
    const U = await ensureUser(db, 990704, 'falsify');

    // ---- 场景 A：currency_status_log append-only
    await raw(db, `INSERT INTO public.currency_status_log(cid,from_status,to_status,actor_uid) VALUES (1,'listed','frozen',$1::bigint)`, [U]);
    const logId = (await raw1<{ log_id: string }>(db, `SELECT max(log_id)::text AS log_id FROM public.currency_status_log`))?.log_id ?? null;
    const greenA = await txn.try(db, `UPDATE public.currency_status_log SET to_status='active' WHERE log_id=$1::bigint`, [logId]);
    add('A-GREEN', '破坏前：currency_status_log UPDATE 被拒（尺子正常）', greenA.rejected === true && greenA.err?.sqlstate === 'P0001', { err: greenA.err });

    await raw(db, 'SAVEPOINT s_brokenA');
    await raw(db, `DROP TRIGGER trg_currency_status_log_append_only ON public.currency_status_log`);
    const redA = await txn.try(db, `UPDATE public.currency_status_log SET to_status='active' WHERE log_id=$1::bigint`, [logId]);
    add('A-RED', '去掉 append-only 触发器后：UPDATE **成功** ⇒ 对应用例必红（尺子会响）', redA.rejected === false && redA.rowCount === 1, { update: redA });
    await raw(db, 'ROLLBACK TO SAVEPOINT s_brokenA');
    await raw(db, 'RELEASE SAVEPOINT s_brokenA');
    const greenA2 = await txn.try(db, `UPDATE public.currency_status_log SET to_status='active' WHERE log_id=$1::bigint`, [logId]);
    add('A-RESTORE', '回滚触发器后：UPDATE 又被拒（逐字节回绿）', greenA2.rejected === true && greenA2.err?.sqlstate === 'P0001', { err: greenA2.err });

    // ---- 场景 B：app_config key 不可变
    await raw(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ('cli:kong17-falsify','{"x":1}'::jsonb,$1::bigint)`, [U]);
    const greenB = await txn.try(db, `UPDATE public.app_config SET key='cli:kong17-falsify2' WHERE key='cli:kong17-falsify'`);
    add('B-GREEN', '破坏前：app_config.key 修改被拒（尺子正常）', greenB.rejected === true && greenB.err?.sqlstate === 'P0001', { err: greenB.err });

    await raw(db, 'SAVEPOINT s_brokenB');
    await raw(db, `DROP TRIGGER trg_app_config_key_immutable ON public.app_config`);
    const redB = await txn.try(db, `UPDATE public.app_config SET key='cli:kong17-falsify2' WHERE key='cli:kong17-falsify'`);
    add('B-RED', '去掉 key-immutable 触发器后：改 PK key **成功** ⇒ 对应用例必红', redB.rejected === false && redB.rowCount === 1, { update: redB });
    await raw(db, 'ROLLBACK TO SAVEPOINT s_brokenB');
    await raw(db, 'RELEASE SAVEPOINT s_brokenB');
    const greenB2 = await txn.try(db, `UPDATE public.app_config SET key='cli:kong17-falsify2' WHERE key='cli:kong17-falsify'`);
    add('B-RESTORE', '回滚触发器后：改 key 又被拒（逐字节回绿）', greenB2.rejected === true && greenB2.err?.sqlstate === 'P0001', { err: greenB2.err });

    // ---- 全库触发器启用态未被本自证破坏
    const bad = await raw1<{ n: string }>(db, `SELECT count(*)::text AS n FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgenabled <> 'O'
        AND t.tgrelid IN ('public.app_config'::regclass,'public.currency_status_log'::regclass,'public.admin_role'::regclass,
                          'public.admin_permission'::regclass,'public.admin_role_permission'::regclass,'public.admin_user_role'::regclass)`);
    add('N4', '本柱触发器全为 O（无残留 DISABLE/DROP）', bad?.n === '0', { non_enabled: bad?.n });

    await txn.rollback(db);
  } catch (e) {
    try { await txn.rollback(db); } catch { /* noop */ }
    add('ERR', '自证异常（已尝试回滚）', false, { message: String((e as Error)?.message || e).slice(0, 300) });
  } finally {
    c.release();
  }

  // ============================================================ ③ 主工作区文件未被碰 + 零残留
  const shaA2 = sha256File(MIGRATION_FILE);
  add('N5', '主工作区迁移文件 sha256 **前后相等**（未被自证碰）', shaA === shaA2, { before: shaA, after: shaA2, scratch_sha: shaB1 });

  const fr = await foreignRows(p);
  add('N6', '冲突行全属本单命名空间（foreign_rows_present=[]）', (fr as { all_empty: boolean }).all_empty === true, { foreign_rows: fr });
  const residue = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE actor_uid BETWEEN $1 AND $2`, [NS_UID_MIN, NS_UID_MAX]);
  add('N7', '回滚后 currency_status_log 无本单夹具行', residue?.n === '0', { residue: residue?.n });
  const cfg = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.app_config WHERE key LIKE 'cli:kong17-%'`);
  add('N8', '回滚后 app_config 无本单夹具行', cfg?.n === '0', { residue: cfg?.n });

  await p.end().catch(() => undefined);

  const failed = list.filter((x) => !x.pass);
  const artifact = save('falsify', {
    emulation: 'scratch 副本删触发器创建块（证明改动只在 scratch）+ 真库同一事务 DROP TRIGGER→用例变红→ROLLBACK 恢复',
    scratch_copies: [{ file: p1, sha256: shaB1 }, { file: p2, sha256: shaB2 }],
    pristine_sha256: { before: shaA, after: shaA2, equal: shaA === shaA2 },
    total: list.length, passed: list.length - failed.length, failed: failed.map((f) => f.id), checks: list,
  });
  console.log(JSON.stringify({ artifact, total: list.length, passed: list.length - failed.length, failed: failed.map((f) => f.id) }, null, 2));
  for (const x of list) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.name}`);
};

main().catch((e) => { console.error('p3p-03 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
