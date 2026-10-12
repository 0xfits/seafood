/**
 * A5 收口 · Telegram bot 绑定服务层（route 册 v2.31 §41.2 #7–#10 / data 册 v0.32 §38.4）
 * ================================================================================
 * 口径（冻结，逐条可回溯）：
 *   · 隐私红线（A5-DL-P1 / Z4）：库内只落 `users.tg_user_id`（数字 ID）+ `tg_linked_at`；
 *     Telegram 载体里的公开标识（username / first_name / language_code 等）**只在内存中**
 *     用于 bot 回复文案，绝不落库、绝不出现在任何读口响应（`bind/status` 绝不回 `tg_user_id` 数值）。
 *   · 绑定 code = **HMAC 签名令牌**（A5-DL-P4）：`code` 自带 `uid + iat + exp(600s) + 签名`，
 *     无状态、**不入库不建表**；有效期 10 分钟；一次性消费 = webhook 侧验签 +
 *     `tg_linked_at` 比对（§41.2 #7）—— 绑定成功时刻晚于 code 签发时刻 ⇒ 该 code 已被消费。
 *   · env 闭集（§41.7）：`TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` 必需，
 *     `TELEGRAM_BOT_USERNAME` 可选（仅前端步骤文案，非运行依赖）；缺任一必需 env ⇒
 *     #7/#8/#9/#10 全部 `503 TG_NOT_CONFIGURED`（env-gated 降级，非 500，Z8）。
 *   · webhook 处理序（§41.2 #10 写死）：① secret 校验（401）→ ② env 校验（503）→ ③ 验签
 *     code → ④ 同号幂等 / 抢绑拒绝 → ⑤ 落 `tg_user_id + tg_linked_at` → ⑥ bot 回复一行（双语）。
 *     **恒 200**（Telegram 对非 2xx 会重试）；业务失败只进日志 + bot 回复文案，不产生副作用。
 *   · 通知推送（§41.7）在 messages-service 侧；本文件只承载绑定面 + webhook 面。
 * ================================================================================
 */
import crypto from 'crypto';
import { readQuery, txQuery, withTransaction } from './db';

// ---------------------------------------------------------------- env 面（§41.7 env 闭集）
export interface TelegramRuntimeConfig {
  token: string | null;
  webhookSecret: string | null;
  botUsername: string | null;
}

export const telegramRuntimeConfig = (): TelegramRuntimeConfig => ({
  token: (process.env.TELEGRAM_BOT_TOKEN || '').trim() || null,
  webhookSecret: (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim() || null,
  botUsername: (process.env.TELEGRAM_BOT_USERNAME || '').trim() || null,
});

/** env-gated 降级判据（§41.9）：两个必需 env 任一缺失 ⇒ 绑定面 + webhook 面整体 503 TG_NOT_CONFIGURED。 */
export const isTelegramConfigured = (): boolean => {
  const cfg = telegramRuntimeConfig();
  return Boolean(cfg.token && cfg.webhookSecret);
};

// ---------------------------------------------------------------- 绑定 code（HMAC 签名令牌 · A5-DL-P4 不入库）
const BIND_CODE_TTL_SECONDS = 600; // 10 分钟（Z5 / §41.2 #7）
const codeSigningKey = (): string => {
  const raw = (process.env.SECRET_KEY || '').trim();
  if (!raw) {
    // 服务端经 auth 模块 fail-fast（缺 SECRET_KEY 不启动）；此处为防御性兜底。
    throw new Error('SECRET_KEY is not set');
  }
  return raw;
};

const base64Url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

interface BindCodePayload {
  uid: number;
  iat: number;
  exp: number;
}

export interface IssuedBindCode {
  code: string;
  expires_in: number;
}

/** 签发一次性绑定 code（重发 = 新 code；旧 code 由 `tg_linked_at` 比对天然失效）。 */
export const issueBindCode = (uid: number): IssuedBindCode => {
  const iat = Math.floor(Date.now() / 1000);
  const payload: BindCodePayload = { uid, iat, exp: iat + BIND_CODE_TTL_SECONDS };
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', codeSigningKey()).update(encodedPayload).digest('base64url');
  return { code: `v1.${encodedPayload}.${signature}`, expires_in: BIND_CODE_TTL_SECONDS };
};

export type BindCodeVerifyResult =
  | { ok: true; uid: number; iat: number }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' };

/** 验签绑定 code（签名不匹配 / 形状不对 ⇒ NOT_FOUND，不泄差异原因；过期 ⇒ EXPIRED）。 */
export const verifyBindCode = (code: unknown): BindCodeVerifyResult => {
  if (typeof code !== 'string' || code.length === 0 || code.length > 512) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const parts = code.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !parts[1] || !parts[2]) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  const [, encodedPayload, signature] = parts;
  let expected: Buffer;
  let payload: BindCodePayload;
  try {
    expected = crypto.createHmac('sha256', codeSigningKey()).update(encodedPayload).digest();
    // ★ 探针现取（A5 收口行为探针 P1/B1）：签名是 `digest('base64url')` 的**文本**，
    //   `Buffer.from(sig)` 按 UTF-8 取字节（43 B）与 32 B 摘要长度不等 ⇒ 恒 NOT_FOUND
    //   （绑定流全程失效）。必须按 base64url **解码**后再做定时安全比对。
    const given = Buffer.from(signature, 'base64url');
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return { ok: false, reason: 'NOT_FOUND' };
    }
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as BindCodePayload;
  } catch {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (!Number.isInteger(payload.uid) || payload.uid <= 0 || !Number.isFinite(payload.exp)) {
    return { ok: false, reason: 'NOT_FOUND' };
  }
  if (payload.exp * 1000 <= Date.now()) {
    return { ok: false, reason: 'EXPIRED' };
  }
  return { ok: true, uid: payload.uid, iat: payload.iat };
};

// ---------------------------------------------------------------- webhook /start 消费（§41.2 #10 处理序 ③–⑤）
export type BindConsumeOutcome =
  | { kind: 'ok' }
  | { kind: 'replay_ok' }
  | { kind: 'failed'; code: 'TG_CODE_INVALID'; reason: 'NOT_FOUND' | 'EXPIRED' | 'CONSUMED' }
  | { kind: 'failed'; code: 'TG_TARGET_ACCOUNT_TAKEN' };

/**
 * `/start <code>` 消费（写死处理序 ③–⑤）：
 *   ③ 验签（无效/过期 ⇒ TG_CODE_INVALID）；④ 目标用户已绑**同号** ⇒ 幂等成功；
 *      已绑**且绑定时刻晚于 code 签发** ⇒ CONSUMED（旧 code 失效）；
 *      `tg_user_id` 已被**其它**站内账号占用 ⇒ TG_TARGET_ACCOUNT_TAKEN（DB 兜底 =
 *      部分唯一索引，A5-DL-P2）；⑤ 落 `tg_user_id + tg_linked_at`（rebind 覆盖自身旧值允许）。
 */
export const consumeBindCode = async (tgUserId: number, code: unknown): Promise<BindConsumeOutcome> => {
  const verified = verifyBindCode(code);
  if (!verified.ok) {
    return { kind: 'failed', code: 'TG_CODE_INVALID', reason: verified.reason === 'EXPIRED' ? 'EXPIRED' : 'NOT_FOUND' };
  }

  return withTransaction(async (tx) => {
    const users = await txQuery<{
      uid: number;
      tg_user_id: string | number | null;
      tg_linked_at: Date | null;
    }>(
      tx,
      `SELECT uid, tg_user_id, tg_linked_at FROM public.users WHERE uid = $1 LIMIT 1`,
      [verified.uid],
    );
    const me = users[0];
    if (!me) {
      return { kind: 'failed', code: 'TG_CODE_INVALID', reason: 'NOT_FOUND' } as BindConsumeOutcome;
    }

    if (me.tg_user_id !== null && Number(me.tg_user_id) === tgUserId) {
      // ④ 幂等成功回复（同号重复 /start，Telegram 重试语义，无副作用）。
      return { kind: 'replay_ok' } as BindConsumeOutcome;
    }

    const linkedAtEpoch = me.tg_linked_at ? Math.floor(new Date(me.tg_linked_at).getTime() / 1000) : null;
    if (me.tg_user_id !== null && linkedAtEpoch !== null && linkedAtEpoch >= verified.iat) {
      // ④ 一次性消费（§41.2 #7）：绑定成功时刻晚于本 code 签发 ⇒ 本 code 已被消费。
      return { kind: 'failed', code: 'TG_CODE_INVALID', reason: 'CONSUMED' } as BindConsumeOutcome;
    }

    const taken = await txQuery<{ uid: number }>(
      tx,
      `SELECT uid FROM public.users WHERE tg_user_id = $1 AND uid <> $2 LIMIT 1`,
      [tgUserId, verified.uid],
    );
    if (taken[0]) {
      return { kind: 'failed', code: 'TG_TARGET_ACCOUNT_TAKEN' } as BindConsumeOutcome;
    }

    await txQuery(
      tx,
      `UPDATE public.users SET tg_user_id = $2, tg_linked_at = now() WHERE uid = $1`,
      [verified.uid, tgUserId],
    );
    return { kind: 'ok' } as BindConsumeOutcome;
  });
};

// ---------------------------------------------------------------- #8 解绑 / #9 绑定状态（A5-DL-P3 解绑即停推）
export const unbindTelegram = async (uid: number): Promise<boolean> => {
  return withTransaction(async (tx) => {
    const rows = await txQuery<{ tg_user_id: string | number | null }>(
      tx,
      `SELECT tg_user_id FROM public.users WHERE uid = $1 LIMIT 1`,
      [uid],
    );
    if (!rows[0] || rows[0].tg_user_id === null) {
      return false; // 未绑定 ⇒ 400 TG_NOT_LINKED（重复解绑第二次起，§41.2 #8）
    }
    await txQuery(
      tx,
      `UPDATE public.users SET tg_user_id = NULL, tg_linked_at = NULL WHERE uid = $1`,
      [uid],
    );
    return true;
  });
};

export interface TelegramBindStatus {
  tg_linked: boolean;
  tg_linked_at: string | null;
}

/** 读面隐私红线（判负②）：**绝不**回 `tg_user_id` 数值 —— 只回绑定布尔 + 绑定时刻。 */
export const readBindStatus = async (uid: number): Promise<TelegramBindStatus> => {
  const rows = await readQuery<{ tg_linked: boolean; tg_linked_at: Date | null }>(
    `SELECT (tg_user_id IS NOT NULL) AS tg_linked, tg_linked_at
       FROM public.users WHERE uid = $1 LIMIT 1`,
    [uid],
  );
  const row = rows[0];
  return {
    tg_linked: Boolean(row?.tg_linked),
    tg_linked_at: row?.tg_linked_at ? new Date(row.tg_linked_at).toISOString() : null,
  };
};

// ---------------------------------------------------------------- bot 回复（webhook ⑥ · 双语一行 · 不带任何消息内容）
const REPLY_TEXTS = {
  ok: '✅ 绑定成功：该 Telegram 账号已关联你的站内账号 / Linked: this Telegram account is now bound to your site account.',
  invalid: '❌ 绑定码无效，请在站内重新获取 / Invalid bind code, please get a new one from the site.',
  expired: '❌ 绑定码已过期（10 分钟有效），请重新获取 / Bind code expired (10-minute validity), please get a new one.',
  consumed: '❌ 绑定码已被使用，请重新获取 / Bind code already consumed, please get a new one.',
  taken: '❌ 该 Telegram 账号已绑定其它站内账号 / This Telegram account is already linked to another site account.',
  hint: '👋 发送 /start <绑定码> 完成绑定（绑定码在站内 Settings 获取）/ Send /start <code> to link your site account (get the code in site Settings).',
} as const;

export const replyTextForOutcome = (outcome: BindConsumeOutcome): string => {
  if (outcome.kind === 'ok' || outcome.kind === 'replay_ok') return REPLY_TEXTS.ok;
  if (outcome.code === 'TG_TARGET_ACCOUNT_TAKEN') return REPLY_TEXTS.taken;
  if (outcome.reason === 'EXPIRED') return REPLY_TEXTS.expired;
  if (outcome.reason === 'CONSUMED') return REPLY_TEXTS.consumed;
  return REPLY_TEXTS.invalid;
};

export const REPLY_HINT_TEXT = REPLY_TEXTS.hint;

/** bot 回复发送（失败只进日志 —— Telegram 对非 2xx 会重试 webhook 本身，回复缺失不产生副作用）。 */
export const sendTelegramReply = async (chatId: number | string, text: string): Promise<void> => {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.warn('[telegram.webhook] reply skipped: TELEGRAM_BOT_TOKEN not configured');
    return;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!response.ok) {
      console.warn('[telegram.webhook] sendMessage failed:', response.status);
    }
  } catch (error) {
    console.warn('[telegram.webhook] sendMessage error:', error instanceof Error ? error.message : 'ERROR');
  }
};
