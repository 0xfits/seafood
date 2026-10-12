/**
 * A5 收口 · 站内信服务层（`conversation` / `message` 两面 · route 册 v2.31 §41 / data 册 v0.32 §38）
 * ================================================================================
 * 口径（冻结，逐条可回溯）：
 *   · 会话模型 = per-listing（`UNIQUE(listing_id, buyer_uid)` 自然幂等，Z1）；会话创建走
 *     单语句 `INSERT … SELECT` 从 listing 取 `seller_uid`（A5-DL-G1：冗余列单真源写法），
 *     服务端确定性派生 `create_key = open:<listing_id>:<buyer_uid>`（A5-DL-G4 / §41.8）。
 *   · `message` append-only（Z1）：三闸在 DB（迁移 0045）；本层只 INSERT，绝不 UPDATE/DELETE。
 *   · 频次闸 = **单语句写路径 CTE**（§38.7 实现口径写死）：计数 = 查询期派生（无计数器表），
 *     20 条/UTC 日/（会话 × 发送者）+ 200 条/UTC 日/发送者；闸过后落库。
 *   · 幂等重放不计数：同 `create_key` 重放走短路径返回既有行（200 + `idempotent_replay`），
 *     **不进入** 计数-插入语句（§38.7 / §41.8）。
 *   · 读水位单调（A5-DL-G3 触发器兜底 + 本层 GREATEST）；未读 = 查询期聚合（§38.6，无存储计数器）。
 *   · 列表读口一律 keyset 禁 OFFSET（DL25 / Z7）。
 *   · 通知 = 落库成功后后台段推送（§41.7），失败只进日志，绝不回滚消息写、绝不改 HTTP 响应。
 *
 * 幂等键承载（§41.10 诚实登记）：`cli:` 键的唯一约束落点 = **服务端内存缓存**（本文件
 *   `messageCreateKeyCache`）。route 册 §41.10 明示「DB vs 服务端表实现形态未定（只冻语义
 *   不冻机制）」，而 0045 的 `message` DDL 是内容闭集（无 create_key 列）⇒ 本轮取内存缓存：
 *   同键同内容 = 200 重放返回既有 `msg_id`（不计数、不通知）；同键异内容 = 409
 *   `LEDGER_IDEMPOTENCY_CONFLICT`。边界：进程重启后缓存清空 ⇒ 跨进程重放会落新行
 *   （不丢已落库数据，只是去重失效）—— 已登记边界，非本单判负面；将来接 DB 承载走新迁移。
 * ================================================================================
 */
import { createHash } from 'crypto';
import { readQuery, txQuery, withTransaction, type TxClient } from './db';
import { errorMessageOf } from './ledger-errors';

// ---------------------------------------------------------------- 常量（§38.3 N2 / §38.7 R1/R2 / §41.2 #2/#3）
/** body 域上限（字符；DB 层 CHECK `message_body_len` 为 fail-closed 兜底，主闸在写路径）。 */
export const MSG_BODY_MAX_CHARS = 2000;
/** 会话闸：20 条 / UTC 自然日 / （会话 × 发送者）（Zang 暂裁，一句话可改）。 */
export const MSG_PER_CONVERSATION_DAILY_LIMIT = 20;
/** 全局闸：200 条 / UTC 自然日 / 发送者（Jing 提议初值，一句话可改）。 */
export const MSG_GLOBAL_DAILY_LIMIT = 200;
/** 会话列表 `last_body_preview` 截断长度（§41.2 #2）。 */
export const MSG_PREVIEW_MAX_CHARS = 50;
/** 会话列表页大小上限（§41.2 #2：limit ≤ 50，默认 20）。 */
export const CONVERSATION_LIST_LIMIT_MAX = 50;
export const CONVERSATION_LIST_LIMIT_DEFAULT = 20;
/** 消息列表页大小上限（§41.2 #3：limit ≤ 100，默认 50）。 */
export const MESSAGE_LIST_LIMIT_MAX = 100;
export const MESSAGE_LIST_LIMIT_DEFAULT = 50;

// ---------------------------------------------------------------- verb 结果形状（R107 单形状；沿 job-service `fail` 体例）
export interface MessagingVerbErr {
  ok: false;
  status: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export type MessagingVerbOk<T> = { ok: true } & T;
export type MessagingVerbResult<T> = MessagingVerbOk<T> | MessagingVerbErr;

/** `MSG_*` / `TG_*` / `AUTH_*` / `LEDGER_*` ⇒ R107 i18n 域（msg.err. / tg.err. / auth.err. / ledger.err.）。 */
export const messagingI18nNamespaceOf = (code: string): 'msg' | 'tg' | 'auth' | 'ledger' => {
  if (code.startsWith('MSG_')) return 'msg';
  if (code.startsWith('TG_')) return 'tg';
  if (code.startsWith('AUTH_')) return 'auth';
  return 'ledger';
};

const msgFail = (status: number, code: string, details: Record<string, unknown>): MessagingVerbErr => ({
  ok: false,
  status,
  code,
  message: errorMessageOf(code),
  details,
});

const sha256Of = (value: string) => createHash('sha256').update(value).digest('hex');

const toPositiveInt = (value: unknown): number | null => {
  const next = Number(value);
  return Number.isFinite(next) && Number.isInteger(next) && next > 0 ? next : null;
};

// ---------------------------------------------------------------- `cli:` 幂等键缓存（§41.8 · 实现形态见文件头登记）
interface CreateKeyCacheEntry {
  msgId: number;
  conversationId: number;
  timeCreated: string;
  fingerprint: string;
  expiresAt: number;
}

const CREATE_KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CREATE_KEY_CACHE_MAX = 10_000;
const messageCreateKeyCache = new Map<string, CreateKeyCacheEntry>();

const cacheSweep = (now: number): void => {
  if (messageCreateKeyCache.size < CREATE_KEY_CACHE_MAX) return;
  for (const [key, entry] of messageCreateKeyCache) {
    if (entry.expiresAt <= now) messageCreateKeyCache.delete(key);
  }
};

const CONTROL_CHARS_TEST = /[\u0000-\u001f\u007f]/;

/**
 * `cli:` 键校验（沿 buy/publish 体例，§41.8）：
 *   缺失/空 ⇒ `LEDGER_IDEMPOTENCY_KEY_REQUIRED`；形状违规（前缀/长度/保留分隔符/控制字符）⇒
 *   `LEDGER_IDEMPOTENCY_KEY_INVALID`（均为既有 33 码关闭集内的借码，route 册 §41.5「借码」条）。
 */
const resolveCreateKey = (raw: unknown): { ok: true; key: string } | MessagingVerbErr => {
  const provided = typeof raw === 'string' ? raw.trim() : '';
  if (!provided) {
    return msgFail(400, 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', { field: 'create_key' });
  }
  if (provided.length > 200) {
    return msgFail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'TOO_LONG' });
  }
  if (!provided.startsWith('cli:')) {
    return msgFail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'PREFIX_REQUIRED', allowed_prefixes: ['cli:'] });
  }
  if (provided.includes('#')) {
    return msgFail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'RESERVED_SEPARATOR' });
  }
  if (CONTROL_CHARS_TEST.test(provided)) {
    return msgFail(400, 'LEDGER_IDEMPOTENCY_KEY_INVALID', { field: 'create_key', reason: 'CONTROL_CHARACTER' });
  }
  return { ok: true, key: provided };
};

// ---------------------------------------------------------------- #1 开会话（自然幂等 · 单语句 INSERT…SELECT 派生 seller_uid）
export const openConversation = async (
  actorUid: number,
  listingIdRaw: unknown,
): Promise<MessagingVerbResult<{ conversation_id: number; created: boolean }>> => {
  const listingId = toPositiveInt(listingIdRaw);
  if (!listingId) {
    // R107 统一 404 口径：无法判别存在的目标一律「不存在」（route 册 §41.5 MSG_LISTING_NOT_FOUND 行）。
    return msgFail(404, 'MSG_LISTING_NOT_FOUND', { ref: 'listing' });
  }

  return withTransaction(async (tx: TxClient) => {
    const listings = await txQuery<{
      listing_id: number;
      seller_uid: number;
      status: string;
    }>(
      tx,
      `SELECT listing_id, seller_uid, status FROM public.listing WHERE listing_id = $1 LIMIT 1`,
      [listingId],
    );
    const listing = listings[0];
    if (!listing) {
      return msgFail(404, 'MSG_LISTING_NOT_FOUND', { ref: 'listing', listing_id: listingId });
    }
    if (Number(listing.seller_uid) === actorUid) {
      // Z2：卖家本人开自己商品的会话 ⇒ 拒（前端按钮不渲染 + 服务端双闸）。
      // ★ 探针现取（A5 收口行为探针 H3）：`bigint` 列经驱动回来是**串**（'7'），
      //   裸 `===` 与数字 actorUid 恒不等 ⇒ 自开闸不触发、落 DB CHECK
      //   `conversation_parties_distinct`（错码 400 LEDGER_AMOUNT_INVALID）。必须显式取数。
      return msgFail(400, 'MSG_SELF_CONVERSATION', { listing_id: listingId });
    }

    // 幂等复用先于 status 闸：追加旧会话不受限（§41.2 #1 准入「开新会话要求 listed · 追加旧会话不受限」）。
    const existing = await txQuery<{ conversation_id: number }>(
      tx,
      `SELECT conversation_id FROM public.conversation WHERE listing_id = $1 AND buyer_uid = $2 LIMIT 1`,
      [listingId, actorUid],
    );
    if (existing[0]) {
      return { ok: true as const, conversation_id: Number(existing[0].conversation_id), created: false };
    }

    if (listing.status !== 'listed') {
      return msgFail(400, 'MSG_LISTING_NOT_OPEN', { listing_id: listingId, status: listing.status });
    }

    // A5-DL-G1：seller_uid 唯一写法 = 单语句 INSERT…SELECT（结构上不可能与 listing 分叉）。
    // A5-DL-G4：create_key = 服务端确定性派生（前端不得自造）。
    const createKey = `open:${listingId}:${actorUid}`;
    const inserted = await txQuery<{ conversation_id: number }>(
      tx,
      `INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key)
       SELECT l.listing_id, $2, l.seller_uid, $3
         FROM public.listing l
        WHERE l.listing_id = $1
       ON CONFLICT (listing_id, buyer_uid) DO NOTHING
       RETURNING conversation_id`,
      [listingId, actorUid, createKey],
    );
    if (inserted[0]) {
      return { ok: true as const, conversation_id: Number(inserted[0].conversation_id), created: true };
    }

    // 并发同键：另一请求已建 ⇒ 自然幂等复用（created:false）。
    const raced = await txQuery<{ conversation_id: number }>(
      tx,
      `SELECT conversation_id FROM public.conversation WHERE listing_id = $1 AND buyer_uid = $2 LIMIT 1`,
      [listingId, actorUid],
    );
    if (!raced[0]) {
      // 理论不可达（并发窗口内被第三方删除才会出现；conversation 不可删）——fail-closed。
      return msgFail(404, 'MSG_LISTING_NOT_FOUND', { ref: 'listing', listing_id: listingId });
    }
    return { ok: true as const, conversation_id: Number(raced[0].conversation_id), created: false };
  });
};

// ---------------------------------------------------------------- 会话可见性（#2/#3/#5 共用 · 参与者判别）
interface ConversationRow {
  conversation_id: number;
  listing_id: number;
  listing_title: string;
  buyer_uid: number;
  seller_uid: number;
  buyer_last_read_msg_id: number;
  seller_last_read_msg_id: number;
}

const readConversationRow = async (client: TxClient, conversationId: number): Promise<ConversationRow | null> => {
  const rows = await txQuery<Record<string, unknown>>(
    client,
    `SELECT c.conversation_id, c.listing_id, c.buyer_uid, c.seller_uid,
            c.buyer_last_read_msg_id, c.seller_last_read_msg_id, l.title AS listing_title
       FROM public.conversation c
       JOIN public.listing l ON l.listing_id = c.listing_id
      WHERE c.conversation_id = $1
      LIMIT 1`,
    [conversationId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    conversation_id: Number(row.conversation_id),
    listing_id: Number(row.listing_id),
    listing_title: String(row.listing_title ?? ''),
    buyer_uid: Number(row.buyer_uid),
    seller_uid: Number(row.seller_uid),
    buyer_last_read_msg_id: Number(row.buyer_last_read_msg_id ?? 0),
    seller_last_read_msg_id: Number(row.seller_last_read_msg_id ?? 0),
  };
};

/** 参与者判别（Z2 参与者面 = 恰双方）：非参与者 ⇒ 403（details 只放 conversation_id，禁泄露对方标识）。 */
export const requireConversationParticipant = async (
  client: TxClient,
  actorUid: number,
  conversationId: number,
): Promise<{ ok: true; conversation: ConversationRow } | MessagingVerbErr> => {
  const conversation = await readConversationRow(client, conversationId);
  if (!conversation) {
    return msgFail(404, 'MSG_CONVERSATION_NOT_FOUND', { conversation_id: conversationId });
  }
  if (conversation.buyer_uid !== actorUid && conversation.seller_uid !== actorUid) {
    return msgFail(403, 'MSG_NOT_PARTICIPANT', { conversation_id: conversationId });
  }
  return { ok: true, conversation };
};

// ---------------------------------------------------------------- #2 会话列表（keyset：(time_updated, conversation_id) · 禁 OFFSET）
export interface ConversationListQuery {
  beforeTime?: unknown;
  beforeId?: unknown;
  limit?: unknown;
  listingId?: unknown;
}

const previewOf = (body: string): string =>
  [...body].length > MSG_PREVIEW_MAX_CHARS ? [...body].slice(0, MSG_PREVIEW_MAX_CHARS).join('') : body;

export const listConversations = async (
  actorUid: number,
  query: ConversationListQuery,
): Promise<MessagingVerbResult<{ rows: Record<string, unknown>[]; next_cursor: Record<string, unknown> | null }>> => {
  const limitRaw = toPositiveInt(query.limit);
  const limit = Math.min(limitRaw ?? CONVERSATION_LIST_LIMIT_DEFAULT, CONVERSATION_LIST_LIMIT_MAX);
  const listingId = query.listingId === undefined || query.listingId === null || query.listingId === ''
    ? null
    : toPositiveInt(query.listingId);
  if (query.listingId !== undefined && query.listingId !== null && query.listingId !== '' && !listingId) {
    return msgFail(400, 'MSG_LISTING_NOT_FOUND', { ref: 'listing' });
  }
  const beforeTime = typeof query.beforeTime === 'string' && query.beforeTime.trim() !== ''
    ? query.beforeTime
    : null;
  const beforeId = toPositiveInt(query.beforeId);
  // 恶意/残缺游标 = 按缺省处理（不报 500；游标只是定位提示，格式错 ⇒ 从头读）。
  let beforeTimeValid: string | null = null;
  if (beforeTime) {
    const parsed = new Date(beforeTime);
    beforeTimeValid = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  const rows = await readQuery<Record<string, unknown>>(
    `SELECT c.conversation_id,
            c.listing_id,
            l.title AS listing_title,
            (CASE WHEN c.buyer_uid = $1 THEN 'buyer' ELSE 'seller' END) AS role,
            (CASE WHEN c.buyer_uid = $1 THEN c.seller_uid ELSE c.buyer_uid END) AS counterpart_uid,
            (SELECT m.body FROM public.message m
              WHERE m.conversation_id = c.conversation_id
              ORDER BY m.msg_id DESC LIMIT 1) AS last_body,
            (SELECT count(*)::int FROM public.message m
              WHERE m.conversation_id = c.conversation_id
                AND m.from_uid <> $1
                AND m.msg_id > (CASE WHEN c.buyer_uid = $1
                                     THEN c.buyer_last_read_msg_id
                                     ELSE c.seller_last_read_msg_id END)) AS unread_count,
            c.time_updated
       FROM public.conversation c
       JOIN public.listing l ON l.listing_id = c.listing_id
      WHERE (c.buyer_uid = $1 OR c.seller_uid = $1)
        AND ($5::bigint IS NULL OR c.listing_id = $5::bigint)
        AND ($2::timestamptz IS NULL OR (c.time_updated, c.conversation_id) < ($2::timestamptz, $3::bigint))
      ORDER BY c.time_updated DESC, c.conversation_id DESC
      LIMIT $4::int`,
    [actorUid, beforeTimeValid, beforeId, limit, listingId],
  );

  const mapped = rows.map((row) => {
    const lastBody = typeof row.last_body === 'string' ? row.last_body : '';
    const timeUpdated = row.time_updated instanceof Date ? row.time_updated.toISOString() : String(row.time_updated ?? '');
    return {
      conversation_id: Number(row.conversation_id),
      listing_id: Number(row.listing_id),
      listing_title: String(row.listing_title ?? ''),
      role: row.role === 'buyer' ? 'buyer' : 'seller',
      counterpart_uid: Number(row.counterpart_uid),
      last_body_preview: lastBody ? previewOf(lastBody) : '',
      unread_count: Number(row.unread_count ?? 0),
      time_updated: timeUpdated,
    };
  });

  const nextCursor = mapped.length === limit
    ? {
        before_time: mapped[mapped.length - 1].time_updated,
        before_id: mapped[mapped.length - 1].conversation_id,
      }
    : null;

  return { ok: true as const, rows: mapped, next_cursor: nextCursor };
};

// ---------------------------------------------------------------- #3 消息列表（keyset：msg_id · 禁 OFFSET）
export const listMessages = async (
  actorUid: number,
  conversationIdRaw: unknown,
  query: { beforeMsgId?: unknown; limit?: unknown },
): Promise<MessagingVerbResult<{
  conversation: Record<string, unknown>;
  rows: Record<string, unknown>[];
  next_before_msg_id: number | null;
}>> => {
  const conversationId = toPositiveInt(conversationIdRaw);
  if (!conversationId) {
    // R107 统一 404 口径：非数字 :conversationId 同形（route 册 §41.5）。
    return msgFail(404, 'MSG_CONVERSATION_NOT_FOUND', {});
  }
  const limitRaw = toPositiveInt(query.limit);
  const limit = Math.min(limitRaw ?? MESSAGE_LIST_LIMIT_DEFAULT, MESSAGE_LIST_LIMIT_MAX);
  const beforeMsgId = toPositiveInt(query.beforeMsgId);

  return withTransaction(async (tx: TxClient) => {
    const guard = await requireConversationParticipant(tx, actorUid, conversationId);
    if (!guard.ok) return guard;
    const { conversation } = guard;
    const isBuyer = conversation.buyer_uid === actorUid;

    const rows = await txQuery<Record<string, unknown>>(
      tx,
      `SELECT msg_id, from_uid, body, time_created
         FROM public.message
        WHERE conversation_id = $1
          AND ($2::bigint IS NULL OR msg_id < $2::bigint)
        ORDER BY msg_id DESC
        LIMIT $3::int`,
      [conversationId, beforeMsgId, limit],
    );

    const mapped = rows.map((row) => ({
      msg_id: Number(row.msg_id),
      from_uid: Number(row.from_uid),
      body: String(row.body ?? ''),
      time_created: row.time_created instanceof Date ? row.time_created.toISOString() : String(row.time_created ?? ''),
    }));

    return {
      ok: true as const,
      conversation: {
        conversation_id: conversation.conversation_id,
        listing_id: conversation.listing_id,
        listing_title: conversation.listing_title,
        role: isBuyer ? 'buyer' : 'seller',
        counterpart_uid: isBuyer ? conversation.seller_uid : conversation.buyer_uid,
      },
      rows: mapped,
      next_before_msg_id: mapped.length === limit ? mapped[mapped.length - 1].msg_id : null,
    };
  });
};

// ---------------------------------------------------------------- #4 发消息（双频次闸 CTE + 幂等重放短路径 + 后台通知）
export interface SendMessageOutcome {
  msg_id: number;
  conversation_id: number;
  time_created: string;
  idempotent_replay: boolean;
}

export const sendMessage = async (
  actorUid: number,
  conversationIdRaw: unknown,
  bodyRaw: unknown,
  createKeyRaw: unknown,
): Promise<MessagingVerbResult<SendMessageOutcome>> => {
  const conversationId = toPositiveInt(conversationIdRaw);
  if (!conversationId) {
    return msgFail(404, 'MSG_CONVERSATION_NOT_FOUND', {});
  }

  const keyed = resolveCreateKey(createKeyRaw);
  if (!keyed.ok) return keyed;

  // body 主闸（§41.5 MSG_BODY_INVALID：details.reason ∈ {EMPTY, TOO_LONG}；DB CHECK 为 fail-closed 兜底）。
  const body = typeof bodyRaw === 'string' ? bodyRaw : '';
  if (body.trim().length === 0) {
    return msgFail(400, 'MSG_BODY_INVALID', { reason: 'EMPTY' });
  }
  if (body.length > MSG_BODY_MAX_CHARS) {
    return msgFail(400, 'MSG_BODY_INVALID', { reason: 'TOO_LONG' });
  }

  // 幂等重放短路径（§38.7「幂等重放不计数」）：同键同内容 ⇒ 200 + 既有行；同键异内容 ⇒ 409。
  const fingerprint = sha256Of(`${conversationId}|${actorUid}|${body}`);
  const now = Date.now();
  cacheSweep(now);
  const cached = messageCreateKeyCache.get(keyed.key);
  if (cached && cached.expiresAt > now) {
    if (cached.fingerprint === fingerprint) {
      return {
        ok: true as const,
        msg_id: cached.msgId,
        conversation_id: cached.conversationId,
        time_created: cached.timeCreated,
        idempotent_replay: true,
      };
    }
    return msgFail(409, 'LEDGER_IDEMPOTENCY_CONFLICT', { field: 'create_key' });
  }

  return withTransaction(async (tx: TxClient) => {
    const guard = await requireConversationParticipant(tx, actorUid, conversationId);
    if (!guard.ok) return guard;

    // ★ 单语句写路径 CTE（§38.7 实现口径写死）：计数与插入同语句同快照 ⇒ 旁路直插不受闸 =
    //   已登记边界（与 8④ 电量闸同体例）；重放永不进入本语句 ⇒ 重放不挤占配额。
    //   闸均按「发送者」计，买卖双方同规（无卖家豁免，§38.7）。
    const rows = await txQuery<Record<string, unknown>>(
      tx,
      `WITH day AS (
         SELECT date_trunc('day', now() AT TIME ZONE 'UTC') AS d
       ),
       conv AS (
         SELECT count(*)::int AS n
           FROM public.message, day
          WHERE conversation_id = $1
            AND from_uid = $2
            AND time_created >= day.d
       ),
       glob AS (
         SELECT count(*)::int AS n
           FROM public.message, day
          WHERE from_uid = $2
            AND time_created >= day.d
       ),
       ins AS (
         INSERT INTO public.message (conversation_id, from_uid, body)
         SELECT $1, $2, $3
          WHERE (SELECT n FROM conv) < $4::int
            AND (SELECT n FROM glob) < $5::int
         RETURNING msg_id, time_created
       )
       SELECT ins.msg_id, ins.time_created, (SELECT n FROM conv) AS conv_n, (SELECT n FROM glob) AS glob_n
         FROM ins`,
      [conversationId, actorUid, body, MSG_PER_CONVERSATION_DAILY_LIMIT, MSG_GLOBAL_DAILY_LIMIT],
    );

    if (!rows[0]) {
      // 0 行 = 闸拦下（会话闸优先取 reason，与 §41.5 表序一致）；0 行分支读不到 CTE 返回值 ⇒ 重查一次定 reason。
      const counts = await txQuery<{ conv_n: number; glob_n: number }>(
        tx,
        `SELECT (SELECT count(*)::int FROM public.message
                  WHERE conversation_id = $1 AND from_uid = $2
                    AND time_created >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS conv_n,
                (SELECT count(*)::int FROM public.message
                  WHERE from_uid = $2
                    AND time_created >= date_trunc('day', now() AT TIME ZONE 'UTC')) AS glob_n`,
        [conversationId, actorUid],
      );
      const reason = Number(counts[0]?.conv_n ?? 0) >= MSG_PER_CONVERSATION_DAILY_LIMIT
        ? 'PER_CONVERSATION_DAILY'
        : 'GLOBAL_DAILY';
      return msgFail(429, 'MSG_RATE_LIMITED', {
        conversation_id: conversationId,
        reason,
        limit: reason === 'PER_CONVERSATION_DAILY' ? MSG_PER_CONVERSATION_DAILY_LIMIT : MSG_GLOBAL_DAILY_LIMIT,
      });
    }

    const msgId = Number(rows[0].msg_id);
    const timeCreated = rows[0].time_created instanceof Date
      ? rows[0].time_created.toISOString()
      : String(rows[0].time_created ?? '');

    // time_updated 只由消息追加写路径推进（§38.5；read_mark_only 闸允许集内）。
    await txQuery(
      tx,
      `UPDATE public.conversation SET time_updated = now() WHERE conversation_id = $1`,
      [conversationId],
    );

    messageCreateKeyCache.set(keyed.key, {
      msgId,
      conversationId,
      timeCreated,
      fingerprint,
      expiresAt: Date.now() + CREATE_KEY_CACHE_TTL_MS,
    });

    return { ok: true as const, msg_id: msgId, conversation_id: conversationId, time_created: timeCreated, idempotent_replay: false };
  });
};

// ---------------------------------------------------------------- #5 读水位推进（单调 · 天然幂等 · 无 create_key）
export const markConversationRead = async (
  actorUid: number,
  conversationIdRaw: unknown,
): Promise<MessagingVerbResult<{ last_read_msg_id: number }>> => {
  const conversationId = toPositiveInt(conversationIdRaw);
  if (!conversationId) {
    return msgFail(404, 'MSG_CONVERSATION_NOT_FOUND', {});
  }

  return withTransaction(async (tx: TxClient) => {
    const guard = await requireConversationParticipant(tx, actorUid, conversationId);
    if (!guard.ok) return guard;
    const { conversation } = guard;
    const isBuyer = conversation.buyer_uid === actorUid;
    const current = isBuyer ? conversation.buyer_last_read_msg_id : conversation.seller_last_read_msg_id;

    const newest = await txQuery<{ newest: number }>(
      tx,
      `SELECT COALESCE(max(msg_id), 0)::bigint AS newest FROM public.message WHERE conversation_id = $1`,
      [conversationId],
    );
    const target = Math.max(current, Number(newest[0]?.newest ?? 0));

    // A5-DL-G3：水位单调（GREATEST 保证 + 触发器兜底）；time_updated 不随读标记推进（保持原值）。
    const updated = await txQuery<{ watermark: number }>(
      tx,
      isBuyer
        ? `UPDATE public.conversation
              SET buyer_last_read_msg_id = GREATEST(buyer_last_read_msg_id, $2::bigint)
            WHERE conversation_id = $1
            RETURNING buyer_last_read_msg_id AS watermark`
        : `UPDATE public.conversation
              SET seller_last_read_msg_id = GREATEST(seller_last_read_msg_id, $2::bigint)
            WHERE conversation_id = $1
            RETURNING seller_last_read_msg_id AS watermark`,
      [conversationId, target],
    );

    return { ok: true as const, last_read_msg_id: Number(updated[0]?.watermark ?? target) };
  });
};

// ---------------------------------------------------------------- #6 未读总数（查询期聚合 · 会话级汇总 Σ · §38.6）
export const totalUnread = async (
  actorUid: number,
): Promise<MessagingVerbResult<{ unread_total: number }>> => {
  const rows = await readQuery<{ unread_total: number }>(
    `SELECT COALESCE(sum(
       CASE WHEN c.buyer_uid = $1
            THEN (SELECT count(*) FROM public.message m
                   WHERE m.conversation_id = c.conversation_id
                     AND m.from_uid <> c.buyer_uid
                     AND m.msg_id > c.buyer_last_read_msg_id)
            ELSE (SELECT count(*) FROM public.message m
                   WHERE m.conversation_id = c.conversation_id
                     AND m.from_uid <> c.seller_uid
                     AND m.msg_id > c.seller_last_read_msg_id)
       END), 0)::int AS unread_total
     FROM public.conversation c
    WHERE c.buyer_uid = $1 OR c.seller_uid = $1`,
    [actorUid],
  );
  return { ok: true as const, unread_total: Number(rows[0]?.unread_total ?? 0) };
};

// ---------------------------------------------------------------- F19 读口扩展（route 册 §41.3 · 零新路由 · 零 DDL）
/**
 * `GET /api/prize/:bID` 顶层 `seller` 对象取数口：
 *   `uid` = `listing.seller_uid`（0015 既有列，零 DDL）；`nickname` = EVM 掩码派生
 *   （前 6 + `…` + 后 4；users 无昵称列，不为此建列）；`avatar` = null 占位。
 * 零隐私出口：不含联系方式 / 完整地址 / handle（掩码即全部出口）。
 */
export const getPrizeSellerView = async (
  bID: number,
): Promise<MessagingVerbResult<{ seller: { uid: number; nickname: string; avatar: null } }>> => {
  const rows = await readQuery<{ uid: number; evm: string }>(
    `SELECT l.seller_uid AS uid, u.evm
       FROM public.listing l
       JOIN public.users u ON u.uid = l.seller_uid
      WHERE l.listing_id = $1
      LIMIT 1`,
    [bID],
  );
  const row = rows[0];
  if (!row) {
    return msgFail(404, 'MSG_LISTING_NOT_FOUND', { ref: 'listing', listing_id: bID });
  }
  const evm = String(row.evm ?? '');
  const nickname = evm.length >= 10 ? `${evm.slice(0, 6)}…${evm.slice(-4)}` : evm;
  return { ok: true as const, seller: { uid: Number(row.uid), nickname, avatar: null } };
};

// ---------------------------------------------------------------- 后台通知（§41.7 · waitUntil 体例 · 失败不回滚不改响应）
type WaitUntilFn = (promise: Promise<unknown>) => void;

/** `@vercel/functions` 的 `waitUntil`（懒加载；离线/非 Vercel 环境 ⇒ null ⇒ 退化 fire-and-forget）。 */
const resolveWaitUntil = (): WaitUntilFn | null => {
  try {
    const mod = require('@vercel/functions') as { waitUntil?: WaitUntilFn };
    return typeof mod.waitUntil === 'function' ? mod.waitUntil : null;
  } catch {
    return null;
  }
};

/** 后台执行一个 Promise：优先挂 `waitUntil`（Vercel runtime 保证响应后仍执行）；同步不可抛。 */
const runInBackground = (task: () => Promise<void>): void => {
  const promise = task().catch((error: unknown) => {
    console.warn('[telegram.notify] background task failed:', error instanceof Error ? error.message : 'ERROR');
  });
  const waitUntil = resolveWaitUntil();
  if (waitUntil) {
    waitUntil(promise);
  }
  // fire-and-forget：promise 自带 catch，不会产生 unhandled rejection。
};

const SITE_NAME_FALLBACK = 'Seafood Club';
const SITE_URL_FALLBACK = 'https://0xseafood.com';
const TITLE_MASK_MAX_CHARS = 12;

const titleMask = (title: string): string => {
  const chars = [...title.trim()];
  if (chars.length === 0) return '';
  return chars.length > TITLE_MASK_MAX_CHARS ? `${chars.slice(0, TITLE_MASK_MAX_CHARS).join('')}…` : title;
};

const readSiteName = async (): Promise<string> => {
  try {
    const rows = await readQuery<{ value: unknown }>(
      `SELECT value FROM public.app_config WHERE key = 'system_settings' LIMIT 1`,
    );
    const value = rows[0]?.value;
    if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).siteName === 'string') {
      const siteName = (value as Record<string, unknown>).siteName as string;
      if (siteName.trim()) return siteName.trim();
    }
  } catch {
    // 读不到站点名 = 非致命（通知文案降级用兜底名）。
  }
  return SITE_NAME_FALLBACK;
};

/**
 * 对端通知（§41.7 写死）：收件人判定 = 对端 `tg_user_id IS NOT NULL`（未绑定 = 零打扰，Z3；
 * 解绑后自然停推 = 无行可查）。内容 = 双语一行、**不带消息内容**（隐私）。
 * 推送失败/超时 ⇒ 只进日志，绝不回滚消息写、绝不改 HTTP 响应。
 */
export const notifyMessageCounterpart = (input: {
  conversationId: number;
  fromUid: number;
}): void => {
  runInBackground(async () => {
    const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
      console.warn('[telegram.notify] skipped: TELEGRAM_BOT_TOKEN not configured (in-site messaging unaffected)');
      return;
    }
    const rows = await readQuery<{ tg_user_id: string | number; title: string }>(
      `SELECT u.tg_user_id, l.title
         FROM public.conversation c
         JOIN public.users u
           ON u.uid = (CASE WHEN c.buyer_uid = $1 THEN c.seller_uid ELSE c.buyer_uid END)
         JOIN public.listing l ON l.listing_id = c.listing_id
        WHERE c.conversation_id = $2
          AND (c.buyer_uid = $1 OR c.seller_uid = $1)
          AND u.tg_user_id IS NOT NULL
        LIMIT 1`,
      [input.fromUid, input.conversationId],
    );
    if (!rows[0]) return; // 对端未绑定 ⇒ 零打扰（Z3）

    const siteName = await readSiteName();
    const site = (process.env.PUBLIC_SITE_URL || '').trim() || SITE_URL_FALLBACK;
    const masked = titleMask(String(rows[0].title ?? ''));
    const text = `${siteName}：你有新消息（来自会话：${masked}），打开 ${site}/messages 查看 / You have a new message, open ${site}/messages`;

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: rows[0].tg_user_id, text }),
    });
    if (!response.ok) {
      console.warn('[telegram.notify] sendMessage failed:', response.status);
    }
  });
};
