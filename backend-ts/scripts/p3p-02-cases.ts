/**
 * P3-P-02 · 行为用例（≥6）+ 守卫矩阵 + 边界 —— **全部在单一事务内并整体 ROLLBACK ⇒ 零库侧残留**。
 * 只 SELECT/INSERT/UPDATE/DELETE 于 0017 新建对象 + 自带夹具（uid 9907xx / 角色键 p3p:）。
 * 读法：npx ts-node --transpile-only scripts/p3p-02-cases.ts
 */
import { mkPool, raw, raw1, save, mkChecks, txn, ensureUser, isOurUid, isOurRole, foreignRows, sha256File, MIGRATION_FILE } from './p3p-lib';

// 口径（**不自创接口**）：单一真源可访问性判定 —— 数据层可验证查询
const CAN_ACCESS = `SELECT (u.is_admin OR EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid)) AS can_access_admin
                      FROM public.users u WHERE u.uid = $1::bigint`;

const main = async () => {
  const p = mkPool();
  const { add, list } = mkChecks();
  const c = await p.connect();
  const db = c as unknown as Parameters<typeof raw>[0];
  try {
    await txn.begin(db);

    // ---------------------------------------------------------------- 夹具
    const U1 = await ensureUser(db, 990701, 'admin-flag-only');   // is_admin=true, 无角色行
    const U2 = await ensureUser(db, 990702, 'role-only');         // is_admin=false, 有角色行
    const U3 = await ensureUser(db, 990703, 'neither');           // 皆无
    add('F0', '夹具 uid 全落本单窗口 9907xx', isOurUid(U1) && isOurUid(U2) && isOurUid(U3), { U1, U2, U3 });

    // is_admin 显式置位（users 表 DL72 总开关；本单不改结构，只改数据以构造用例）
    await raw(db, `UPDATE public.users SET is_admin = true  WHERE uid = $1::bigint`, [U1]);
    await raw(db, `UPDATE public.users SET is_admin = false WHERE uid IN ($1::bigint,$2::bigint)`, [U2, U3]);

    // 权限模型夹具：角色 + 权限 + 角色→权限 + 用户→角色（仅 U2）
    await raw(db, `INSERT INTO public.admin_role(role_key,name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, ['p3p:ops', 'ops role']);
    await raw(db, `INSERT INTO public.admin_permission(permission_key,name) VALUES ($1,$2) ON CONFLICT DO NOTHING`, ['p3p:read', 'read']);
    await raw(db, `INSERT INTO public.admin_role_permission(role_key,permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`, ['p3p:ops', 'p3p:read']);
    await raw(db, `INSERT INTO public.admin_user_role(uid,role_key) VALUES ($1::bigint,$2) ON CONFLICT DO NOTHING`, [U2, 'p3p:ops']);
    const roleRow = await raw1<{ role_key: string }>(db, `SELECT role_key FROM public.admin_role WHERE role_key=$1`, ['p3p:ops']);
    add('F1', '角色键落本单命名空间 p3p:', !!roleRow && isOurRole(roleRow.role_key), { role_key: roleRow?.role_key });

    // ============================================================ 用例 1：权限单一真源（3 态）
    const c1 = await raw1<{ can_access_admin: boolean }>(db, CAN_ACCESS, [U1]); // is_admin=true, 无角色行
    const c2 = await raw1<{ can_access_admin: boolean }>(db, CAN_ACCESS, [U2]); // is_admin=false, 有角色行
    const c3 = await raw1<{ can_access_admin: boolean }>(db, CAN_ACCESS, [U3]); // 皆无
    add('C1', '权限单一真源 is_admin=true 且无角色行 ⇒ 可进', c1?.can_access_admin === true, { uid: U1, readout: c1 });
    add('C2', '权限单一真源 is_admin=false 但有角色行 ⇒ 可进', c2?.can_access_admin === true, { uid: U2, readout: c2 });
    add('C3', '权限单一真源 两者皆无 ⇒ 不可进', c3?.can_access_admin === false, { uid: U3, readout: c3 });

    // ============================================================ 用例 2：currency_status_log append-only
    const ins = await txn.try(db,
      `INSERT INTO public.currency_status_log(cid,from_status,to_status,actor_uid,memo) VALUES (1,$1,$2,$3::bigint,$4) RETURNING log_id::text AS log_id`,
      ['listed', 'frozen', U3, 'p3p case insert']);
    const logId = (await raw1<{ log_id: string }>(db, `SELECT max(log_id)::text AS log_id FROM public.currency_status_log`))?.log_id ?? null;
    add('C4', 'currency_status_log 合法 INSERT 必成功（对照项，尺子不滥杀）', ins.rejected === false && ins.rowCount === 1, { insert: ins, log_id: logId });

    const upd = await txn.try(db, `UPDATE public.currency_status_log SET to_status='active' WHERE log_id=$1::bigint`, [logId]);
    add('C5', 'currency_status_log UPDATE 必拒（append-only）', upd.rejected === true, { err: upd.err });
    const del = await txn.try(db, `DELETE FROM public.currency_status_log WHERE log_id=$1::bigint`, [logId]);
    add('C6', 'currency_status_log DELETE 必拒（append-only / DL79 同向）', del.rejected === true, { err: del.err });

    // ============================================================ 用例 3：app_config 键/值
    const okIns = await txn.try(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ($1,$2::jsonb,$3::bigint)`, ['cli:kong17-demo', '{"a":1}', U3]);
    add('C7', 'app_config 合法 object 值 INSERT 成功', okIns.rejected === false && okIns.rowCount === 1, { insert: okIns });
    const dup = await txn.try(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ($1,$2::jsonb,$3::bigint)`, ['cli:kong17-demo', '{"a":2}', U3]);
    add('C8', 'app_config key 重复 ⇒ 23505', dup.rejected === true && dup.err?.sqlstate === '23505', { err: dup.err });
    const nonjson = await txn.try(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ($1,'not json'::jsonb,$2::bigint)`, ['cli:kong17-nonjson', U3]);
    add('C9', 'app_config value 非 jsonb ⇒ 拒（22P02）', nonjson.rejected === true, { err: nonjson.err });
    const nullVal = await txn.try(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ($1,NULL,$2::bigint)`, ['cli:kong17-null', U3]);
    add('C10', 'app_config value NULL ⇒ 拒（NOT NULL）', nullVal.rejected === true, { err: nullVal.err });
    const scalar = await txn.try(db, `INSERT INTO public.app_config(key,value,updated_by) VALUES ($1,'128'::jsonb,$2::bigint)`, ['cli:kong17-balance', U3]);
    add('C11', 'app_config 裸标量余额值 ⇒ 拒（DL3 禁存余额 CHECK）', scalar.rejected === true && scalar.err?.sqlstate === '23514', { err: scalar.err });

    // ============================================================ 用例 4：守卫矩阵（不可变列 / DELETE）
    const keyChg = await txn.try(db, `UPDATE public.app_config SET key='cli:kong17-renamed' WHERE key=$1`, ['cli:kong17-demo']);
    add('C12', 'app_config PK key 不可改', keyChg.rejected === true, { err: keyChg.err });
    const touch = await raw1<{ same: boolean }>(db, `SELECT (time_updated = (SELECT time_updated FROM public.app_config WHERE key='cli:kong17-demo')) AS same FROM public.app_config WHERE key='cli:kong17-demo'`);
    const valUpd = await txn.try(db, `UPDATE public.app_config SET value='{"a":9}'::jsonb WHERE key=$1`, ['cli:kong17-demo']);
    add('C13', 'app_config 非键列可改（value 更新成功）', valUpd.rejected === false && valUpd.rowCount === 1, { update: valUpd });
    const roleChg = await txn.try(db, `UPDATE public.admin_role SET role_key='p3p:renamed' WHERE role_key='p3p:ops'`);
    add('C14', 'admin_role PK role_key 不可改', roleChg.rejected === true, { err: roleChg.err });
    const permChg = await txn.try(db, `UPDATE public.admin_permission SET permission_key='p3p:renamed' WHERE permission_key='p3p:read'`);
    add('C15', 'admin_permission PK permission_key 不可改', permChg.rejected === true, { err: permChg.err });
    const rpChg = await txn.try(db, `UPDATE public.admin_role_permission SET role_key='p3p:ghost' WHERE role_key='p3p:ops'`);
    add('C16', 'admin_role_permission PK 对不可改', rpChg.rejected === true, { err: rpChg.err });
    const urChg = await txn.try(db, `UPDATE public.admin_user_role SET role_key='p3p:ghost' WHERE uid=$1::bigint`, [U2]);
    add('C17', 'admin_user_role PK 对不可改', urChg.rejected === true, { err: urChg.err });
    const urDel = await txn.try(db, `DELETE FROM public.admin_user_role WHERE uid=$1::bigint`, [U2]);
    add('C18', 'admin_user_role DELETE 允许（撤销角色分配是合法操作）', urDel.rejected === false && urDel.rowCount === 1, { del: urDel });
    // 复原 U2 的角色行（供后续用例/回滚前一致）
    await raw(db, `INSERT INTO public.admin_user_role(uid,role_key) VALUES ($1::bigint,'p3p:ops') ON CONFLICT DO NOTHING`, [U2]);

    // ============================================================ 用例 5：边界（逐条原始读数）
    const fkGhost = await txn.try(db, `INSERT INTO public.currency_status_log(cid,from_status,to_status,actor_uid) VALUES (999999,'listed','frozen',$1::bigint)`, [U3]);
    add('C19', '边界·cid 不存在 ⇒ 23503（FK currency）', fkGhost.rejected === true && fkGhost.err?.sqlstate === '23503', { err: fkGhost.err });
    const fkRoleGhost = await txn.try(db, `INSERT INTO public.admin_role_permission(role_key,permission_key) VALUES ('p3p:nope','p3p:read')`);
    add('C20', '边界·admin_role_permission 指向不存在角色 ⇒ 23503', fkRoleGhost.rejected === true && fkRoleGhost.err?.sqlstate === '23503', { err: fkRoleGhost.err });
    const fkUserGhost = await txn.try(db, `INSERT INTO public.admin_user_role(uid,role_key) VALUES (999999,'p3p:ops')`);
    add('C21', '边界·admin_user_role.uid 不存在 ⇒ 23503（FK users）', fkUserGhost.rejected === true && fkUserGhost.err?.sqlstate === '23503', { err: fkUserGhost.err });
    const dupRole = await txn.try(db, `INSERT INTO public.admin_role(role_key,name) VALUES ('p3p:ops','dup')`);
    add('C22', '边界·admin_role 重复 PK ⇒ 23505', dupRole.rejected === true && dupRole.err?.sqlstate === '23505', { err: dupRole.err });
    const dupPair = await txn.try(db, `INSERT INTO public.admin_role_permission(role_key,permission_key) VALUES ('p3p:ops','p3p:read')`);
    add('C23', '边界·admin_role_permission 重复 PK 对 ⇒ 23505', dupPair.rejected === true && dupPair.err?.sqlstate === '23505', { err: dupPair.err });
    const emptyName = await txn.try(db, `INSERT INTO public.admin_role(role_key,name) VALUES ('p3p:empty','')`);
    add('C24', '边界·空 name（""）—— 逐列照 spec（name 可空）⇒ 允许（登记为数据质量项）', emptyName.rejected === false, { insert: emptyName });

    await txn.rollback(db);

    // ---------------------------------------------------------------- 收尾读数（回滚后：零残留）
    const fr = await foreignRows(p);
    add('Z1', '回滚后零本单残留（foreign_rows 全空）', (fr as { all_empty: boolean }).all_empty === true, { foreign_rows: fr });
    const residue = await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE actor_uid BETWEEN 990700 AND 990799`);
    add('Z2', '回滚后 currency_status_log 无本单夹具行', residue?.n === '0', { residue: residue?.n });

    add('S0', '迁移文件 sha256（现取）', true, { sha256: sha256File(MIGRATION_FILE) });

  } catch (e) {
    try { await txn.rollback(db); } catch { /* noop */ }
    add('ERR', '探针异常（已尝试回滚）', false, { message: String((e as Error)?.message || e).slice(0, 300) });
  } finally {
    c.release();
    const failed = list.filter((x) => !x.pass);
    const artifact = save('cases', {
      total: list.length, passed: list.length - failed.length, failed: failed.map((f) => f.id),
      checks: list,
    });
    console.log(JSON.stringify({ artifact, total: list.length, passed: list.length - failed.length, failed: failed.map((f) => f.id) }, null, 2));
    for (const x of list) console.log(`${x.pass ? 'PASS' : 'FAIL'} ${x.id} ${x.name}`);
    await p.end().catch(() => undefined);
  }
};

main().catch((e) => { console.error('p3p-02 fatal:', String((e as Error)?.message || e).slice(0, 400)); process.exit(2); });
