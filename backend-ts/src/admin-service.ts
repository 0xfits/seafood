// ============================================================================
// src/admin-service.ts — P4-B2c · 权限与设置（**非资金面**）内部 service 层
// ============================================================================
// 依据（唯一权威）：docs/route-layer.spec.md v0.1
//   §1 #31（admin/me）· #32/#33（settings 读/写）· #34（settings/reset→410）· #35/#36/#37（permissions*）
//   · #38（user/update）· #45（user/all）· #46（user/stats）
//   §3.1（detail-miss 404）· §3.2（逐码适用条件）· §3.3（R107 收尾规则）· §3.3-6（AUTH_* 独立域）
//   §4.1 #39（自锁守卫） / #40（角色无在用用户才可删）· §5.1（撤销 permissions 的 deprecated）· §6.1/§6.2
// 依据（数据层）：docs/data-layer.spec.md v0.6
//   DL16（evm 不可改）· DL36（后台写一律带 ops: 键；无键 ⇒ 400）· DL38（换数据源）· DL71（app_config 4 列）
//   · DL72（admin_role* 四表 + 单一真源）· DL104（user/update 入参白名单）· DL105（requireAdmin 语义）
//   · DL122/DL147（AUTH_* 两码 + 3 个 reason）· §11.2:581-584（逐端点 ops: 键形状）
//
// 硬边界（本文件自证）：
//   · **不 import** ./ledger、./commission ⇒ 无任何编排函数调用、无任何 ledger_entry/account/currency 写。
//   · 只走已存在表：public.app_config / public.admin_role / public.admin_role_permission /
//     public.admin_user_role / public."users"（0017 / 0002 既有 DDL）。
//   · **不写任何 admin 种子**（DL72 表 = 0 行是预期；本模块只在端点被调用时按入参落行）。
// ============================================================================
import { DatabaseService } from './database';
import type { JobVerbErr, JobVerbResult } from './job-service';

// ---- 错误构造（复用 job-service 的 JobVerbErr 形状；由 index.ts 用 sendVerbError 出口）---------
export const adminVerbError = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  message?: string,
): JobVerbErr => ({
  ok: false,
  status,
  code,
  message: message || code,
  details,
  authDomain: code.startsWith('AUTH_'),
});

// ---- §4.5 / DL36：后台写的幂等键（前缀只允许 `ops:`；禁 `#` 与控制字符）----------------------
const ADMIN_KEY_PREFIX = 'ops:';
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** DL36 的规范键形状（§11.2:581-584）：`ops:<admin_uid>:<action>:<business_id>` */
export const canonicalAdminOpsKey = (actorUid: number, action: string, businessId: string | number) =>
  `${ADMIN_KEY_PREFIX}${actorUid}:${action}:${businessId}`;

/**
 * 解析后台写请求的 `ops:` 幂等键（来源优先级：body.create_key → body.idempotency_key → `Idempotency-Key` 头）。
 * DL36 逐字：「无键的后台写请求 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`」。
 * 口径自曝：`0017` 的四张表**无幂等键列**（逐列契约冻结）⇒ 本键**只做强校验、不落库**（报告 §1.3-2）。
 */
export const resolveAdminOpsKey = (
  req: { body?: Record<string, unknown> | null; headers?: Record<string, unknown> },
  actorUid: number,
  action: string,
  businessId: string | number,
): { ok: true; key: string } | { ok: false; error: JobVerbErr } => {
  const body = (req.body || {}) as Record<string, unknown>;
  const headerKey = req.headers ? (req.headers['idempotency-key'] ?? req.headers['Idempotency-Key']) : undefined;
  const raw = body.create_key ?? body.idempotency_key ?? headerKey;
  const provided = raw === undefined || raw === null ? '' : String(raw).trim();
  const expected = canonicalAdminOpsKey(actorUid, action, businessId);

  if (!provided) {
    return {
      ok: false,
      error: adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', {
        field: 'create_key',
        expected_prefix: ADMIN_KEY_PREFIX,
        canonical_key: expected,
      }, 'Idempotency key is required for admin writes'),
    };
  }
  if (provided.length > 200) {
    return { ok: false, error: adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'TOO_LONG' }) };
  }
  if (!provided.startsWith(ADMIN_KEY_PREFIX)) {
    return { ok: false, error: adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: [ADMIN_KEY_PREFIX] }) };
  }
  if (provided.includes('#')) {
    return { ok: false, error: adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'RESERVED_SEPARATOR' }) };
  }
  if (CONTROL_CHARS.test(provided)) {
    return { ok: false, error: adminVerbError(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'CONTROL_CHARACTER' }) };
  }
  return { ok: true, key: provided };
};

// ---- §1 #33 / §4.1 #36：禁写费率键（费率真源 = commission_policy.fee_rate_bp，CR23/CR25）------
const FEE_RATE_KEY_PATTERNS: RegExp[] = [
  /fee_?rate/i,
  /rate_?bp/i,
  /commission_?rate/i,
  /commission_?policy/i,
  /费率/,
  /佣金/,
];

/** 返回首个「费率类」键名（无 ⇒ null）。**不**删键、**不**改写：命中即整请求拒。 */
export const findFeeRateKey = (body: Record<string, unknown> | null | undefined): string | null => {
  for (const key of Object.keys(body || {})) {
    if (FEE_RATE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      return key;
    }
  }
  return null;
};

// ---- 小工具 ---------------------------------------------------------------------------------
const uniqueTrimmed = (values: unknown[]): string[] =>
  Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));

const uniqueTargetUids = (values: unknown[]): number[] =>
  Array.from(new Set(
    values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).map((value) => Math.trunc(value)),
  ));

const slugifyRoleKey = (value: string): string =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- §1 #36 · POST /api/admin/permissions/save（自锁守卫 + admin_permission 前置闸）-----------
export const adminPermissionSaveVerb = async (params: {
  actorUid: number;
  actorIsAdmin: boolean;
  id?: unknown;
  name?: unknown;
  description?: unknown;
  permissions?: unknown;
  user_ids?: unknown;
}): Promise<JobVerbResult> => {
  const name = String(params.name ?? '').trim();
  if (!name) {
    return adminVerbError(400, 'LEDGER_AMOUNT_INVALID', { field: 'name', reason: 'REQUIRED' }, 'Permission group name is required');
  }

  const permissions = uniqueTrimmed(Array.isArray(params.permissions) ? params.permissions : []);
  if (permissions.length === 0) {
    return adminVerbError(400, 'LEDGER_AMOUNT_INVALID', { field: 'permissions', reason: 'AT_LEAST_ONE_REQUIRED' }, 'At least one valid permission is required');
  }

  const userIDs = uniqueTargetUids(Array.isArray(params.user_ids) ? params.user_ids : []);
  const roleKey = String(params.id ?? '').trim() || slugifyRoleKey(name) || `role-${Date.now()}`;

  // §4.1 #39 自锁守卫：**禁止**把自己降权到无 manage_permissions（`is_admin` 总开关不受影响）
  if (!params.actorIsAdmin && userIDs.includes(params.actorUid) && !permissions.includes('manage_permissions')) {
    return adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
      field: 'admin_role_permission',
      reason: 'PERMISSION_SELF_LOCKOUT',
      role_key: roleKey,
      actor_uid: String(params.actorUid),
      missing_permission: 'manage_permissions',
    }, 'Refusing to remove manage_permissions from your own role');
  }

  // §1.3-5：`admin_role_permission.permission_key` **FK → `admin_permission`**；0 行表必须先判，
  // 否则裸 `23503` 会漏出未映射 SQLSTATE（§3.3-4）。miss ⇒ 404 LEDGER_REF_NOT_FOUND（§3.1 业务对象不存在）。
  const missing = await DatabaseService.findMissingPermissions(permissions);
  if (missing.length > 0) {
    return adminVerbError(404, 'LEDGER_REF_NOT_FOUND', {
      ref_type: 'admin_permission',
      ref_id: missing.join(','),
      missing_permission_keys: missing,
    }, 'Referenced permission not found');
  }

  const group = await DatabaseService.savePermissionGroup({
    id: roleKey,
    name,
    description: String(params.description ?? ''),
    permissions,
    user_ids: userIDs,
  });

  return { ok: true, replay: false, view: group as unknown as Record<string, unknown> };
};

// ---- §1 #37 · POST /api/admin/permissions/delete（该角色下无在用用户才可删）------------------
export const adminPermissionDeleteVerb = async (params: { id?: unknown }): Promise<JobVerbResult> => {
  const id = String(params.id ?? '').trim();
  if (!id) {
    return adminVerbError(400, 'LEDGER_AMOUNT_INVALID', { field: 'id', reason: 'REQUIRED' }, 'Permission group id is required');
  }

  const outcome = await DatabaseService.deletePermissionGroup(id);
  if (outcome === 'not_found') {
    return adminVerbError(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'admin_role', ref_id: id }, 'Permission group not found');
  }
  if (outcome === 'in_use') {
    // §4.1 #40：该角色下在用用户 ⇒ 拒（否则静默失权）
    return adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
      field: 'admin_user_role',
      reason: 'ROLE_IN_USE',
      role_key: id,
    }, 'Permission group is assigned to users');
  }
  return { ok: true, replay: false, view: { id } };
};

// ---- §1 #38 · POST /api/admin/user/update（入参白名单 · DL16 / DL104）-----------------------
/** DL104 白名单外的**禁字段**：身份凭据 + 一切余额/积分类（DL5/DL12/DL16） */
const FORBIDDEN_USER_UPDATE_FIELDS = [
  'evm', 'uid',
  'points', 'balance', 'frozen', 'asset', 'lucks', 'lucky',
  'amount', 'supply', 'total_points', 'totalPoints',
];

const normalizeRoleKeys = (raw: unknown): string[] => {
  const items = Array.isArray(raw) ? raw : (raw === null || raw === undefined ? [] : [raw]);
  return Array.from(new Set(items.map((value) => String(value ?? '').trim()).filter(Boolean)));
};

export const adminUserUpdateVerb = async (params: {
  body: Record<string, unknown> | null | undefined;
}): Promise<JobVerbResult> => {
  const body = (params.body || {}) as Record<string, unknown>;

  // DL104：白名单 = `target_uid` / `is_admin` / `role_key` / `bio`（`uID` 为旧前端别名，见报告 §1.3）
  const banned = FORBIDDEN_USER_UPDATE_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (banned.length > 0) {
    return adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
      field: banned[0],
      forbidden_fields: banned,
      reason: 'FORBIDDEN_FIELD',
      rule: 'DL16/DL104',
    }, 'Field is not accepted by this endpoint');
  }

  const targetUid = Math.trunc(Number(body.target_uid ?? body.uID));
  if (!Number.isFinite(targetUid) || !targetUid) {
    return adminVerbError(400, 'LEDGER_AMOUNT_INVALID', { field: 'target_uid', reason: 'REQUIRED' }, 'Invalid target uid');
  }

  const hasRoleInput = Object.prototype.hasOwnProperty.call(body, 'role_key');
  const roleKeys = hasRoleInput ? normalizeRoleKeys(body.role_key) : null;
  if (roleKeys) {
    for (const roleKey of roleKeys) {
      if (!(await DatabaseService.roleExists(roleKey))) {
        return adminVerbError(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'admin_role', ref_id: roleKey }, 'Referenced role not found');
      }
    }
  }

  let user = await DatabaseService.getUserById(targetUid);
  if (!user) {
    return adminVerbError(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'users', ref_id: String(targetUid) }, 'User not found');
  }

  const patch: { bio?: string; is_admin?: boolean } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'bio')) {
    patch.bio = String(body.bio ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'is_admin')) {
    const raw = body.is_admin;
    patch.is_admin = raw === true || raw === 1 || String(raw).trim().toLowerCase() === 'true' || String(raw).trim() === '1';
  }
  if (Object.keys(patch).length > 0) {
    const updated = await DatabaseService.updateUserProfile(targetUid, patch);
    if (!updated) {
      return adminVerbError(404, 'LEDGER_REF_NOT_FOUND', { ref_type: 'users', ref_id: String(targetUid) }, 'User not found');
    }
    user = updated;
  }

  if (roleKeys) {
    await DatabaseService.replaceUserRoles(targetUid, roleKeys);
  }

  // 响应键集冻结（§2 母约束 F1）：仍为 `UserRecord` 的 6 键 —— **不**追加 roles 键。
  return { ok: true, replay: false, view: user as unknown as Record<string, unknown> };
};
