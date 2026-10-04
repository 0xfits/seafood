// P4-SEC（缺陷 A）：**必须第一行** —— 在任何模块（尤其下面的 `./auth`）读到 process.env 之前
// 把 <repo>/.env.local、<repo>/.env 注入。修前 `./auth`（第 4 行 import）被求值**早于**
// `./database` 顶部的 dotenv ⇒ `SECRET_KEY` 恒 undefined ⇒ 落到硬编码兜底常量。
import './env';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// P4-A1-LEDGER-IMPL（Zang §5.99 / DL96）：路由层计算 `request_fingerprint`（business 字段集合）
import { createHash } from 'crypto';
import {
  consumeWalletAuthChallenge,
  createSessionToken,
  startWalletAuthChallenge,
  verifySessionToken,
} from './auth';
import {
  AdminAccessRecord,
  DatabaseService,
  SystemSettingsWriteError,
  TaskProgressRecord,
  UserRecord,
  isAppConfigEnvelope,
  screenAppConfigEnvelope,
  screenSystemSettingsWrite,
  validateAppConfigKey,
  validateAppConfigValue,
  SYSTEM_SETTINGS_KEY,
} from './database';
import { healthCheck } from './db';
// P4-SEC（缺陷 B）：基础设施异常走**既有** §14 分类器与 R107 错误体（不新增错误码）
import { ledgerErrorDiagnostics, normalizeLedgerError, toErrorResponse } from './ledger-errors';
// P7-A：账本流水读口的 `kind` 过滤取值 = **冻结关闭集**（`ledger.spec` §5.1/R40，20 个；不复制/不自造）
import { LEDGER_KINDS } from './ledger';
// ★ S3（`R-9-103`）：J2/J3（报名 `/apply`、选定 `/accept`）路由已**下架**（`410 Gone`）⇒ 不再导入
//   `applyToJob`/`acceptApplication`（服务层 verb 保留不删，仅不再被本层调用）；J4 `submitWork` 仍由本层接线。
import { ledgerErrorBody, sendGone, sendVerbError, submitWork } from './job-service';
// P4-B3c：招工**资金**编排（J1 托管 / J5 发放 / J6 退款 ⇒ `job_post_event`）
// P4-B4a：J1 `publishJob`（§1.8 #1）/ J5 `settleJob` / J6 `refundJob` 由本片注册（`verifyJobSubmission` 沿用）
import { publishJob, refundJob, settleJob, verifyJobSubmission } from './job-funds-service';
// P4-B4a：商品面（P1 上架/编辑/下架）—— §1.8 #7/#8；**本片首次导入整个模块**（v0.8 §1.8 现取 `grep` = 0）
import { createListing, transitionListingStatus, updateListing } from './listing-service';
// P4-B4a：商品**资金**面（P2 购买 / P4 退款）—— §1.8 #9/#10；同样**本片首次导入**（`listing-funds-service` 调用点改前 = 0）
import { buyListing, refundListingOrder } from './listing-funds-service';
// P4-B4a：R3 佣金政策插行（§1.8 附注 / §9 A11）；**只读引用**该模块，不改其行为、不改金额来源（§4.8）
// 8②：同模块的读口 `getCommissionPolicy` 供新增 admin 读口复用（**不得自写第二套取数**，§19.2(c)）
import { getCommissionPolicy, insertCommissionPolicy } from './commission';
// P4-B3e（§4.2 M1/M2/M3 · §4.3 资金四栏 · DL85/DL87/DL90 + DL68 币对串行化）：交易所资金编排
import { placeMarketOrder, cancelMarketOrder, cancelAllMarketOrders } from './market-service';
// P4-B3a：币种面**真资金**编排（§1.1:147-148 · §4.2 C1/C2 · §7-3 已裁）
import { createCurrencyVerb, listCurrencyVerb } from './currency-service';
// P4-B2c：权限与设置（非资金面）service（§1 #36/#37/#38 的 verb + DL36 的 ops: 幂等键）
import {
  adminPermissionDeleteVerb,
  adminPermissionSaveVerb,
  adminUserUpdateVerb,
  adminVerbError,
  findFeeRateKey,
  resolveAdminOpsKey,
} from './admin-service';
// 批 8④（`route-layer.spec` v2.8 §23 / `data-layer.spec` v0.15 §26）：自建单位审核（变体 Ⅱ 旁路台账）
//   · 读口 `GET /api/admin/currency`（闸 `review_tasks`；注册点 69 → 70）
//   · 动作口 `POST /api/admin/currency/:cid/review`（闸 `review_tasks`；注册点 → 71）
import {
  CURRENCY_REVIEW_OPS_ACTION,
  parseStatusFilter,
  reviewCurrency404,
  reviewCurrencyVerb,
} from './currency-review-service';
// 批 8⑤（`route-layer.spec` v2.10 §25 / `data-layer.spec` v0.17 §28）：合规审核（商品 / 招工仲裁）
//   · 读口 `GET /api/admin/listing` + 动作口 `POST /api/admin/listing/:listingId/takedown`（§25.2 · 闸 `review_tasks`）
//   · 读口 `GET /api/admin/arbitration` + 动作口 `POST /api/admin/arbitration/:jobId`（§25.2 · 闸 `review_tasks`）
import {
  JOB_ARBITRATE_OPS_ACTION,
  LISTING_TAKEDOWN_OPS_ACTION,
  arbitrateJobVerb,
  job404,
  listing404,
  parseJobStatusFilter,
  parseListingStatusFilter,
  reviewListingTakedownVerb,
} from './compliance-review-service';
// P6-TR-1b：后台翻译回填（cron 兜底 + 手动触发）—— 路由层只做鉴权与机读回执，编排全在服务层
import { backfillPending, registerPendingTranslations, scanRegisterPending, scheduleEntityTranslation } from './translate-service';
// 8⑥（`route-layer.spec` v2.21 §32.14 · `R-9-74`/`R-9-77`/`R-9-78`/`R-9-79`）：审计台统一读口
//   `GET /api/admin/audit/:table`（注册点 87 → 88）；14 面白名单 + 五类过滤逐表映射 + keyset 分页。
import { buildAuditSql, buildAuditView, parseAuditRequest } from './audit-console';
// 8⑥ C3③（`R-9-76`）：`points/adjust` 的原因码关闭集（语义域 · 非错误码 ⇒ 账本闭集 33 不动）。
import { POINTS_ADJUST_REASONS, isPointsAdjustReason } from './points-adjust-reasons';

const app = express();
const PORT = Number(process.env.PORT || 5788);

app.use(helmet());
app.use(cors());
app.use(express.json());

/**
 * P6-TR-1c-A：写路径翻译挂载 —— **前台**确保 pending 行存在（读侧 `i18n_status` 立即有据可依），
 * **后台**（`waitUntil` / fire-and-forget）调 `translateFields`。
 * 红线：**任何 pending 登记 / 翻译失败都绝不影响写响应的状态码与语义**（两步各自兜底）。
 */
const enqueueTranslation = async (target: {
  entityType: string;
  entityId: string;
  fields: Record<string, string>;
  reset?: boolean;
}): Promise<void> => {
  try {
    await registerPendingTranslations(target, { reset: target.reset === true });
  } catch (e) {
    console.warn('[translate] pending registration skipped:', (e as Error)?.name || 'ERROR');
  }
  try {
    scheduleEntityTranslation(target); // waitUntil / fire-and-forget；同步不可抛
  } catch (e) {
    console.warn('[translate] schedule skipped:', (e as Error)?.name || 'ERROR');
  }
};

/** 从 listing 写回执（`view`）提取可译字段（field 名 = 源列名，与 createDbSourceResolver 白名单一致）。 */
const enqueueListingTranslation = async (view: unknown, reset = false): Promise<void> => {
  const v = (view || {}) as Record<string, unknown>;
  const entityId = v.listing_id === undefined || v.listing_id === null ? '' : String(v.listing_id);
  const fields: Record<string, string> = {};
  const title = typeof v.title === 'string' ? v.title : '';
  const description = typeof v.description === 'string' ? v.description : '';
  if (title.trim()) fields.title = title;
  if (description.trim()) fields.description = description;
  if (entityId && Object.keys(fields).length) {
    await enqueueTranslation({ entityType: 'listing', entityId, fields, reset });
  }
};

const sendSuccess = (res: Response, data?: unknown, message = 'OK', statusCode = 200, extra?: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {
    success: true,
    message,
  };

  if (data !== undefined) {
    payload.data = data;
  }

  // P4-B1-c: 可选附加顶层键（如 deprecated: true），不改变 data 形状。
  if (extra) {
    Object.assign(payload, extra);
  }

  return res.status(statusCode).json(payload);
};

const sendError = (res: Response, statusCode: number, message: string) => res.status(statusCode).json({
  success: false,
  message,
  error: message,
});

const setPublicCache = (res: Response, maxAgeSeconds = 30, staleWhileRevalidateSeconds = 300) => {
  res.setHeader('Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`);
};

const setPrivateNoStore = (res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
};

const parseInteger = (value: unknown, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? Math.trunc(next) : fallback;
};

const parseBoolean = (value: unknown, fallback = false) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const getPagination = (req: Request) => ({
  skip: Math.max(0, parseInteger(req.query.skip, 0)),
  limit: Math.max(1, parseInteger(req.query.limit, 100)),
});

type ActorContext = {
  session: {
    uID: number;
    evm: string;
  };
  user: UserRecord;
  adminAccess: AdminAccessRecord;
};

// P4-SEC（缺陷 B）：`resolveActor` 的失败**必须分类**——修前一切异常同形吞成 401
// （实测：Neon `ConnectTimeoutError` 抖动 ⇒ **合法** token 也 401），调用方无法区别
// 「你没带对凭据（401，重试无用）」与「后端暂时不可用（503，可重试）」。
type ActorFailure =
  /** 无 token / 签名错 / 格式错 / 过期 / 用户不存在 ⇒ 401 AUTH_UNAUTHORIZED */
  | { kind: 'unauthorized' }
  /** DB / 网络 / 驱动等基础设施异常 ⇒ 交 §14 分类器（本条实测落 503） */
  | { kind: 'infra'; error: unknown };

const isActorFailure = (value: ActorContext | ActorFailure): value is ActorFailure => 'kind' in value;

/**
 * P4-SEC：把「包装过的传输层失败」下沉到它的**真因**，再交给既有分类器。
 * 为什么需要：Neon 驱动抛的是 `NeonDbError('Error connecting to database: fetch failed')`，
 * 真因挂在 `sourceError`（实测：`node_modules/@neondatabase/serverless/index.js` 里
 * `throw $.sourceError = oe, $`），再下一层 `cause` 才是带 `code: 'ECONNREFUSED'` 的那个。
 * 冻结分类器只看单层对象 ⇒ 顶层会落到 `unclassified_non_pg_error`（500 类），
 * 而语义明明是「后端暂时不可用」（503，可重试）。
 * 边界：一旦某层**已有码**（PG SQLSTATE / 驱动码 / `LEDGER_*`）就**立刻采信并停止下沉** ——
 * 那是 DB 的正式答复，例如 `08P01`（我方连接配置缺陷）必须留在 500 类供 R108 告警。
 * 不新增错误码、不改分类器判据（`ledger-errors.ts` 冻结）；只是把真因喂给它。
 */
const codeOf = (value: unknown): string => {
  const raw = (value as { code?: unknown } | null | undefined)?.code;
  return typeof raw === 'string' ? raw : '';
};

const unwrapInfraCause = (error: unknown, depth = 0): unknown => {
  if (codeOf(error)) return error;
  if (depth >= 3 || error === null || typeof error !== 'object') return error;

  for (const key of ['cause', 'sourceError', 'error'] as const) {
    const child = (error as Record<string, unknown>)[key];
    if (child === null || typeof child !== 'object') continue;
    const resolved = unwrapInfraCause(child, depth + 1);
    if (codeOf(resolved)) return resolved; // 只采信「真有码」的后代；否则继续找/回退本体
  }

  return error;
};

const resolveActor = async (req: Request): Promise<ActorContext | ActorFailure> => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { kind: 'unauthorized' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { kind: 'unauthorized' };
  }

  // ① 凭据校验（格式 / HMAC 签名 / exp）：**纯计算、无 IO** ⇒ 失败只能是 401，绝不可能落 503。
  let session: { uID: number; evm: string };
  try {
    session = verifySessionToken(token);
  } catch (error) {
    console.warn('Failed to verify session token:', error instanceof Error ? error.message : error);
    return { kind: 'unauthorized' };
  }

  // ② 凭据有效但查无此人 ⇒ 401（鉴权语义：该 uID 无对应主体）。
  // ③ 查询本身抛错（DB / 网络 / 驱动）⇒ infra，**不得**当鉴权失败 ⇒ 交上层分类成 503。
  try {
    const user =
      await DatabaseService.getUserById(session.uID) ||
      await DatabaseService.getUserByEvm(session.evm);

    if (!user) {
      return { kind: 'unauthorized' };
    }

    const adminAccess = await DatabaseService.resolveAdminAccess(user);
    return {
      session,
      user,
      adminAccess,
    };
  } catch (error) {
    return { kind: 'infra', error };
  }
};

// P4-B2c（§3.3-1 / §3.3-6 / §6.2 / DL105 v0.2 / DL122 / DL147）：401/403 一律 R107 形状，
// 码域 = AUTH_*（**不**进 LEDGER_* 33 码关闭集；i18n_key 域 = auth.err.*）。
// DL147③：reason 只准取 §11.3.2 登记值（ACTOR_NOT_ALLOWED / NOT_ADMIN / PERMISSION_NOT_GRANTED）。
const AUTH_REASONS = ['ACTOR_NOT_ALLOWED', 'NOT_ADMIN', 'PERMISSION_NOT_GRANTED'] as const;

const sendAuthError = (res: Response, statusCode: 401 | 403, reason?: string) => {
  const code = statusCode === 401 ? 'AUTH_UNAUTHORIZED' : 'AUTH_FORBIDDEN';
  const details: Record<string, unknown> = {};
  if (reason && (AUTH_REASONS as readonly string[]).includes(reason)) {
    details.reason = reason;
  }
  return res.status(statusCode).json(ledgerErrorBody(code, code, details, 'auth'));
};

const requireActor = async (req: Request, res: Response): Promise<ActorContext | null> => {
  const resolved = await resolveActor(req);

  if (!isActorFailure(resolved)) {
    return resolved;
  }

  // ① 凭据面失败（无 token / 签名错 / 用户不存在）⇒ 401 AUTH_UNAUTHORIZED（R107 形状，既有）
  if (resolved.kind === 'unauthorized') {
    sendAuthError(res, 401);
    return null;
  }

  // ② 基础设施异常 ⇒ 503（走**既有** §14 分类器；基础设施类 SQLSTATE / 驱动连接类 /
  //    连接池耗尽均已被它归到 LEDGER_TX_TIMEOUT ⇒ 503「暂时不可用、可重试」）。
  //    原始 message / stack **只准进服务端日志**（R108 诊断面），对外只给 §14 码 + 非敏感 details（R107）。
  const normalized = normalizeLedgerError(unwrapInfraCause(resolved.error));
  console.error(
    '[auth.infra] resolveActor failed on an infrastructure error (NOT an auth failure):',
    JSON.stringify(ledgerErrorDiagnostics(resolved.error)),
  );
  res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  return null;
};

const hasRequiredPermission = (actor: ActorContext, requiredPermission?: string | string[]) => {
  if (!requiredPermission) {
    return true;
  }

  const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  return required.some((permission) => actor.adminAccess.permissions.includes(permission));
};

const requireAdmin = async (req: Request, res: Response, requiredPermission?: string | string[]) => {
  const actor = await requireActor(req, res);
  if (!actor) {
    return null;
  }

  if (!actor.adminAccess.can_access_admin) {
    // §6.2 步 2 / DL105② / DL147③：reason=NOT_ADMIN
    sendAuthError(res, 403, 'NOT_ADMIN');
    return null;
  }

  if (!actor.adminAccess.is_admin && !hasRequiredPermission(actor, requiredPermission)) {
    // §6.2 步 4 / DL105④ / DL147③：reason=PERMISSION_NOT_GRANTED
    sendAuthError(res, 403, 'PERMISSION_NOT_GRANTED');
    return null;
  }

  return actor;
};

/**
 * ★ S16（可用性缺口：普通发布者本应能用 `/task/review` 待审队列）· 待审队列读口准入（count / list **共用**）。
 * 准入 = 「admin（持 `review_tasks`）**∨** 已登录用户」：
 *   · 未登录 ⇒ 走 `requireActor` **既有 401**（本助手返回 null，**不落 403**）；
 *   · admin ⇒ `employerFilterUid = null`（全局视图 · 与改前 `requireAdmin(review_tasks)` **逐字同判** ⇒ 零回归）；
 *   · 普通已登录用户 ⇒ `employerFilterUid = actor.user.uID`（仅其作为发布者 `job.employer_uid` 的 pending 提交）。
 * `count` 口与 `list` 口**共用**本助手产出的同一 `employerFilterUid` ⇒ 过滤谓词两处同源（不各写一套）。
 * ★ 未改 `POST /api/tasklist/:jID/verify` 的准入（仍 `requireAdmin(review_tasks)` · admin-only 零回归）；
 *   发布者的判定动作仍走 `POST /api/job/:jobId/review`（`requireJobOwnerOrAdmin`，已支持雇主）。
 */
const resolveReviewQueueScope = async (
  req: Request,
  res: Response,
): Promise<{ actor: ActorContext; employerFilterUid: number | null } | null> => {
  const actor = await requireActor(req, res);
  if (!actor) return null;

  // admin 判定与 `requireAdmin(req, res, 'review_tasks')` 的放行条件**逐字同源**
  //（`can_access_admin ∧ (is_admin ∨ permissions∋review_tasks)`）⇒ admin 路径零回归。
  const isReviewAdmin = actor.adminAccess.can_access_admin
    && (actor.adminAccess.is_admin || hasRequiredPermission(actor, 'review_tasks'));

  return { actor, employerFilterUid: isReviewAdmin ? null : actor.user.uID };
};

const buildUserPayload = async (user: UserRecord) => {
  const asset = await DatabaseService.getUserAsset(user.uID).catch(() => null);
  return {
    ...user,
    points: asset?.points || 0,
    requires_profile_completion: !String(user.bio || '').trim(),
  };
};

const ensureOwnedTaskProgress = (taskProgress: TaskProgressRecord | null, userID: number) => (
  taskProgress && taskProgress.uID === userID ? taskProgress : null
);

app.get('/', (req, res) => {
  sendSuccess(
    res,
    {
      status: 'ok',
      message: 'Seafood TypeScript Backend',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/health',
        authChallenge: '/api/auth/challenge',
        authVerify: '/api/auth/verify',
        prizes: '/api/prize/all',
        tasks: '/api/task/all',
        user: '/api/user',
      },
    },
    'Backend ready',
  );
});

// P6-VERCEL-SHAPE：`/health` 与 `/api/health` **共用同一 handler**（同一函数引用）。
// 现场：`vercel.json` 的 `routes` 把 `/api/(.*)` 转发给 `backend-ts/src/index.ts` 时**保留原路径**
//   ⇒ 函数收到的是 `/api/health`（外部实测 `GET https://seafood-opal.vercel.app/api/health` = **404**），
//   而应用只注册了 `/health`。本片**只新增一个注册点**（另一条 `app.get`，指向同一 handler）——
//   **handler 体与响应体形状逐字不变**（同一 `healthCheck()` 报告对象、同 `Cache-Control: no-store`）。
const sendHealthReport = async (req: Request, res: Response) => {
  // 健康检查不得被 CDN / 中间缓存（否则会长期报陈旧状态）
  res.setHeader('Cache-Control', 'no-store');
  try {
    const report = await healthCheck();
    res.status(report.ok ? 200 : 503).json(report);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      ok: false,
      db_version: 'unknown',
      schema_version: null,
      time: new Date().toISOString(),
    });
  }
};

// 两个注册点共用**同一 handler**（`/health` 既有面 + `/api/health` Vercel 转发面）
app.get('/health', sendHealthReport);
app.get('/api/health', sendHealthReport);

app.get('/api/test/data', (req, res) => {
  sendSuccess(
    res,
    {
      status: 'ok',
      message: 'TypeScript backend is running',
      timestamp: new Date().toISOString(),
    },
  );
});

app.post('/api/auth/register', (req, res) => {
  sendError(res, 410, 'Registration has moved to wallet sign-in plus profile completion');
});

app.post('/api/auth/challenge', async (req, res) => {
  try {
    const payload = startWalletAuthChallenge(req.body?.evm_address);
    sendSuccess(res, payload);
  } catch (error) {
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to create auth challenge');
  }
});

app.post('/api/auth/verify', async (req, res) => {
  // P6-D1'（批 6 · D1'）：**鉴权层不得把驱动/传输错吞成 401**。
  // ============================================================================
  // 修前（现盘 `:425-426`）：整段共用一个 `catch` ⇒ 无条件 `sendError(res, 401, ...)` ⇒
  //   无 SQLSTATE 的驱动/传输错（实测 `NeonDbError{code:null, message:'Error connecting to
  //   database: fetch failed'}`）被伪装成「凭据无效（401，重试无用）」，而真语义是
  //   「服务暂时不可用（503，可重试）」⇒ 方向性误导（调用方/前端会去让用户重登）。
  // 修后（两段式，**语义边界**）：
  //   ① 凭据面（`consumeWalletAuthChallenge`：格式 / HMAC / nonce 过期 / EIP-191 签名恢复不符）
  //      ⇒ **401**（**401 只用于真鉴权失败**；本段纯计算、无 IO）；
  //   ② 落库面（`findOrCreateUserByEvm` / `getUserAsset`）异常 ⇒ 交**既有** §14 分类器
  //      （`normalizeLedgerError(unwrapInfraCause(e))` ⇒ 无码驱动/传输错 = `LEDGER_TX_TIMEOUT` **503** +
  //      机读 `reason`），**不再**吞成 401；原始信息只进服务端日志（R108 诊断面 / R107 不外泄）。
  // 400 分支与端点注册点均不变（本片只改 catch 分流）。
  let challenge: { evm: string };
  try {
    challenge = consumeWalletAuthChallenge(req.body || {});
  } catch (error) {
    sendError(res, 401, error instanceof Error ? error.message : 'Failed to verify auth challenge');
    return;
  }

  try {
    const user = await DatabaseService.findOrCreateUserByEvm(challenge.evm);
    // P5-B5-FIX-LOGIN（Zang §5.104①）：登录端点与读端点**同族收口**（对照 `:496` 的
    // `GET /api/user/asset/:uID`，P4-B1-a 已修面）。原 `|| upsertAsset(uID, 0)` 回退会写 `asset` 表 ——
    // 该表**不存在**（`data-layer.spec:166`「不存在，且永不创建」）⇒ 无 `cid=1` account 行的用户**必抛 42P01**，
    // 被本函数 catch 吞成 **401** ⇒ **新 EVM 钱包 100% 登不进站**。
    // 现只读账本真源 `account`（`getUserAsset` ⇒ `database.ts:861`）；无行 ⇒ `emptyAsset` 空态（零值 + 完整键集）；
    // **零写库、零建表**：账户行由既有账本机制在首次入账时建立（登录事务内**不**建户）。
    const asset = (await DatabaseService.getUserAsset(user.uID)) || DatabaseService.emptyAsset(user.uID);
    const token = createSessionToken({
      uID: user.uID,
      evm: user.EVM,
    });

    sendSuccess(res, {
      ...user,
      points: asset.points,
      requires_profile_completion: !String(user.bio || '').trim(),
      token,
      access_token: token,
      token_type: 'bearer',
    });
  } catch (error) {
    // P6-D1'（②）：**落库面异常 ⇒ 既有 §14 分类器**（无 SQLSTATE 的驱动/传输错 = `LEDGER_TX_TIMEOUT`
    // **503** + 机读 `reason`）；401 已在上面的凭据面分流，**不再**把基础设施故障伪装成鉴权失败。
    // 原始信息只进服务端日志（R108 诊断面）；对外只给 §14 码 + 非敏感 details（R107）。
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[auth.verify] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

app.post('/api/auth/login', async (req, res) => {
  req.url = '/api/auth/verify';
  return app._router.handle(req, res, () => undefined);
});

// ============================================================================
// P6-D1'-SWEEP（Kong · 单 BE-ERR503-SWEEP）：**「infra 错未进分类器」同族出口一次收完**。
//   · 判据：本文件内凡「会碰库（IO）」的 catch 却**硬编码** `sendError(res, 500, …)` ⇒ 与 D1' 同族
//     （库不可达/驱动传输错被伪装成 500「实现缺陷」，调用方无法区分「可重试」与「别重试」）；
//   · 收口 = 复用**既有** helper `sendInfraMapped`（`:(定义见文件下部) normalizeLedgerError(unwrapInfraCause(e))`，
//     R107 形状）：DB/传输类 ⇒ **503 `LEDGER_TX_TIMEOUT` + 机读 `reason`**；真缺陷仍 500
//     （`LEDGER_TRANSACTION_REQUIRED`，DL126「500 只由不变式被破坏触发」不破）。
//   · **不动**：400 分支、33 码/bucket、真凭据 401 的位置、410 弃用面、任何成功路径响应形状；
//     零 IO 面（`/api/shard`、`/api/shard/transfer` 恒空态，catch 只可能见代码缺陷）⇒ 保留 500。
// ============================================================================
app.get('/api/prize/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const prizes = await DatabaseService.listPrizes(skip, limit);
    setPublicCache(res);
    sendSuccess(res, prizes);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'prize.all', error);
  }
});

app.get('/api/task/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const tasks = await DatabaseService.listTasks(skip, limit);
    setPublicCache(res);
    sendSuccess(res, tasks);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'task.all', error);
  }
});

app.get('/api/task/:tID', async (req, res) => {
  try {
    const tID = parseInteger(req.params.tID);
    if (!tID) {
      return sendError(res, 400, 'Invalid tID');
    }

    // P4-B2a（§3.1 裁定 E1 / §1 #10【保留·改语义】）：detail-miss 统一 404（**撤销** B1-b 的 200 空态）
    const task = await DatabaseService.getTask(tID);
    if (!task) {
      return sendVerbError(res, {
        ok: false,
        status: 404,
        code: 'LEDGER_REF_NOT_FOUND',
        message: 'job not found',
        details: { ref_type: 'job', ref_id: String(tID) },
      });
    }

    setPublicCache(res);
    sendSuccess(res, task);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'task.detail', error);
  }
});

app.get('/api/prize/:bID', async (req, res) => {
  try {
    const bID = parseInteger(req.params.bID);
    if (!bID) {
      return sendError(res, 400, 'Invalid bID');
    }

    const prize = await DatabaseService.getPrizeById(bID);
    if (!prize) {
      return sendError(res, 404, 'Prize not found');
    }

    setPublicCache(res);
    sendSuccess(res, prize);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'prize.detail', error);
  }
});

app.get('/api/user', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const payload = await buildUserPayload(actor.user);
    sendSuccess(res, payload);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'user.me', error);
  }
});

app.post('/api/user/profile', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const bio = String(req.body?.bio || '').trim();
  if (!bio) {
    return sendError(res, 400, 'bio is required');
  }

  try {
    const updatedUser = await DatabaseService.updateUserProfile(actor.user.uID, { bio });
    if (!updatedUser) {
      return sendError(res, 404, 'User not found');
    }

    // P6-TR-1c-A：bio 译文登记（前台 pending + 后台 waitUntil 翻译；失败不影响本响应）
    await enqueueTranslation({ entityType: 'user', entityId: String(actor.user.uID), fields: { bio }, reset: true });

    const payload = await buildUserPayload(updatedUser);
    sendSuccess(res, payload, 'Profile updated');
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'user.profile', error);
  }
});

app.get('/api/user/asset/:uID', async (req, res) => {
  try {
    const uID = parseInteger(req.params.uID);
    if (!uID) {
      return sendError(res, 400, 'Invalid user ID');
    }

    // P4-B1-a: 纯读端点，禁止隐式写库（原 `|| upsertAsset(uID, 0)` 回退已移除）。
    const asset = await DatabaseService.getUserAsset(uID);
    sendSuccess(res, asset || DatabaseService.emptyAsset(uID));
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'user.asset', error);
  }
});

/**
 * ============================================================================
 * P7-A（批 7-A · Kong）：注册 `GET /api/user/ledger` —— 「我的账单 / 账本流水」读口。
 * 依据（逐字）：
 *   · `route-layer.spec:265`：`GET /api/user/ledger`（`account`/`ledger_entry` 只读派生）
 *     ⇒ **「路由层随批 4 注册」** ⇒ **本单就是那次注册**（此前从未实现 ⇒ 实测 404）。
 *   · `data-layer.spec` **DL25**（【已冻结】）/ `ledger.spec` **R95**：分页**必须 keyset**
 *     —— 入参 `before_txid` 游标、响应回传 `next_before_txid`（`null` = 到底）；**禁 `OFFSET`**。
 *   · `data-layer.spec` **DL23**：读路径**零写副作用**（无 DDL / 无懒开户 / 无 `upsert*`）
 *     ⇒ 本面 = 纯 SELECT（服务层 `listLedgerEntriesByUser`），身份**只读 token actor**。
 *   · `route-layer.spec:1343`（§5.1「碎片读口 ②」）：`GET /api/shard/transfer` 的语义
 *     **由 `GET /api/user/ledger?kind=transfer` 取代**（旧路径 `:791` 保留 + 空态 + `deprecated:true`，**不删**）。
 * 过滤：`cid`（可空）、`kind`（可空，取值 = 冻结关闭集 `LEDGER_KINDS` **21** 个〔P9② `R-9-14` 扩容：+`checkin_makeup_fee`〕）、
 *       `before_txid`（可空游标）、`limit`（默认 100 / 上限 500；非法值回落默认，不 500）。
 * 鉴权：`requireActor`（无 token / 坏 token / 查无此人 ⇒ **401 + R107 形状** `{error:{code,message,i18n_key,details}}`）。
 * ============================================================================
 */
const LEDGER_READ_DEFAULT_LIMIT = 100;
const LEDGER_READ_MAX_LIMIT = 500;
const LEDGER_KIND_SET: ReadonlySet<string> = new Set(LEDGER_KINDS);

app.get('/api/user/ledger', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  // ---- 入参解析（非法值 ⇒ **R107 形状** `{error:{code,message,i18n_key,details}}`，绝不 500）------
  // P7-A 收口五（L7④）：`cid` / `before_txid` 非法面此前走 `sendError`（旧形状 `{success,message,error}`）
  //   ⇒ 与 `kind` 面（`sendVerbError` ⇒ R107）**同端点两种形状**。本单统一为 R107，口径 = 冻结裁定 §5.16：
  //     · **形状非法** ⇒ 400 `LEDGER_AMOUNT_INVALID`（既有码 `LD016`，**不新增码**）
  //       + `details.field` / `details.reason ∈ {NOT_DECIMAL_INTEGER, NOT_STRING, OUT_OF_BIGINT_RANGE}`；
  //     · `cid` 形状合法但 `<= 0` ⇒ 「该行不存在」⇒ 404 `LEDGER_CURRENCY_NOT_FOUND` + `{cid}`
  //       （与 `toCid` / DB 侧 `ledger_cid_arg` **逐字一致**；§5.16 明列 `cid<=0` 属此列）；
  //     · `before_txid` 是 keyset 游标（**无实体** ⇒ 不适用 §5.16 的「不存在 ⇒ 404」）⇒ 非正 ⇒ 400 同码
  //       + `reason='NOT_POSITIVE'`（既有 reason 词，见 `src/commission.ts:387`）。
  //   注：`''`（空串）沿用既有语义 = **未给**（可选过滤项 ⇒ 回落「不过滤」，与 `limit` 空串回落默认同族）。
  const rawCid = req.query.cid;
  let cid: number | null = null;
  if (rawCid !== undefined && rawCid !== '') {
    const parsed = typeof rawCid === 'string'
      ? parseLedgerReadInt(rawCid)
      : { ok: false as const, reason: 'NOT_STRING' };
    if (!parsed.ok) {
      return sendVerbError(res, {
        ok: false,
        status: 400,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'cid shape is invalid',
        details: { field: 'cid', reason: parsed.reason },
      });
    }
    if (parsed.value <= 0n) {
      return sendVerbError(res, {
        ok: false,
        status: 404,
        code: 'LEDGER_CURRENCY_NOT_FOUND',
        message: 'currency not found',
        details: { cid: parsed.value.toString() },
      });
    }
    cid = Number(parsed.value);
  }

  const rawBefore = req.query.before_txid;
  let beforeTxid: number | null = null;
  if (rawBefore !== undefined && rawBefore !== '') {
    const parsed = typeof rawBefore === 'string'
      ? parseLedgerReadInt(rawBefore)
      : { ok: false as const, reason: 'NOT_STRING' };
    if (!parsed.ok) {
      return sendVerbError(res, {
        ok: false,
        status: 400,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'before_txid shape is invalid',
        details: { field: 'before_txid', reason: parsed.reason },
      });
    }
    if (parsed.value <= 0n) {
      return sendVerbError(res, {
        ok: false,
        status: 400,
        code: 'LEDGER_AMOUNT_INVALID',
        message: 'before_txid must be a positive txid',
        details: { field: 'before_txid', reason: 'NOT_POSITIVE', value: parsed.value.toString() },
      });
    }
    beforeTxid = Number(parsed.value);
  }

  const rawKind = req.query.kind;
  let kind: string | null = null;
  if (rawKind !== undefined && rawKind !== '') {
    // 取值必须落在**冻结关闭集**内（`ledger.spec` §5.1 / R40；`LEDGER_KINDS` = 20）。不给自造 kind 留口。
    if (typeof rawKind !== 'string' || !LEDGER_KIND_SET.has(rawKind)) {
      return sendVerbError(res, {
        ok: false,
        status: 400,
        code: 'LEDGER_UNKNOWN_KIND',
        message: 'unsupported ledger kind',
        details: { kind: String(rawKind) },
      });
    }
    kind = rawKind;
  }

  // `limit`：默认 100、上限 500；**非数字 / 非法 ⇒ 回落默认**（与既有 `getPagination` 口径一致，报告 §3 明写）。
  const rawLimit = req.query.limit;
  const parsedLimit = Number(rawLimit);
  const limit = rawLimit === undefined || rawLimit === ''
    ? LEDGER_READ_DEFAULT_LIMIT
    : (Number.isFinite(parsedLimit)
      ? Math.min(LEDGER_READ_MAX_LIMIT, Math.max(1, Math.trunc(parsedLimit)))
      : LEDGER_READ_DEFAULT_LIMIT);

  try {
    const entries = await DatabaseService.listLedgerEntriesByUser({
      uid: actor.user.uID,
      cid,
      kind,
      beforeTxid,
      limit,
    });
    // DL25 硬项：响应**必须**回传 `next_before_txid`（满页 ⇒ 末条 `txid`；不足页 ⇒ `null` 表示到底）。
    // 该键随 `sendSuccess` 的 `extra` 走**顶层**（与既有 `deprecated:true` 同位置，不改 `data` 形状）。
    const nextBeforeTxid = entries.length === limit && entries.length > 0
      ? entries[entries.length - 1].txid
      : null;
    sendSuccess(res, entries, 'OK', 200, { next_before_txid: nextBeforeTxid });
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器（DB/传输类 ⇒ 503）。
    return sendInfraMapped(res, 'user.ledger', error);
  }
});

// ---- P7-A 收口五（L7④）：本端点的**同源形状闸**（模块级；**置于端点之后** ⇒ 注册行不位移）--------
/** `bigint` 真界（与 `src/ledger.ts:307-308` 的 `BIGINT_MAX/MIN` **同值**；= PG `bigint` 上下界）。 */
const LEDGER_READ_BIGINT_MAX = 9223372036854775807n;
const LEDGER_READ_BIGINT_MIN = -9223372036854775808n;

/**
 * `cid` / `before_txid` 的**同源形状闸**（**只判定、不发射响应** —— 发射点仍在端点内，
 * 与 `kind` 面**逐字同构**的 `sendVerbError`）。
 * 判据 = 本仓**唯一共用形状闸** `src/ledger.ts:337 toAmount` 同源（`^-?\d+$` 十进制整数 + 真 `bigint` 界）：
 *   · 非字符串（重复 query 键 ⇒ 数组）⇒ `reason='NOT_STRING'`；
 *   · 非十进制整数串 ⇒ `reason='NOT_DECIMAL_INTEGER'`；
 *   · 超 `bigint` 范围 ⇒ `reason='OUT_OF_BIGINT_RANGE'`。
 * 与 DB 侧 `ledger_int_amount` **同码**（`LD016` / `400`，`field=before_txid` 与 `field=cid` 逐格同判）；
 *   DB 侧对 **> 19 位**另有 `OVER_MAX_SINGLE_AMOUNT` 预算，TS `toAmount` **不复制** ⇒ 登记（报告 §6）。
 * 置位说明：本块**置于端点之后**（端点之前零新增行）⇒ 注册行 `app.get('/api/user/ledger'` 仍为 **`:633`**
 *   （spec v1.8 与既有报告引用的行号**不漂移**）；本 `const` 只在端点的闭包内被引用、调用发生在模块
 *   初始化完成之后 ⇒ 无 TDZ / 无「先使用后声明」运行期问题。
 */
const parseLedgerReadInt = (raw: string): { ok: true; value: bigint } | { ok: false; reason: string } => {
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return { ok: false, reason: 'NOT_DECIMAL_INTEGER' };
  const n = BigInt(s);
  if (n > LEDGER_READ_BIGINT_MAX || n < LEDGER_READ_BIGINT_MIN) {
    return { ok: false, reason: 'OUT_OF_BIGINT_RANGE' };
  }
  return { ok: true, value: n };
};

app.get('/api/home', async (req, res) => {
  const taskLimit = Math.min(12, Math.max(1, parseInteger(req.query.task_limit, 6)));
  const prizeLimit = Math.min(16, Math.max(1, parseInteger(req.query.prize_limit, 8)));
  res.setHeader('Vary', 'Authorization');

  try {
    // P4-SEC（缺陷 B）：`resolveActor` 现在区分「鉴权失败」与「基础设施故障」。
    // `/api/home` 是**公开只读面**（原实现也把失败降级为匿名），故这里保持原语义：
    // 取不到主体 ⇒ 匿名渲染，**不**把公开面打成 503；但类型上必须显式收敛。
    const resolvedActor = await resolveActor(req);
    const actor = isActorFailure(resolvedActor) ? null : resolvedActor;
    const [tasks, prizes, claimedPrizeIds, asset] = await Promise.all([
      DatabaseService.listTasks(0, taskLimit),
      DatabaseService.listPrizes(0, prizeLimit),
      actor
        ? DatabaseService.listClaimedPrizeIdsByUser(actor.user.uID)
        : Promise.resolve([] as number[]),
      actor
        ? DatabaseService.getUserAsset(actor.user.uID)
        : Promise.resolve(null),
    ]);

    if (actor) {
      setPrivateNoStore(res);
    } else {
      setPublicCache(res);
    }

    sendSuccess(res, {
      tasks,
      prizes,
      claimed_prize_ids: claimedPrizeIds,
      user_points: asset?.points || 0,
      is_authenticated: Boolean(actor),
    });
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'home', error);
  }
});

app.get('/api/prize-item', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const prizeItems = await DatabaseService.listPrizeItemsByUser(actor.user.uID, skip, limit);
    sendSuccess(res, prizeItems);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'prize-item.list', error);
  }
});

app.get('/api/task-progress', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const taskProgressItems = await DatabaseService.listTaskProgressByUser(actor.user.uID, skip, limit);
    sendSuccess(res, taskProgressItems);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'task-progress.list', error);
  }
});

app.get('/api/task-progress/:jID', async (req, res) => {
  // R-9-86（§5.296 · HIGH 隐私面）：本读口回包含 `info_input` = **交付物正文**
  // （`database.ts getTaskProgress` 的 `s.deliverable AS info_input`）⇒ **必须**鉴权 + 归属校验。
  // ★ S2（`R-9-100`）：`:jID` 语义由 `application_id` **改为 `submission_id`**（`getTaskProgress` 现按
  //   `job_submission.submission_id` 取数、`uID` = 提交者 `worker_uid`）；归属校验**不降级**。语义（R-9-86 逐字）：
  //   · 未登录 / 凭据无效 ⇒ **401**（`requireActor` 既有：R107 `AUTH_UNAUTHORIZED`）
  //   · 已登录但**非提交者** ⇒ **404**（与 miss 分支**同形**，不泄漏存在性；★ 不用 403）
  //   · 提交者本人 ⇒ **200**（成功分支 `data` 形状逐字不变）
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const jID = parseInteger(req.params.jID);
    if (!jID) {
      return sendError(res, 400, 'Invalid jID');
    }

    // 归属校验复用既有 `ensureOwnedTaskProgress`（与 submit 路由同源）；miss 与「非本人」合流 ⇒ 同形 404。
    const taskProgress = ensureOwnedTaskProgress(
      await DatabaseService.getTaskProgress(jID),
      actor.user.uID,
    );
    if (!taskProgress) {
      return sendError(res, 404, 'Task progress not found');
    }

    sendSuccess(res, taskProgress);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'task-progress.detail', error);
  }
});

// ---- J4 · 提交交付物（写口；`job-service.ts` `submitWork`；★ S2 任务模型改造 `R-9-99`）----
// ★ S3（路由层语义同步，与 S2 一致 · 现取确认）：
//   · URL 参数名仍写作 `:identifier`（**保留路径兼容**，前端 URL 不变），但其**语义 = 目标 `job_id`**
//     （`R-9-99`：提交即参与 ⇒ 不再解析 / 不再要求 `job_application`）；
//   · 本路由把该值**原样**当 `job_id` 传给 `submitWork({ identifier })`（`job-service.ts:133`，逐字一致）⇒ 无二次解轴。
app.post('/api/task-progress/:identifier/submit', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const identifier = parseInteger(req.params.identifier);
  const infoInput = String(req.body?.info_input || '').trim();
  const createKeyRaw = req.body?.create_key ?? req.get('idempotency-key') ?? undefined;

  if (!identifier) {
    return sendError(res, 400, 'Invalid task or task progress id');
  }

  if (!infoInput) {
    return sendError(res, 400, 'info_input is required');
  }

  try {
    // ★ S2（`R-9-99`）：提交**无报名前置**、**任何已登录 actor（含发布者本人）**可提交、
    //   **同一人可多次提交**；`batt` 闸已由「报名」移到「提交」（409 + reason `BATT_BELOW_ACCEPT_THRESHOLD` 逐字不变）。
    //   ⇒ 不再用读口预证归属；`identifier` 语义 = 目标 **`job_id`**（不再解析 `job_application`）。
    //   提交落 `job_submission`（review_status='pending'），**无分录**（DL99/R3）；miss⇒404、非 open⇒409。
    const result = await submitWork({
      identifier,
      workerUid: actor.user.uID,
      deliverable: infoInput,
      createKeyRaw,
    });

    if (!result.ok) {
      return sendVerbError(res, result);
    }

    // 成功分支 data 键集**冻结**（§2 母约束 F1）：仍为 TaskProgressRecord 9 键；
    // 同键重放顶层标记 `idempotent_replay:true`（§3.2「200（良性）」/ R106），不改 data 形状
    return sendSuccess(res, result.view, 'Task progress submitted', 200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'task-progress.submit', error);
  }
});

// P6-B5-CLAIM（批 5 = sunset）：旧模型（管理员后台发 task/reward）已废弃 ⇒ `POST /api/task-progress/claim/:jID` **退役**。
//   奖励/积分发放的唯一路径 = A1 管理员调分（已接账本 `mint`/`burn`）⇒ 无功能缺口。
//   硬边界：**在访问任何表之前**直接 `410` —— 旧实现体经 `DatabaseService` 读 `asset`/`task_progress`（迁移面从未建过该两表）
//   ⇒ 恒 `42P01` ⇒ 被吞成 `500`（本仓今日唯一可达的「撞缺表」面）⇒ handler 路径**零表访问**。
//   形状 = **照抄既有 410 面**（同一共享产出器 `./job-service` `ledgerErrorBody` ⇒ R107 `{error:{code,message,i18n_key,details}}`，
//   code=`LEDGER_REF_NOT_FOUND`，`i18n_key=ledger.err.LEDGER_REF_NOT_FOUND`，details={`ref_type`,`ref_id`,`http_status`,`sunset`}）；
//   **机读 reason** 落 `details.reason`（本仓 S6 惯例，见 `frontend/src/test/unit/auth.test.js:107`）。
//   撤 `requireActor` 前置（同 B2a/B2b 先例：弃用面不得把「已下线」伪装成「未授权」；本面零副作用 ⇒ 无令牌下亦可观测 410）。
const CLAIM_RETIRED_REASON = 'CLAIM_RETIRED';
const CLAIM_RETIRED_REF_ID = '/api/task-progress/claim/:jID';
const CLAIM_RETIRED_SUNSET = '批 5 sunset（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/task-progress/claim/:jID', (_req, res) => {
  return res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${CLAIM_RETIRED_REF_ID}`,
    {
      ref_type: 'endpoint',
      ref_id: CLAIM_RETIRED_REF_ID,
      http_status: 410,
      sunset: CLAIM_RETIRED_SUNSET,
      reason: CLAIM_RETIRED_REASON,
    },
  ));
});

app.get('/api/shard', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const shards = await DatabaseService.listShardHoldingsByUser(actor.user.uID, skip, limit);
    // P4-B1-c: shard 读侧恒空态（无对应表）+ 顶层 deprecated 标记（碎片语义已被积分交易所取代）。
    sendSuccess(res, shards, 'OK', 200, { deprecated: true });
  } catch (error) {
    console.error('Error loading shard holdings:', error);
    sendError(res, 500, 'Failed to load shard holdings');
  }
});

app.get('/api/shard/transfer', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const transfers = await DatabaseService.listShardTransfersByUser(actor.user.uID, skip, limit);
    // P4-B1-c: shard_transfer 读侧恒空态（无对应表）+ 顶层 deprecated 标记。
    sendSuccess(res, transfers, 'OK', 200, { deprecated: true });
  } catch (error) {
    console.error('Error loading shard transfers:', error);
    sendError(res, 500, 'Failed to load shard transfers');
  }
});

app.post('/api/shard/redeem', async (_req, res) => {
  // P4-B2b：§1 #23 + §5.1 ⇒ 写口一律 410（**不得**用 200 空态冒充成功）：碎片兑换在 `cid` 模型里无对应语义（等值动作 = 交易所 `trade` / `transfer`）
  // 撤 `requireActor` 前置：弃用面不返回 401（否则「已下线」被伪装成「未授权」）。
  return sendGone(res, '/api/shard/redeem', LEGACY_REWARD_WRITE_SUNSET);
});

app.post('/api/chest/:bID/open', async (_req, res) => {
  // P4-B2b：§1 #24 + §5.1 ⇒ 写口一律 410（**不得**用 200 空态冒充成功）：「凭空调入余额」与 `DL5` 双分录正面冲突
  // 撤 `requireActor` 前置：弃用面不返回 401（否则「已下线」被伪装成「未授权」）。
  return sendGone(res, '/api/chest/:bID/open', LEGACY_REWARD_WRITE_SUNSET);
});

app.get('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const orders = await DatabaseService.listOrdersByUser(actor.user.uID, skip, limit);
    sendSuccess(res, orders);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'order.list', error);
  }
});

// ============================================================================
// P4-B3e（§1 #26【保留·改接】· §4.2 M1 · DL85/DL90/DL64）：交易所**挂单** = `market_post_event(op='order')`
//   ⇒ `hold` ×2（同 uid 同 cid）：买单冻结 `$` `amount×price` / 卖单冻结 base `amount`
//   · `owner_uid` = **token 的 actor**（body 传入被丢弃）；`quote_cid` **服务端恒 1**
//   · `create_key` **必填 fail-loud**（§4.4-14 判据：`market_order.order_id` 是 IDENTITY、无自然键 ⇒ 不派生）
//     ⇒ **旧前端（`ShardPage.jsx:176`，body `{bID,side,price,volume}`、无键）会 `400`** = 前端同步项（报告 §5）
//   · **DL68 币对级串行化**：写语句外层 CTE 先取 `pg_advisory_xact_lock(base_cid, quote_cid)`
// ============================================================================
app.post('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await placeMarketOrder({
      actorUid: actor.user.uID,
      body: (req.body || {}) as Record<string, unknown>,
      headerKey: req.header('idempotency-key'),
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(
      res,
      result.view,
      result.replay ? 'Order created (idempotent replay)' : 'Order created',
      200,
      result.replay ? { idempotent_replay: true } : undefined,
    );
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[market.order] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

// ============================================================================
// P4-B3e（§1 #27【保留·改语义】· §4.2 M2 · §7-5 已裁）：**全撤** = 逐单 `market_post_event(op='cancel')`
//   ⇒ 每单 `hold_release` ×2（`balance ↔ frozen` 同账户 2 腿）；根键逐单 `biz:market:cancel:<order_id>`
//   · **入参一律走 query、不得读 body**（§1 #27 逐字；旧前端 `ShardPage.jsx:328` 的 body 式全撤 = §2.4 S4）
//   · 返回体保留旧前端读的 `cancelled` 键（`ShardPage.jsx:333`）
// ============================================================================
app.delete('/api/order', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await cancelAllMarketOrders({
      actorUid: actor.user.uID,
      query: (req.query || {}) as Record<string, unknown>,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Orders cancelled');
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[market.cancel_all] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

// ============================================================================
// P4-B3e（§1 #28【保留·改接】· §4.2 M2）：**单撤** = `market_post_event(op='cancel')` ⇒ `hold_release` ×2
//   · 授权 = **只有订单 `owner_uid`**（非 owner ⇒ `403 AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`，3c/3d 同族）
//   · **手续费不可退**（DL87：`trade_fee` 是消耗不是冻结）—— 撤单只释放剩余在冻额
// ============================================================================
app.delete('/api/order/:oID', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await cancelMarketOrder({
      actorUid: actor.user.uID,
      orderIdRaw: req.params.oID,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(
      res,
      result.view,
      result.replay ? 'Order cancelled (idempotent replay)' : 'Order cancelled',
      200,
      result.replay ? { idempotent_replay: true } : undefined,
    );
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[market.cancel] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

app.get('/api/market/:bID/orderbook', async (req, res) => {
  const bID = parseInteger(req.params.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const rows = await DatabaseService.listOrderBook(bID);
    sendSuccess(res, rows);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'market.orderbook', error);
  }
});

app.get('/api/market/:bID/trades', async (req, res) => {
  const bID = parseInteger(req.params.bID);
  if (!bID) {
    return sendError(res, 400, 'Invalid bID');
  }

  try {
    const { skip, limit } = getPagination(req);
    const rows = await DatabaseService.listTradesByBrand(bID, skip, limit);
    sendSuccess(res, rows);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'market.trades', error);
  }
});

app.get('/api/admin/me', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  sendSuccess(res, actor.adminAccess);
});

// ============================================================================
// 批 9 第 1 片（P9① · `route-layer.spec` v2.12 §27.2 · `data-layer.spec` v0.19 §30.2）：
//   **公开读口** `GET /api/role-names`（**无鉴权** —— 角色名 / 站点标语 = 全站 UI 文案）。
// ============================================================================
// · 注册点 `75 → 76` 逐字登记（`get 31 → 32`）；写口仍复用 `POST /api/admin/settings`（+0）。
// · 响应带 `updated_at`（供增量 / 失效判据）；**读取失败 ⇒ 前端 fail-closed 回落 locale 基值**（`source='locale'`）。
app.get('/api/role-names', async (_req, res) => {
  try {
    const overlay = await DatabaseService.getSiteTextOverlay();
    sendSuccess(res, overlay);
  } catch (error) {
    // 基础设施异常 ⇒ 既有 §14 分类器（503 + 机读 reason）；前端据此回落 locale 基值（绝不空串）。
    return sendInfraMapped(res, 'roleNames.get', error);
  }
});

// ============================================================================
// 批 9 第 2 片（P9② · `route-layer.spec` v2.14 §28.2 `R-9-19` · `data-layer.spec` v0.21 §31）：
//   batt 电量 + 签到 / 补签 —— **4 新口**（注册点 `76 → 80`：`get 32→34` / `post 41→43`）。
// ----------------------------------------------------------------------------
// · 用户面四口全闸 `requireActor`（用户本人 · `uid` 取自 token，**不得**客户端声明）；**零 admin 键新增**（11 键不动）。
// · 动作口幂等键 = **服务端派生定案形**（`R-9-16`/`R-9-19`）：
//     `biz:checkin:<uid>:<checkin_day>` / `biz:checkin:makeup:<uid>:<target_day>`
//   （`<...>` = **业务标的日**（不可变标识）；**禁**金额 / 时间戳入键 · `R50`/`DL95`；前缀 `biz:` · `R49`）。
// · 响应键集 = 每口**冻结键集**（§28.2 R1/R2/A1/A2）逐字；错误面 = **既有 33 闭集借码 + 稳定 `reason`**（零新增码）+ R107 单形状。
// ============================================================================
/** UTC 自然日（`R-9-15`）`YYYY-MM-DD`（`offsetDays` 允许取昨日等）。 */
const utcDay = (offsetDays = 0): string => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
/** 业务日形（`YYYY-MM-DD` 且为真日期）校验 —— 防非法 `target_day` 入幂等键 / 入 SQL。 */
const isBusinessDay = (v: unknown): boolean => {
  const s = String(v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
/** 用户面业务幂等键派生（`biz:` 前缀 · 逐段冒号连接 · `R49` 前缀 / 禁 `#`/控制字符由常量段保证）。 */
const bizKeyOf = (...parts: Array<string | number>): string => `biz:${parts.map((p) => String(p)).join(':')}`;

// R1 · `GET /api/batt` —— 用户电量读口（`data` 键集 = §28.2 冻结 6 键；派生布尔 `canAccept` 即时重算）。
//   ★ P9④（`route-layer.spec` v2.18 §30.2/§30.7 变体 Ⅱ）：**BTTC 读口并入本口**（零新 GET ⇒ `get 36→36`）
//     —— 追加 `bttc` 子对象（`symbol`/`name`/`decimals`/`status`/`totalSupply`/`balance`/`canMint`/`canBurn`/`policy`）。
//     既有 6 键**逐字不动**；派生布尔 `canMint`/`canBurn` 即时重算（`R-9-23` 钳制后生效值）。
app.get('/api/batt', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const d = await DatabaseService.getBatt(actor.user.uID);
    const b = await DatabaseService.getBttcState(actor.user.uID);
    sendSuccess(res, {
      batt: d.batt,
      capBatt: d.capBatt,
      floorBatt: d.floorBatt,
      acceptThresholdBatt: d.acceptThresholdBatt,
      canAccept: d.canAccept,
      updated_at: d.updated_at,
      bttc: {
        symbol: b.symbol,
        name: b.name,
        decimals: b.decimals,
        status: b.status,
        totalSupply: b.totalSupply,
        balance: b.balance,
        canMint: b.canMint,
        canBurn: b.canBurn,
        policy: b.policy,
        source: b.source,
      },
    });
  } catch (error) {
    return sendInfraMapped(res, 'batt.get', error);
  }
});

// R2 · `GET /api/checkin` —— 用户签到读口（`data` 键集 = §28.2 冻结 6 键）。
app.get('/api/checkin', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const d = await DatabaseService.getCheckinStatus(actor.user.uID);
    sendSuccess(res, {
      streakDay: d.streakDay,
      streakCapDays: d.streakCapDays,
      checkedInToday: d.checkedInToday,
      canMakeup: d.canMakeup,
      makeupCostUsd: d.makeupCostUsd,
      updated_at: d.updated_at,
    });
  } catch (error) {
    return sendInfraMapped(res, 'checkin.get', error);
  }
});

// A1 · `POST /api/checkin` —— 签到动作口（幂等键 = `biz:checkin:<uid>:<checkin_day>`；零账本腿）。
app.post('/api/checkin', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const uid = actor.user.uID;
    const idemKey = bizKeyOf('checkin', uid, utcDay());
    const r = await DatabaseService.checkin(uid, idemKey);
    if (!r) return sendInfraMapped(res, 'checkin.post', new Error('checkin: no row'));
    return sendSuccess(
      res,
      { checkedIn: true, streakDay: r.streakDay, rewardBatt: r.rewardBatt, batt: r.batt },
      r.outcome === 'replayed' ? 'Checkin done (idempotent replay)' : 'Checkin done',
      200,
      r.outcome === 'replayed' ? { idempotent_replay: true } : undefined,
    );
  } catch (error) {
    return sendInfraMapped(res, 'checkin.post', error);
  }
});

// A2 · `POST /api/checkin/makeup` —— 补签动作口（**有资金腿**：`checkin_makeup_fee` → `uid = −1`，不真 burn）。
//   幂等键 = `biz:checkin:makeup:<uid>:<target_day>`；`data` 键集 = §28.2 冻结 3 键。
app.post('/api/checkin/makeup', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const targetRaw = String(req.body?.target_day ?? req.body?.targetDay ?? '').trim();
  if (!isBusinessDay(targetRaw)) {
    return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
      field: 'target_day', reason: 'CHECKIN_MAKEUP_TARGET_INVALID',
    }, 'Target day is invalid'));
  }

  try {
    const uid = actor.user.uID;
    const idemKey = bizKeyOf('checkin', 'makeup', uid, targetRaw);
    const fingerprint = createHash('sha256').update(`${uid}|${targetRaw}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.checkinMakeup({
      uid, targetDay: targetRaw, idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: '',
    });
    if (!r) return sendInfraMapped(res, 'checkin.makeup', new Error('makeup: no row'));

    if (r.outcome === 'applied' || r.outcome === 'replayed') {
      return sendSuccess(
        res,
        { restoredStreakDay: r.restoredStreakDay, costUsd: r.costUsd, txid: r.txid },
        r.outcome === 'replayed' ? 'Makeup done (idempotent replay)' : 'Makeup done',
        200,
        r.outcome === 'replayed' ? { idempotent_replay: true } : undefined,
      );
    }
    // 三类拒绝 ⇒ **既有闭集借码 + 稳定 reason**（零新增码 · R107 单形状）。
    if (r.outcome === 'rejected_insufficient_balance') {
      return sendVerbError(res, adminVerbError(409, 'LEDGER_INSUFFICIENT_BALANCE', {
        field: 'checkin_makeup', target_day: r.targetDay,
      }, 'Insufficient balance'));
    }
    const reason = r.outcome === 'rejected_daily_limit'
      ? 'CHECKIN_MAKEUP_DAILY_LIMIT'
      : 'CHECKIN_MAKEUP_TARGET_INVALID';
    return sendVerbError(res, adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION', {
      field: 'checkin_makeup', reason, target_day: r.targetDay,
    }, 'Makeup rejected'));
  } catch (error) {
    return sendInfraMapped(res, 'checkin.makeup', error);
  }
});

// ============================================================================
// 批 9 第 3 片（P9③ · `route-layer.spec` v2.16 §29.12 · `data-layer.spec` v0.23 §32）：
//   评分 / 时效（四角色指标）+ `R-9-7` 发货 / 收货 —— **5 新口**
//   （注册点 `80 → 85`：`get 34→36` / `post 43→46`；`put 0` / `patch 1` / `delete 2` 不变）。
// ----------------------------------------------------------------------------
// · 用户面 5 口全闸 `requireActor`（用户本人 · `uid` 取自 token，**不得**客户端声明）；**零 admin 键新增**（11 键不动）。
// · A2/A3 归属闸：ship = 卖方本人 / receive = 买方本人（取数真源 = `listing_order.seller_uid/buyer_uid`）；
//   ship/receive 的**状态回写 + 事件行**在 `transitionListingOrder` 的**单语句 CTE** 内同生同灭（变体 C-Ⅰ）。
// · 错误面 = **既有 33 闭集借码 + 稳定 `reason`**（零新增码）+ R107 单形状。
// · 「无数据」兜底：星级 = `defaultStars`（默认 3.0）；时长 = `null`（前端「暂无数据」· **不填 0**）；比率 = 100%。
// ============================================================================
const RATING_DIRECTIONS = ['poster_to_worker', 'worker_to_poster', 'vendor_to_customer', 'customer_to_vendor'] as const;
const RATING_PERIODS = [30, 90, 360, 1000] as const;

/** ship/receive 动作口回执映射（**既有 33 闭集借码 + 稳定 `reason`** · 零新增码 · R107）。 */
const sendOrderTransition = (
  res: Response,
  r: Awaited<ReturnType<typeof DatabaseService.transitionListingOrder>>,
  action: 'ship' | 'receive',
) => {
  if (!r) return sendInfraMapped(res, `listing.${action}`, new Error(`${action}: no row`));
  if (r.outcome === 'shipped' || r.outcome === 'received') {
    return sendSuccess(res, { orderId: String(r.orderId), status: r.toStatus, fromStatus: r.currentStatus },
      action === 'ship' ? 'Order shipped' : 'Order received');
  }
  if (r.outcome === 'replay') {
    return sendSuccess(res, { orderId: String(r.orderId), status: r.toStatus },
      `Order ${r.toStatus} (idempotent replay)`, 200, { idempotent_replay: true });
  }
  if (r.outcome === 'order_not_found') {
    return sendVerbError(res, adminVerbError(404, 'LEDGER_REF_NOT_FOUND',
      { ref_type: 'listing_order', ref_id: String(r.orderId), reason: 'order_not_found' }, 'Referenced object not found'));
  }
  if (r.outcome === 'not_party') {
    return sendVerbError(res, adminVerbError(403, 'AUTH_FORBIDDEN',
      { reason: 'NOT_ORDER_PARTY', ref_type: 'listing_order', ref_id: String(r.orderId) }, 'Forbidden'));
  }
  return sendVerbError(res, adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION',
    { field: 'listing_order.status', reason: action === 'ship' ? 'ORDER_NOT_SHIPPABLE' : 'ORDER_NOT_RECEIVABLE',
      status: r.currentStatus, ref_type: 'listing_order', ref_id: String(r.orderId) }, 'Invalid order state'));
};

// R1 · `GET /api/rating/summary` —— 评分汇总读口（四角色星级 · 4 周期 · **无数据默认 3.0**）。
app.get('/api/rating/summary', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const periodRaw = req.query.period;
  let period = 90;
  if (periodRaw !== undefined && periodRaw !== '') {
    const p = Number(periodRaw);
    if (!RATING_PERIODS.includes(p as never)) {
      return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID',
        { field: 'period', reason: 'RATING_PERIOD_INVALID', allowed: RATING_PERIODS }, 'Period is invalid'));
    }
    period = p;
  }
  try {
    const summary = await DatabaseService.getRatingSummary(actor.user.uID);
    const sel = summary.periods[String(period)] || summary.periods['90'];
    return sendSuccess(res, {
      period,
      stars: { poster: sel.poster, worker: sel.worker, vendor: sel.vendor, customer: sel.customer },
      periods: summary.periods,
      defaultStars: summary.defaultStars,
      source: summary.source,
    });
  } catch (error) {
    return sendInfraMapped(res, 'rating.summary', error);
  }
});

// R2 · `GET /api/timeliness` —— 时效读口（四时长 + 比率四类 · **无数据「暂无数据」/ 默认 100%**）。
app.get('/api/timeliness', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const jobRaw = req.query.job_id ?? req.query.jobId;
  const listingRaw = req.query.listing_id ?? req.query.listingId;
  const jobN = jobRaw === undefined || jobRaw === '' ? 0 : parseInteger(jobRaw, 0);
  const listingN = listingRaw === undefined || listingRaw === '' ? 0 : parseInteger(listingRaw, 0);
  try {
    const t = await DatabaseService.getTimeliness(actor.user.uID, {
      jobId: jobN > 0 ? jobN : undefined,
      listingId: listingN > 0 ? listingN : undefined,
    });
    return sendSuccess(res, {
      posterAvgDays: t.posterAvgDays,
      workerAvgDays: t.workerAvgDays,
      vendorAvgShipDays: t.vendorAvgShipDays,
      customerAvgReceiveDays: t.customerAvgReceiveDays,
      workerPassRate: t.workerPassRate,
      customerDealRate: t.customerDealRate,
      jobPassRate: t.jobPassRate,
      listingDealRate: t.listingDealRate,
    });
  } catch (error) {
    return sendInfraMapped(res, 'timeliness.get', error);
  }
});

// A1 · `POST /api/rating` —— 提交评分（**四要素由服务端取数**；幂等键 `biz:rating:<uid>:<target_type>:<target_id>`）。
app.post('/api/rating', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const body = (req.body || {}) as Record<string, unknown>;
  const targetType = String(body.targetType ?? body.target_type ?? '').trim();
  const direction = String(body.direction ?? '').trim();
  const targetIdRaw = body.targetId ?? body.target_id;
  const targetId = parseInteger(targetIdRaw, 0);
  const starsNum = Number(body.stars);
  if (!(targetType === 'job' || targetType === 'listing')) {
    return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID',
      { field: 'target_type', reason: 'RATING_TARGET_TYPE_INVALID' }, 'Target type is invalid'));
  }
  if (!RATING_DIRECTIONS.includes(direction as never)) {
    return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID',
      { field: 'direction', reason: 'RATING_DIRECTION_INVALID' }, 'Direction is invalid'));
  }
  if (!(targetId > 0)) {
    return sendVerbError(res, adminVerbError(404, 'LEDGER_REF_NOT_FOUND',
      { ref_type: targetType, ref_id: String(targetIdRaw ?? ''), reason: 'rating_target_not_found' }, 'Referenced object not found'));
  }
  if (!Number.isFinite(starsNum) || starsNum < 0 || starsNum > 5) {
    return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID',
      { field: 'stars', reason: 'RATING_STARS_OUT_OF_RANGE' }, 'Stars out of range'));
  }
  try {
    const uid = actor.user.uID;
    const idemKey = bizKeyOf('rating', uid, targetType, targetId);
    const fingerprint = createHash('sha256').update(`${uid}|${targetType}|${targetId}|${direction}|${starsNum}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.submitRating({
      raterUid: uid, targetType, targetId, direction, stars: starsNum,
      idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: '',
    });
    if (!r) return sendInfraMapped(res, 'rating.post', new Error('rating: no row'));
    if (r.outcome === 'inserted' || r.outcome === 'replay') {
      return sendSuccess(res, {
        ratingId: r.ratingId, rateeUid: r.rateeUid, stars: r.stars, targetType, targetId, direction,
      }, r.outcome === 'replay' ? 'Rating submitted (idempotent replay)' : 'Rating submitted', 200,
      r.outcome === 'replay' ? { idempotent_replay: true } : undefined);
    }
    if (r.outcome === 'already_rated') {
      return sendVerbError(res, adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION',
        { field: 'rating', reason: 'RATING_ALREADY_DONE', target_type: targetType, target_id: String(targetId) }, 'Rating already done'));
    }
    return sendVerbError(res, adminVerbError(404, 'LEDGER_REF_NOT_FOUND',
      { ref_type: targetType, ref_id: String(targetId), reason: 'rating_target_not_found' }, 'Referenced object not found'));
  } catch (error) {
    return sendInfraMapped(res, 'rating.post', error);
  }
});

// A2 · `POST /api/listing-orders/:orderId/ship` —— 发货（卖方本人 · `paid→shipped` · 幂等键 `biz:listing:ship:<order_id>`）。
app.post('/api/listing-orders/:orderId/ship', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const orderIdText = String(req.params.orderId ?? '').trim();
  if (!/^\d+$/.test(orderIdText) || orderIdText === '0') {
    return sendVerbError(res, adminVerbError(404, 'LEDGER_REF_NOT_FOUND',
      { ref_type: 'listing_order', ref_id: orderIdText || 'null', reason: 'order_not_found' }, 'Referenced object not found'));
  }
  try {
    const orderId = Number(orderIdText);
    const idemKey = bizKeyOf('listing', 'ship', orderId);
    const fingerprint = createHash('sha256').update(`listing.ship|${orderId}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.transitionListingOrder({
      action: 'ship', orderId, actorUid: actor.user.uID,
      idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: `listing ship:${orderId}`,
    });
    return sendOrderTransition(res, r, 'ship');
  } catch (error) {
    return sendInfraMapped(res, 'listing.ship', error);
  }
});

// A3 · `POST /api/listing-orders/:orderId/receive` —— 收货（买方本人 · `shipped→received` · 幂等键 `biz:listing:receive:<order_id>`）。
app.post('/api/listing-orders/:orderId/receive', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const orderIdText = String(req.params.orderId ?? '').trim();
  if (!/^\d+$/.test(orderIdText) || orderIdText === '0') {
    return sendVerbError(res, adminVerbError(404, 'LEDGER_REF_NOT_FOUND',
      { ref_type: 'listing_order', ref_id: orderIdText || 'null', reason: 'order_not_found' }, 'Referenced object not found'));
  }
  try {
    const orderId = Number(orderIdText);
    const idemKey = bizKeyOf('listing', 'receive', orderId);
    const fingerprint = createHash('sha256').update(`listing.receive|${orderId}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.transitionListingOrder({
      action: 'receive', orderId, actorUid: actor.user.uID,
      idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: `listing receive:${orderId}`,
    });
    return sendOrderTransition(res, r, 'receive');
  } catch (error) {
    return sendInfraMapped(res, 'listing.receive', error);
  }
});

// ============================================================================
// 批 9 第 4 片（P9④ · `route-layer.spec` v2.18 §30 · `data-layer.spec` v0.25 §33）：
//   BTTC 铸造 / 分解 —— **2 新动作口**（注册点 `85 → 87`：`get 36→36` / `post 46→48`）。
// ----------------------------------------------------------------------------
// · 读口 = **并入既有用户资产读口 `GET /api/batt`**（变体 Ⅱ · §30.7）⇒ **零新 GET**（`get 36→36`）。
// · 2 动作口全闸 `requireActor`（用户本人 · `uid` 取自 token，**不得**客户端声明）；**零 admin 键新增**（11 键不动）。
// · 幂等键 = **`cli:<UUID>`**（调用方供键 · `R-9-41`；★ **禁** `biz:bttc:mint:<uid>` 形态 —— 无天然判别子）。
// · 错误面 = **既有 33 闭集借码 + 稳定 `reason`**（零新增码）+ R107 单形状。
// · 库面 leg = **`PENDING_APPLY`**（`0032`/`0033` 未 apply ⇒ 新 kind / 豁免列不可验）。
// ============================================================================
const BTTC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** BTTC 动作口幂等键解析（`cli:<UUID>` · `R-9-41`）。 */
const resolveBttcKey = (req: Request): { ok: true; key: string } | { ok: false; reason: 'MISSING' | 'PREFIX_REQUIRED' | 'NOT_UUID' } => {
  const body = (req.body || {}) as Record<string, unknown>;
  const headerValue = req.headers['idempotency-key'];
  const raw = body.create_key ?? body.idempotency_key ?? body.idempotencyKey ?? headerValue ?? undefined;
  const s = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!s) return { ok: false, reason: 'MISSING' };
  if (!s.startsWith('cli:')) return { ok: false, reason: 'PREFIX_REQUIRED' };
  return BTTC_UUID_RE.test(s.slice(4)) ? { ok: true, key: s } : { ok: false, reason: 'NOT_UUID' };
};

/** 2 动作口写入前置：解析键 ⇒ 非法即 R107 400（**借既有幂等键码** · 零新增码）。 */
const bttcKeyGuard = (req: Request, res: Response): string | null => {
  const k = resolveBttcKey(req);
  if (k.ok) return k.key;
  const code = k.reason === 'MISSING' ? 'LEDGER_IDEMPOTENCY_KEY_REQUIRED' : 'LEDGER_IDEMPOTENCY_KEY_INVALID';
  sendVerbError(res, adminVerbError(400, code, { field: 'create_key', reason: k.reason }, 'Idempotency key invalid'));
  return null;
};

/** BTTC 动作口拒绝映射（同一 uid 状态复核 ⇒ 稳定 `reason` 常量 · 零新增码 · R107）。 */
const sendBttcRejection = async (
  res: Response, uid: number, action: 'mint' | 'burn',
  r: { bstatus: string | null; batt: number; held: string },
) => {
  const st = await DatabaseService.getBttcState(uid);
  if (r.bstatus === null || st.status === null || !(st.status === 'draft' || st.status === 'listed')) {
    return sendVerbError(res, adminVerbError(409, 'LEDGER_CURRENCY_INVALID_TRANSITION',
      { field: 'currency.status', reason: 'BTTC_UNAVAILABLE', status: st.status }, 'BTTC not available'));
  }
  if (action === 'mint' && r.batt < st.policy.mintBattCost) {
    return sendVerbError(res, adminVerbError(409, 'LEDGER_INSUFFICIENT_BALANCE',
      { field: 'batt', reason: 'INSUFFICIENT_BATT', required: String(st.policy.mintBattCost), available: String(r.batt) }, 'Insufficient batt'));
  }
  if (action === 'burn' && BigInt(r.held) < BigInt(st.policy.burnBttcCost)) {
    return sendVerbError(res, adminVerbError(409, 'LEDGER_INSUFFICIENT_BALANCE',
      { field: 'balance', reason: 'INSUFFICIENT_BTTC', required: String(st.policy.burnBttcCost), available: r.held }, 'Insufficient BTTC'));
  }
  return sendVerbError(res, adminVerbError(409, 'LEDGER_INSUFFICIENT_BALANCE',
    { field: 'balance', reason: 'INSUFFICIENT_FEE' }, 'Insufficient balance'));
};

// A1 · `POST /api/bttc/mint` —— 铸造动作口（batt `−mintBattCost` → `$ −mintFeeUsd` 入 `uid=−1` → BTTC `+1`）。
app.post('/api/bttc/mint', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const idemKey = bttcKeyGuard(req, res);
  if (idemKey === null) return;
  try {
    const uid = actor.user.uID;
    const fingerprint = createHash('sha256').update(`bttc:mint|${uid}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.bttcMint({ uid, idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: '' });
    if (!r) return sendInfraMapped(res, 'bttc.mint', new Error('bttc.mint: no row'));
    if (r.outcome === 'rejected') return sendBttcRejection(res, uid, 'mint', r);
    return sendSuccess(
      res,
      { batt: r.batt, txid: r.txid, supplyBefore: r.supplyBefore, supplyAfter: r.supplyAfter },
      r.outcome === 'replayed' ? 'BTTC mint done (idempotent replay)' : 'BTTC mint done',
      200,
      r.outcome === 'replayed' ? { idempotent_replay: true } : undefined,
    );
  } catch (error) {
    return sendInfraMapped(res, 'bttc.mint', error);
  }
});

// A2 · `POST /api/bttc/burn` —— 分解动作口（BTTC `−burnBttcCost` 真 burn → `$ −burnFeeUsd` 入 `uid=−1` → batt `+burnBattGain` 封顶丢弃）。
app.post('/api/bttc/burn', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  const idemKey = bttcKeyGuard(req, res);
  if (idemKey === null) return;
  try {
    const uid = actor.user.uID;
    const fingerprint = createHash('sha256').update(`bttc:burn|${uid}`).digest('hex').slice(0, 32);
    const r = await DatabaseService.bttcBurn({ uid, idempotencyKey: idemKey, requestFingerprint: fingerprint, memo: '' });
    if (!r) return sendInfraMapped(res, 'bttc.burn', new Error('bttc.burn: no row'));
    if (r.outcome === 'rejected') return sendBttcRejection(res, uid, 'burn', r);
    return sendSuccess(
      res,
      { batt: r.batt, txid: r.txid, supplyBefore: r.supplyBefore, supplyAfter: r.supplyAfter },
      r.outcome === 'replayed' ? 'BTTC burn done (idempotent replay)' : 'BTTC burn done',
      200,
      r.outcome === 'replayed' ? { idempotent_replay: true } : undefined,
    );
  } catch (error) {
    return sendInfraMapped(res, 'bttc.burn', error);
  }
});

app.get('/api/admin/settings', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const settings = await DatabaseService.getSystemSettings();
    // §1 #32 / §4.1 #35：响应必须标注「费率不在本表」（真源 = commission_policy.fee_rate_bp）。
    // 用 message 承载（**不改 data 键集** —— §2 母约束 F1 优先）。
    sendSuccess(res, settings, 'OK（费率不在 app_config；真源 = commission_policy.fee_rate_bp）');
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'admin.settings.get', error);
  }
});

// 批 8①（`data-layer.spec` v0.10 §21.2 `AG3`①）：沿 `cause` 链读 PG 约束名（不打印原始 message —— R107/R108 纪律）。
const pgConstraintOf = (error: unknown, depth = 0): string => {
  if (depth >= 4 || error === null || typeof error !== 'object') return '';
  const constraint = (error as { constraint?: unknown }).constraint;
  if (typeof constraint === 'string' && constraint) return constraint;
  for (const key of ['cause', 'sourceError', 'error'] as const) {
    const found = pgConstraintOf((error as Record<string, unknown>)[key], depth + 1);
    if (found) return found;
  }
  return '';
};

app.post('/api/admin/settings', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const body: unknown = req.body;
    const envelope: Record<string, unknown> | null =
      body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;

    // ★ 批 8③b（`data-layer.spec` v0.13 §24.1(b)/(c) · `route-layer.spec` v2.6 §21 · `R-8-19`）：
    //   **键级寻址线格式**（单键 · 显式信封）—— 判别式 = 请求体为 jsonb object **且含自有属性 `key`**。
    //   · **形态 A**（裸值对象 · 无自有属性 `key`）⇒ 目标键 = 常量 `'system_settings'`（键形 / 响应 / 错误形状**逐字不变**）；
    //   · **形态 B**（显式信封 `{key, value}`）⇒ 目标键 = 请求体 `key` 的取值（**必先过 `AV1`**）。
    let targetKey: string = SYSTEM_SETTINGS_KEY;
    let formBValue: unknown = null;
    const isFormB = isAppConfigEnvelope(body);
    if (isFormB) {
      // ② 信封形状（§24.1(c) ②③④）：信封多余属性 / `key` 非串 / `value` 非 object ⇒ R107 400（**不静默忽略**）
      const envVerdict = screenAppConfigEnvelope(envelope as Record<string, unknown>);
      if (!envVerdict.ok) {
        return sendVerbError(res, adminVerbError(400, envVerdict.code, envVerdict.details, envVerdict.message));
      }
      // ③ `AV1` 顶层键判定（**必在 `ops:` 派生之前** ⇒ §24.3(c)⑤：非法键不得被伪装成「缺幂等键」）
      const keyVerdict = validateAppConfigKey(envVerdict.rawKey);
      if (!keyVerdict.ok) {
        return sendVerbError(res, adminVerbError(400, keyVerdict.code, keyVerdict.details, keyVerdict.message));
      }
      targetKey = keyVerdict.key;
      formBValue = envVerdict.value;
    }

    // ④ `ops:` 幂等键**按解出的目标键**派生（`DL36` / §11.2:581 / §24.3 · **闭合 `O-3`**）——
    //   · 形态 A ⇒ `targetKey = 'system_settings'`（`AW3` 常量）⇒ 键形 `ops:<uid>:setting:system_settings` **逐字不变**；
    //   · 形态 B ⇒ `ops:<uid>:setting:<目标键名>`（如 `…:listing_deposit_policy`）⇒ **命名空间与 `system_settings` 不相交**。
    const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', targetKey);
    if (!opsKey.ok) {
      return sendVerbError(res, opsKey.error);
    }

    // ---- 形态 B 支（新）：`AV2`–`AV4`（逐键字段闭集 / 类型 / `amount` 语义域）→ 写落点 → `AW8` 响应 ----
    if (isFormB) {
      const valVerdict = validateAppConfigValue(targetKey, formBValue);
      if (!valVerdict.ok) {
        return sendVerbError(res, adminVerbError(400, valVerdict.code, valVerdict.details, valVerdict.message));
      }
      // 写落点的 `key` = **解出的目标键**（现取写死的 `'system_settings'` 字面已参数化 · §24.7 `AS1`）
      const writtenValue = await DatabaseService.saveSystemSettings(valVerdict.value, actor.session.uID, targetKey);
      // `AW8`：`data` = `{ key, value }`；`message` = spec 冻结值 `'App config key saved'`。
      sendSuccess(res, { key: targetKey, value: writtenValue }, 'App config key saved');
      return;
    }

    // ---- 形态 A 支（既有 · §24.1(f) 逐字兼容）----
    const plainBody: Record<string, unknown> = envelope ?? {};

    // §1 #33 / §4.1 #36：**禁写费率键**（费率真源 = commission_policy.fee_rate_bp，CR23/CR25）
    //   ⚠️ 批 8① 登记：该黑名单（`§7-16` 裁定 = 删除）**本单保留**（删除属接该面的实现单，`§21.5 AT1`）；
    //   它命中的键**同时**也是白名单外键 ⇒ 无论先后，**一律 400 拒**（不静默放行）。本单排它在前 = 保持既有行为。
    const feeKey = findFeeRateKey(plainBody);
    if (feeKey) {
      return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
        field: feeKey,
        reason: 'FEE_RATE_KEY_NOT_IN_APP_CONFIG',
        authoritative_table: 'commission_policy',
        authoritative_column: 'fee_rate_bp',
      }, 'Fee-rate keys are not writable via /api/admin/settings'));
    }

    // 批 8①（§21.2 `AG1`/`AG3`/`AG4`）：**逐键白名单 + 类型闸**（元规则：**不得静默放行**）。
    //   · `AG1` 未知键（含 §21.1 清单外的一切键名） ⇒ 400 + `details.reason='SETTING_KEY_NOT_IN_APP_CONFIG_WHITELIST'`
    //     （★ `R-8-10` **稳定常量**，**不随键名插值** ⇒ 可枚举 / 可映射 i18n）+ `details.unknown_keys=[...]`（逐键列出）；
    //   · `AG3`① 非 jsonb object（裸标量 / 数组 / null） ⇒ 400 + `reason='SETTING_VALUE_NOT_OBJECT'`；
    //   · `AG3`② 已知字段类型不符 ⇒ 400 + `reason='SETTING_TYPE_INVALID'` + `details.{field,expected,got}`；
    //   · `AG4`③ **整请求拒**（合法键 + 未知键混合体 ⇒ 整请求 400，合法字段**不落库**）。
    //   信封控制字段（`create_key` 等，`DL36` 幂等键载体）在判定前剥离 —— 它不是 settings 字段、不是 app_config 键。
    //   ★ 形态 A 的**目标键恒为常量** ⇒ 本支错误优先级仍 = 现取次序（闸 → `ops:` → 费率键 → 门禁），**逐字不变**。
    const verdict = screenSystemSettingsWrite(body);
    if (!verdict.ok) {
      return sendVerbError(res, adminVerbError(400, verdict.code, verdict.details, verdict.message));
    }

    const settings = await DatabaseService.saveSystemSettings(verdict.value, actor.session.uID);
    sendSuccess(res, settings, 'System settings saved');
  } catch (error) {
    // 批 8①（`AG3`① / §21.2）：DB 容器 CHECK（`app_config_value_is_container`，SQLSTATE `23514`）⇒
    //   **必须转译为项目级 `400` + 机读 reason**（**禁裸 500**）—— 正常情况下已被应用层闸拦下，本支是**兜底**。
    if (error instanceof SystemSettingsWriteError) {
      return sendVerbError(res, adminVerbError(400, error.code, error.details, error.message));
    }
    if (pgConstraintOf(error) === 'app_config_value_is_container') {
      return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
        field: 'value',
        reason: 'SETTING_VALUE_NOT_OBJECT',
        expected: 'object',
        source: 'db_container_check',
      }, 'Setting value must be a JSON object'));
    }
    // 基础设施异常 ⇒ **既有** §14 分类器（R107；修前本 catch 硬编码 `sendError(res, 400, …)` 旧形状）。
    return sendInfraMapped(res, 'admin.settings.post', error);
  }
});

// P4-B2c（§1 #34 + §5.1「一键重置设置」+ C3 ②「确认删除」）：无审计的批量破坏写 ⇒ 一律 410 + R107 形状。
// 撤 requireAdmin 前置（同 B2a/B2b 先例：弃用面不得把「已下线」伪装成「未授权」）。
const ADMIN_SETTINGS_RESET_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/admin/settings/reset', async (_req, res) => {
  return sendGone(res, '/api/admin/settings/reset', ADMIN_SETTINGS_RESET_SUNSET);
});

app.get('/api/admin/permissions', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  try {
    const [groups, users] = await Promise.all([
      DatabaseService.listPermissionGroups(),
      DatabaseService.getAllUsers(0, 1000),
    ]);
    // P4-B2c（§5.1「权限面板弃用标」/§5.3）：批 2 换数据源到 admin_role* 后即正式口 ⇒ **撤销 deprecated**。
    sendSuccess(res, { groups, users });
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'admin.permissions.get', error);
  }
});

app.post('/api/admin/permissions/save', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  // DL36 / §11.2:582：`ops:<admin_uid>:permission_save:<role_key>`
  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'permission_save', String(req.body?.id ?? 'new'));
  if (!opsKey.ok) {
    return sendVerbError(res, opsKey.error);
  }

  try {
    const result = await adminPermissionSaveVerb({
      actorUid: actor.session.uID,
      actorIsAdmin: actor.adminAccess.is_admin,
      id: req.body?.id,
      name: req.body?.name,
      description: req.body?.description,
      permissions: req.body?.permissions,
      user_ids: req.body?.user_ids,
    });
    if (!result.ok) {
      return sendVerbError(res, result);
    }
    sendSuccess(res, result.view, 'Permission group saved');
  } catch (error) {
    console.error('Error saving permission group:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to save permission group');
  }
});

app.post('/api/admin/permissions/delete', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_permissions');
  if (!actor) return;

  // DL36 / §11.2:583：`ops:<admin_uid>:permission_delete:<role_key>`
  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'permission_delete', String(req.body?.id ?? ''));
  if (!opsKey.ok) {
    return sendVerbError(res, opsKey.error);
  }

  try {
    const result = await adminPermissionDeleteVerb({ id: req.body?.id });
    if (!result.ok) {
      return sendVerbError(res, result);
    }
    sendSuccess(res, result.view, 'Permission group deleted');
  } catch (error) {
    console.error('Error deleting permission group:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to delete permission group');
  }
});

app.post('/api/admin/user/update', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_users');
  if (!actor) return;

  // DL36 / §11.2:584：`ops:<admin_uid>:user_update:<target_uid>`
  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'user_update', String(req.body?.target_uid ?? req.body?.uID ?? ''));
  if (!opsKey.ok) {
    return sendVerbError(res, opsKey.error);
  }

  try {
    const result = await adminUserUpdateVerb({ body: req.body });
    if (!result.ok) {
      return sendVerbError(res, result);
    }
    sendSuccess(res, result.view, 'User updated');
  } catch (error) {
    console.error('Error updating user:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to update user');
  }
});

// P4-B2a（§1 #39–#41【弃用→410】/ §5.1「后台发布招工」行 / §4.1 #42–#44）：管理员不再发布/改/删招工
//   一律 410 + R107 形状（code=LEDGER_REF_NOT_FOUND）+ 登记过期日（DL35 过渡条；过期日待 Kevin 定，未决 §7-1）
//   注：**不再前置 requireAdmin**——弃用面「一律 410」须在无令牌下可观测（与本批 auth/register 的先例一致）；
//       该路径已无任何副作用，故不存在信息泄露。
const ADMIN_TASK_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';
// P4-B2b：商品面弃用面的过期日（逐字取自 §5.1 每行的「过期日」列；未决 §7-1 ⇒ 上线日待 Kevin 定）
const ADMIN_PRIZE_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';
const LEGACY_REWARD_WRITE_SUNSET = '批 3 末删除路径（§5.1 碎片写口①/宝箱写口；未决 §7-1：过期日待 Kevin 定）';

app.post('/api/admin/task/create', async (_req, res) => {
  return sendGone(res, '/api/admin/task/create', ADMIN_TASK_SUNSET);
});

app.post('/api/admin/task/update', async (_req, res) => {
  return sendGone(res, '/api/admin/task/update', ADMIN_TASK_SUNSET);
});

app.post('/api/admin/task/delete', async (_req, res) => {
  return sendGone(res, '/api/admin/task/delete', ADMIN_TASK_SUNSET);
});

app.post('/api/admin/prize/create', async (_req, res) => {
  // P4-B2b：§1 #42 + §5.1「后台发布商品」+ C3 ①（整体删除）⇒ 一律 410 + R107 形状。
  // 撤 `requireAdmin` 前置：本仓 `resolveActor` 把 DB 异常吞成 401（B2a-HTTP §2 实测）⇒
  // 弃用面**不得**把「已下线」伪装成「未授权」（与 `/api/admin/task/*` 同口径）。
  return sendGone(res, '/api/admin/prize/create', ADMIN_PRIZE_SUNSET);
});

app.post('/api/admin/prize/update', async (_req, res) => {
  // P4-B2b：§1 #43 + §5.1「后台发布商品」+ C3 ①（整体删除）⇒ 一律 410 + R107 形状。
  // 撤 `requireAdmin` 前置：本仓 `resolveActor` 把 DB 异常吞成 401（B2a-HTTP §2 实测）⇒
  // 弃用面**不得**把「已下线」伪装成「未授权」（与 `/api/admin/task/*` 同口径）。
  return sendGone(res, '/api/admin/prize/update', ADMIN_PRIZE_SUNSET);
});

app.post('/api/admin/prize/delete', async (_req, res) => {
  // P4-B2b：§1 #44 + §5.1「后台发布商品」+ C3 ①（整体删除）⇒ 一律 410 + R107 形状。
  // 撤 `requireAdmin` 前置：本仓 `resolveActor` 把 DB 异常吞成 401（B2a-HTTP §2 实测）⇒
  // 弃用面**不得**把「已下线」伪装成「未授权」（与 `/api/admin/task/*` 同口径）。
  return sendGone(res, '/api/admin/prize/delete', ADMIN_PRIZE_SUNSET);
});

app.get('/api/user/all', async (req, res) => {
  // P4-B2c（§1 #45 / §4.1 #48）：只读运维视图 —— 分页（getPagination）+ **只出非敏感列**
  //（UserRecord 6 键：uID/EVM/bio/is_admin/time_reg/time_login_last）+ **禁 token**（mapper 无任何 token 列）。
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const users = await DatabaseService.getAllUsers(skip, limit);
    sendSuccess(res, users);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'user.all', error);
  }
});

app.get('/api/user/stats', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const stats = await DatabaseService.getUserStats();
    // §1 #46 / §4.1 #49 / DL1 / DL24：统计口径必须标注「账本派生」（余额真源 = account）。
    sendSuccess(res, stats, 'OK（统计口径 = 账本派生：余额取自 account，DL1/DL24）');
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'user.stats', error);
  }
});

app.get('/api/tasklist/pending-verification/count', async (req, res) => {
  // ★ S16：准入 = 「admin（持 `review_tasks`）∨ 已登录」；普通发布者只看**自己任务**上的 pending 提交
  //   （过滤 uid 与列表口**同源** = `resolveReviewQueueScope`）；未登录 ⇒ 既有 401（**不是** 403）。
  const scope = await resolveReviewQueueScope(req, res);
  if (!scope) return;

  try {
    const count = await DatabaseService.countPendingVerification(scope.employerFilterUid);
    sendSuccess(res, { count });
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'tasklist.pending.count', error);
  }
});

app.get('/api/tasklist/pending-verification', async (req, res) => {
  // ★ S16：admin（持 `review_tasks`）⇒ `employerFilterUid = null`（全局视图 · **既有行为零回归**）；
  //   普通发布者 ⇒ 仅其作为发布者（`job.employer_uid`）的任务上的 pending 提交（与 count 口同源）。
  const scope = await resolveReviewQueueScope(req, res);
  if (!scope) return;

  try {
    const { skip, limit } = getPagination(req);
    const items = await DatabaseService.listPendingVerification(skip, limit, scope.employerFilterUid);
    sendSuccess(res, items);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'tasklist.pending.list', error);
  }
});

app.post('/api/tasklist/:jID/verify', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  const approved = req.body?.approved !== false;

  try {
    // ========================================================================
    // P4-B3c（§1 #49【保留·改接】· §4.2 J5/J6 · §4.0 R4「审核通过 → 发放必须原子」）
    //   · `approve`        ⇒ `job_post_event(op='settle')` = `job_payout`×2 + `job_fee`×2 + `commission`×2N
    //   · `approved:false` ⇒ `job_post_event(op='refund')` = `job_escrow_refund`×2（`to_status='rejected'`）
    //   资金写入与 `job_submission.review_status` **结论位**在**同一条 SQL 语句**内
    //   （`DatabaseService.reviewJobSubmission`）⇒ 不存在「已审核但没发放」/「状态 settled 但没发放」。
    //   错误面统一 R107（§3.3-8）；成功面**键集冻结**（§2 母约束 F1）。
    // ========================================================================
    const result = await verifyJobSubmission({
      identifierRaw: req.params.jID,
      approved,
      actorUid: actor.user.uID,
    });
    if (!result.ok) return sendVerbError(res, result);

    // 成功面：仍由 `getTaskProgress`（9 键）产出；approve 分支再补 `task`/`user`（与改接前逐键一致）
    // ★ S3 修（`R-9-100/101`）：`getTaskProgress` 读口**已换轴 = `submission_id`**（`database.ts:2586`
    //   `s.submission_id AS "jID"`）⇒ 成功面**不得**再用申请号 `result.applicationId`（旧轴 ⇒ 会读到别的行 / miss）。
    //   改传**提交号**：与解析/结算**同源**的 URL 参数 `:jID`（`R-9-100` 起读口 identifier = `submission_id`；
    //   后台待审队列 `listPendingVerification` 与前端契约同步换轴随 S4 / S3b）。
    const submissionId = Number(req.params.jID);
    const record = await DatabaseService.getTaskProgress(submissionId);
    if (!record) {
      return sendVerbError(res, {
        ok: false,
        status: 404,
        code: 'LEDGER_REF_NOT_FOUND',
        message: 'Referenced object not found',
        details: { ref_type: 'job_submission', ref_id: String(submissionId) },
      });
    }

    if (!approved) {
      return sendSuccess(res, record, 'Task progress rejected', 200, result.replay ? { idempotent_replay: true } : undefined);
    }

    const [task, user] = await Promise.all([
      DatabaseService.getTask(record.tID),
      DatabaseService.getUserById(record.uID),
    ]);
    return sendSuccess(res, {
      ...record,
      task,
      user: user
        ? {
            uID: user.uID,
            EVM: user.EVM,
            is_admin: user.is_admin,
          }
        : null,
    }, 'Task progress verified', 200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[tasklist.verify] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

// P4-B2c（§1 #50 + §5.1「资产初始化」+ §4.1 #53「删除」+ R75）：账户由 DB 按需 0/0 开户 ⇒ 该入口无存在理由。
// 实测：该路径原本**无任何守卫**（§5.1 逐字）且旧实现返回 500（本片 T39 读数）⇒ 补齐 §5.1 的 410 面。
const ADMIN_ASSETS_INIT_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/admin/assets/init', async (_req, res) => {
  return sendGone(res, '/api/admin/assets/init', ADMIN_ASSETS_INIT_SUNSET);
});

// P4-A1-CAP（**Kevin 2026-09-30 定值**，Zang 裁定）：后台调分的**单笔上限** = 100000 `$`。
//   · 「单笔 ≤ 100000」只在此**一处**校验（**单点校验位**，紧贴入参解析；值也只在此出现一次）；
//   · 超限 ⇒ `400` + `LEDGER_AMOUNT_INVALID`（`ledger-errors.ts:49`，input 类）+ `details.reason = OVER_MAX_SINGLE_AMOUNT`
//     —— reason **复用** `currency-service.ts:125` 既有值（同族语义：金额超单笔上限），**不新造码 / 不新造 reason**；
//   · **日累计上限留后续（批 6）**；本常量**不得**改成从 `app_config` 读（那属批 6）。
const ADMIN_POINTS_ADJUST_MAX_PER_CALL = 100000;

// P6-B6-AUDIT（**Zang 2026-10-02 新定，进规格待 Jing 收口**）：后台调分的**日累计上限** =
//   1,000,000 点/日，**按操作人 + 自然日（UTC）**；**超限 ⇒ 明确拒绝 + 机读 reason + 审计留痕**。
//   · 阈值 = **服务端常量**，**客户端永不参与**；
//   · **唯一真值在 DB 编排函数** `public.admin_points_adjust_post_event`（`migrations/0023`）——
//     它**在同一函数/同一语句内**对当日审计行求和（⇒ 防并发两笔同时卡在阈值下），本常量**仅供参考/响应
//     回填**（`details.max` 的兜底），**不参与**判定 ⇒ 两侧漂移不会造成放行/误拒；
//   · 阈值 = 服务端常量，客户端永不参与。
// TODO: Kevin 定值
const ADMIN_POINTS_ADJUST_MAX_PER_DAY = 1000000;

// P4-A1-LEDGER-IMPL（Zang §5.99 裁定）：本路由由「写缺失 `asset` 表」**改接账本** `ledger_post_event`。
//   · 有符号 `amount`：`> 0` ⇒ `mint`（铸币到目标用户）；`< 0` ⇒ `burn`（从目标用户销毁）；
//     上限按**绝对值** `ADMIN_POINTS_ADJUST_MAX_PER_CALL`；`0` ⇒ 拒（既有码 + 既有 reason）。
//   · 幂等键 = 规范形 `ops:<admin_uid>:points_adjust:<target_uid>:1:<seq>`（`DL146②` / `DL36`），
//     由**既有助手** `resolveAdminOpsKey` 校验（缺键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`）；
//   · 指纹（`DL96`）= business 字段集合（`target_uid` / `cid` / `amount` / `reason_code`）；
//   · **零新造码**：本路由只用既有错误码（`LD016` / `LD021` / `LD005` / `AUTH_*`）与既有 reason。
app.post('/api/admin/points/adjust', async (req, res) => {
  const actor = await requireAdmin(req, res);
  if (!actor) return;

  try {
    const uID = parseInteger(req.body?.uID);
    const amount = parseInteger(req.body?.amount, Number.NaN);
    const reason = String(req.body?.reason || '').trim();

    if (!uID || Number.isNaN(amount) || !reason) {
      return sendError(res, 400, '参数不完整');
    }

    // ★ 8⑥ C3③（`route-layer.spec` v2.21 §32.14 · `R-9-76` = `PZ-1` 终审 (b)）：`reason` 由
    // **自由文本**收严为**枚举原因码**（关闭集 = `POINTS_ADJUST_REASONS` · 恰 7 值 · 语义域）。
    //   · **零新增错误码**（账本错误闭集 **33 不动**）⇒ 借既有码 `LEDGER_AMOUNT_INVALID`（`#17`）+ `R107` 形状；
    //   · **口径切换点 = 本行**；**历史**已落库的 4 行自由文本（`admin_ops_audit_log.memo`）**不回填 / 不改写**。
    if (!isPointsAdjustReason(reason)) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'reason', reason: 'REASON_CODE_NOT_IN_ENUM', allowed_reasons: [...POINTS_ADJUST_REASONS] },
      ));
    }

    // `route-layer.spec:840`：`LD021` = 「目标账户无效（**平台 / 保留 uid 前置闸**）」⇒ 前置拒
    // 平台 / 保留 uid（`0`/`-1`/`-2`/`-3`/`-4…-99`）：既有码 + 与 DB 侧 `ledger_uid_arg` 同 details 形状
    // （`{field, uid}`）⇒ **不得把保留 uid 当目标用户**，也**不得**让账本为其开户。
    if (uID < 0) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_RESERVED_UID',
        'Target account is invalid',
        { field: 'uid', uid: String(uID) },
      ));
    }

    // A1-CAP 单点校验位（值不变，语义由「> 0」改为「绝对值」）：`0` 与 超上限 一律 `400`
    // （同族入参码，R107 形状；`reason` 取既有值，不新造）。
    if (amount === 0) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'amount', reason: 'NOT_A_POSITIVE_INTEGER', provided: amount },
      ));
    }

    if (Math.abs(amount) > ADMIN_POINTS_ADJUST_MAX_PER_CALL) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'amount', reason: 'OVER_MAX_SINGLE_AMOUNT', max: ADMIN_POINTS_ADJUST_MAX_PER_CALL, provided: amount },
      ));
    }

    // DL36 / DL97 / DL146②：后台写必带 `ops:` 前缀幂等键（既有助手 ⇒ 零新码、零新校验代码）
    const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'points_adjust', `${uID}:1`);
    if (!opsKey.ok) {
      return sendVerbError(res, opsKey.error);
    }

    // DL96：路由层必须传 `request_fingerprint`，指纹范围 = business 字段集合（不含派生量）
    const fingerprint = createHash('sha256')
      .update(['points_adjust', String(uID), '1', String(amount), reason].join('|'))
      .digest('hex');

    const result = await DatabaseService.adjustPoints({
      actorUid: actor.session.uID,
      uID,
      amount,
      reason,
      idempotencyKey: opsKey.key,
      requestFingerprint: fingerprint,
    });

    if (result.user_found !== 1) {
      // `uid > 0` 但库内无该用户 ⇒ **不调账本、不造幽灵账户**（既有码：`LEDGER_RESERVED_UID`
      // = `400`「目标账户无效」`src/ledger-errors.ts:55`；`details` 形状与 DB 侧 `ledger_uid_arg` 同）
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_RESERVED_UID',
        'Target account is invalid',
        { field: 'uid', uid: String(uID) },
      ));
    }

    // P6-B6-AUDIT（Zang 2026-10-02 新定；裁定①/②）：**日累计闸**（阈值 1000000 点/日，按操作人 + 自然日 UTC）。
    // 闸在 **DB 编排函数内、与资金事件同一条语句**（对当日 **成功行** 求和 ⇒ 防并发两笔同时卡阈值下，
    // 且**拒绝行不计入** ⇒ 防「反复发超限请求把当日额度刷爆」）。
    // 超限 ⇒ 函数**正常返回** `ok=false` + 机读 `reason='OVER_MAX_DAILY_AMOUNT'`，
    // **零资金分录、但留一行审计**（`result='rejected_daily_cap'`，Zang 裁定①：被拒尝试必须留痕）；
    // 此处**复用既有码**（`LD016` = `LEDGER_AMOUNT_INVALID`，与既有 `OVER_MAX_SINGLE_AMOUNT` 同族），
    // **不新造码 / 不新造 reason / 不新造通道**（裁定③）。
    if (result.ok !== true) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        {
          field: 'amount',
          reason: result.reason || 'OVER_MAX_DAILY_AMOUNT',
          max: Number(result.daily_cap ?? ADMIN_POINTS_ADJUST_MAX_PER_DAY),
          used: result.daily_used === null ? null : Number(result.daily_used),
          provided: amount,
          requested: result.requested === null ? amount : Number(result.requested),
        },
      ));
    }

    // `op` 由 DB 编排函数按 `§4.10③` 逐字派生并回执（`>0 ⇒ mint`；`<0 ⇒ entries + 单腿 kind='burn'`）
    const op = result.op === 'burn' ? 'burn' : 'mint';
    return sendSuccess(res, {
      uID,
      cid: 1,
      op,
      amount,
      new_points: Number(result.new_balance ?? 0),
      timestamp: Math.floor(Date.now() / 1000),
      reason,
      txid: result.txid,
    }, op === 'mint' ? '积分调整成功（铸币）' : '积分调整成功（销毁）', 200,
      result.idempotent_replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[admin.points.adjust] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

// ============================================================================
// P4-B3a（§1.1:147-148 · §4.2 C1/C2 · §7-3）：币种面**真资金**编排（首批真资金动作）
//   · C1 `POST /api/currency`：建自定义积分单位，收 `currency_create_fee` → `-1`（消耗）
//   · C2 `POST /api/currency/:cid/list`：上市，收上市费（同 kind）+ 保证金 `listing_deposit`（冻结 HOLD）
//   · 未授权 ⇒ `401`（无 token）/ `403 AUTH_FORBIDDEN`（非货币 owner，reason=ACTOR_NOT_ALLOWED）
//   · 退市 / 罚没（`hold_release` / `hold_forfeit`）**本片不实现**（§4.2 无对应事件行 ⇒ 报告 §7-1）
// ============================================================================
app.post('/api/currency', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await createCurrencyVerb({
      actorUid: actor.user.uID,
      body: (req.body || {}) as Record<string, unknown>,
      headerKey: req.header('idempotency-key'),
    });
    if (!result.ok) return sendVerbError(res, result);
    // P6-TR-1c-A：币种 name 译文登记（前台 pending + 后台 waitUntil；失败不影响本响应）
    {
      const view = result.view as Record<string, unknown>;
      const cid = view.cid === undefined || view.cid === null ? '' : String(view.cid);
      const name = typeof view.name === 'string' ? view.name : '';
      if (cid && name.trim()) {
        await enqueueTranslation({ entityType: 'currency', entityId: cid, fields: { name }, reset: true });
      }
    }
    return sendSuccess(res, result.view, result.replay ? 'Currency created (idempotent replay)' : 'Currency created');
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[currency.create] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

app.post('/api/currency/:cid/list', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await listCurrencyVerb({
      cidRaw: req.params.cid,
      actorUid: actor.user.uID,
      body: (req.body || {}) as Record<string, unknown>,
      headerKey: req.header('idempotency-key'),
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Currency listed (idempotent replay)' : 'Currency listed');
  } catch (error) {
    const normalized = normalizeLedgerError(unwrapInfraCause(error));
    console.error('[currency.list] infra failure:', JSON.stringify(ledgerErrorDiagnostics(error)));
    return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
  }
});

// ============================================================================
// P4-B4a（§1.8「已实现·未注册清单」10 条 + 1 附注 · §9 A 栏 A1–A11）：**只做路由层注册**
// ----------------------------------------------------------------------------
// 硬口径（本片自证 · 逐条对应派单硬边界）：
//   · **不改任何服务层行为**：每个 verb 一律「取 actor → 极薄形状闸 → 交 service →
//     错误经 `sendVerbError`（R107，与既有 `POST /api/currency*`、`POST /api/tasklist/:jID/verify` 同先例）」。
//     错误码 / 状态码 / 成功面键集**全部由服务层产出** —— 本层不新造码、不改码。
//   · **不改金额来源**（§4.8）：`reward` / `price` / `quantity` 一律**原样透传**，路由层不计算、不默认、不派生。
//   · 幂等键照 §4.5 三载体：`body.create_key` / `body.idempotency_key` / `Idempotency-Key` 头（取值序同 `:589` 先例）；
//     **三载体全缺 ⇒ 不注入**（把「缺键」交给服务层的 fail-loud 判定，§4.4-14）。
//   · 成功面统一 `sendSuccess`；**重放 ⇒ 顶层 `idempotent_replay:true`（非 `data` 键）**（§4.4-17 既有标记手法）。
//   · 基础设施异常一律走**既有** §14 分类器（`normalizeLedgerError(unwrapInfraCause(e))`），同 currency 面先例。
// ============================================================================

/** §3.1 三类 404 + §3.1:454 / C1 口径：非数字或缺失 id ⇒ `404 LEDGER_REF_NOT_FOUND`（R107 形状，禁裸 400 文案） */
const sendRefNotFound = (res: Response, refType: string, refId: string, reason: string) =>
  res.status(404).json(ledgerErrorBody('LEDGER_REF_NOT_FOUND', 'Referenced object not found', {
    ref_type: refType, ref_id: refId || 'null', reason,
  }));

/**
 * ★ 批 8⑤ 归属闸（`R-8-25①` / `R-8-26` · `route-layer.spec` v2.10 §25.6）：`POST /api/job/:jobId/review`
 * （`:1884`）与 `POST /api/job/:jobId/cancel`（`:1908`）准入 = 「**该 job 的雇主本人** ∨ 持 `review_tasks`
 * 的管理员」（按已冻结 D5「雇主自审 + 平台仲裁兜底」）。
 *   · **★ 既有 admin 通道保留（`R-8-25①` 逐字：不得删除 ⇒ 零回归）** —— 非雇主支**照旧**走既有
 *     `requireAdmin(req, res, 'review_tasks')`（**不是替换**）；
 *   · 拒绝形态 = **既有** `403 AUTH_FORBIDDEN` + `details.reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`
 *     （**零新增错误码、零新增 reason 常量**：`AUTH_REASONS` 三值不动）。
 * 判定顺序（§25.6(a) 写死）：① 无 token ⇒ `401`（`requireActor`）；② `:jobId` 非数字 / job 不存在 ⇒ `404`
 * （既有 detail-miss）；③ `actor.uid == job.employer_uid` ⇒ 放行（雇主支 · 无键）；④ 否则走既有 admin 通道；
 * ⑤ 皆不满足 ⇒ 拒绝。
 * 返回放行 actor；已按既有形状落响应 ⇒ `null`。
 */
const requireJobOwnerOrAdmin = async (
  req: Request,
  res: Response,
  jobIdRaw: string,
): Promise<ActorContext | null> => {
  const actor = await requireActor(req, res);
  if (!actor) return null;

  if (!/^[1-9]\d*$/.test(jobIdRaw)) {
    sendRefNotFound(res, 'job', jobIdRaw, 'job_not_found');
    return null;
  }

  const employerUid = await DatabaseService.getJobEmployerUid(Number(jobIdRaw));
  if (employerUid === null) {
    sendRefNotFound(res, 'job', jobIdRaw, 'job_not_found');
    return null;
  }
  if (Number(actor.user.uID) === Number(employerUid)) {
    return actor; // ③ 雇主自审支（归属支 · 无键）
  }

  // ④ 既有 admin 通道（★ 保留，不得删除）；⑤ 皆不满足 ⇒ requireAdmin 落既有 403 + reason
  return requireAdmin(req, res, 'review_tasks');
};

/** 服务层/DB 抛出的基础设施异常 ⇒ 既有 §14 分类器（R107 形状；原始 message/stack 只进服务端日志，R108） */
const sendInfraMapped = (res: Response, scope: string, error: unknown) => {
  const normalized = normalizeLedgerError(unwrapInfraCause(error));
  console.error(`[${scope}] infra failure:`, JSON.stringify(ledgerErrorDiagnostics(error)));
  return res.status(normalized.httpStatus).json(toErrorResponse(normalized));
};

/** §4.5 三载体归一（仅注入 `create_key`；**不校验、不派生** —— 校验与 fail-loud 属服务层） */
const withCreateKey = (req: Request): Record<string, unknown> => {
  const body = (req.body || {}) as Record<string, unknown>;
  const raw = body.create_key ?? body.idempotency_key ?? body.idempotencyKey ?? req.get('idempotency-key') ?? undefined;
  return raw === undefined || raw === null ? body : { ...body, create_key: raw };
};

const createKeyRawOf = (req: Request): unknown =>
  req.body?.create_key ?? req.body?.idempotency_key ?? req.body?.idempotencyKey ?? req.get('idempotency-key') ?? undefined;

// ---- A1 · J1 招工发布 + 托管（§1.8 #1；`job-funds-service.ts:149` `publishJob`）--------
app.post('/api/job', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    // `create_key` 必传（fail-loud，§4.4-14）；`reward`/`cid` 原样交服务层（§4.8：金额 = A 类客户端值）
    const result = await publishJob({ actorUid: actor.user.uID, body: withCreateKey(req) });
    if (!result.ok) return sendVerbError(res, result);
    // P6-TR-1c-A：招工 title/description 译文登记（前台 pending + 后台 waitUntil；失败不影响本响应）
    {
      const view = result.view as Record<string, unknown>;
      const jobId = view.job_id === undefined || view.job_id === null ? '' : String(view.job_id);
      const title = typeof req.body?.title === 'string' ? req.body.title : '';
      const description = typeof req.body?.description === 'string' ? req.body.description : '';
      const fields: Record<string, string> = {};
      if (title.trim()) fields.title = title;
      if (description.trim()) fields.description = description;
      if (jobId && Object.keys(fields).length) {
        await enqueueTranslation({ entityType: 'job', entityId: jobId, fields });
      }
    }
    return sendSuccess(res, result.view, result.replay ? 'Job published (idempotent replay)' : 'Job published', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'job.publish', error);
  }
});

// ---- A2 · J2 报名【★ S3 下架 · `R-9-103`】—— 旧模型（管理员后台发 task/reward）废弃 ---------
//   `R-9-99` 取消「报名 / 选定」两个环节（提交即参与）⇒ `POST /api/job/:jobId/apply` **退役** ⇒ **`410 Gone`**。
//   硬边界：**在访问任何表之前**直接 `410` —— handler 路径**零表访问 / 零副作用**（旧实现体经 `applyToJob`
//   ⇒ `DatabaseService.applyToJob` 写 `job_application`；`job_application` 已**停写**（`R-9-100` 保留历史行））。
//   形状 = **照抄既有 410 面**（同一共享产出器 `./job-service` `ledgerErrorBody` ⇒ R107 `{error:{code,message,i18n_key,details}}`，
//   code=`LEDGER_REF_NOT_FOUND`，`i18n_key=ledger.err.LEDGER_REF_NOT_FOUND`，details={`ref_type`,`ref_id`,`http_status`,`sunset`,`reason`}）；
//   **机读 reason** 落 `details.reason` = 稳定常量 **`APPLY_RETIRED`**（`route-layer.spec` v2.23 §34.7）。
//   撤 `requireActor` 前置（同 `CLAIM_RETIRED` / B2a/B2b 先例：弃用面不得把「已下线」伪装成「未授权」；零副作用 ⇒ 无令牌下亦可观测 410）。
const APPLY_RETIRED_REASON = 'APPLY_RETIRED';
const APPLY_RETIRED_REF_ID = '/api/job/:jobId/apply';
const APPLY_RETIRED_SUNSET = '任务模型改造（`R-9-103`）sunset（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/job/:jobId/apply', (_req, res) => {
  return res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${APPLY_RETIRED_REF_ID}`,
    {
      ref_type: 'endpoint',
      ref_id: APPLY_RETIRED_REF_ID,
      http_status: 410,
      sunset: APPLY_RETIRED_SUNSET,
      reason: APPLY_RETIRED_REASON,
    },
  ));
});

// ---- A3 · J3 雇主选定打工人【★ S3 下架 · `R-9-103`】—— 「选定」环节已取消 -------------------
//   `R-9-99` 取消「选定」环节 ⇒ `POST /api/job/:jobId/accept` **退役** ⇒ **`410 Gone`**。
//   形状 / 硬边界 / 撤 `requireActor` 口径与上条 `apply` 面**逐字同源**（同一 `ledgerErrorBody` R107 产出器）；
//   `details.reason` 稳定常量 = **`ACCEPT_RETIRED`**（`route-layer.spec` v2.23 §34.7）。
const ACCEPT_RETIRED_REASON = 'ACCEPT_RETIRED';
const ACCEPT_RETIRED_REF_ID = '/api/job/:jobId/accept';
const ACCEPT_RETIRED_SUNSET = '任务模型改造（`R-9-103`）sunset（未决 §7-1：过期日待 Kevin 定）';

app.post('/api/job/:jobId/accept', (_req, res) => {
  return res.status(410).json(ledgerErrorBody(
    'LEDGER_REF_NOT_FOUND',
    `endpoint deprecated: ${ACCEPT_RETIRED_REF_ID}`,
    {
      ref_type: 'endpoint',
      ref_id: ACCEPT_RETIRED_REF_ID,
      http_status: 410,
      sunset: ACCEPT_RETIRED_SUNSET,
      reason: ACCEPT_RETIRED_REASON,
    },
  ));
});

// ---- A4 · J4 提交交付物（**可选别名**；§1.8 #4「服务已接线、仅新路径名未注册」）----------
// 与既有 `POST /api/task-progress/:identifier/submit`（`:583`）**同 service verb ⇒ 成功面键集逐键一致**（§2 母约束 F1）；
// 交付物字段名以 §4.2 J4 的 `deliverable` 为准，**兼容**既有前端在用的 `info_input`（既有路径逐字）。
app.post('/api/job/:jobId/submit', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const identifier = parseInteger(req.params.jobId);
  const deliverable = String(req.body?.deliverable ?? req.body?.info_input ?? '').trim();

  // ★ S3（同族扫面·申请轴落点收口）：`identifier` = 目标 `job_id`（`R-9-99`）⇒ miss 标签撤 `job_application`，改 `job`。
  if (!identifier) return sendRefNotFound(res, 'job', String(req.params.jobId ?? ''), 'job_not_found');
  if (!deliverable) return sendError(res, 400, 'info_input is required'); // 与既有 `:595` 逐字一致（别名面）

  try {
    const result = await submitWork({
      identifier,
      workerUid: actor.user.uID,
      deliverable,
      createKeyRaw: createKeyRawOf(req),
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Task progress submitted', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'job.submit', error);
  }
});

// ---- A5 · J5/J6 审核（approve ⇒ settle / reject ⇒ refund `to_status='rejected'`）----------
// 权限（**批 8⑤ 归属闸** · `R-8-25①` · `route-layer.spec` v2.10 §25.6）：准入 = 「该 job 的**雇主本人**
//   ∨ 持 `review_tasks` 的管理员」（按已冻结 D5「雇主自审 + 平台仲裁兜底」）；**★ 既有 admin 通道保留**
//   （`requireJobOwnerOrAdmin` 的 OR 一支 ⇒ **零回归**）。
// `req.body.approved !== false` ⇒ settle（`settleJob`），`=== false` ⇒ refund（`refundJob`）—— 前端契约同 `:1103`。
// ★ S6（`R-9-100`/`R-9-101`）· **逐笔判定**：body 可选 `submission_id`（兼容别名 `submissionId`）
//   ⇒ 原样转发服务层 `settleJob({submissionIdRaw})`（S4a 已收该入参 ⇒ 结算键/指纹含提交号、
//   `review_status='approved'` 与资金**同一语句**）；**不带提交号 ⇒ 旧调用逐字走遗留单笔分支（零回归）**。
//   ★ spec 现取（未冻结该 body 形态）：已冻结面 = **路径 `POST /api/job/:jobId/review` + body `{approved}`
//   + 成功键集 15 键**（`route-layer.spec.md:33/91` · §1.11 Q7），**未冻结「提交号字段名」** ⇒ 本片取
//   **最小变体** `{approved, submission_id}`（别名 `submissionId`）⇒ **待 Jing 回写 spec**（登记见报告）。
//   ★ S6b（`R-9-99`/`R-9-101`）· **逐笔 reject 接线**：带提交号 + `approved:false` ⇒ **按提交判不合格**
//   （零资金 · 只落该提交 `review_status='rejected'` · **job 保持 `open`** ⇒ 同人可再提），
//   走 S4a 已入库服务层 `DatabaseService.rejectJobSubmission`（**不另写**）。
//   修前事实（严重错误）：`approved:false` **恒走** `refundJob` 整单退（退**整单** + job→`rejected`）⇒ 带提交号时
//   会误退整单并取消任务。现按「**带提交号** vs **不带提交号**」分支化：
//     · 带提交号 + `approved:true`  ⇒ `settleJob({submissionIdRaw})`（S6 已接 · 逐笔发放，R4 原子）；
//     · 带提交号 + `approved:false` ⇒ `rejectJobSubmission`（逐笔 · 零资金 · 该提交 `rejected` · job 保持 `open`）；
//     · **不带提交号** ⇒ **保持现行为（零回归）**：`approved:true` 走遗留单笔 `settleJob`；`approved:false` 整单 `refundJob`。
app.post('/api/job/:jobId/review', async (req, res) => {
  const jobIdRaw = String(req.params.jobId ?? '').trim();
  const actor = await requireJobOwnerOrAdmin(req, res, jobIdRaw);
  if (!actor) return;

  const approved = req.body?.approved !== false;
  // ★ S6/S6b：逐笔提交号（canonical `submission_id`，兼容别名 `submissionId`；三者全缺 ⇒ 遗留分支）
  const submissionIdRaw = req.body?.submission_id ?? req.body?.submissionId;
  const hasSubmission = submissionIdRaw !== undefined && submissionIdRaw !== null
    && String(submissionIdRaw).trim() !== '';

  try {
    // ★★ S6b：带提交号 + 判不合格 ⇒ **逐笔驳回**（零资金 · 该提交 `rejected` · job 保持 `open`）。
    if (hasSubmission && !approved) {
      const subIdText = String(submissionIdRaw).trim();
      const subRefMissing = {
        ok: false as const, status: 404, code: 'LEDGER_REF_NOT_FOUND', message: 'Referenced object not found',
        details: { ref_type: 'job_submission', ref_id: subIdText || 'null', field: 'submission_id',
          reason: 'submission_not_found', job_id: jobIdRaw },
      };
      if (!/^\d+$/.test(subIdText) || Number(subIdText) <= 0) return sendVerbError(res, subRefMissing);
      // 归属校核：该提交必须属于本 job（防「以 job A 的归属权驳回 job B 的提交」跨 job 越权）。
      const target = await DatabaseService.resolveReviewTarget(Number(subIdText));
      if (!target || String(target.jobId) !== jobIdRaw) return sendVerbError(res, subRefMissing);
      const rejected = await DatabaseService.rejectJobSubmission({
        submissionId: Number(subIdText),
        reviewedBy: actor.user.uID,
        reviewMemo: `job reject:${jobIdRaw}:${subIdText}`,
      });
      if (rejected <= 0) {
        return sendVerbError(res, {
          ok: false as const, status: 409, code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
          message: 'Business state transition rejected',
          details: { field: 'job_submission.review_status', reason: 'job_review_status_invalid',
            from: target.submissionStatus, to: 'rejected', submission_id: subIdText },
        });
      }
      const record = await DatabaseService.getTaskProgress(Number(subIdText));
      return sendSuccess(res, record ?? {
        submission_id: subIdText, job_id: jobIdRaw, worker_uid: String(target.workerUid), review_status: 'rejected',
      }, 'Job submission rejected');
    }

    const result = approved
      ? await settleJob({ jobIdRaw, submissionIdRaw, reviewerUid: actor.user.uID }) // 审核人 ⇒ 结论位与资金**同一语句**（R4 原子）
      : await refundJob({ jobIdRaw, toStatusRaw: 'rejected', reviewerUid: actor.user.uID });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, approved ? 'Job settled' : 'Job rejected', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'job.review', error);
  }
});

// ---- A5b · S6 逐条提交读口（`GET /api/job/:jobId/submissions`）--------------------------
// ★ 路径 = **spec 已冻结**（`docs/data-layer.spec.md:281`：「路由 `GET /api/job/:jobId/submissions`」）；
//   **返回形状 / 字段名 spec 未冻结** ⇒ 本片取**最小列集**（提交号 / 任务号 / 提交人 / 交付物 /
//   审核状态 / 审核人 / 审核时点 / 审核备注 / 提交时点）⇒ **待 Jing 回写 spec**（登记见报告）。
// 准入（Zang 裁 D · 与 `/review` 同族）= 「该 job 的**雇主本人** ∨ 持 `review_tasks` 的管理员」——
//   **复用既有 `requireJobOwnerOrAdmin`（不另写）**：① 无 token ⇒ 401；② `:jobId` 非数字 / job 不存在
//   ⇒ 404（既有 detail-miss）；③ 雇主本人 ⇒ 放行；④ 否则既有 admin 通道；⑤ 皆不满足 ⇒ 既有
//   `403 AUTH_FORBIDDEN` + `reason ∈ {NOT_ADMIN, PERMISSION_NOT_GRANTED}`（**零新增码 / 零新增 reason**）。
//   ★ 惯例对照（登记）：同族读口 `/api/task-progress/:jID`（`:885`）对「已登录取非本人」取 **404**
//   （不泄漏存在性）；本口**取 403** —— 因它复用「雇主 ∨ admin」归属闸（既有冻结形态 = 403），
//   且 job 本身是公开对象（列表可见）⇒ 存在性非秘密。**待 Zang 复核**（见报告§同族扫面）。
app.get('/api/job/:jobId/submissions', async (req, res) => {
  const jobIdRaw = String(req.params.jobId ?? '').trim();
  const actor = await requireJobOwnerOrAdmin(req, res, jobIdRaw);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const submissions = await DatabaseService.listJobSubmissions(Number(jobIdRaw), skip, limit);
    setPrivateNoStore(res); // 交付物正文属隐私面（R-9-86 同向）⇒ 私有、禁缓存
    return sendSuccess(res, submissions);
  } catch (error) {
    return sendInfraMapped(res, 'job.submissions', error);
  }
});

// ---- A6 · J6 取消 → 退托管（§1.8 #6；`job-funds-service.ts:237` `refundJob`，`to_status='cancelled'`）----
// 权限（**批 8⑤ 归属闸** · `R-8-26` · `route-layer.spec` v2.10 §25.6）：准入 = 「**雇主本人** ∨ 持
//   `review_tasks`」；**★ 既有 admin 通道保留**（`requireJobOwnerOrAdmin` 的 OR 一支 ⇒ **零回归**）。
//   （原注释「雇主可取消自己的招工…登记待 Zang 裁定」由 `R-8-26` 收口 ⇒ 本片兑现。）
//   并**不传 `reviewerUid`**（服务层注释口径：「无审核人 ⇒ 只做资金 + 业务行状态」⇒ 不写结论位）。
app.post('/api/job/:jobId/cancel', async (req, res) => {
  const jobIdRaw = String(req.params.jobId ?? '').trim();
  const actor = await requireJobOwnerOrAdmin(req, res, jobIdRaw);
  if (!actor) return;

  try {
    const result = await refundJob({ jobIdRaw, toStatusRaw: 'cancelled' });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Job cancelled (idempotent replay)' : 'Job cancelled', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'job.cancel', error);
  }
});

// ---- A7 · P1-a 商品上架（§1.8 #7；`listing-service.ts:164` `createListing`）--------------
app.post('/api/listing', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const body = withCreateKey(req);
    const result = await createListing({
      sellerUid: actor.user.uID, // 卖家恒 = token 侧 actor（保留 uid 前置闸在服务层）
      cid: body.cid as number,
      price: body.price as number, // §4.8：A 类客户端值，原样交服务层（不计算、不默认）
      stock: body.stock as number,
      title: body.title,
      description: body.description,
      mediaUrls: body.media_urls,
      createKeyRaw: body.create_key,
    });
    if (!result.ok) return sendVerbError(res, result);
    await enqueueListingTranslation(result.view); // 上架（新建）⇒ 登记 title/description
    return sendSuccess(res, result.view, result.replay ? 'Listing created (idempotent replay)' : 'Listing created', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'listing.create', error);
  }
});

// ---- A8-a · P1-b 商品编辑（§1.8 #8；`listing-service.ts:222` `updateListing`）-------------
// 语义分工（§9 A8 的 `POST|PATCH` 两 verb）：**`POST` = 编辑**（字段增量维护）/ **`PATCH` = 状态迁移（下架等）**。
app.post('/api/listing/:listingId', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const listingId = parseInteger(req.params.listingId);
  if (!listingId || listingId <= 0) return sendRefNotFound(res, 'listing', String(req.params.listingId ?? ''), 'listing_not_found');

  const body = (req.body || {}) as Record<string, unknown>;
  try {
    const result = await updateListing({
      listingId,
      actorUid: actor.user.uID, // 非卖家 ⇒ 服务层 403 + ACTOR_NOT_ALLOWED
      price: body.price,
      stock: body.stock,
      title: body.title,
      description: body.description,
      mediaUrls: body.media_urls,
    });
    if (!result.ok) return sendVerbError(res, result);
    await enqueueListingTranslation(result.view, true); // 编辑 ⇒ 内容可能变更，重置回 pending
    return sendSuccess(res, result.view, 'Listing updated');
  } catch (error) {
    return sendInfraMapped(res, 'listing.update', error);
  }
});

// ---- A8-b · P1-c 商品状态迁移（上架 / 下架 / 冻结 / 复牌；`:286` `transitionListingStatus`）----
// `delisted` = 终态禁改（§7-18）；白名单唯一真源 = `public.listing_status_transition_ok`（服务层交 DB）。
app.patch('/api/listing/:listingId', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const listingId = parseInteger(req.params.listingId);
  if (!listingId || listingId <= 0) return sendRefNotFound(res, 'listing', String(req.params.listingId ?? ''), 'listing_not_found');

  try {
    // 入参别名：`to_status`（§4.2 P1 状态机口径）/ `status`（前端常见写法）—— 二者皆缺 ⇒ 交服务层判 400
    const result = await transitionListingStatus({
      listingId,
      actorUid: actor.user.uID,
      toStatus: req.body?.to_status ?? req.body?.status ?? '',
    });
    if (!result.ok) return sendVerbError(res, result);
    await enqueueListingTranslation(result.view); // 状态迁移（title/description 未变）⇒ 不重置回 pending
    return sendSuccess(res, result.view, 'Listing status transitioned');
  } catch (error) {
    return sendInfraMapped(res, 'listing.transition', error);
  }
});

// ---- A9 · P2 商品下单（§1.8 #9；`listing-funds-service.ts:191` `buyListing`）-------------
// §4.7.3 B8：客户端传的 `price`/`seller_uid`/`buyer_uid` 一律**被服务层忽略**（金额与对手方服务端取数）；
// `listing_id` 的形状闸在服务层（非数字/0 ⇒ 404 `listing_not_found`）。
app.post('/api/listing/:listingId/buy', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await buyListing({
      actorUid: actor.user.uID, // 买方恒 = token 侧 actor（代他人付款结构上不可能）
      listingIdRaw: req.params.listingId,
      body: withCreateKey(req),  // `cli:` `create_key` 必传（fail-loud，§4.4-14）
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Listing purchased (idempotent replay)' : 'Listing purchased', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'listing.buy', error);
  }
});

// ---- A10 · P4 商品退款（**路径正典** `/api/listing-orders/:orderId/refund`，§7-37）--------
// ★ P7-B（§7-32「管理员退款发起」· §12.11.4 / Z1 / Z6）：**注册点 68 不变**、**前端零改动**。
//   actor 分流顺序（写死）：`requireActor`（token 侧取 actor，客户端不得声明）⇒ ① 卖方 ⇒ 卖方路；
//   ② 否则 `can_access_admin ∧ manage_points` ⇒ 管理员路（含**兼买方禁令**）；③ 否则 403。
//   **准入真源 = 服务层 `resolveRefundActorRoute`（纯函数单点）** —— 本层**不复制**该闸，
//   只把 token 侧 `adminAccess` 注入（§6.1 单一真源；客户端不得声明 actor / 权限）。
//   ⇒ 闸**必早于任何资金调用**（§12.3 G6）：401/403 时服务层在 `listingRefundPostEvent` 之前返回。
app.post('/api/listing-orders/:orderId/refund', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const result = await refundListingOrder({
      actorUid: actor.user.uID,
      orderIdRaw: req.params.orderId,
      adminAccess: actor.adminAccess,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Listing order refunded (idempotent replay)' : 'Listing order refunded', 200,
      result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'listing.refund', error);
  }
});

// ---- A11 · R3 佣金政策插行（§1.8 附注；`src/commission.ts:240` `insertCommissionPolicy`）----
// · **无分录**（INSERT-only 政策表）；`created_by` 由 token 侧 admin 注入（不得由调用方自报）；
// · `effective_from` 严格递增（CR25）；越界/回填 ⇒ 服务层 `400 LD016` + `FEE_RATE_OUT_OF_RANGE` /
//   `POLICY_SHAPE_INVALID` / `POLICY_EFFECTIVE_BACKDATED` → 经既有 §14 分类器原码/原 status 映射（§3.3-4）；
// · **不改金额来源**（§4.8）：本端点只「插一行新政策」，既有政策与在途结算不受影响（`effective_from > now` 时）。
// · 权限：spec 未点名 ⇒ 本片取 §1 #33 指认的权威表同域权限 `manage_settings`（`:872` 同族先例）—— 登记 §7 待裁。
app.post('/api/admin/commission_policy', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  const body = (req.body || {}) as Record<string, unknown>;
  const effectiveFrom = body.effective_from === undefined || body.effective_from === null
    || String(body.effective_from).trim() === ''
    ? null : String(body.effective_from);

  try {
    const policy = await insertCommissionPolicy({
      fee_rate_bp: Number(body.fee_rate_bp),
      levels: Number(body.levels),
      // 非数组 ⇒ 传空数组（让服务层守卫判 `POLICY_SHAPE_INVALID` 400；**不在此层造码**）
      weights_bp: Array.isArray(body.weights_bp) ? body.weights_bp.map((w) => Number(w)) : [],
      effective_from: effectiveFrom,
      created_by: actor.user.uID,
    });
    return sendSuccess(res, policy, 'Commission policy inserted');
  } catch (error) {
    return sendInfraMapped(res, 'admin.commission_policy', error);
  }
});

// ---- 8② · A12 佣金政策**读口**（运营后台展示现行费率 + 返佣权重矩阵）--------------------------
// 契约真源 = `docs/route-layer.spec.md` v2.4 **§19.2(b)**（本片冻结新增；`§7-70`）：
//   · 路径 / 方法 = `GET /api/admin/commission_policy`（**同路径同族先例** = `GET|POST /api/admin/settings`，
//     即只换 verb，不得另造路径）⇒ **注册点 68 → 69**（§1.14 增量登记；表体未动）；
//   · 闸 = `manage_settings`（与写口**同键**；11 键内，`R-8-1` ⇒ **零新增权限键**）；
//   · 响应形状 = **R107 口径**（成功 `{success,message,data}` / 失败 `{error:{code,message,i18n_key,details}}`）；
//     `data` = **形态 A** = `CommissionPolicy` **恰 8 键本体**（与写口成功响应同形）——「合片」的数据面依据；
//   · 取数口径 = **复用** `src/commission.ts:201` `getCommissionPolicy`（**不得自写第二套取数**，§19.2(c)）；
//     **CR4**：`at` **不得**暴露为对外查询参数 ⇒ 只取「当前生效政策」（`T = DB now()`）；
//   · 只读纪律：**只 `SELECT`**；不得引入任何写路径 / 回填 / 修正（政策表 append-only，`0007:102-112`）；
//   · `ops:` 幂等键 = **无**（读口无副作用；先例 = `GET /api/admin/settings`，§19.2(b)）；
//   · **R-8-6 双向判负**：本读口 = **运营后台功能需求**，**不得**承载 §19.4 的**验收**读数（两条线不混同）。
app.get('/api/admin/commission_policy', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  try {
    const policy = await getCommissionPolicy();
    return sendSuccess(res, policy, 'Commission policy (current effective)');
  } catch (error) {
    return sendInfraMapped(res, 'admin.commission_policy.get', error);
  }
});

// ============================================================================
// 批 8④（`route-layer.spec` v2.8 §23 · `data-layer.spec` v0.15 §26）：自建单位审核（变体 Ⅱ 旁路台账）
//   · 读口 `GET /api/admin/currency`（§23.2；闸 = `review_tasks`；注册点 **69 → 70**）
//   · 动作口 `POST /api/admin/currency/:cid/review`（§23.3；闸 = `review_tasks`；注册点 **→ 71**）
// 权限键 = `review_tasks`（§23.6：11 键零增删 · `R-8-1`/`R-8-8`）；**零新增错误码**（33 码闭集不动）。
// ============================================================================

// ---- 读口 · `GET /api/admin/currency`（`data` 键集自本片起冻结：§23.2）----------------------------
//   · `?status=<draft|listed|frozen|delisted>` 允许过滤；**非法值 ⇒ 400**（**不得静默回落**）；
//   · 只读（只 `SELECT`）；**不得**借读口补写（`DL23` 同向）；无 `ops:` 键（读口无副作用）。
app.get('/api/admin/currency', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const filter = parseStatusFilter(req.query?.status);
    if (!filter.ok) return sendVerbError(res, filter.err);
    const rows = await DatabaseService.listCurrenciesForAdmin(filter.status);
    return sendSuccess(res, rows, 'Currency list (admin)');
  } catch (error) {
    return sendInfraMapped(res, 'admin.currency.list', error);
  }
});

// ---- 动作口 · `POST /api/admin/currency/:cid/review`（通过 / 驳回 双路径；§23.3）------------------
//   · 请求体逐字 = `{ action: "approve" | "reject", reason: <string> }`（`action` 闭集恰 2 值；
//     `reason` 必填 / 非空 —— **驳回必须给 reason**）；
//   · `ops:` 幂等键 = `ops:<admin_uid>:currency_review:<cid>`（既有助手 `resolveAdminOpsKey`；缺键 ⇒ 400）；
//   · 通过 ⇒ 台账行 + 同事务 `draft → listed` + `currency_status_log` 恰 1 行；驳回 ⇒ 台账行（必须落）；
//   · `:cid` 非数字 / `cid<=0` / 不存在 ⇒ 404（既有 `LD007`）；非 `draft` ⇒ 409（既有 `LD011`）。
app.post('/api/admin/currency/:cid/review', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    // `:cid` 形状闸**先于**幂等键解析（§23.3(c)#1#2：非数字 / `cid<=0` ⇒ 404，**不得静默按 0 处理**）。
    const cidText = String(req.params.cid ?? '').trim();
    if (!/^[1-9]\d*$/.test(cidText)) return sendVerbError(res, reviewCurrency404(cidText));

    // DL36 / DL146②：后台写必带 `ops:` 前缀幂等键（既有助手 ⇒ 零新码、零新校验代码）。
    const opsKey = resolveAdminOpsKey(req, actor.session.uID, CURRENCY_REVIEW_OPS_ACTION, cidText);
    if (!opsKey.ok) return sendVerbError(res, opsKey.error);

    const result = await reviewCurrencyVerb({
      cidRaw: req.params.cid,
      actorUid: actor.session.uID,
      body: (req.body || {}) as Record<string, unknown>,
      opsKey: opsKey.key,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view,
      result.replay ? 'Currency review recorded (idempotent replay)' : 'Currency review recorded',
      200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'admin.currency.review', error);
  }
});

// ============================================================================
// 批 8⑤（`route-layer.spec` v2.10 §25 · `data-layer.spec` v0.17 §28）：合规审核（商品 / 招工仲裁 · 变体 Ⅱ 旁路台账）
//   · 读口 `GET /api/admin/listing`（§25.2；闸 = `review_tasks`；注册点 **71 → 72**）
//   · 动作口 `POST /api/admin/listing/:listingId/takedown`（§25.2；闸 = `review_tasks`；注册点 **→ 73**）
//   · 读口 `GET /api/admin/arbitration`（§25.2；闸 = `review_tasks`；注册点 **→ 74**）
//   · 动作口 `POST /api/admin/arbitration/:jobId`（§25.2；闸 = `review_tasks`；注册点 **→ 75**）
// 权限键 = `review_tasks`（§25.5：11 键零增删 · `R-8-1`/`R-8-8`）；**零新增错误码**（33 码闭集不动）。
// ============================================================================

// ---- 读口 · `GET /api/admin/listing`（`data` 键集自本片起冻结：§25.2 / §24.8(b)）------------------
//   · `?status=<draft|listed|delisted|frozen>` 允许过滤；**非法值 ⇒ 400**（**不得静默回落**）；
//   · 只读（只 `SELECT`）；**不得**借读口补写（`DL23` 同向）；无 `ops:` 键（读口无副作用）。
app.get('/api/admin/listing', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const filter = parseListingStatusFilter(req.query?.status);
    if (!filter.ok) return sendVerbError(res, filter.err);
    const rows = await DatabaseService.listListingsForAdmin(filter.status);
    return sendSuccess(res, rows, 'Listing list (admin)');
  } catch (error) {
    return sendInfraMapped(res, 'admin.listing.list', error);
  }
});

// ---- 动作口 · `POST /api/admin/listing/:listingId/takedown`（通过 / 驳回 双路径；§25.2 / §28.2(d)）----
//   · 请求体逐字 = `{ action: "approve" | "reject", reason: <string>, target_status?: "delisted" | "frozen" }`
//     （`action` 闭集恰 2 值；`reason` 必填 / 非空 —— **驳回必须给 reason**；`target_status` 缺省 = `delisted`）；
//   · `ops:` 幂等键 = `ops:<admin_uid>:listing_takedown:<listingId>`（既有助手 `resolveAdminOpsKey`；缺键 ⇒ 400）；
//   · 通过 ⇒ 台账行 + 同事务 `listed → delisted|frozen`（**既有已白名单边**）；驳回 ⇒ 台账行（**必须落**）、`listing.status` 不动；
//   · `:listingId` 非数字 / `listingId<=0` / 不存在 ⇒ 404；非 `listed` ⇒ 409（既有 `LD011`）。
app.post('/api/admin/listing/:listingId/takedown', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    // `:listingId` 形状闸**先于**幂等键解析（§25.3(b)#1#2：非数字 / `<=0` ⇒ 404，**不得静默按 0 处理**）。
    const listingIdText = String(req.params.listingId ?? '').trim();
    if (!/^[1-9]\d*$/.test(listingIdText)) return sendVerbError(res, listing404(listingIdText));

    // DL36 / DL146②：后台写必带 `ops:` 前缀幂等键（既有助手 ⇒ 零新码、零新校验代码）。
    const opsKey = resolveAdminOpsKey(req, actor.session.uID, LISTING_TAKEDOWN_OPS_ACTION, listingIdText);
    if (!opsKey.ok) return sendVerbError(res, opsKey.error);

    const result = await reviewListingTakedownVerb({
      listingIdRaw: req.params.listingId,
      actorUid: actor.session.uID,
      body: (req.body || {}) as Record<string, unknown>,
      opsKey: opsKey.key,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view,
      result.replay ? 'Listing takedown recorded (idempotent replay)' : 'Listing takedown recorded',
      200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'admin.listing.takedown', error);
  }
});

// ---- 读口 · `GET /api/admin/arbitration`（`data` 键集自本片起冻结：§25.2 / §24.8(b)）-------------
//   · `?status=<七值之一>` 允许过滤；**非法值 ⇒ 400**（不得静默回落）；只读；无 `ops:` 键。
app.get('/api/admin/arbitration', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const filter = parseJobStatusFilter(req.query?.status);
    if (!filter.ok) return sendVerbError(res, filter.err);
    const rows = await DatabaseService.listJobsForArbitration(filter.status);
    return sendSuccess(res, rows, 'Arbitration list (admin)');
  } catch (error) {
    return sendInfraMapped(res, 'admin.arbitration.list', error);
  }
});

// ---- 动作口 · `POST /api/admin/arbitration/:jobId`（平台仲裁兜底；§25.2 / §25.6(d) / §28.2(d)）----
//   · 请求体逐字 = `{ action: "approve" | "reject", reason: <string> }`（`action` 闭集恰 2 值；`reason` 必填 / 非空）；
//     候选人 / 标的物走 body 显式字段（`R-8-27` I-4：路径不再加层级）；
//   · `ops:` 幂等键 = `ops:<admin_uid>:job_arbitrate:<job_id>`（**★ 既有逐字** = `data-layer.spec.md:509`）；
//   · 通过 ⇒ 台账行 + 同事务 `submitted→disputed→settled`（支持雇主）；驳回 ⇒ 台账行（**必须落**）+
//     同事务 `submitted→disputed→cancelled`（退单 / 支持打工人）+ **资金腿** `job_escrow_refund` ×2；
//   · `:jobId` 非数字 / `<=0` / 不存在 ⇒ 404；非 `submitted`·非 `disputed` ⇒ 409（既有 `LD011`）。
app.post('/api/admin/arbitration/:jobId', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const jobIdText = String(req.params.jobId ?? '').trim();
    if (!/^[1-9]\d*$/.test(jobIdText)) return sendVerbError(res, job404(jobIdText));

    const opsKey = resolveAdminOpsKey(req, actor.session.uID, JOB_ARBITRATE_OPS_ACTION, jobIdText);
    if (!opsKey.ok) return sendVerbError(res, opsKey.error);

    const result = await arbitrateJobVerb({
      jobIdRaw: req.params.jobId,
      actorUid: actor.session.uID,
      body: (req.body || {}) as Record<string, unknown>,
      opsKey: opsKey.key,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view,
      result.replay ? 'Job arbitration recorded (idempotent replay)' : 'Job arbitration recorded',
      200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'admin.arbitration.record', error);
  }
});

// ============================================================================
// 8⑥（`route-layer.spec` v2.21 §32.14 · 终审 `R-9-74`/`R-9-77`/`R-9-78`/`R-9-79`）：审计台统一读口
//   · 读口 `GET /api/admin/audit/:table`（变体 Ⅰ · **注册点 87 → 88** · `+1` get）；
//   · 闸 = **`manage_audit`**（`R-9-75` 新增权限键 · 闭集 11 → 12；`requireAdmin` 既有出口）；
//   · 表名**白名单闭集 14 面**（`R-9-74`/`R-9-77` · 排除 `app_config`）；**非白名单 ⇒ `400`**；
//   · 五类过滤（`actor`/`target`/`action`/时间窗 `from`·`to`/关联 id `refId`）**逐表映射显式表达**
//     （`audit-console.ts` 结构化白名单 · **禁拼 SQL 字符串**）；不适用参数 ⇒ `400` + 列该表支持维度（`R-9-78`）；
//   · keyset 分页（`limit` 默认 50 / 上限 100；`(timeColumn DESC, <pk> DESC)` · `R-9-79`）；
//   · **只读**（§32.10）：仅 `SELECT`，不动任何 `append-only` 留痕面；**零新增码**（闭集 33）；`R107` 形状。
// ============================================================================
app.get('/api/admin/audit/:table', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_audit');
  if (!actor) return;

  try {
    const parsed = parseAuditRequest(req.params.table, req.query as Record<string, unknown>);
    if (!parsed.ok) return sendVerbError(res, parsed.err);
    const { text, params } = buildAuditSql(parsed.plan);
    const rows = await DatabaseService.readAuditPage(text, params);
    return sendSuccess(res, buildAuditView(parsed.plan, rows), 'Audit page (admin · read-only)');
  } catch (error) {
    return sendInfraMapped(res, 'admin.audit.read', error);
  }
});

// ---- P6-TR-1b · 后台翻译回填（`vercel.json` cron：每日 UTC 18:00 = 北京 02:00 = DeepSeek 低峰）------
// 鉴权：`Authorization: Bearer <CRON_SECRET>` **或** `x-cron-secret: <CRON_SECRET>`（二者取一即可）。
//   · **未配 CRON_SECRET ⇒ 503 fail-loud，绝不默认放行**（安全红线）；
//   · 密钥只做相等比较，**绝不回显/日志**其值。
// 幂等：服务层 ON CONFLICT upsert + 缓存命中不重复付费 ⇒ 重复调用不产生重复行。
// 回执（机读，**TR-1c-B 扩展键、不删旧键**）：
//   翻译面 { processed(=scanned), ready, failed, skipped, deferred, retried, reason, engine }
//   扫描面 { mode, scan_scanned, scan_registered, scan_existing, scan_by_entity }
// ---------------------------------------------------------------------------
// **P6-TR-1c-B · 存量登记（根因修复）**：`mode` 三态
//   · 缺省 / `scan_translate`（含 `scan=1`）⇒ **先扫存量补 pending 行，再翻译**（cron 自愈）；
//   · `mode=scan`  ⇒ **只扫存量登记**（零翻译、零 API 调用）；
//   · `mode=translate` ⇒ 只翻译（**旧行为**，不扫）。
//   扫描**幂等**：`ON CONFLICT DO NOTHING` ⇒ 连跑两次 `scan_registered=0`、行数不增、不重复付费。
app.post('/api/translate/backfill', async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return sendError(res, 503, 'CRON_SECRET not configured');
  }
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  if (bearer !== secret && headerSecret !== secret) {
    return sendError(res, 401, 'Unauthorized');
  }

  const body = (req.body as Record<string, unknown> | undefined) || {};
  const rawLimit = body.limit ?? req.query?.limit;
  const parsedLimit = Number(rawLimit);
  // 默认 100（P6-TR-1c-FIX-FIN）：存量 276 行量级 + cron 每日 1 次，默认 20 需两周才能清完；
  //   真正的成本闸是 TRANSLATE_DAILY_ITEM_CAP=500（每日条目上限），故默认放到上限 100（**上限不变**）。
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(100, Math.floor(parsedLimit)) : 100;

  const rawMode = String(body.mode ?? req.query?.mode ?? '').trim().toLowerCase();
  const rawScan = body.scan ?? req.query?.scan;
  // `scan=1` 显式请求扫描 ⇒ 与 `mode=translate` 合并为 `scan_translate`
  const mode = rawMode === 'translate' && parseBoolean(rawScan, false) ? 'scan_translate' : (rawMode || 'scan_translate');
  const validMode = mode === 'scan' || mode === 'translate' || mode === 'scan_translate' ? mode : 'scan_translate';
  const wantScan = validMode === 'scan' || validMode === 'scan_translate';
  const wantTranslate = validMode !== 'scan';

  try {
    const scan = wantScan ? await scanRegisterPending() : null;
    const report = wantTranslate ? await backfillPending(limit) : null;
    return sendSuccess(res, {
      ok: true,
      mode: validMode,
      // 存量扫描面（新增键；未扫 ⇒ null）
      scan_scanned: scan ? scan.scanned : null,
      scan_registered: scan ? scan.registered : null,
      scan_existing: scan ? scan.existing : null,
      scan_by_entity: scan ? scan.by_entity : null,
      // 翻译面（既有键，语义不变）
      processed: report ? report.scanned : 0,
      ready: report ? report.ready : 0,
      failed: report ? report.failed : 0,
      skipped: report ? report.skipped : 0,
      deferred: report ? report.deferred : 0,
      reason: report ? report.reason : null,
      scanned: report ? report.scanned : 0,
      retried: report ? report.retried : 0,
      engine: report ? report.engine : null,
    }, 'Translate backfill completed');
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'translate.backfill', error);
  }
});

app.use((req, res) => {
  sendError(res, 404, 'Not found');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`TypeScript backend running on port ${PORT}`);
    console.log('Using Neon PostgreSQL for Seafood API routes');
  });
}

export default app;
