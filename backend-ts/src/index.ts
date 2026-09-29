// P4-SEC（缺陷 A）：**必须第一行** —— 在任何模块（尤其下面的 `./auth`）读到 process.env 之前
// 把 <repo>/.env.local、<repo>/.env 注入。修前 `./auth`（第 4 行 import）被求值**早于**
// `./database` 顶部的 dotenv ⇒ `SECRET_KEY` 恒 undefined ⇒ 落到硬编码兜底常量。
import './env';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import {
  consumeWalletAuthChallenge,
  createSessionToken,
  isAdminAddress,
  startWalletAuthChallenge,
  verifySessionToken,
} from './auth';
import {
  AdminAccessRecord,
  DatabaseService,
  TaskProgressRecord,
  UserRecord,
} from './database';
import { healthCheck } from './db';
// P4-SEC（缺陷 B）：基础设施异常走**既有** §14 分类器与 R107 错误体（不新增错误码）
import { ledgerErrorDiagnostics, normalizeLedgerError, toErrorResponse } from './ledger-errors';
import { ledgerErrorBody, sendGone, sendVerbError, submitWork } from './job-service';
// P4-B3c：招工**资金**编排（J1 托管 / J5 发放 / J6 退款 ⇒ `job_post_event`）
import { verifyJobSubmission } from './job-funds-service';
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

const app = express();
const PORT = Number(process.env.PORT || 5788);

app.use(helmet());
app.use(cors());
app.use(express.json());

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

    const adminAccess = await DatabaseService.resolveAdminAccess(user, isAdminAddress(user.EVM));
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

app.get('/health', async (req, res) => {
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
});

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
  try {
    const challenge = consumeWalletAuthChallenge(req.body || {});
    const user = await DatabaseService.findOrCreateUserByEvm(challenge.evm);
    const asset = (await DatabaseService.getUserAsset(user.uID)) || (await DatabaseService.upsertAsset(user.uID, 0));
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
    sendError(res, 401, error instanceof Error ? error.message : 'Failed to verify auth challenge');
  }
});

app.post('/api/auth/login', async (req, res) => {
  req.url = '/api/auth/verify';
  return app._router.handle(req, res, () => undefined);
});

app.get('/api/prize/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const prizes = await DatabaseService.listPrizes(skip, limit);
    setPublicCache(res);
    sendSuccess(res, prizes);
  } catch (error) {
    console.error('Error loading prizes:', error);
    sendError(res, 500, 'Failed to load prizes');
  }
});

app.get('/api/task/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const tasks = await DatabaseService.listTasks(skip, limit);
    setPublicCache(res);
    sendSuccess(res, tasks);
  } catch (error) {
    console.error('Error loading tasks:', error);
    sendError(res, 500, 'Failed to load tasks');
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
    console.error('Error loading task detail:', error);
    sendError(res, 500, 'Failed to load task');
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
    console.error('Error loading prize detail:', error);
    sendError(res, 500, 'Failed to load prize');
  }
});

app.get('/api/user', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const payload = await buildUserPayload(actor.user);
    sendSuccess(res, payload);
  } catch (error) {
    console.error('Error loading current user:', error);
    sendError(res, 500, 'Failed to load user');
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

    const payload = await buildUserPayload(updatedUser);
    sendSuccess(res, payload, 'Profile updated');
  } catch (error) {
    console.error('Error updating user profile:', error);
    sendError(res, 500, 'Failed to update profile');
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
    console.error('Get user asset error:', error);
    sendError(res, 500, 'Internal server error');
  }
});

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
    console.error('Error loading home payload:', error);
    sendError(res, 500, 'Failed to load home payload');
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
    console.error('Error loading prize items:', error);
    sendError(res, 500, 'Failed to load prize items');
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
    console.error('Error loading task progress:', error);
    sendError(res, 500, 'Failed to load task progress');
  }
});

app.get('/api/task-progress/:jID', async (req, res) => {
  try {
    const jID = parseInteger(req.params.jID);
    if (!jID) {
      return sendError(res, 400, 'Invalid jID');
    }

    const taskProgress = await DatabaseService.getTaskProgress(jID);
    if (!taskProgress) {
      return sendError(res, 404, 'Task progress not found');
    }

    sendSuccess(res, taskProgress);
  } catch (error) {
    console.error('Error loading task progress:', error);
    sendError(res, 500, 'Failed to load task progress');
  }
});

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
    // P4-B2a（§1 #19【保留·改接】/ §4.2 J4）：submit 落 `job_submission`（review_status='pending'）
    //   + `job.status→'submitted'`，**无分录**（DL99/R3）；miss⇒404、非法状态⇒409、非打工人⇒403（§3.1/§3.2）
    //   快路径：复用 B1-b 已改接 job_application 的读口先证归属（未命中则交 service 判定）
    const ownedProgress = ensureOwnedTaskProgress(await DatabaseService.getTaskProgress(identifier), actor.user.uID);
    const result = await submitWork({
      identifier,
      workerUid: actor.user.uID,
      deliverable: infoInput,
      createKeyRaw,
      applicationHint: ownedProgress ? ownedProgress.jID : null,
    });

    if (!result.ok) {
      return sendVerbError(res, result);
    }

    // 成功分支 data 键集**冻结**（§2 母约束 F1）：仍为 TaskProgressRecord 9 键；
    // 同键重放顶层标记 `idempotent_replay:true`（§3.2「200（良性）」/ R106），不改 data 形状
    return sendSuccess(res, result.view, 'Task progress submitted', 200, result.replay ? { idempotent_replay: true } : undefined);
  } catch (error) {
    console.error('Error submitting job work:', error);
    sendError(res, 500, 'Failed to submit task info');
  }
});

app.post('/api/task-progress/claim/:jID', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const jID = parseInteger(req.params.jID);
  if (!jID) {
    return sendError(res, 400, 'Invalid jID');
  }

  try {
    const taskProgress = await DatabaseService.getTaskProgress(jID);
    if (!taskProgress) {
      return sendError(res, 404, 'Task progress not found');
    }

    if (taskProgress.uID !== actor.user.uID) {
      return sendError(res, 403, 'Forbidden');
    }

    if (!taskProgress.time_checked) {
      return sendError(res, 400, 'Task progress is not verified yet');
    }

    if (taskProgress.time_claimed) {
      const currentAsset = (await DatabaseService.getUserAsset(actor.user.uID)) || (await DatabaseService.upsertAsset(actor.user.uID, 0));
      return sendSuccess(res, {
        ...taskProgress,
        reward_points: taskProgress.points_claimed,
        user_points_total: currentAsset.points,
      });
    }

    const task = await DatabaseService.getTask(taskProgress.tID);
    const rewardPoints = taskProgress.points_claimed || task?.points || 0;
    const updatedTaskProgress = await DatabaseService.claimTaskProgress(jID, rewardPoints);
    const updatedAsset = await DatabaseService.upsertAsset(actor.user.uID, rewardPoints);

    if (!updatedTaskProgress) {
      return sendError(res, 404, 'Task progress not found');
    }

    sendSuccess(res, {
      ...updatedTaskProgress,
      reward_points: rewardPoints,
      user_points_total: updatedAsset.points,
    }, 'Task progress reward claimed');
  } catch (error) {
    console.error('Error claiming task progress reward:', error);
    sendError(res, 500, 'Failed to claim reward');
  }
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
    console.error('Error loading user orders:', error);
    sendError(res, 500, 'Failed to load user orders');
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
    console.error('Error loading order book:', error);
    sendError(res, 500, 'Failed to load order book');
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
    console.error('Error loading market trades:', error);
    sendError(res, 500, 'Failed to load market trades');
  }
});

app.get('/api/admin/me', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  sendSuccess(res, actor.adminAccess);
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
    console.error('Error loading system settings:', error);
    sendError(res, 500, 'Failed to load system settings');
  }
});

app.post('/api/admin/settings', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_settings');
  if (!actor) return;

  // DL36 / §11.2:581：`ops:<admin_uid>:setting:<key>`；无键 ⇒ 400 LEDGER_IDEMPOTENCY_KEY_REQUIRED
  const opsKey = resolveAdminOpsKey(req, actor.session.uID, 'setting', 'system_settings');
  if (!opsKey.ok) {
    return sendVerbError(res, opsKey.error);
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;
    // §1 #33 / §4.1 #36：**禁写费率键**（费率真源 = commission_policy.fee_rate_bp，CR23/CR25）
    const feeKey = findFeeRateKey(body);
    if (feeKey) {
      return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
        field: feeKey,
        reason: 'FEE_RATE_KEY_NOT_IN_APP_CONFIG',
        authoritative_table: 'commission_policy',
        authoritative_column: 'fee_rate_bp',
      }, 'Fee-rate keys are not writable via /api/admin/settings'));
    }
    const settings = await DatabaseService.saveSystemSettings(body, actor.session.uID);
    sendSuccess(res, settings, 'System settings saved');
  } catch (error) {
    console.error('Error saving system settings:', error);
    sendError(res, 400, error instanceof Error ? error.message : 'Failed to save system settings');
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
    console.error('Error loading permission groups:', error);
    sendError(res, 500, 'Failed to load permission groups');
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
    console.error('Error loading user list:', error);
    sendError(res, 500, 'Failed to load users');
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
    console.error('Error loading user stats:', error);
    sendError(res, 500, 'Failed to load user stats');
  }
});

app.get('/api/tasklist/pending-verification/count', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const count = await DatabaseService.countPendingVerification();
    sendSuccess(res, { count });
  } catch (error) {
    console.error('Error counting pending verification items:', error);
    sendError(res, 500, 'Failed to load pending verification count');
  }
});

app.get('/api/tasklist/pending-verification', async (req, res) => {
  const actor = await requireAdmin(req, res, 'review_tasks');
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const items = await DatabaseService.listPendingVerification(skip, limit);
    sendSuccess(res, items);
  } catch (error) {
    console.error('Error loading pending verification items:', error);
    sendError(res, 500, 'Failed to load pending verification items');
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
    const record = await DatabaseService.getTaskProgress(Number(result.applicationId));
    if (!record) {
      return sendVerbError(res, {
        ok: false,
        status: 404,
        code: 'LEDGER_REF_NOT_FOUND',
        message: 'Referenced object not found',
        details: { ref_type: 'job_application', ref_id: String(result.applicationId) },
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

    const result = await DatabaseService.adjustPoints(uID, amount, reason);
    if (!result.success) {
      return sendError(res, 404, result.message);
    }

    sendSuccess(res, {
      uID,
      new_points: result.asset?.points || 0,
      timestamp: result.asset?.time_update || Math.floor(Date.now() / 1000),
      reason,
    }, result.message);
  } catch (error) {
    console.error('Points adjustment error:', error);
    sendError(res, 500, '积分调整失败');
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
