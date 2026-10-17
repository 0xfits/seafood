/**
 * 对账告警 · 站内 Telegram 推送 + 外部心跳（`OPEN-ITEMS` B32 · 落地形态 = **D + A**）
 * ================================================================================
 * Kevin 裁定（2026-10-17）：`B32` = **D（站内）+ A（外部）**
 *   · **D** = 漂移 / 基础设施异常 ⇒ 直接推 Telegram（本文件的 `notifyOps`）
 *   · **A** = **成功跑完才** ping healthchecks.io；没 ping ⇒ 它来叫人（本文件的 `pingHeartbeat`）
 *     —— 这是**唯一**能覆盖「cron 根本没跑」的形态：Vercel 官方逐字「Cron job delivery is
 *     best effort … your function does not execute, and **no runtime log is created** for that
 *     scheduled run」⇒ 该情形站内**无任何日志**可查，只有**缺失的 ping** 可见。
 *
 * ★ 铁律（写死，改动前先读）：
 *   ① **绝不阻断主流程**：本文件任何函数都**不向上抛**。配置缺失 / 查无此人 / 未绑 Telegram /
 *      fetch 失败 / 超时 / 非 2xx ⇒ 一律静默降级成 `{sent:false, reason}` 或一条 `console.warn`。
 *      对账回执（200 + `data.ok`）与状态码**永不**因告警面失败而改变（告警是旁路，不是判据）。
 *   ② **不收密文进 env**：收件人口径 = `OPS_ALERT_UID`（站内 uid，**非敏感**）⇒ 服务端现查
 *      `users.tg_user_id`。**不**在 env 里存 chat_id：告警跟随用户绑定的变化（解绑即停推），
 *      且 env 面不出现任何「一眼敏感」的值。
 *   ③ **文案不含秘密**：不发 token / 不发连接串 / 不发 SQL 参数 / 不发心跳 URL 本身
 *      （ping URL 的 UUID 就是凭据）。所有外发文本一律过 `redactSensitive()` 与 300 字上限。
 *   ④ 零新路由、零迁移、零新错误码、零前端改动 —— 本文件只被 `index.ts` 的既有
 *      `opsReconHandler` 调用。
 *
 * 两个副作用出口（本单的全部行为面）：
 *   · `notifyOps(text)`            —— 查 uid ⇒ tg_user_id ⇒ `sendTelegramReply`
 *   · `pingHeartbeat(url, fail)`   —— 3s 超时的单次 GET；`fail=true` ⇒ `${url}/fail`
 * 外加一个**纯**格式器 `buildDriftAlertText()`（无 IO，供路由层复用与离线探针直测）。
 */
import { readQuery } from './db';
import { sendTelegramReply } from './telegram-service';
import type { ReconReport } from './ops-recon';

// ---------------------------------------------------------------- 常量

/** 单条消息上限（「不超过 300 字」= 300 个码点，不是字节） */
export const OPS_ALERT_MAX_CHARS = 300;

/** 心跳单次 ping 的硬上限 —— 心跳慢不得拖住对账回执 */
export const HEARTBEAT_TIMEOUT_MS = 3000;

/**
 * Telegram 发送的硬上限。`sendTelegramReply` 自身**不带**超时（它只吞错，不设界），
 * 若 api.telegram.org 挂起，会让 handler 一直不返回 ⇒ 这里用 `Promise.race` 加一道界：
 * 超时即视为「未确认送达」，**不改响应**（改的只是返回值里的 reason）。
 */
export const NOTIFY_TIMEOUT_MS = 3000;

/** 错误摘要上限（再长也没人看；且更长的串更容易带出无关上下文） */
const ERROR_BRIEF_MAX_CHARS = 140;

// ---------------------------------------------------------------- 脱敏 / 截断（对外文本的唯一出口）

/**
 * 脱敏表（顺序即优先级；一律替换成 `***`，绝不「保留前缀」式打码 —— 前缀足以泄标识）。
 * 覆盖本仓真实会踩到的四类：连接串口令、Telegram bot token（`<digits>:<secret>`）、
 * JWT、长 hex/base64 串（SECRET_KEY / HMAC 令牌 / 心跳 UUID 的常见形状）。
 */
const SENSITIVE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // `scheme://user:pass@host` ⇒ 口令与用户名一起抹掉（保留 scheme/host 便于定位是哪条库）
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:@/]+:[^\s@/]+@/gi, '$1***:***@'],
  // Telegram bot token 形状：`<bot_id>:<35 位 secret>`
  [/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g, '***'],
  // JWT
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '***'],
  // `sk_live_… / pk_test_…` 形态的支付/平台密钥
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{6,}\b/g, '***'],
  // 长 hex（≥32）与长 base64url（≥40）串：SECRET_KEY / 心跳 UUID / HMAC 签名
  [/\b[A-Fa-f0-9]{32,}\b/g, '***'],
  [/\b[A-Za-z0-9_-]{40,}\b/g, '***'],
];

/** 对外文本脱敏（纯函数，幂等；先抹凭据再截断，避免截断把 creds 切成「看似安全」的残片） */
export const redactSensitive = (raw: string): string => {
  let out = String(raw ?? '');
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) out = out.replace(pattern, replacement);
  return out;
};

/** 折叠空白 + 脱敏 + 按**码点**截到 `max`（超限补 `…`）—— 所有外发文案的唯一收敛点 */
const clampText = (raw: string, max: number): string => {
  const flattened = redactSensitive(raw).replace(/\s+/g, ' ').trim();
  const chars = Array.from(flattened); // 码点切分：emoji / 中文不被切成半个代理对
  if (chars.length <= max) return flattened;
  return `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
};

/** 异常 → 一行可外发的摘要（脱敏 + 上限；**只取 message**，绝不串话 stack / 参数） */
export const briefError = (error: unknown): string => {
  const message = error instanceof Error
    ? error.message
    : (typeof error === 'string' ? error : (error === null || error === undefined ? 'unknown' : String(error)));
  const oneLine = clampText(message, ERROR_BRIEF_MAX_CHARS);
  return oneLine || 'unknown';
};

// ---------------------------------------------------------------- 文案（纯函数）

/**
 * 漂移摘要（中文纯文本、单条）：必带 `checked_at` / `duration_ms` / 每条失败 check 的
 * `id` + `rows` + `diff`。为压缩体长，键名用短式 `rows=` / `diff=`（机读友好、便于检索）。
 */
export const buildDriftAlertText = (report: ReconReport): string => {
  const failed = report.checks.filter((c) => c.status === 'FAIL');
  const items = failed.map((c) => {
    const diff = c.diff === undefined || c.diff === null ? '-' : String(c.diff);
    return `${c.id} rows=${c.rows} diff=${diff}`;
  });
  const head = `对账漂移 ${report.checked_at} 用时${report.duration_ms}ms 失败${failed.length}/${report.checks.length}项`;
  return clampText(items.length > 0 ? `${head}: ${items.join('; ')}` : head, OPS_ALERT_MAX_CHARS);
};

/** 基础设施异常摘要（中文纯文本、单条；错误原文过 `briefError` 脱敏） */
export const buildInfraAlertText = (error: unknown): string =>
  clampText(`对账执行异常: ${briefError(error)}`, OPS_ALERT_MAX_CHARS);

// ---------------------------------------------------------------- D · 站内推送

export interface NotifyResult {
  /** 是否**交到了** Telegram 发送层（`true` 不等于「Telegram 已确认送达」，见下） */
  sent: boolean;
  /** 机读原因：配置缺失 / 查无此人 / 未绑定 / 超时 / 异常 —— 供日志与探针断言 */
  reason: string;
}

/**
 * 推一条运维告警给 `OPS_ALERT_UID` 绑定的 Telegram 账号。
 *
 * 收件人口径（**不存 chat_id 进 env**）：
 *   `OPS_ALERT_UID`（如 `100`，非敏感）⇒ `SELECT tg_user_id FROM public.users WHERE uid = $1`
 *   ⇒ 有值才发；无 env / 非数字 / 查无该行 / `tg_user_id IS NULL` ⇒ **不发**，返回 reason。
 *
 * 降级链（任一环失败都不抛）：
 *   缺 `TELEGRAM_BOT_TOKEN` ⇒ `sendTelegramReply` 自己 `console.warn` 后 return（既有体例）
 *   ⇒ 本函数据 token 是否在配置面**如实**回报 `sent:false`，不谎报成功。
 *
 * 返回值仅用于日志/探针；**调用方不得**用它改变对账回执（`index.ts` 侧另有 try/catch 兜底，
 * 即便把本函数改成直接 throw，响应也必须仍是既有的 200/503 形态）。
 */
export const notifyOps = async (text: string): Promise<NotifyResult> => {
  try {
    const rawUid = String(process.env.OPS_ALERT_UID ?? '').trim();
    if (!rawUid) return { sent: false, reason: 'OPS_ALERT_UID not configured' };
    if (!/^\d+$/.test(rawUid)) return { sent: false, reason: 'OPS_ALERT_UID not numeric' };
    const uid = Number(rawUid);
    if (!Number.isSafeInteger(uid) || uid <= 0) return { sent: false, reason: 'OPS_ALERT_UID out of range' };

    // 只读单语句 ⇒ 走只读池（与 ops-recon 同层；不占显式事务）
    const rows = await readQuery<{ tg_user_id: string | number | null }>(
      'SELECT tg_user_id FROM public.users WHERE uid = $1 LIMIT 1',
      [uid],
    );
    const row = rows[0];
    if (!row) return { sent: false, reason: 'OPS_ALERT_UID user not found' };

    // `tg_user_id` 是 bigint ⇒ 驱动可能回字符串，一律先 Number 归一（本仓体例）
    if (row.tg_user_id === null || row.tg_user_id === undefined) {
      return { sent: false, reason: 'OPS_ALERT_UID user has no telegram binding' };
    }
    const chatId = Number(row.tg_user_id);
    if (!Number.isSafeInteger(chatId) || chatId <= 0) {
      return { sent: false, reason: 'tg_user_id not a valid numeric chat id' };
    }

    const body = clampText(text, OPS_ALERT_MAX_CHARS);
    if (!body) return { sent: false, reason: 'empty alert text' };

    // 发送层自身会吞错（非 2xx / 网络异常只 warn），故这里再加一道**时长**界：
    // 超时 = 未确认送达，但仍然不抛、不改响应。
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        sendTelegramReply(chatId, body),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            console.warn('[ops-alert] telegram send exceeded time budget (not confirmed)');
            resolve();
          }, NOTIFY_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim()) {
      // 发送层已降级为「只 warn」 ⇒ 如实回报未送达（不谎报）
      return { sent: false, reason: 'TELEGRAM_BOT_TOKEN not configured (telegram-service degraded to log-only)' };
    }
    return { sent: true, reason: 'handed to telegram-service' };
  } catch (error) {
    // 查库失败 / 发送层意外抛出 ⇒ 只记一行，绝不向上抛
    console.warn('[ops-alert] notifyOps degraded:', briefError(error));
    return { sent: false, reason: `notify failed: ${briefError(error)}` };
  }
};

// ---------------------------------------------------------------- A · 外部心跳

/**
 * ping 外部死人开关（healthchecks.io 免费档）。
 *
 * · `url` 缺 / 空 ⇒ **直接 return**（未配置心跳 = 静默降级，不算失败、不打日志 ——
 *   否则本地开发与未配 env 的环境会被无意义告警刷屏）。
 * · `fail=true` ⇒ ping `${url}/fail`（healthchecks 的「显式失败」形态，仍算一次 ping）。
 * · 3 秒硬上限（`AbortController`）；任何异常 / 超时 / 非 2xx **一律吞掉**，只 `console.warn`。
 *   ★ 绝不能因心跳失败把对账判红：心跳是**外部**观察面，不是对账判据。
 * ★ 日志里**不打 URL**（ping URL 里的 UUID 就是凭据）。
 */
export const pingHeartbeat = async (url: string | undefined, fail = false): Promise<void> => {
  const base = String(url ?? '').trim();
  if (!base) return; // 未配置 ⇒ 静默（无 ping = 外部侧会叫人，这是设计意图，不是错误）

  const target = fail ? `${base.replace(/\/+$/, '')}/fail` : base;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    const response = await fetch(target, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      // 只回状态码，不回 URL（URL 含凭据）
      console.warn(`[ops-alert] heartbeat ping non-2xx: ${response.status}`);
    }
  } catch (error) {
    console.warn('[ops-alert] heartbeat ping failed:', briefError(error));
  } finally {
    clearTimeout(timer);
  }
};
