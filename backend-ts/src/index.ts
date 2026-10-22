// P4-SEC（缺陷 A）：**必须第一行** —— 在任何模块（尤其下面的 `./auth`）读到 process.env 之前
// 把 <repo>/.env.local、<repo>/.env 注入。修前 `./auth`（第 4 行 import）被求值**早于**
// `./database` 顶部的 dotenv ⇒ `SECRET_KEY` 恒 undefined ⇒ 落到硬编码兜底常量。
import './env';
import express, { Request, RequestHandler, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// P4-A1-LEDGER-IMPL（Zang §5.99 / DL96）：路由层计算 `request_fingerprint`（business 字段集合）
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import {
  consumeWalletAuthChallenge,
  createSessionToken,
  shouldRenewSession,
  startWalletAuthChallenge,
  verifySessionToken,
} from './auth';
import {
  AdminAccessRecord,
  DatabaseService,
  SystemSettingsWriteError,
  UserRecord,
  isAppConfigEnvelope,
  screenAppConfigEnvelope,
  screenSystemSettingsWrite,
  validateAppConfigKey,
  validateAppConfigValue,
  SYSTEM_SETTINGS_KEY,
  // ★ FEED-SORT-v1：`?sort=` 闭集 + 归一（单一定义点在 database.ts，路由层不自拟字面量）
  FEED_SORT_DEFAULT,
  FEED_SORT_MODES,
  normalizeFeedSort,
} from './database';
import type { FeedSortMode } from './database';
import { healthCheck } from './db';
// 方案 A · 对账定时化：三条**纯只读**对账（供应量/账本、account/ledger、batt_account/batt_entry）
import { runLedgerRecon } from './ops-recon';
import { buildDriftAlertText, buildInfraAlertText, notifyOps, pingHeartbeat } from './ops-alert';
// P4-SEC（缺陷 B）：基础设施异常走**既有** §14 分类器与 R107 错误体（不新增错误码）
import { errorMessageOf, ledgerErrorDiagnostics, normalizeLedgerError, toErrorResponse } from './ledger-errors';
// P7-A：账本流水读口的 `kind` 过滤取值 = **冻结关闭集**（`ledger.spec` §5.1/R40，20 个；不复制/不自造）
import { LEDGER_KINDS } from './ledger';
// ★ 2026-10-21 job 域下线（migration 0070）：招工服务面（原 `job-service` / `job-funds-service`）整体移除。
//   共享错误体 / verb 形状收敛到**无领域语义**的 `./verb-shape`（listing / currency / market / project / campaign 同用）。
import { ledgerErrorBody, sendGone, sendVerbError } from './verb-shape';
// P4-B4a：商品面（P1 上架/编辑/下架）—— §1.8 #7/#8；**本片首次导入整个模块**（v0.8 §1.8 现取 `grep` = 0）
import { createListing, transitionListingStatus, updateListing, updateListingDetails, classifyListingPatchBody, getListingEditView } from './listing-service';
// ★ 迁移 0060（Kevin 2026-10-20 第 3 条「统一商品 Id」）：详情读口的 `ref` 判定助手
//   （全数字 ⇒ listing_id · 7 位字母数字 ⇒ item_code）
import { isItemCode, isNumericRef } from './item-id';
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
// 批 8⑤（`route-layer.spec` v2.10 §25 / `data-layer.spec` v0.17 §28）：合规审核（商品轴）
//   · 读口 `GET /api/admin/listing` + 动作口 `POST /api/admin/listing/:listingId/takedown`（§25.2 · 闸 `review_tasks`）
// ★ 2026-10-21：招工仲裁面（`/api/admin/arbitration*`）随 job 域下线移除。
import {
  LISTING_TAKEDOWN_OPS_ACTION,
  listing404,
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
// ★ A5 收口（route 册 v2.31 §41 / data 册 v0.32 §38）：站内信 `/api/messages` 族 + Telegram `/api/telegram` 族
import {
  getPrizeSellerView,
  listConversations,
  listMessages,
  markConversationRead,
  messagingI18nNamespaceOf,
  notifyMessageCounterpart,
  openConversation,
  sendMessage,
  totalUnread,
} from './messages-service';
// ★ 项目（打工/工资）域（data-layer.spec §40.15 · route-layer.spec §49.19 · 迁移 0063/0064/0068）
//   七口：R1/R2 公开读、R3–R6 用户写（登录闸）、R7 管理员（manage_tasks）。
//   ★ 0068：R2 `:ref` 三形态（全数字 id / snowflake / slug，零新路由）；详情加性 `campaigns[]` 嵌套。
//   ★ 活动小时桶埋点 `recordUserActivityHour` 的调用点在 `resolveActor` 成功出口（旁路、不 await）。
import {
  applyProjectVerb,
  claimProjectWageVerb,
  createProjectVerb,
  getProjectDetailByRef,
  getProjectOwnerContext,
  isProjectReadRef,
  isProjectRef,
  leaveProjectVerb,
  listHomeCampaignTasks,
  listProjects,
  patchProjectVerb,
  recordUserActivityHour,
} from './project-service';
// ★ 活动任务体系（data-layer.spec §40.14 · route-layer.spec §49.18 · 迁移 0065/0068）
//   九口：R1/R2 公开读、R3 用户提凭证、R4–R8 管理员（manage_tasks：建改活动/任务/子任务、settle、task 完成奖）。
//   ★ 0068 权限扩容：campaign/task/subtask 的**创建口**在 manage_tasks 之外新增 project_owner 支
//     （owner_uid = 本人 ∧ 项目 status ≠ 'ended'；task/subtask 归属链经 campaign 校验）。
//   subtask 增/改/删**一律内联于 task 写口**（`subtasks[]` 按 id upsert ＋ 闭集键 `subtasks_remove` 删）⇒
//   无独立 subtask 路由（零新注册点：删不是第十一口）。
//   ★ 本单加性第十口：`GET /api/campaign/task/:taskId`（任务自己的页面 `/task/:taskId` 的公开读面；
//     draft / ended 对公众 404，owner/admin 同形状 200）。注册点 129 → **130**（get 56 → 57）。
import {
  authorizeProjectScopedCreate,
  createCampaignVerb,
  createTaskVerb,
  getCampaignAuthzContext,
  getCampaignByRef,
  getTaskAuthzContext,
  getTaskDetailByRef,
  grantTaskRewardVerb,
  isCampaignRef,
  isTaskPubliclyVisible,
  listActiveCampaigns,
  patchCampaignVerb,
  patchTaskVerb,
  settlePredictionVerb,
  submitProofVerb,
} from './campaign-service';
import {
  checkConfirmRateLimit,
  confirmErrorForOutcome,
  confirmShapeError,
  confirmShortBindCode,
  consumeBindCode,
  isTelegramConfigured,
  issueBindCode,
  issueShortBindCode,
  isValidShortBindCode,
  readBindStatus,
  replyTextForOutcome,
  REPLY_HINT_TEXT,
  sendTelegramReply,
  shortBindIssueReplyText,
  telegramRuntimeConfig,
  unbindTelegram,
} from './telegram-service';

const app = express();
const PORT = Number(process.env.PORT || 5788);

app.use(helmet());
// P9-AUTH-RENEWAL：续期走**响应头** `X-Session-Token`（零新路由）。同源生产 / 本地 vite 代理都不需要
// expose，但跨源场景（真机走 LAN 反代之外的直连、外部调用方）只有显式 expose 才能读到它 ⇒ 零成本加上。
app.use(cors({ exposedHeaders: ['X-Session-Token'] }));
// 媒体上传（route-layer.spec v2.39 §48.2）：`data_base64` = 解码后 ≤1MiB 的 base64 文本
// （1MiB ≈ 1.40MB base64 + JSON 信封）⇒ 传输层上限 4mb。缺省 100kb 连前端 ≤300KB 的正常
// 压缩图（≈405KB 请求体）都会 413，>1MiB 的业务闸（400 MEDIA_SIZE_EXCEEDED）在 handler 内判。
app.use(express.json({ limit: '4mb' }));

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

/**
 * 从 listing 写回执（`view`）提取可译字段（field 名 = 源列名，与 `createDbSourceResolver` 白名单一致）。
 *
 * ★★ 2026-10-20 Kevin 数据模型指令（`listing.title` 退场、正文并入 `description`）⇒ 只登记
 *   **`description`** 一路（标题 = 描述首个换行之前，随描述一起翻译）。`view.title` 是**派生值**
 *   （`split_part(description, E'\n', 1)`），它不是可写列、再登记会让翻译回写撞已 DROP 的列。
 *   ⇒ 不再从 `view.title` 造 field。
 */
const enqueueListingTranslation = async (view: unknown, reset = false): Promise<void> => {
  const v = (view || {}) as Record<string, unknown>;
  const entityId = v.listing_id === undefined || v.listing_id === null ? '' : String(v.listing_id);
  const fields: Record<string, string> = {};
  const description = typeof v.description === 'string' ? v.description : '';
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

// ============================================================================
// ★ P58 浏览去重开关（迁移 0058）· 详情读口访客标识解析（路由层 · 零 DB）
// 优先级：① 登录 —— Bearer 会话令牌**纯验签**（`verifySessionToken` 零查库）⇒ `uid:<id>`
//          （计数标识 = best-effort 身份面：令牌 HMAC 验签即登录态真源，用户行存在性由既有鉴权口
//          保证；不查库是为详情热路径不加 2-3 次读）；
//         ② 匿名显式头 `x-sf-viewer`（前端后续会带）⇒ `anon:<值>`（128 字符上限防灌表）；
//         ③ 匿名 cookie `sf_viewer` ⇒ 复用；缺失/超限 ⇒ 发 `sf_viewer=<uuid4>`
//            （HttpOnly; SameSite=Lax; Max-Age=1 年）并以其为 key。
// ★ 仅开关 on 时调用（off 模式零 cookie 写、零头读取 —— 现状行为不变）。
// ★ P59（2026-10-20 生产实测 · CDN 缓存缺陷）后：返回值**只含 `viewerKey`**。
//   本口不再用「是否新发 cookie」二分缓存头 —— 详情读口无条件 `private, no-store`
//   （理由见 `/api/prize/:bID` 路由注释：浏览数要求「每次打开 +1」，任何共享缓存命中都会
//   破坏该语义）。发 cookie 的响应被 no-store 一并覆盖 ⇒ 防串号诉求自动满足，不再需要
//   一个只为选缓存头而存在的布尔。
// ============================================================================
const DETAIL_VIEWER_HEADER = 'x-sf-viewer';
const DETAIL_VIEWER_COOKIE = 'sf_viewer';
const DETAIL_VIEWER_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 年
const DETAIL_VIEWER_KEY_MAX = 128;

const readDetailViewCookie = (req: Request): string => {
  const raw = req.headers.cookie;
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    if (part.slice(0, eq).trim() !== DETAIL_VIEWER_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return '';
};

const resolveDetailViewViewerKey = (req: Request, res: Response): string => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const session = verifySessionToken(authHeader.slice('Bearer '.length).trim());
      if (Number.isFinite(session.uID) && session.uID > 0) {
        return `uid:${session.uID}`;
      }
    } catch {
      // 无令牌 / 令牌失效 ⇒ 匿名路径（详情读口本就公开）
    }
  }

  const headerKey = String(req.headers[DETAIL_VIEWER_HEADER] ?? '').trim();
  if (headerKey && headerKey.length <= DETAIL_VIEWER_KEY_MAX) {
    return `anon:${headerKey}`;
  }

  const cookieKey = readDetailViewCookie(req);
  if (cookieKey && cookieKey.length <= DETAIL_VIEWER_KEY_MAX) {
    return `anon:${cookieKey}`;
  }

  const minted = randomUUID();
  res.setHeader('Set-Cookie', `${DETAIL_VIEWER_COOKIE}=${minted}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DETAIL_VIEWER_COOKIE_MAX_AGE}`);
  return `anon:${minted}`;
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

/**
 * ★ FEED-SORT-v1（首页两标签 · Kevin 2026-10-22）：`GET /api/prize/all?sort=` 的**路由层判据唯一落点**。
 *   · 缺参 / 空串 ⇒ `recommend`（宽松：前端清空参数不该 400）；
 *   · `recommend` / `new`（大小写与首尾空白归一）⇒ 该值；
 *   · **其余一切**（`banana` / `newest` / 数组参数 `?sort=a&sort=b`）⇒ `ok:false` ⇒ 调用方 **400**
 *     `LEDGER_AMOUNT_INVALID` + `details.reason='sort_invalid'`（**借码**：不新增错误码，33 码闭集不动）。
 */
type FeedSortQuery = { ok: true; sort: FeedSortMode } | { ok: false; raw: string };
const resolveFeedSortQuery = (req: Request): FeedSortQuery => {
  const raw = req.query.sort;
  if (raw === undefined) return { ok: true, sort: FEED_SORT_DEFAULT };
  if (Array.isArray(raw)) return { ok: false, raw: raw.map((v) => String(v)).join(',') };
  const text = String(raw).trim();
  if (text === '') return { ok: true, sort: FEED_SORT_DEFAULT };
  const sort = normalizeFeedSort(text);
  return sort ? { ok: true, sort } : { ok: false, raw: text };
};

type ActorContext = {
  session: {
    uID: number;
    evm: string;
    /** P9-AUTH-RENEWAL：旧 token 无 `iat` ⇒ 由 `exp - ACCESS_TOKEN_EXPIRE_MINUTES*60` 反推（见 `auth.ts`） */
    iat: number;
    /** P9-AUTH-RENEWAL：会话起点（绝对上限 7 天的起算点）；旧 token 回落 `iat` */
    sessionStartedAt: number;
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
  let session: ActorContext['session'];
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
    // ★ 项目域活动小时桶（data §40.15.3 PR-6 埋点面）：**登录态请求**旁路 +1。
    //   纪律：`void …` 不 await ⇒ 零主路径延迟；`recordUserActivityHour` 自身吞错 ⇒
    //   最坏该小时桶缺行（该小时按离线计），绝不把埋点失败变成业务失败（PR-N5）。
    void recordUserActivityHour(Number(user.uID)).catch(() => undefined);
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
  // ★ S31（台账 B5 上半）：`message` = **查表派生的稳定英文句**（`errorMessageOf`），**不再**把域码当文案
  //   （§3.3 条款 9′；`code` 仍是 `AUTH_UNAUTHORIZED` / `AUTH_FORBIDDEN`，`i18n_key` = `auth.err.<CODE>` 不变）。
  return res.status(statusCode).json(ledgerErrorBody(code, errorMessageOf(code), details, 'auth'));
};

/**
 * P9-AUTH-RENEWAL（Kevin 2026-10-17 裁定 · 变体 1「无状态滑动续期」）：
 * 鉴权成功（**验签通过且用户存在**）即「活性」⇒ 按 1 小时粒度把续期后的 token 挂到响应头
 * `X-Session-Token`（**零新路由、零新错误码、零库写**）。判据与签发都在 `auth.ts`：
 *   · 粒度：`now >= iat + 3600s` 才重签（不是每请求重签）；
 *   · 绝对上限：`sst + 7d` 到点后**不再续**（`shouldRenewSession` 返回 false）；
 *   · 会话起点 `sst` 原样回传 ⇒ 续期不会把 7 天上限重新起算；
 *   · 闲置上限由 `exp` 承载（`exp = min(iat + 3d, sst + 7d)`）⇒ 过期 token 在 `verifySessionToken` 就抛错，走不到这里。
 * 失败语义逐字不变：本函数只在**已有**的 200 响应上加一个头，不参与任何状态码 / 载荷判定。
 */
const maybeIssueRenewedSession = (res: Response, session: ActorContext['session']): void => {
  const now = Math.floor(Date.now() / 1000);
  if (!shouldRenewSession({ issuedAt: session.iat, sessionStartedAt: session.sessionStartedAt, now })) {
    return;
  }
  res.setHeader('X-Session-Token', createSessionToken({
    uID: session.uID,
    evm: session.evm,
    sessionStartedAt: session.sessionStartedAt,
  }));
  // 带凭证的响应**绝不可被共享缓存留存**（否则一个用户的新 token 可能被发给另一个用户）。
  // 匿名面（`/api/prize/all` 一类 `setPublicCache`）不走本函数 ⇒ 公共缓存语义零变化。
  res.setHeader('Cache-Control', 'private, no-store');
};

const requireActor = async (req: Request, res: Response): Promise<ActorContext | null> => {
  const resolved = await resolveActor(req);

  if (!isActorFailure(resolved)) {
    // P9-AUTH-RENEWAL：**统一鉴权入口**的成功出口 = 全站 52 个 `requireActor` 调用点共用的一次续期判断。
    maybeIssueRenewedSession(res, resolved.session);
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
 * `GET /api/user` 载荷。
 *
 * ★ 0059（管理员可编辑他人商品 · 前端需知「我是否可代编」）：**加性**补一个 `admin` 子对象
 *   `{ can_access_admin, is_admin, permissions }` —— 三键全部来自 token 侧 `resolveAdminAccess`
 *   的既有字段（**不泄漏**任何其它管理信息：无 preferred_admin_path / 无他人数据 / 无角色行明细）。
 *   · 纯加性：既有顶层键（`...user` / `points` / `requires_profile_completion`）**逐字不变**；
 *   · 未注入 `adminAccess`（理论上的非 actor 调用）⇒ 三键取保守默认（false / false / []），
 *     **绝不**臆断为管理员。
 */
const buildUserPayload = async (user: UserRecord, adminAccess?: AdminAccessRecord | null) => {
  const asset = await DatabaseService.getUserAsset(user.uID).catch(() => null);
  return {
    ...user,
    points: asset?.points || 0,
    requires_profile_completion: !String(user.bio || '').trim(),
    admin: {
      can_access_admin: adminAccess?.can_access_admin === true,
      is_admin: adminAccess?.is_admin === true,
      permissions: [...(adminAccess?.permissions ?? [])],
    },
  };
};

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
    sendAuthError(res, 401);
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
// ★ FEED-SORT-v1（首页两标签「推荐 / 新发」· Kevin 2026-10-22）：
//   `?sort=` 只认闭集 `FEED_SORT_MODES`（`recommend` 缺省 = 五因子加权分 / `new` = 纯发布时间降序）；
//   非法值 ⇒ **400** `LEDGER_AMOUNT_INVALID` + `details.reason='sort_invalid'`（借码、零新错误码），
//   且**不进服务层、不查库**（形状闸前置）。判据单一定义点 = `resolveFeedSortQuery`（上方）。
//   响应键集**零变化**（score 及各因子原始值都不出）；分页 skip/limit 语义不变。
//   `sort` 落在 URL 查询串 ⇒ CDN 缓存键天然区分两态（不新增 Vary、不改缓存头口径）。
app.get('/api/prize/all', async (req, res) => {
  try {
    const { skip, limit } = getPagination(req);
    const sortQuery = resolveFeedSortQuery(req);
    if (!sortQuery.ok) {
      return sendVerbError(res, adminVerbError(400, 'LEDGER_AMOUNT_INVALID', {
        field: 'sort',
        reason: 'sort_invalid',
        value: sortQuery.raw.slice(0, 32),
        allowed: [...FEED_SORT_MODES],
      }, 'Sort is invalid'));
    }
    const prizes = await DatabaseService.listPrizes(skip, limit, sortQuery.sort);
    setPublicCache(res);
    sendSuccess(res, prizes);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    // 修前：本 catch 硬编码 `sendError(res, 500, …)` ⇒ 库不可达被伪装成 500「实现缺陷」。
    return sendInfraMapped(res, 'prize.all', error);
  }
});

app.get('/api/prize/:bID', async (req, res) => {
  try {
    // ★★ 迁移 0060（Kevin 2026-10-20 指令第 3 条「页面地址 uri 改用 itemCode」）：
    //   路径参数位名沿用 `:bID`（**零新路由** ⇒ 注册点仍 111），但取值域扩成 **ref**：
    //     · **全数字** ⇒ 按 `listing_id` 解释（**向后兼容**：既有 `/item/<数字 id>` 链接、
    //       外部已发出去的 URL、老前端一律照旧命中）；
    //     · **7 位字母数字**（`^[0-9A-Za-z]{7}$`，`isItemCode`）⇒ 按 `item_code` 查（现行页面地址）；
    //     · 其它形状（空 / 8 位以上 / 带符号）⇒ 既有 `bID_not_found` 404（形状闸，零 DB）；
    //     · 码不存在 ⇒ 与「id 不存在」**同一个 404**（`prize_not_found`，不区分，避免探测面）。
    //   计数 / 去重 / 缓存头 / seller 合成**逐字不变**：解析出 `listing_id` 之后走原封不动的旧路径
    //   ⇒ 本单对详情语义的改动只有「入参多了一种解释方式」。
    const rawRef = String(req.params.bID ?? '').trim();
    const numericRef = isNumericRef(rawRef) ? parseInteger(rawRef) : 0;
    const codeRef = numericRef ? null : (isItemCode(rawRef) ? rawRef : null);
    if (!numericRef && !codeRef) {
      return sendRefNotFound(res, 'prize', rawRef, 'bID_not_found');
    }
    const bID = numericRef || (await DatabaseService.getListingIdByItemCode(codeRef as string));
    if (!bID) {
      return sendRefNotFound(res, 'prize', rawRef, 'prize_not_found');
    }

    // ★ P57 详情浏览计数（Kevin 2026-10-20 详情页改版 · 后端件 · 迁移 0057）：详情读口 =
    //   「自增 + 读」专用口 getPrizeDetailRecordingView —— 单语句 CTE 对 listing.view_count +1
    //   并读回**自增后**值 ⇒ 响应加性键 `views`；item_condition 同批透出为 `condition`、
    //   收藏计数同批与 feed 同源透出为 `wants` ⇒ data 顶层 47→**50**（+views +condition +wants）。
    //   简单计数口径：任何状态都计（不过滤 status）、**卖家自看也计**。
    //   行不存在 ⇒ CTE 0 行 ⇒ null ⇒ 既有 404 语义不变、**不计数**。零新路由（注册点仍 110）；
    //   feed（/api/prize/all、/api/home）不计数、不加键。
    //
    // ★ P58 浏览去重开关（迁移 0058 · Kevin 2026-10-20「后台开关」）：
    //   · off（**当前配置**）⇒ 行为与 P57 现状逐字不变：无条件自增、不写日志、零访客 cookie/头读取；
    //   · on ⇒ 先落 `listing_view_log`（viewer_key = `uid:<id>` 登录 / `anon:<x-sf-viewer 头或
    //     sf_viewer cookie>` 匿名；头优先、无头发 HttpOnly+SameSite=Lax 1 年 cookie），
    //     `ON CONFLICT ON CONSTRAINT listing_view_log_uniq DO NOTHING` —— rowCount=1（新访客/新一天）
    //     才自增，冲突（同访客同天已见）⇒ 只读不增；**404 不计数不写日志**；
    //     日志失败 ⇒ fail-open：详情照常返回、按「新访客」落旧口径自增（计数面退化为不去重）；
    //   · 开关读 = 每请求单行 SELECT（`isDetailViewDedupEnabled`，无缓存体例）；
    //     行缺席/非法值 ⇒ 服务层 fail-safe 默认 on（去重）。
    const dedupOn = await DatabaseService.isDetailViewDedupEnabled();
    const detailViewerKey = dedupOn ? resolveDetailViewViewerKey(req, res) : null;
    const prize = detailViewerKey
      ? await DatabaseService.getPrizeDetailViewWithViewer(bID, detailViewerKey)
      : await DatabaseService.getPrizeDetailRecordingView(bID);
    if (!prize) {
      return sendRefNotFound(res, 'prize', String(bID), 'prize_not_found');
    }

    // ★ F19 读口扩展（route 册 v2.31 §41.3 · 零新路由 / 零 DDL）：响应顶层增 `seller` 对象
    //   （`uid` = listing.seller_uid 既有列；`nickname` = EVM 掩码派生；`avatar` = null 占位）。
    //   纯增键向后兼容；零隐私出口（不含联系方式 / 完整地址 / handle）；渲染面零改动（消费另裁）。
    const sellerResult = await getPrizeSellerView(bID);
    const seller = sellerResult.ok ? sellerResult.seller : null;

    // ★ P59（2026-10-20 生产实测 · CDN 缓存缺陷）：本口**无条件** `private, no-store`。
    //   两条理由，缺一不可：
    //   ① 语义：响应带 `views`（自增后值）⇒ 详情浏览计数必须「每次打开 +1」。原实现匿名
    //      分支挂共享缓存头（`public, s-maxage=30, stale-while-revalidate=300`）⇒ CDN 命中时
    //      请求根本不到 origin ⇒ 浏览数不增，且读数在「边缘缓存值」与「库内真值」之间跳动
    //      （生产实测 2→4→4）。
    //   ② 安全：去重开关 on 时本口可能发 `Set-Cookie: sf_viewer`，共享缓存会把 A 的
    //      Set-Cookie 回放给 B。
    //   原「新发 cookie ⇒ 降级 no-store / 其余 ⇒ 共享缓存」的二分已删（它把绝大多数匿名请求
    //   送进 CDN，正是本缺陷成因）⇒ 登录/匿名、新发/复用 cookie、开关 on/off 一律同语义。
    //   认证区分头：本路由历史上不设 Authorization 的缓存键响应头（只有 `/api/home` 设），
    //   故无既有体例需保留；`no-store` 已使缓存键区分失去意义。
    setPrivateNoStore(res);
    sendSuccess(res, { ...prize, seller });
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
    // ★ 0059：admin 旗标 = token 侧派生值（前端据此决定是否显示「编辑他人商品」入口）
    const payload = await buildUserPayload(actor.user, actor.adminAccess);
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
      return sendRefNotFound(res, 'user', String(actor.user.uID), 'user_not_found');
    }

    // P6-TR-1c-A：bio 译文登记（前台 pending + 后台 waitUntil 翻译；失败不影响本响应）
    await enqueueTranslation({ entityType: 'user', entityId: String(actor.user.uID), fields: { bio }, reset: true });

    // ★ 0059：同上（profile 更新回执与 /api/user 载荷同源，admin 子对象一并加性带上）
    const payload = await buildUserPayload(updatedUser, actor.adminAccess);
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
      return sendRefNotFound(res, 'user', String(req.params.uID ?? ''), 'uID_not_found');
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
 * 注册 `GET /api/user/balances` —— 顶部菜单弹出层的**多币种余额分行显示**读口。
 * 依据（Kevin 2026-10-20 需求）：菜单里不再显示「积分」二字，改为按币种分行（`$12,234` / `€21,345` …），
 *   **用户没有的币种不显示**（余额 0 ⇒ 不出行），不再是单币种 `points` 一个数。
 * 契约：
 *   · 鉴权 = `requireActor`（**用户本人**，`uid` 只取 token actor，不接受客户端声明）；
 *     缺 token / 坏 token / 查无此人 ⇒ **既有 401**（R107 形状 `AUTH_UNAUTHORIZED`），零新错误码。
 *   · 取数 = `account JOIN currency`，`balance > 0` 才出；顺序 = `cid` **升序**（`$` = cid 1 恒首位）。
 *   · 行键**恰四键** `cid`（number）/ `symbol` / `name` / `balance`（**string**，`bigint::text` ⇒ 大数逐字不丢精度）。
 *   · 缓存：响应是**账户私有数据** ⇒ 无条件 `private, no-store` ＋ `Vary: Authorization`
 *     （共享缓存既不可留存余额，也不可把 A 的响应回给 B）。
 *   · **纯 SELECT**（DL23）：零写副作用、零 DDL、零懒开户、零新 ledger kind。
 * ============================================================================
 */
app.get('/api/user/balances', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  // 私有缓存头 + 认证区分头：两条缺一不可（`no-store` 使缓存键区分失去意义，`Vary` 是纵深防御）。
  res.setHeader('Vary', 'Authorization');
  setPrivateNoStore(res);

  try {
    const balances = await DatabaseService.listUserBalances(actor.user.uID);
    sendSuccess(res, balances);
  } catch (error) {
    // P6-D1'-SWEEP（同族收口）：基础设施异常一律交**既有** §14 分类器
    //（DB/传输类 ⇒ 503 + 机读 reason；真缺陷仍 500/`LEDGER_TRANSACTION_REQUIRED`）。
    return sendInfraMapped(res, 'user.balances', error);
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
  const prizeLimit = Math.min(16, Math.max(1, parseInteger(req.query.prize_limit, 8)));
  res.setHeader('Vary', 'Authorization');

  try {
    // P4-SEC（缺陷 B）：`resolveActor` 现在区分「鉴权失败」与「基础设施故障」。
    // `/api/home` 是**公开只读面**（原实现也把失败降级为匿名），故这里保持原语义：
    // 取不到主体 ⇒ 匿名渲染，**不**把公开面打成 503；但类型上必须显式收敛。
    const resolvedActor = await resolveActor(req);
    const actor = isActorFailure(resolvedActor) ? null : resolvedActor;
    // P9-AUTH-RENEWAL：`/api/home` 是**唯一绕开 `requireActor`** 的带 token 读口（公开面，取不到主体降级匿名）。
    // 带 token 且验签通过 + 用户存在 = 「活性」的同一条定义 ⇒ 同口径续期，否则「只在首页刷新的用户」会被
    // 3 天闲置上限踢掉（前台首页确实打这个口）。
    // 安全面：本分支恒 `setPrivateNoStore` + `Vary: Authorization`（见下），匿名分支才 `setPublicCache`
    // ⇒ 续期头只挂在私有响应上，不污染公共缓存；匿名/坏 token 分支**不**续期（无主体、无会话起点）。
    if (actor) maybeIssueRenewedSession(res, actor.session);
    // ★ 2026-10-21 job 域下线（0070）：`tasks` 腿（原 `DatabaseService.listTasks` ⇒ `public.job`）整体移除。
    //   载荷键 `tasks` **保留为空数组**（形状零变更，前端首页消费方随前端单收敛）；首页任务位由
    //   `GET /api/home/campaign-tasks`（campaign 域）承接。
    const [prizes, claimedPrizeIds, asset] = await Promise.all([
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
      tasks: [] as unknown[],
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

app.get('/api/shard', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const shards = await DatabaseService.listShardHoldingsByUser(actor.user.uID, skip, limit);
    // P4-B1-c: shard 读侧恒空态（无对应表）+ 顶层 deprecated 标记（碎片语义已被积分交易所取代）。
    sendSuccess(res, shards, 'OK', 200, { deprecated: true });
  } catch (error) {
    return sendInfraMapped(res, 'shard.holdings', error);
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
    return sendInfraMapped(res, 'shard.transfers', error);
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
    return sendRefNotFound(res, 'brand', String(req.params.bID ?? ''), 'bID_not_found');
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
    return sendRefNotFound(res, 'brand', String(req.params.bID ?? ''), 'bID_not_found');
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
        // ★ 铸造缺额提示（纯读·零新查询）：`$` 余额随 `bttc` 子对象下发，前端只做减法（不参与任何写决定）。
        usdBalance: b.usdBalance,
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
  // ★ 2026-10-21（0070）：招工轴（`?job_id` / `jobPassRate` / `posterAvgDays` / `workerAvgDays` /
  //   `workerPassRate`）随 job 域下线置 `null`（原「无数据 ⇒ null」同语义）；载荷键**逐字保留**，
  //   前端按「暂无数据」渲染，键的移除归前端单。
  const listingRaw = req.query.listing_id ?? req.query.listingId;
  const listingN = listingRaw === undefined || listingRaw === '' ? 0 : parseInteger(listingRaw, 0);
  try {
    const t = await DatabaseService.getTimeliness(actor.user.uID, {
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
  // ★ 2026-10-21（0070）：评分标的闭集从 `{job, listing}` 收为 `{listing}`（招工面已无对象可评）。
  if (targetType !== 'listing') {
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
// P4-B2b：商品面弃用面的过期日（逐字取自 §5.1 每行的「过期日」列；未决 §7-1 ⇒ 上线日待 Kevin 定）
const ADMIN_PRIZE_SUNSET = '批 4 删路径（未决 §7-1：过期日待 Kevin 定）';
const LEGACY_REWARD_WRITE_SUNSET = '批 3 末删除路径（§5.1 碎片写口①/宝箱写口；未决 §7-1：过期日待 Kevin 定）';

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
// Kevin 2026-10-04 定值 1000000
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

    if (!uID) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'uid', reason: 'MISSING' },
      ));
    }

    if (Number.isNaN(amount)) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'amount', reason: 'MISSING' },
      ));
    }

    if (!reason) {
      return res.status(400).json(ledgerErrorBody(
        'LEDGER_AMOUNT_INVALID',
        'Request shape is invalid',
        { field: 'reason', reason: 'MISSING' },
      ));
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
// 商品发布页币种下拉（Kevin 2026-10-19 · 公开只读）· 读口 `GET /api/currencies`
//   · **无鉴权闸**（公开只读；发布页未登录也要能渲染选项 ⇒ 不得挂 `requireActor` /
//     `requireAdmin`）——与 `GET /api/admin/currency`（闸 = `review_tasks`）**两个口**；
//   · `data` = 行数组，行键集**自本单起冻结 = 恰三键**：cid / symbol / name
//     （`database.ts listListedCurrencies`：只 `SELECT`，`status = 'listed'`，`ORDER BY cid`）；
//   · 只读：零写、零 DDL、无幂等键（读口无副作用）；
//   · 失败 ⇒ `sendInfraMapped`（R107 既有分类器；**零新增错误码**）；
//   · 注册点 **107 → 108**（逐 verb 分解 get 47 → 48、post 56、delete 3、patch 1）。
// ============================================================================
app.get('/api/currencies', async (_req, res) => {
  try {
    const rows = await DatabaseService.listListedCurrencies();
    return sendSuccess(res, rows, 'Currency list (public)');
  } catch (error) {
    return sendInfraMapped(res, 'currencies.list', error);
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
      // 商品分类（迁移 0054 · 承 0053）：可选 `item_type`，闭集四值
      // （`DigitalAutoDeliver` / `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`）；
      // 未传 ⇒ null（未分类）。闸在服务层（非法值含退役的裸 `Digital` ⇒ 400）。
      itemType: body.item_type,
      // ★ 商品成色（迁移 0057）：可选 `item_condition`，四值闭集；**仅实物两分类允许非空**
      //   （数字商品 / 未分类带值 ⇒ 400 `ITEM_CONDITION_NOT_APPLICABLE`，服务层 applicability 闸；
      //   非法值同 item_type 体例 400 `NOT_IN_CLOSED_SET`）。两闸都在 currencyGate 之前 ⇒ 零 DB 调用。
      itemCondition: body.item_condition,
      // ★ 迁移 0061 多件购买授权（route §49.17.2）：可选严格布尔；未传 ⇒ 落 `false`。
      //   形状闸 / 归一 / 400 全在服务层（`normalizeAllowMultiBuy` + `multiBuyApplicabilityError`），
      //   本层**不校验、不默认**（同 price/stock 体例：客户端值原样交服务层）。
      allowMultiBuy: body.allow_multi_buy,
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
// ★ S55（发布动作单 · 2026-10-20 Kevin 口径）：**同一路径扩出「字段编辑」支**（`/profile/trades/published`
//   行内【编辑】独立页 `/item/:id/edit` + 【降价】弹窗）—— **零新路由**（注册点仍 110）、零迁移、零新码。
//   verb 分类（互斥口径 · 纯函数 `classifyListingPatchBody`，本层只分支）：
//     · 含 `to_status|status` **且** 含任一可编辑字段 ⇒ **400 STATUS_AND_FIELDS_EXCLUSIVE**（两支语义冲突；
//       不猜、不二段式执行 —— 否则「先改价再下架」会在半途失败时留下已改价的行）；
//     · 只含状态键 ⇒ 既有 `transitionListingStatus`（下架/上架/冻结/复牌，行为一字不动）；
//     · 只含字段键 ⇒ `updateListingDetails`（仅本人、仅 `draft|listed`；**`description` 实际变化**时
//       **才**重置翻译回 `pending`，未变不调 ⇒ 避免无谓重译与译文闪烁）；
//     · body 带 `title` ⇒ **400 NOT_SUPPORTED**（★ Kevin 2026-10-20：`listing.title` 退场、正文并入
//       `description`；不静默忽略 ⇒ 旧前端误发 title 会立刻暴露，而不是「以为改标题生效了」）；
//     · 两者都无 ⇒ **400 NO_EDITABLE_FIELD**（与旧面「空 body 交服务层判 400」同码同形，`sendVerbError` 体例）。
app.patch('/api/listing/:listingId', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const listingId = parseInteger(req.params.listingId);
  if (!listingId || listingId <= 0) return sendRefNotFound(res, 'listing', String(req.params.listingId ?? ''), 'listing_not_found');

  const body = (req.body || {}) as Record<string, unknown>;
  const route = classifyListingPatchBody(body);
  if (route.kind === 'invalid') return sendVerbError(res, route.err);

  try {
    if (route.kind === 'fields') {
      const result = await updateListingDetails({
        listingId,
        actorUid: actor.user.uID, // 非卖家 ⇒ 服务层 403 + ACTOR_NOT_ALLOWED（闸在 DB 语句内）
        patch: {
          // `title` 已被分类闸拦下（400）；此处仍透传 ⇒ 服务层同一条 NOT_SUPPORTED 闸是第二道（双保险）
          title: body.title,
          description: body.description,
          price: body.price,
          stock: body.stock,
          mediaUrls: body.media_urls,
          itemType: body.item_type,
          // ★ 商品成色（迁移 0057）：PATCH 字段支可改；`undefined` = 不动 / `null` = 显式置 NULL /
          //   带值 = 改成色（仅实物两分类允许非空 —— 同 patch 提交类型时纯预检零 DB，只提成色时
          //   交 DB 侧 `condition_not_applicable` 守卫臂）。
          itemCondition: body.item_condition,
          // ★ 迁移 0061 多件购买授权（第 7 可改字段 · route §49.17.3）：`undefined` = 不动 /
          //   `true`|`false` = 落值（严格布尔，串/数字/`null` ⇒ 400 NOT_A_BOOLEAN，零 DB）。
          allowMultiBuy: body.allow_multi_buy,
        },
        // ★ 0059（Kevin 2026-10-20）：管理员（`can_access_admin ∧ (is_admin ∨ manage_rewards)`）
        //   可编辑**他人**商品 —— 只注入 token 侧派生值，客户端不得声明；本人编辑行为逐字不变。
        adminAccess: actor.adminAccess,
      });
      if (!result.ok) return sendVerbError(res, result);
      // ★ 只有 description **实际**变化才重置翻译（`text_changed` 由服务层按 `prev_description` 判定）；
      //   纯改价/库存/图片/分类不动译文（`media_urls` 不进译文源白名单）。
      if (result.text_changed) await enqueueListingTranslation(result.view, true);
      return sendSuccess(res, result.view, 'Listing updated');
    }

    // 入参别名：`to_status`（§4.2 P1 状态机口径）/ `status`（前端常见写法）—— 二者皆缺已在上面 400
    const result = await transitionListingStatus({
      listingId,
      actorUid: actor.user.uID,
      toStatus: body.to_status ?? body.status ?? '',
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

// ============================================================================
// 本批 · 商品收藏（listing_favorite）+ 卖家轴两条交易读口 —— 5 新口
//   · 全部 `requireActor`（uid 恒取 token 侧 actor，客户端不得声明）；
//   · 成功走 `sendSuccess`；引用缺失走 `sendRefNotFound`（既有 §3.1 形态）；
//     基础设施异常交 `sendInfraMapped`（既有 §14 分类器）；
//   · 收藏三口无资金动作：不写 ledger、不落幂等键 —— 幂等承重墙 =
//     `listing_favorite` 表级 UNIQUE(fav_uid, listing_id)（迁移 0047）。
// ============================================================================

// ---- G1 · GET /api/listing/mine —— 「我发布的」（listing.seller_uid = me 全状态行，listing_id 降序）
app.get('/api/listing/mine', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const rows = await DatabaseService.listListingsBySeller(actor.user.uID, skip, limit);
    sendSuccess(res, rows);
  } catch (error) {
    return sendInfraMapped(res, 'listing.mine', error);
  }
});

// ---- G1b · GET /api/listing/:listingId/edit —— 编辑页统一预填（0059 · **注册点 110 → 111**）
//   授权 = 本人 **或** 管理员（`can_access_admin ∧ (is_admin ∨ permissions∋manage_rewards)`）；
//   两臂返回**同一形状**（与 `GET /api/listing/mine` 行同族 11 键）⇒ 编辑页只需一套预填逻辑。
//   无权限 ⇒ 403 `ACTOR_NOT_ALLOWED`（与写口同形）；行不存在 ⇒ 404（先 404 后 403，不给存在性探针）。
//   ★ 纯读：零写 / 零台账 / 零译文；判定真源 = 服务层 `getListingEditView`（本层不复制授权闸）。
app.get('/api/listing/:listingId/edit', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const listingId = parseInteger(req.params.listingId);
  if (!listingId || listingId <= 0) {
    return sendRefNotFound(res, 'listing', String(req.params.listingId ?? ''), 'listing_not_found');
  }

  try {
    const result = await getListingEditView({
      listingId,
      actorUid: actor.user.uID,
      adminAccess: actor.adminAccess,
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view);
  } catch (error) {
    return sendInfraMapped(res, 'listing.edit', error);
  }
});

// ---- G2 · GET /api/listing-orders/sold —— 「我卖出的」（listing_order.seller_uid = me，order_id 降序；
//          行形与买家轴 GET /api/prize-item 同族 + status）
app.get('/api/listing-orders/sold', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const rows = await DatabaseService.listListingOrdersBySeller(actor.user.uID, skip, limit);
    sendSuccess(res, rows);
  } catch (error) {
    return sendInfraMapped(res, 'listing-orders.sold', error);
  }
});

// ---- G3 · GET /api/favorites —— 「我的收藏」（listing_favorite.fav_uid = me join listing 概要，
//          按收藏时间降序）
app.get('/api/favorites', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const { skip, limit } = getPagination(req);
    const rows = await DatabaseService.listFavoritesByUser(actor.user.uID, skip, limit);
    sendSuccess(res, rows);
  } catch (error) {
    return sendInfraMapped(res, 'favorites.list', error);
  }
});

// ---- G4 · POST /api/favorites —— 收藏（幂等：重复收藏不落第二行，回成功与现态；
//          body.listing_id 先做数字校验 ⇒ 既有 400 形态；listing 行不存在 ⇒ 404 sendRefNotFound）
app.post('/api/favorites', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const body = (req.body || {}) as Record<string, unknown>;
  const listingId = parseInteger(body.listing_id ?? body.listingId, Number.NaN);
  if (!Number.isInteger(listingId) || listingId <= 0) {
    return res.status(400).json(ledgerErrorBody(
      'LEDGER_AMOUNT_INVALID',
      'Request shape is invalid',
      { field: 'listing_id', reason: 'NOT_A_POSITIVE_INTEGER' },
    ));
  }

  try {
    const r = await DatabaseService.createFavoriteRow({ favUid: actor.user.uID, listingId });
    if (!r.row) {
      return sendRefNotFound(res, 'listing', String(listingId), 'listing_not_found');
    }
    return sendSuccess(res, {
      fav_id: r.row.fav_id,
      listing_id: r.row.listing_id,
      time_created: r.row.time_created,
    }, r.outcome === 'existing' ? 'Favorite already exists (idempotent replay)' : 'Favorite added', 200,
      r.outcome === 'existing' ? { idempotent_replay: true } : undefined);
  } catch (error) {
    return sendInfraMapped(res, 'favorites.add', error);
  }
});

// ---- G5 · DELETE /api/favorites/:listingId —— 取消收藏（幂等：删 0 行也回成功；
//          :listingId 非数字 / 缺失 / 0 ⇒ 404 既有 §3.1 形态）
app.delete('/api/favorites/:listingId', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  const listingIdText = String(req.params.listingId ?? '').trim();
  if (!/^\d+$/.test(listingIdText) || listingIdText === '0') {
    return sendRefNotFound(res, 'listing', listingIdText, 'listing_not_found');
  }

  try {
    const listingId = Number(listingIdText);
    const deleted = await DatabaseService.deleteFavoriteRow({ favUid: actor.user.uID, listingId });
    return sendSuccess(res, { listing_id: listingId, deleted });
  } catch (error) {
    return sendInfraMapped(res, 'favorites.delete', error);
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
// ---- P6-TR-1c-FIX-CRON · 注册面修复（**只加 GET，不改语义**）------------------
// Vercel Cron **发 GET**（平台无 body，自带 Bearer 授权头，值取 env CRON_SECRET）；本路由此前只注册
//   `app.post` ⇒ 日级 cron 自上线以来**从未进入 handler**（落到文件末 catch-all ⇒ `route_not_found`）。
//   · **GET = Vercel cron 入口**（无 body ⇒ 走 `req.query.limit/mode/scan` 分支）；
//   · **POST = 人工/旧调用**（p4z-tr1c-01/07、d1p-04 等脚本仍用 POST）；
//   · 两者**同一 handler**（`translateBackfillHandler`）：鉴权闸、参数解析、幂等与回执**一字未改**。
const translateBackfillHandler: RequestHandler = async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return sendError(res, 503, 'CRON_SECRET not configured');
  }
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  if (bearer !== secret && headerSecret !== secret) {
    return sendAuthError(res, 401);
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
};

app.post('/api/translate/backfill', translateBackfillHandler);
app.get('/api/translate/backfill', translateBackfillHandler);

// ============================================================================
// ★ 方案 A · 对账定时化（`ops/bttc-recon-cadence/REPORT.md` §7；Kevin 2026-10-17 批）
//   注册点 +1（`GET /api/ops/recon/ledger`）；门 `p7b-03` 的 AC10-2 同批前推 106 → 107。
//   鉴权体例 = **逐行照搬** `translateBackfillHandler`（唯一真源）：
//     CRON_SECRET 未配 ⇒ 503 fail-loud（绝不默认放行）/ Bearer 或 `x-cron-secret` 不符 ⇒ 401 /
//     通过 ⇒ 干活。密钥只做等值比较，**绝不回显、绝不进日志**。
//   方法只用 GET（Vercel cron 发的是 GET；既有 `translate/backfill` 的 POST/GET 错配已另单修好）。
//   零新错误码（503/401 均为既有形态）；零写库、零迁移、零前端、零 i18n 键。
// ============================================================================
// ============================================================================
// ★ B32 · 对账告警（`OPEN-ITEMS` B32 · Kevin 2026-10-17 裁定 = **D + A**）
//   D（站内）= 漂移 ⇒ 推 Telegram（`OPS_ALERT_UID` 现查 `users.tg_user_id`）；
//              基础设施异常（本 handler 的 catch）⇒ 同样推一条。
//   A（外部）= **只有成功跑完才** ping `RECON_HEARTBEAT_URL`；漂移/异常 ping `/fail`；
//              异常分支**不 ping 成功位**是刻意的（缺 ping = 外部来叫人 = 死人开关语义）。
//   「cron 根本没跑」站内**无解**（官方逐字：未触发时「no runtime log is created」）⇒
//   该情形**只**靠外部心跳的「缺失 ping」覆盖。
//   口径：告警是**旁路**，任何失败（缺 env / 查无此人 / 超时 / 非 2xx）一律静默降级，
//   响应体 / 状态码 / 错误码**一字不变**（仍有界：心跳 3s、发送 3s）。
// ============================================================================

/** 告警旁路兜底：即便 `notifyOps` / `pingHeartbeat` 意外抛出，也绝不影响对账回执。 */
const runAlertSafely = async (label: string, run: () => Promise<unknown>): Promise<void> => {
  try {
    await run();
  } catch (error) {
    console.warn(`[recon] alert channel "${label}" failed:`, error instanceof Error ? error.message : 'ERROR');
  }
};

const opsReconHandler: RequestHandler = async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return sendError(res, 503, 'CRON_SECRET not configured');
  }
  const authHeader = String(req.headers.authorization || '');
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const headerSecret = String(req.headers['x-cron-secret'] || '').trim();
  if (bearer !== secret && headerSecret !== secret) {
    return sendAuthError(res, 401);
  }

  try {
    const report = await runLedgerRecon();
    // 告警面 v1 = 「结构化回执 + console.error 一条」（不接外部服务，见 REPORT §4）。
    // 只打 id / 状态 / 行数 / 差额，**不打 SQL 参数、不打密钥**，便于 Vercel 日志按 `[recon]` 检索。
    if (!report.ok) {
      console.error('[recon] ledger drift detected', JSON.stringify({
        checked_at: report.checked_at,
        duration_ms: report.duration_ms,
        failed: report.checks
          .filter((c) => c.status === 'FAIL')
          .map((c) => ({ id: c.id, rows: c.rows, diff: c.diff ?? null })),
      }));
    }
    // ---- B32 告警面（旁路；任一失败不改回执）--------------------------------
    if (report.ok) {
      // A · 成功跑完 ⇒ ping 成功位（缺 ping = 外部来叫人）
      await runAlertSafely('heartbeat', () => pingHeartbeat(process.env.RECON_HEARTBEAT_URL));
    } else {
      // A · 漂移 ⇒ 显式 ping `/fail`（healthchecks 侧记一红，比「缺 ping」更准）
      await runAlertSafely('heartbeat', () => pingHeartbeat(process.env.RECON_HEARTBEAT_URL, true));
      // D · 漂移 ⇒ 推一条中文摘要（checked_at / duration_ms / 每条失败 check 的 id+rows+diff）
      await runAlertSafely('notify', () => notifyOps(buildDriftAlertText(report)));
    }
    return sendSuccess(res, report, report.ok ? 'Ledger recon completed' : 'Ledger recon detected drift');
  } catch (error) {
    // D · 基础设施异常 ⇒ 推一条（**不** ping 成功位：缺 ping 走外部报警，符合死人开关语义）
    await runAlertSafely('notify', () => notifyOps(buildInfraAlertText(error)));
    // 基础设施异常交**既有** §14 分类器（DB/传输类 ⇒ 503 + 机读 reason），与 backfill 同体例。
    return sendInfraMapped(res, 'ops.recon.ledger', error);
  }
};

app.get('/api/ops/recon/ledger', opsReconHandler);

// ============================================================================
// ★ A5 收口（route 册 v2.31 §41 / data 册 v0.32 §38）· 站内信 + Telegram 绑定
//   注册点 89 → 99（+10 = `/api/messages` 族 6 + `/api/telegram` 族 4；F19 读口扩展 +0）。
//   authz 矩阵（§41.4 写死）：除 webhook（secret 面）外全部 requireActor；零管理员旁路
//   （requireAdmin 不出现在本族任何口）；站内信 6 条永不降级（无 env 依赖）。
// ============================================================================

/** `MSG_*` / `TG_*` 统一错误出口（R107 单形状；i18n 域 = msg.err. / tg.err.，§41.5）。 */
const sendMessagingError = (
  res: Response,
  err: { status: number; code: string; message: string; details: Record<string, unknown> },
) => res.status(err.status).json(ledgerErrorBody(err.code, err.message, err.details, messagingI18nNamespaceOf(err.code)));

/** env-gated 降级（§41.9）：503 + TG_NOT_CONFIGURED（非 500 / 非静默成功，Z8）。 */
const sendTelegramNotConfigured = (res: Response) =>
  sendMessagingError(res, {
    status: 503,
    code: 'TG_NOT_CONFIGURED',
    message: errorMessageOf('TG_NOT_CONFIGURED'),
    details: {},
  });

// ---- `/api/messages` 族（#1–#6 · 站内信面，永不降级）----------------------

// #1 开会话：自然幂等（UNIQUE(listing_id, buyer_uid) 冲突取既有行 ⇒ 重放 created:false）。
app.post('/api/messages/conversations', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const result = await openConversation(actor.session.uID, (req.body || {}).listing_id);
    if (!result.ok) return sendMessagingError(res, result);
    return sendSuccess(res, { conversation_id: result.conversation_id, created: result.created });
  } catch (error) {
    return sendInfraMapped(res, 'messages.conversations.create', error);
  }
});

// #2 会话列表：keyset 游标 (time_updated, conversation_id)，禁 OFFSET（DL25）。
app.get('/api/messages/conversations', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const result = await listConversations(actor.session.uID, {
      beforeTime: req.query.before_time,
      beforeId: req.query.before_id,
      limit: req.query.limit,
      listingId: req.query.listing_id,
    });
    if (!result.ok) return sendMessagingError(res, result);
    return sendSuccess(res, { rows: result.rows, next_cursor: result.next_cursor });
  } catch (error) {
    return sendInfraMapped(res, 'messages.conversations.list', error);
  }
});

// #3 消息列表：参与者准入（Z2）；keyset 游标 = msg_id，禁 OFFSET。
app.get('/api/messages/conversations/:conversationId/messages', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const result = await listMessages(actor.session.uID, req.params.conversationId, {
      beforeMsgId: req.query.before_msg_id,
      limit: req.query.limit,
    });
    if (!result.ok) return sendMessagingError(res, result);
    return sendSuccess(res, {
      conversation: result.conversation,
      rows: result.rows,
      next_before_msg_id: result.next_before_msg_id,
    });
  } catch (error) {
    return sendInfraMapped(res, 'messages.messages.list', error);
  }
});

// #4 发消息：`cli:` 供键幂等（同键同内容 = 重放不计数；同键异内容 = 409）+ 双频次闸；
//   落库成功 ⇒ 对端通知走后台段（waitUntil 体例）：推送失败绝不回滚消息写、绝不改本响应（§41.7）。
app.post('/api/messages/conversations/:conversationId/messages', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const result = await sendMessage(actor.session.uID, req.params.conversationId, body.body, body.create_key ?? body.idempotency_key);
    if (!result.ok) return sendMessagingError(res, result);
    if (!result.idempotent_replay) {
      notifyMessageCounterpart({ conversationId: result.conversation_id, fromUid: actor.session.uID, previewText: result.body });
    }
    return sendSuccess(res, {
      msg_id: result.msg_id,
      conversation_id: result.conversation_id,
      time_created: result.time_created,
      ...(result.idempotent_replay ? { idempotent_replay: true } : {}),
    });
  } catch (error) {
    return sendInfraMapped(res, 'messages.messages.send', error);
  }
});

// #5 读水位推进：天然幂等（单调水位 = max(当前, 最新 msg_id)，A5-DL-G3 触发器兜底）。
app.post('/api/messages/conversations/:conversationId/read', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const result = await markConversationRead(actor.session.uID, req.params.conversationId);
    if (!result.ok) return sendMessagingError(res, result);
    return sendSuccess(res, { last_read_msg_id: result.last_read_msg_id });
  } catch (error) {
    return sendInfraMapped(res, 'messages.read', error);
  }
});

// #6 未读总数：查询期聚合（会话级汇总 Σ，§38.6 无存储计数器）。
app.get('/api/messages/unread-count', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  try {
    const result = await totalUnread(actor.session.uID);
    if (!result.ok) return sendMessagingError(res, result);
    return sendSuccess(res, { unread_total: result.unread_total });
  } catch (error) {
    return sendInfraMapped(res, 'messages.unread-count', error);
  }
});

// ---- `/api/telegram` 族（#7–#10 · env-gated 降级面，§41.9）-----------------

// #7 绑定发起：code = HMAC 签名令牌（uid + iat + exp600 + 签名，不入库不建表，A5-DL-P4）。
app.post('/api/telegram/bind/start', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  if (!isTelegramConfigured()) {
    return sendTelegramNotConfigured(res);
  }
  try {
    const issued = issueBindCode(actor.session.uID);
    return sendSuccess(res, {
      code: issued.code,
      expires_in: issued.expires_in,
      bot_username: telegramRuntimeConfig().botUsername,
    });
  } catch (error) {
    return sendInfraMapped(res, 'telegram.bind.start', error);
  }
});

// #8 解绑：解绑即停推（Z4 / A5-DL-P3）；重复解绑第二次起 = 400 TG_NOT_LINKED。
app.post('/api/telegram/unbind', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  if (!isTelegramConfigured()) {
    return sendTelegramNotConfigured(res);
  }
  try {
    const unbound = await unbindTelegram(actor.session.uID);
    if (!unbound) {
      return sendMessagingError(res, {
        status: 400,
        code: 'TG_NOT_LINKED',
        message: errorMessageOf('TG_NOT_LINKED'),
        details: {},
      });
    }
    return sendSuccess(res, { tg_linked: false });
  } catch (error) {
    return sendInfraMapped(res, 'telegram.unbind', error);
  }
});

// #9 绑定状态：读面隐私红线 —— 绝不回 tg_user_id 数值（判负②，§41.2 #9）。
app.get('/api/telegram/bind/status', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  if (!isTelegramConfigured()) {
    return sendTelegramNotConfigured(res);
  }
  try {
    const status = await readBindStatus(actor.session.uID);
    return sendSuccess(res, status);
  } catch (error) {
    return sendInfraMapped(res, 'telegram.bind.status', error);
  }
});

// #11 反向短码 confirm（tg-bind-v2 · 0048 telegram_bind_request）：站内输入 bot /start 签发的短码完成绑定。
//   校验链（冻结序）：缺码/形状 400 → 查无此码 404（sendRefNotFound，不泄差异原因）→ EXPIRED / CONSUMED
//   400（TG_CODE_INVALID + details.reason，零新错误码）→ 抢绑闸（同号幂等 200 / 抢绑 409）。
//   成功：事务内置 consumed_at + users 落绑 ⇒ 200 { tg_linked, tg_linked_at }；响应绝不回 tg_user_id 数值。
//   防刷：同账号每分钟 10 次（占位，见服务层 TODO）；全仓无既有 429 形态 ⇒ 400 + reason=RATE_LIMITED（待裁）。
app.post('/api/telegram/bind/confirm', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  setPrivateNoStore(res);
  if (!isTelegramConfigured()) {
    return sendTelegramNotConfigured(res);
  }
  const rawCode = (req.body || {}).code;
  if (!checkConfirmRateLimit(actor.session.uID)) {
    return sendMessagingError(res, {
      status: 400,
      code: 'TG_CODE_INVALID',
      message: errorMessageOf('TG_CODE_INVALID'),
      details: { reason: 'RATE_LIMITED' },
    });
  }
  if (!isValidShortBindCode(rawCode)) {
    // 形状闸失败形态走服务层单一出口（reason = SHAPE_INVALID；错误码仍 TG_CODE_INVALID，零新码）。
    return sendMessagingError(res, confirmShapeError());
  }
  try {
    const outcome = await confirmShortBindCode(actor.session.uID, rawCode);
    if (outcome.kind === 'not_found') {
      return sendRefNotFound(res, 'telegram_bind_code', rawCode, 'code_not_found');
    }
    if (outcome.kind === 'failed') {
      const errShape = confirmErrorForOutcome(outcome);
      if (errShape) return sendMessagingError(res, errShape);
      return sendInfraMapped(res, 'telegram.bind.confirm', new Error('unmapped telegram confirm failure'));
    }
    return sendSuccess(res, { tg_linked: true, tg_linked_at: outcome.tg_linked_at });
  } catch (error) {
    return sendInfraMapped(res, 'telegram.bind.confirm', error);
  }
});

// #10 webhook：① secret 校验（401，timing-safe 比对不泄差异原因）→ ② env 校验（503 降级）→
//   ③–⑥ 消费 `/start <code>`。恒 200（Telegram 对非 2xx 会重试）；业务失败只进日志 + bot 回复；
//   无用户鉴权（bot 机器面，§41.4）。secret env 未配置 ⇒ 无可比对值 ⇒ 直接 503 降级（fail-closed，
//   绝不在 secret 缺失时处理业务 = 判负⑤）。
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const cfg = telegramRuntimeConfig();
    if (cfg.webhookSecret) {
      const header = String(req.headers['x-telegram-bot-api-secret-token'] || '');
      const given = Buffer.from(header);
      const expected = Buffer.from(cfg.webhookSecret);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
        return sendMessagingError(res, {
          status: 401,
          code: 'TG_WEBHOOK_UNAUTHORIZED',
          message: errorMessageOf('TG_WEBHOOK_UNAUTHORIZED'),
          details: {},
        });
      }
    }
    if (!isTelegramConfigured()) {
      return sendTelegramNotConfigured(res);
    }

    const update = (req.body || {}) as Record<string, unknown>;
    const message = (update.message || null) as Record<string, unknown> | null;
    const from = (message?.from || null) as Record<string, unknown> | null;
    const chatId = from ? Number(from.id) : NaN;
    const text = message && typeof message.text === 'string' ? message.text : '';

    if (!Number.isFinite(chatId) || chatId === 0 || !text) {
      // 非文本 / 无发送者 update：无业务面 ⇒ 恒 200 空对象（§41.2 #10 出参）。
      return res.status(200).json({});
    }

    let reply: string = REPLY_HINT_TEXT;
    if (text === '/start') {
      // tg-bind-v2：无载荷 /start ⇒ 反向短码签发（0048 表；防刷与撞码重试序见 issueShortBindCode）。
      const issued = await issueShortBindCode(chatId);
      reply = shortBindIssueReplyText(issued);
    } else if (text.startsWith('/start')) {
      const code = text.slice('/start'.length).trim().split(/\s+/)[0] || null;
      const outcome = await consumeBindCode(chatId, code);
      reply = replyTextForOutcome(outcome);
    }

    // bot 回复后台化（响应不因网络抖动变慢）；回复失败只进日志，不改本响应。
    void sendTelegramReply(chatId, reply);
    return res.status(200).json({});
  } catch (error) {
    // webhook 恒 200：内部异常（含消费路径基础设施错误）只进日志，不向 Telegram 返回非 2xx。
    console.error('[telegram.webhook] internal error (responded 200 per Telegram retry semantics):',
      error instanceof Error ? error.message : 'ERROR');
    return res.status(200).json({});
  }
});

// ============================================================================
// 媒体上传两口（route-layer.spec v2.39 §48 / data-layer.spec v0.34 §40 · 表 public.media = 0050）：
//   · POST /api/media —— requireActor（§48.4 #1 无凭证 ⇒ 401）；content_type 三值闭集；base64
//     严格解码（非法 ⇒ 400）；解码后 ≤2MiB（超 ⇒ 400）；魔数与声明类型一致（fail-loud，
//     §48.2「魔数校验不通过不得入库」）；sha256 去重命中 ⇒ 返既有 media_id + deduplicated:true。
//   · GET /api/media/:id —— 公开无闸（§48.3）；命中 200 + Content-Type + immutable 缓存；miss /
//     非数字 id ⇒ 404 走既有 sendRefNotFound（R107 统一 404 口径，承 §48.3 冻结）。
//   · 基础设施异常一律走既有 sendInfraMapped（R107 · 503 族，§48.2「失败响应」行）。
//   · MEDIA_* 错误码 = 本域 400 族，集中定义于下（i18n 指针域 `media.err.*`；**不进**
//     ledger-errors.ts 的 33 码账本闭集 —— 媒体面零资金语义；400 具体借码 = §48.2 归实现单
//     按既有体例取，随质检回写）。
// ============================================================================

/** POST 400 族错误码（本域集中定义 · 语义见逐条注释；不触碰 ledger-errors.ts 账本码闭集） */
const MEDIA_ERROR_CODES = {
  /** content_type 缺失 / 非字符串 / 超三值闭集 {image/webp, image/jpeg, image/png} ⇒ 400 */
  MEDIA_CONTENT_TYPE_INVALID: 'media content_type must be one of image/webp, image/jpeg, image/png',
  /** data_base64 缺失 / 非字符串 / 非 RFC 4648 严格 base64（字符集 · 4 字符组 · padding）/ 解码为空 ⇒ 400 */
  MEDIA_BASE64_INVALID: 'media data_base64 must be a non-empty strict base64 string',
  /** 解码后字节数 > 1MiB（= 1,048,576，§48.2 体积闸；0051 重设的 DB CHECK 同构兜底）⇒ 400 */
  MEDIA_SIZE_EXCEEDED: 'media payload exceeds 1MiB after base64 decode',
  /** 解码字节魔数与声明 content_type 不一致（webp = RIFF….WEBP / jpeg = FF D8 FF / png = 89 50 4E 47）⇒ 400 */
  MEDIA_MAGIC_MISMATCH: 'media bytes do not match the declared content_type',
} as const;

type MediaErrorCode = keyof typeof MEDIA_ERROR_CODES;

const MEDIA_CONTENT_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;
type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

/** R107 形状错误体（同 ledgerErrorBody 形状；i18n 指针域 `media.err.<CODE>`，四语键随前端单补） */
const sendMediaBadRequest = (res: Response, code: MediaErrorCode, details: Record<string, unknown>) =>
  res.status(400).json({
    error: {
      code,
      message: MEDIA_ERROR_CODES[code],
      i18n_key: `media.err.${code}`,
      details,
    },
  });

/** 魔数判据（fail-loud，§48.2）：webp = RIFF….WEBP（12 字节头）/ jpeg = FF D8 FF / png = 89 50 4E 47 */
const MEDIA_MAGIC_CHECKS: Record<MediaContentType, (bytes: Buffer) => boolean> = {
  'image/webp': (b) => b.length >= 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
};

/** RFC 4648 严格 base64：字符集闭集 + 恰 4 字符组 + padding 恰法（Buffer.from(…, 'base64') 是宽松的 ⇒ 必须先过本闸） */
const STRICT_BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const MEDIA_MAX_BYTES = 1 * 1024 * 1024; // 1MiB = 1,048,576（Kevin 2026-10-19 收口；与 0051 的 DB CHECK 同构）

app.post('/api/media', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;

  try {
    const body = (req.body || {}) as Record<string, unknown>;

    // ① content_type 三值闭集（§48.4 #3：超闭集 ⇒ 400）
    const contentType = typeof body.content_type === 'string' ? body.content_type : '';
    if (!(MEDIA_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      return sendMediaBadRequest(res, 'MEDIA_CONTENT_TYPE_INVALID', { content_type: contentType || null });
    }

    // ② base64 严格解码（非法 ⇒ 400；解码为空同样非法）
    const dataBase64 = typeof body.data_base64 === 'string' ? body.data_base64 : '';
    if (!dataBase64 || !STRICT_BASE64_RE.test(dataBase64)) {
      return sendMediaBadRequest(res, 'MEDIA_BASE64_INVALID', { data_base64_chars: dataBase64.length });
    }
    const bytes = Buffer.from(dataBase64, 'base64');
    if (bytes.length === 0) {
      return sendMediaBadRequest(res, 'MEDIA_BASE64_INVALID', { data_base64_chars: dataBase64.length });
    }

    // ③ 体积闸：解码后 ≤1MiB（§48.4 #2 超 ⇒ 400；0051 重设的 size_bytes CHECK 同构兜底）
    if (bytes.length > MEDIA_MAX_BYTES) {
      return sendMediaBadRequest(res, 'MEDIA_SIZE_EXCEEDED', { decoded_bytes: bytes.length, max_bytes: MEDIA_MAX_BYTES });
    }

    // ④ 魔数 fail-loud：声明类型与实际字节不一致 ⇒ 400（§48.2「魔数校验不通过不得入库」）
    if (!MEDIA_MAGIC_CHECKS[contentType as MediaContentType](bytes)) {
      return sendMediaBadRequest(res, 'MEDIA_MAGIC_MISMATCH', { content_type: contentType, decoded_bytes: bytes.length });
    }

    // ⑤ 入库（sha256 去重：同字节重传返既有 id，§48.4 #6；size_bytes = 解码后字节数）
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const result = await DatabaseService.createMedia({
      sha256,
      contentType,
      bytes,
      sizeBytes: bytes.length,
      ownerUid: actor.user.uID,
    });

    return sendSuccess(res, {
      url: `/api/media/${result.row.media_id}`,
      media_id: result.row.media_id,
      sha256: result.row.sha256,
      size_bytes: result.row.size_bytes,
      deduplicated: result.outcome === 'existing',
    });
  } catch (error) {
    return sendInfraMapped(res, 'media.upload', error);
  }
});

app.get('/api/media/:id', async (req, res) => {
  const idRaw = String(req.params.id ?? '');
  // §48.3：非数字路径段 / miss ⇒ R107 统一 404（既有 sendRefNotFound；承 §3 detail-miss 口径）
  if (!/^[1-9]\d*$/.test(idRaw)) {
    return sendRefNotFound(res, 'media', idRaw, 'media_not_found');
  }
  try {
    const media = await DatabaseService.getMediaById(Number(idRaw));
    if (!media) {
      return sendRefNotFound(res, 'media', idRaw, 'media_not_found');
    }
    // 内容寻址 ⇒ 不可变缓存语义（§48.3 冻结字面：public, max-age=31536000, immutable）
    res.setHeader('Content-Type', media.content_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.status(200).send(media.bytes);
  } catch (error) {
    return sendInfraMapped(res, 'media.get', error);
  }
});

// ============================================================================
// ★★ 项目（打工 / 工资）域 · 七口（data-layer.spec §40.15 · route-layer.spec §49.19）
// ----------------------------------------------------------------------------
// R1 GET  /api/project/all              公开 · 列表（仅 recruiting / working；带在职数派生）
//    ★ 登录态带 token ⇒ 每行**加性** `my_role` / `my_hired_at` / `next_claim_at`（匿名 ⇒ 三键缺省）；
//      前端 `/wage` 据此把【加入】换成【领工资】并按 `next_claim_at` 倒计时（零新路由）。
// R2 GET  /api/project/:ref             公开 · 详情（三形态 0068：全数字 ⇒ id OR snowflake · slug 格式 ⇒ slug 等值；
//                                       加性 `campaigns[]` 嵌套 = 该项目名下活动→任务→子任务）
// R3 POST /api/project                  用户 · 建项目 + 同事务扣建费入平台收入
// R4 POST /api/project/:id/apply        用户 · 招工（满足即直接录用；招满同事务转 working）
// R5 POST /api/project/:id/claim        用户 · 领工资（逐小时桶 batt + 币种定额，两腿同事务）
// R6 POST /api/project/:id/leave        用户 · 离职（幂等）
// R7 PATCH /api/project/:projectId      管理员 `manage_tasks` · 状态机 / 名额扩缩 / 工资与间隔
//
// 注册顺序判据（route #62）：R1 必须在 R2 **之前**（否则 `all` 被 `:ref` 吞成 404）。
// 错误码：零新码 —— 400 `LEDGER_AMOUNT_INVALID` / 404 `LEDGER_REF_NOT_FOUND` /
//   409 `LEDGER_INSUFFICIENT_BALANCE` / 403 `AUTH_FORBIDDEN`，逐场景理由在 `details.reason`。
// 注册点 111 → 118（get 50→52 / post 57→61 / patch 1→2 / delete 3）。
// ============================================================================
/**
 * R1 列表的**可选身份**（零新路由 · 承 §49.18 campaign 详情同族体例）：
 * 登录态 ⇒ 每行加性 `my_role` / `my_hired_at` / `next_claim_at`（`/wage` 卡片据此把【加入】换成
 * 【领工资】并按 `next_claim_at` 显示倒计时）；匿名 ⇒ **三键缺省**。
 * 身份解析失败 / 基础设施异常 ⇒ 按公众处理（列表照常公开可读，不落 401）。
 */
const resolveOptionalProjectViewer = async (req: Request): Promise<{ viewerUid: number | null }> => {
  try {
    const resolved = await resolveActor(req);
    if (isActorFailure(resolved)) return { viewerUid: null };
    const uid = Number(resolved.user?.uID);
    return { viewerUid: Number.isSafeInteger(uid) && uid > 0 ? uid : null };
  } catch {
    return { viewerUid: null }; // 基础设施异常 ⇒ 保守按公众处理（不落 401/403）
  }
};

app.get('/api/project/all', async (req, res) => {
  try {
    // 公开可浏览（未登录零门禁）；仅**登录态**加性透出个人面三键（零新路由）
    const viewer = await resolveOptionalProjectViewer(req);
    const rows = await listProjects(undefined, { viewerUid: viewer.viewerUid });
    // 带个人面的载荷不得进共享缓存（匿名分支维持原样：不设缓存头 = 既有行为零变化）
    if (viewer.viewerUid !== null) {
      setPrivateNoStore(res);
      res.setHeader('Vary', 'Authorization');
    }
    return sendSuccess(res, rows, 'Project list (public)');
  } catch (error) {
    return sendInfraMapped(res, 'project.list', error);
  }
});

app.get('/api/project/:ref', async (req, res) => {
  const ref = String(req.params.ref ?? '');
  // 三形态判定表（0068）：全数字（≤20 位）= 数值 id/snowflake · slug 格式 = slug 等值 · 其他 ⇒ 404（**不得** 500 —— route #67）
  if (!isProjectReadRef(ref)) return sendRefNotFound(res, 'project', ref, 'project_not_found');
  try {
    // 与 campaign R2 同族的可选身份：管理员（manage_tasks）或项目 owner ⇒ 嵌套含 draft 活动；登录态 ⇒ 个人面
    const viewer = await resolveOptionalCampaignViewer(req);
    const view = await getProjectDetailByRef(ref, { viewerUid: viewer.viewerUid, adminActor: viewer.admin });
    if (!view) return sendRefNotFound(res, 'project', ref, 'project_not_found');
    // 带 draft/owner 面的载荷不得进共享缓存（匿名分支维持原样：不设缓存头 = 既有行为零变化）
    if (viewer.viewerUid !== null) {
      setPrivateNoStore(res);
      res.setHeader('Vary', 'Authorization');
    }
    return sendSuccess(res, view, 'Project detail (public)');
  } catch (error) {
    return sendInfraMapped(res, 'project.get', error);
  }
});

// ============================================================================
// ★ 首页「热门任务」公开读口（0069 · 2026-10-21 派单 · 后端小步单）
// ----------------------------------------------------------------------------
// GET /api/home/campaign-tasks —— 首页热门任务卡的数据面（公开 · 零门禁）：
//   · 行集 = active campaign 下非 draft task（project 非 ended），按 time_created DESC 取 20；
//   · 空 ⇒ 200 []（前端按「无真数据 ⇒ mock 补足」降级，版块不塌）；
//   · 公共缓存 = 同族 `setPublicCache`（30s + stale-while-revalidate 300s）；
//   · 基础设施异常 ⇒ `sendInfraMapped`（503 + 机读 reason），**绝不**硬编码 500。
// 注册点 128 ⇒ 129（get 55 ⇒ 56）。
// ============================================================================
app.get('/api/home/campaign-tasks', async (_req, res) => {
  try {
    const rows = await listHomeCampaignTasks();
    setPublicCache(res);
    return sendSuccess(res, rows, 'Home campaign tasks (public)');
  } catch (error) {
    return sendInfraMapped(res, 'home.campaign_tasks', error);
  }
});

app.post('/api/project', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const result = await createProjectVerb({
      actorUid: Number(actor.user.uID),
      body: req.body ?? {},
      headerKey: req.header('idempotency-key'),
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(
      res,
      result.view,
      result.replay ? 'Project created (idempotent replay)' : 'Project created',
      result.replay ? 200 : 201,
    );
  } catch (error) {
    return sendInfraMapped(res, 'project.create', error);
  }
});

app.post('/api/project/:id/apply', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.id ?? '');
    if (!isProjectRef(ref)) return sendRefNotFound(res, 'project', ref, 'project_not_found');
    const result = await applyProjectVerb({ actorUid: Number(actor.user.uID), ref });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Project application (already hired)' : 'Project application accepted');
  } catch (error) {
    return sendInfraMapped(res, 'project.apply', error);
  }
});

app.post('/api/project/:id/claim', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.id ?? '');
    if (!isProjectRef(ref)) return sendRefNotFound(res, 'project', ref, 'project_not_found');
    const result = await claimProjectWageVerb({ actorUid: Number(actor.user.uID), ref });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Project wage claimed');
  } catch (error) {
    return sendInfraMapped(res, 'project.claim', error);
  }
});

app.post('/api/project/:id/leave', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.id ?? '');
    if (!isProjectRef(ref)) return sendRefNotFound(res, 'project', ref, 'project_not_found');
    const result = await leaveProjectVerb({ actorUid: Number(actor.user.uID), ref });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, result.replay ? 'Project leave (no-op)' : 'Project left');
  } catch (error) {
    return sendInfraMapped(res, 'project.leave', error);
  }
});

app.patch('/api/project/:projectId', async (req, res) => {
  // 管理面权限键 = `manage_tasks`（**不是** manage_rewards —— §49.19.1 / 判负 #66）
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;
  try {
    const ref = String(req.params.projectId ?? '');
    if (!isProjectRef(ref)) return sendRefNotFound(res, 'project', ref, 'project_not_found');
    const result = await patchProjectVerb({ ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Project updated');
  } catch (error) {
    return sendInfraMapped(res, 'project.patch', error);
  }
});

// ============================================================================
// ★★ 活动任务体系 · 九口（data-layer.spec §40.14 · route-layer.spec §49.18）
// ----------------------------------------------------------------------------
// R1 GET   /api/campaign/all                        公开 · active 活动（嵌套 active 任务 → 全量子任务）
// R2 GET   /api/campaign/:ref                       公开 · 详情（draft 对公众 404 / 对管理员 200）
// R3 POST  /api/campaign/subtask/:subtaskId/proof   用户 · 提凭证（提交即通过；prediction 一人一票）
// R4 POST  /api/campaign                            管理员 manage_tasks · 建活动（status 恒 draft）
// R5 PATCH /api/campaign/:campaignId                管理员 · 改活动（闭集 5 键 ＋ 状态机）
// R6 POST  /api/campaign/:campaignId/task           管理员 · 加任务（可内联 subtasks[]）
// R7 PATCH /api/campaign/task/:taskId               管理员 · 改任务（`subtasks[]` 按 id upsert ＋
//                                                   闭集键 `subtasks_remove` 删；prediction 发布后冻结）
// R8 POST  /api/campaign/subtask/:subtaskId/settle  管理员 · prediction 结算（回填 ＋ 分发同一事务）
// R9 POST  /api/campaign/task/:taskId/reward        管理员 · task 完成奖手动发放（全部子任务完成后）
// R10 GET  /api/campaign/task/:taskId               公开 · 任务详情页读口（draft / ended 对公众 404；
//                                                   owner / 管理员同形状 200 —— 本单加性第十口）
//
// 注册顺序判据（route #55）：R1 必须先于 R2 —— 否则字面 `all` 被 `:ref` 吞成 404。
// 错误码：零新码 —— 400 `LEDGER_AMOUNT_INVALID` / 404 `LEDGER_REF_NOT_FOUND` /
//   409 `LEDGER_INSUFFICIENT_BALANCE` / 403 `AUTH_FORBIDDEN`，逐场景理由在 `details.reason`。
// 注册点 118 → 127（get +2 / post +5 / patch +2；put 0 / delete 0 不动）。
// ★ 现取 129（home-campaign-tasks +1）→ **130**（本单 R10 `GET /api/campaign/task/:taskId` +1；
//   get 56 → 57 / post 66 / patch 4 / delete 3 / put 0）。
// ============================================================================
/**
 * 详情读口的**可选身份**（零新路由）：R2 的 draft 放宽与登录态附加共用这一次 `resolveActor`。
 * · `admin` ⇒ 「draft 对公众 404 / 对 `manage_tasks` 管理员 200」按身份放宽（承 §49.15 体例；
 *   判定谓词与 `requireAdmin(req,res,'manage_tasks')` 逐字同源：can_access_admin ∧ (is_admin ∨ 权限)）；
 * · `viewerUid` ⇒ 登录态附加 `my_proof` / `my_outcome`（匿名 ⇒ null ⇒ 两键缺省）。
 * 身份解析失败 / 基础设施异常一律按「公众 + 无个人面」处理（保守、不落 401/403、不泄露存在性）。
 */
const resolveOptionalCampaignViewer = async (req: Request): Promise<{ admin: boolean; viewerUid: number | null }> => {
  try {
    const resolved = await resolveActor(req);
    if (isActorFailure(resolved)) return { admin: false, viewerUid: null };
    const admin = resolved.adminAccess.can_access_admin
      && (resolved.adminAccess.is_admin || hasRequiredPermission(resolved, 'manage_tasks'));
    const uid = Number(resolved.user?.uID);
    return { admin, viewerUid: Number.isSafeInteger(uid) && uid > 0 ? uid : null };
  } catch {
    return { admin: false, viewerUid: null }; // 基础设施异常 ⇒ 保守按公众处理（不泄露 draft 存在性）
  }
};

app.get('/api/campaign/all', async (_req, res) => {
  try {
    const rows = await listActiveCampaigns();
    return sendSuccess(res, rows, 'Campaign list (public)');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.list', error);
  }
});

app.get('/api/campaign/:ref', async (req, res) => {
  const ref = String(req.params.ref ?? '');
  // 非数字 ref ⇒ 404（**不得** 500 —— route #60）
  if (!isCampaignRef(ref)) return sendRefNotFound(res, 'campaign', ref, 'campaign_not_found');
  try {
    // draft 对公众 = 404（不泄露存在性）；持 `manage_tasks` 的管理员 200（同一读口按身份放宽）
    // 登录态同一读口加性附加 `my_proof` / `my_outcome`（匿名 ⇒ 键缺省；零新路由）
    const viewer = await resolveOptionalCampaignViewer(req);
    const view = await getCampaignByRef(ref, { includeDraft: viewer.admin, viewerUid: viewer.viewerUid });
    if (!view) return sendRefNotFound(res, 'campaign', ref, 'campaign_not_found');
    return sendSuccess(res, view, 'Campaign detail (public)');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.get', error);
  }
});

// R2b GET /api/campaign/task/:taskId —— 任务自己的页面（`/task/:taskId`）的读面。
//   · 公开面（`c.active ∧ t≠draft ∧ pr≠ended`，与首页热门任务读口逐字同口径）⇒ 200 + `setPublicCache` 30s；
//   · 非公开（draft / ended）⇒ 匿名与第三方 **404**（`LEDGER_REF_NOT_FOUND` + `reason='task_not_public'`，
//     借码零新码、不泄露存在性）；owner（`project.owner_uid` = 本人）∨ `manage_tasks` 管理员 ⇒ 同形状 200；
//   · ★ 缓存头按身份面分流：非公开面（owner/admin 放宽）恒 `private, no-store` —— 绝不能把 draft 内容
//     写进 CDN（同 `/api/home` 的既有分流体例）。
app.get('/api/campaign/task/:taskId', async (req, res) => {
  const ref = String(req.params.taskId ?? '');
  if (!isCampaignRef(ref)) return sendRefNotFound(res, 'task', ref, 'task_not_found');
  try {
    const viewer = await resolveOptionalCampaignViewer(req);
    const view = await getTaskDetailByRef(ref, { includeDraft: viewer.admin, actorUid: viewer.viewerUid });
    if (!view) return sendRefNotFound(res, 'task', ref, 'task_not_public');
    if (isTaskPubliclyVisible({
      task_status: view.status,
      campaign_status: view.campaign.status,
      project_status: view.project.status,
    })) {
      setPublicCache(res);
    } else {
      setPrivateNoStore(res);
    }
    return sendSuccess(res, view, 'Campaign task detail (public)');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.task.detail', error);
  }
});

app.post('/api/campaign/subtask/:subtaskId/proof', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.subtaskId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'subtask', ref, 'subtask_not_found');
    const result = await submitProofVerb({ actorUid: Number(actor.user.uID), subtaskRef: ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Subtask proof submitted');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.proof', error);
  }
});

app.post('/api/campaign/subtask/:subtaskId/settle', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;
  try {
    const ref = String(req.params.subtaskId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'subtask', ref, 'subtask_not_found');
    const result = await settlePredictionVerb({ subtaskRef: ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Prediction settled');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.settle', error);
  }
});

app.post('/api/campaign', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    // 0068 权限扩容：manage_tasks 管理员 **∨** project_owner（body.project_id 所指项目 owner = 本人 ∧ ≠ ended）
    // 谓词与 requireAdmin/详情读口同源；owner 上下文由服务层读口提供，决策纯函数与门共用。
    const actorUid = Number(actor.user.uID);
    const adminActor = actor.adminAccess.can_access_admin
      && (actor.adminAccess.is_admin || hasRequiredPermission(actor, 'manage_tasks'));
    const bodyObj = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
      ? req.body as Record<string, unknown> : {};
    const pidRaw = bodyObj.project_id;
    const pidText = typeof pidRaw === 'number' ? String(pidRaw) : typeof pidRaw === 'string' ? pidRaw.trim() : '';
    const ownerContext = /^\d+$/.test(pidText) ? await getProjectOwnerContext(pidText) : null;
    const denied = authorizeProjectScopedCreate({ actorUid, adminActor, ownerContext, projectId: pidText || null });
    if (denied) return sendVerbError(res, denied);

    const result = await createCampaignVerb({ body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Campaign created', 201);
  } catch (error) {
    return sendInfraMapped(res, 'campaign.create', error);
  }
});

app.patch('/api/campaign/:campaignId', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;
  try {
    const ref = String(req.params.campaignId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'campaign', ref, 'campaign_not_found');
    const result = await patchCampaignVerb({ ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Campaign updated');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.patch', error);
  }
});

app.post('/api/campaign/:campaignId/task', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.campaignId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'campaign', ref, 'campaign_not_found');
    // 0068 权限扩容：task 建 = manage_tasks 管理员 ∨ project_owner（归属链 campaign.project_id 校验）
    const adminActor = actor.adminAccess.can_access_admin
      && (actor.adminAccess.is_admin || hasRequiredPermission(actor, 'manage_tasks'));
    const ownerContext = adminActor ? null : await getCampaignAuthzContext(ref);
    const denied = authorizeProjectScopedCreate({
      actorUid: Number(actor.user.uID),
      adminActor,
      ownerContext,
      projectId: ownerContext?.project_id ?? null,
    });
    if (denied) return sendVerbError(res, denied);

    const result = await createTaskVerb({ campaignRef: ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Campaign task created', 201);
  } catch (error) {
    return sendInfraMapped(res, 'campaign.task.create', error);
  }
});

app.patch('/api/campaign/task/:taskId', async (req, res) => {
  const actor = await requireActor(req, res);
  if (!actor) return;
  try {
    const ref = String(req.params.taskId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'task', ref, 'task_not_found');
    // 0068 权限扩容：本口含 `subtasks[]` 内联**新增**（subtask 创建口之一）⇒ 与 task 建同权限面：
    // manage_tasks 管理员 ∨ project_owner（归属链 task → campaign.project_id 校验）
    const adminActor = actor.adminAccess.can_access_admin
      && (actor.adminAccess.is_admin || hasRequiredPermission(actor, 'manage_tasks'));
    const ownerContext = adminActor ? null : await getTaskAuthzContext(ref);
    const denied = authorizeProjectScopedCreate({
      actorUid: Number(actor.user.uID),
      adminActor,
      ownerContext,
      projectId: ownerContext?.project_id ?? null,
    });
    if (denied) return sendVerbError(res, denied);

    const result = await patchTaskVerb({ ref, body: req.body ?? {} });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(res, result.view, 'Campaign task updated');
  } catch (error) {
    return sendInfraMapped(res, 'campaign.task.patch', error);
  }
});

app.post('/api/campaign/task/:taskId/reward', async (req, res) => {
  const actor = await requireAdmin(req, res, 'manage_tasks');
  if (!actor) return;
  try {
    const ref = String(req.params.taskId ?? '');
    if (!isCampaignRef(ref)) return sendRefNotFound(res, 'task', ref, 'task_not_found');
    const result = await grantTaskRewardVerb({
      ref,
      body: req.body ?? {},
      headerKey: req.header('idempotency-key'),
    });
    if (!result.ok) return sendVerbError(res, result);
    return sendSuccess(
      res,
      result.view,
      result.replay ? 'Task completion reward (idempotent replay)' : 'Task completion reward granted',
      result.replay ? 200 : 201,
    );
  } catch (error) {
    return sendInfraMapped(res, 'campaign.task.reward', error);
  }
});

app.use((req, res) => {
  sendRefNotFound(res, 'endpoint', req.path, 'route_not_found');
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`TypeScript backend running on port ${PORT}`);
    console.log('Using Neon PostgreSQL for Seafood API routes');
  });
}

export default app;
