/**
 * P6-TR-1a · 翻译服务层（三语 UGC「录入即自动多语」的引擎与闸）
 * ============================================================================
 * 交付边界（本单）：
 *   · 服务层 + 迁移 0021；**不接路由**（waitUntil 挂载 / `POST /api/translate/backfill`
 *     / vercel.json cron 属 TR-1b）。`backfillPending()` 只落函数，不被路由引用。
 *   · **绝不阻塞提交**：任一步失败 ⇒ 该字段记 failed + last_error，**不写脏数据**
 *     （迁移 0021 的 `content_translation_ready_has_text` CHECK 是结构级兜底）。
 *
 * 引擎分工（master-plan §5.111 拍板）：
 *   · en / vn  → **DeepSeek**（OpenAI 兼容 `POST {base}/chat/completions`，JSON 输出）
 *   · hk       → **OpenCC 简繁转换**（`toTraditional`，**确定性转换、不是翻译**）
 *
 * 三重校验（逐条实现且可单测；任一不过 ⇒ failed，不落库）：
 *   ① JSON 可解析 且 顶层键集 == 输入字段集 且 每值非空
 *   ② 长度比例 ∈ [0.3, 3.0]（分母 = 源文本长度）
 *   ③ 字符集特征：vn 必须含越南语拉丁扩展字符（声调）——**源无 CJK 或单字源时豁免**；
 *      en 应以 ASCII 为主（非 ASCII 占比 > 30% ⇒ 判负）——**值中无 CJK 的豁免**
 *      （币符号 / 品牌名 / URL 允许非 ASCII）
 *
 * 环境变量（**只读变量名，绝不打印值**）：
 *   DEEPSEEK_API_KEY（必填）、DEEPSEEK_BASE_URL（默认 https://api.deepseek.com）、
 *   DEEPSEEK_MODEL（默认 deepseek-flash）、TRANSLATE_ENGINE（deepseek|stub，默认 deepseek；
 *   **无 key 时自动回落 stub 并告警一次**）、TRANSLATE_MAX_CHARS_PER_ITEM（默认 2000）、
 *   TRANSLATE_DAILY_ITEM_CAP（默认 500）
 *
 * 安全：**不把任何请求/响应全文写进日志**（可能含用户内容与 key 形态）；
 *   错误只保留「机读 reason + 截断摘要」。`DEEPSEEK_API_KEY` 的**值**既不进
 *   配置对象（只暴露 `api_key_present` 布尔）、也不进任何日志/报告。
 * ============================================================================
 */
import * as crypto from 'crypto';

// ============================================================ 类型 =========

/** 目标语言。zh 是源语言，永不作为目标。 */
export type TargetLang = 'en' | 'vn' | 'hk';
/** 非确定性转换（走 LLM）的目标语言 —— hk 是 OpenCC 确定性转换，不走 LLM。 */
export type TranslateLang = 'en' | 'vn';
/** content_translation.status 取值域（与迁移 0021 的具名 CHECK 一致）。 */
export type TranslationStatus = 'pending' | 'ready' | 'failed' | 'deferred';
/** 生效引擎。stub = 确定性假翻译（离线可单测）。 */
export type TranslateEngine = 'deepseek' | 'stub';

/** 最小 fetch 契约（**不依赖 DOM lib / undici 类型**，便于在任意 @types/node 下编译）。 */
export interface FetchLike {
  (
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body: string;
      signal: unknown;
    },
  ): Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}

/** 生效配置（由 getTranslateConfig 从 env 派生）。 */
export interface TranslateServiceConfig {
  /** 实际生效引擎（无 key ⇒ 回落 'stub'）。 */
  engine: TranslateEngine;
  /** 请求的引擎（可被环境变量覆盖；用于暴露「回落」事实）。 */
  requested_engine: TranslateEngine;
  /** key 是否就位（**只暴露布尔，绝不回传值**）。 */
  api_key_present: boolean;
  base_url: string;
  model: string;
  max_chars_per_item: number;
  daily_item_cap: number;
  /** 非空 = 发生了回落/降级，值为机读原因。 */
  fallback_reason: string | null;
}

/** 机读 reason 常量（便于「一句环境变量修复」与日志聚合）。 */
export const REASON = {
  MODEL_NOT_AVAILABLE: 'MODEL_NOT_AVAILABLE',
  NO_API_KEY: 'NO_API_KEY',
  HTTP_ERROR: 'HTTP_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  BAD_RESPONSE_SHAPE: 'BAD_RESPONSE_SHAPE',
  ITEM_TOO_LONG: 'ITEM_TOO_LONG',
  DAILY_CAP_REACHED: 'DAILY_CAP_REACHED',
  EMPTY_SOURCE: 'EMPTY_SOURCE',
  MAX_ATTEMPTS: 'MAX_ATTEMPTS',
  SOURCE_UNRESOLVED: 'SOURCE_UNRESOLVED',
} as const;

/** 带机读 reason 的翻译错误。 */
export class TranslationError extends Error {
  readonly reason: string;
  readonly http_status: number | null;
  constructor(reason: string, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = 'TranslationError';
    this.reason = reason;
    this.http_status = httpStatus;
  }
}

/** 三重校验中「单条」校验结论。 */
export interface ValidateOutcome {
  ok: boolean;
  /** 不通过时的机读原因：JSON_PARSE | KEY_SET_MISMATCH | EMPTY_VALUE | LENGTH_RATIO | CHARSET。 */
  reason: string | null;
  detail: string | null;
}

/** translation_cache 一行。 */
export interface CacheRow {
  src_hash: string;
  src_lang: string;
  tgt_lang: string;
  text_out: string;
  engine: string;
}

/** content_translation 一行。 */
export interface TranslationRow {
  entity_type: string;
  entity_id: string;
  field: string;
  lang: string;
  text: string | null;
  status: TranslationStatus;
  attempts: number;
  last_error: string | null;
}

/**
 * 存储端口（生产实现 = `createDbStore()`；离线单测注入内存假实现）。
 * **upsert 语义（生产实现必须遵守）**：INSERT 时 attempts=0；ON CONFLICT 时
 * `attempts += (status ∈ {ready,failed} ? 1 : 0)` —— 即「一次真实尝试 = +1」，
 * 而 `deferred`（日限额/超长）**不烧 attempts**（否则限流会把重试次数耗光）。
 */
export interface TranslateStore {
  getCache(srcHash: string, srcLang: string, tgtLang: string): Promise<string | null>;
  putCache(row: CacheRow): Promise<void>;
  /** 当日 content_translation 行数（日限额派生，**不新建计数表**）。 */
  countToday(): Promise<number>;
  upsertTranslation(row: TranslationRow): Promise<void>;
  /** status ∈ (pending,failed) 且 attempts < maxAttempts，按 updated_at 升序。 */
  listPending(limit: number, maxAttempts: number): Promise<TranslationRow[]>;
  readCurrent(
    entityType: string,
    entityId: string,
    field: string,
    lang: string,
  ): Promise<{ text: string | null; status: TranslationStatus } | null>;
}

/** translateFields 的入参。 */
export interface TranslateFieldsOptions {
  entityType: string;
  entityId: string;
  /** undefined ⇒ createDbStore()；**null ⇒ 不落库**（纯离线/单测）。 */
  store?: TranslateStore | null;
  /** 覆盖引擎（单测/降级演练用）。 */
  engine?: TranslateEngine;
  /** 覆盖配置（单测用）。 */
  config?: TranslateServiceConfig;
  /** 注入 fetch（单测用）。 */
  fetchImpl?: FetchLike;
  /** 注入 API key（单测/多租户用；**undefined ⇒ 读 process.env.DEEPSEEK_API_KEY**）。 */
  apiKey?: string | null;
  /** 一次性告警回调（默认 console.warn 一次）。 */
  onWarn?: (message: string) => void;
}

/** translateFields 的出参：译文 + 逐字段逐语言状态 + 引擎 + 日限额闸。 */
export interface TranslateFieldsOutput {
  /** 仅含**校验通过**的译文（稀疏：failed/deferred 的键不出现）。 */
  texts: Record<string, Partial<Record<TargetLang, string>>>;
  statuses: Record<string, Partial<Record<TargetLang, TranslationStatus>>>;
  errors: Record<string, Partial<Record<TargetLang, string>>>;
  engine: TranslateEngine;
  /** 是否命中日限额（整批 deferred）。 */
  deferred: boolean;
  deferred_reason: string | null;
}

/** 源文本解析器（backfillPending 用：entity_type/entity_id/field → 当前中文原文）。 */
export type SourceResolver = (row: TranslationRow) => Promise<string | null>;

/** backfillPending 的出参。 */
export interface BackfillReport {
  scanned: number;
  retried: number;
  ready: number;
  failed: number;
  skipped: number;
  /** P6-TR-1b：被日限额/超长闸判 deferred 的行数（与 failed 分列，供 /api/translate/backfill 机读）。 */
  deferred: number;
  engine: TranslateEngine;
  reason: string | null;
}

// ============================================================ 常量 =========

/** 长度比例闸（分母 = 源文本长度）。 */
export const LENGTH_RATIO_MIN = 0.3;
export const LENGTH_RATIO_MAX = 3.0;
/** en 判负阈值：非 ASCII 占比 > 此值 ⇒ 判负（值中无 CJK 时豁免）。 */
export const EN_NON_ASCII_MAX = 0.3;
/** backfillPending 单条最大尝试次数（attempts < 此值才再试）。 */
export const MAX_ATTEMPTS = 5;
/** DeepSeek 请求超时（ms）。 */
export const REQUEST_TIMEOUT_MS = 15000;
/** 走 LLM 的目标语言（hk 走 OpenCC，不在其中）。 */
export const TRANSLATE_TARGETS: ReadonlyArray<TranslateLang> = ['en', 'vn'];
/** P6-TR-1b：**全部**目标语言（含 hk = OpenCC 确定性简繁转换，不走 LLM/不付费）。 */
export const TARGET_LANGS: ReadonlyArray<TargetLang> = ['en', 'vn', 'hk'];
/** 默认模型（官方文档枚举；第三方站写的 deepseek-v4-flash 存疑 ⇒ 环境变量可覆盖）。 */
export const DEFAULT_MODEL = 'deepseek-flash';
export const DEFAULT_BASE_URL = 'https://api.deepseek.com';

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
/** 越南语拉丁扩展（含声调）。 */
const VN_DIACRITIC_RE =
  /[\u00c0-\u00c3\u00c8-\u00ca\u00cc-\u00cd\u00d2-\u00d5\u00d9-\u00da\u00e0-\u00e3\u00e8-\u00ea\u00ec-\u00ed\u00f2-\u00f5\u00f9-\u00fa\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/;

/** 一次性告警闸（无 key 回落 stub 只告警一次）。 */
let fallbackWarned = false;

// ============================================================ 核心纯函数 ====

interface OpenCcModule {
  Converter: (options: { from: string; to: string }) => (s: string) => string;
}
/** OpenCC 转换器的**单例**（首次调用建一次并复用，**不得每次调用重建**）。 */
let traditionalConverter: ((s: string) => string) | null = null;

function getTraditionalConverter(): (s: string) => string {
  if (!traditionalConverter) {
    // 延迟 require：保持本模块「零 IO 副作用」可被离线脚本直接 import。
    // opencc-js 是 CommonJS 兼容包（exports.require → dist/umd/full.js）。
    const OpenCC = require('opencc-js') as OpenCcModule;
    traditionalConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
  }
  return traditionalConverter;
}

/** 简 → 繁（OpenCC，cn→tw）。确定性转换，不是翻译。 */
export function toTraditional(text: string): string {
  return getTraditionalConverter()(text);
}

/** 是否含 CJK 表意文字（判定「是否真的需要翻译」的开关）。 */
export function hasCJK(s: string): boolean {
  return CJK_RE.test(s);
}

/** 非 ASCII 字符占比（分母 = 码点总数；空串 ⇒ 0）。 */
export function asciiRatio(s: string): number {
  const chars = Array.from(s);
  if (!chars.length) return 0;
  let nonAscii = 0;
  for (const ch of chars) if ((ch.codePointAt(0) as number) > 0x7f) nonAscii++;
  return nonAscii / chars.length;
}

/** 是否含越南语拉丁扩展字符（含声调）。 */
export function hasVietnameseDiacritics(s: string): boolean {
  return VN_DIACRITIC_RE.test(s);
}

/** 源文本 sha256（hex，64 字符）。 */
export function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/** stub 引擎的确定性假翻译（离线可单测；**非真实翻译，故跳过三重校验**）。 */
export function stubTranslate(text: string, target: TranslateLang): string {
  return `[${target}] ${text}`;
}

function intOr(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** 从 env 派生生效配置（只读变量名；**不打印任何值**）。 */
export function getTranslateConfig(env: NodeJS.ProcessEnv = process.env): TranslateServiceConfig {
  const requested: TranslateEngine = String(env.TRANSLATE_ENGINE || 'deepseek').toLowerCase() === 'stub'
    ? 'stub'
    : 'deepseek';
  const key = typeof env.DEEPSEEK_API_KEY === 'string' ? env.DEEPSEEK_API_KEY.trim() : '';
  const apiKeyPresent = key.length > 0;
  const baseUrl = String(env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = String(env.DEEPSEEK_MODEL || DEFAULT_MODEL);
  const maxCharsPerItem = intOr(env.TRANSLATE_MAX_CHARS_PER_ITEM, 2000);
  const dailyItemCap = intOr(env.TRANSLATE_DAILY_ITEM_CAP, 500);

  let engine: TranslateEngine = requested;
  let fallbackReason: string | null = null;
  if (requested === 'deepseek' && !apiKeyPresent) {
    engine = 'stub';
    fallbackReason = `${REASON.NO_API_KEY}: DEEPSEEK_API_KEY 缺失 ⇒ 回落 stub（翻译留空+后台重试）`;
  }
  return {
    engine,
    requested_engine: requested,
    api_key_present: apiKeyPresent,
    base_url: baseUrl,
    model,
    max_chars_per_item: maxCharsPerItem,
    daily_item_cap: dailyItemCap,
    fallback_reason: fallbackReason,
  };
}

/** 拼装 DeepSeek 提示词（只输出 JSON、键与输入同、保留数字/价格/币符号/品牌名/URL）。 */
export function buildTranslationPrompt(
  fields: Record<string, string>,
  targetsPerField: Record<string, ReadonlyArray<TranslateLang>>,
): { system: string; user: string } {
  const system = [
    'You are a professional translator for a Chinese-language marketplace app (jobs, goods, profiles, points).',
    'Translate each Chinese source string into the requested target languages.',
    '',
    'STRICT OUTPUT RULES:',
    '1. Output ONLY one single JSON object. No markdown code fences. No explanations. No extra text.',
    '2. Top-level keys MUST be EXACTLY the input field keys — same set, none added, none removed.',
    '3. Each value MUST be an object whose keys are EXACTLY the requested target languages for that field.',
    '4. Every translated value MUST be a non-empty string.',
    '5. Preserve numbers, prices, currency symbols (¥/$), brand names, URLs, emails, phone numbers,',
    '   product codes, order ids and emoji EXACTLY as they appear. Never localise amounts.',
    '6. Translate faithfully: add nothing, omit nothing, do not summarise, do not explain.',
    '7. Vietnamese ("vn") must be written with correct diacritics — never strip tone marks.',
    '8. Keep the same register (formal/informal) as the source.',
  ].join('\n');
  const user = JSON.stringify({ task: 'translate', fields, targets: targetsPerField });
  return { system, user };
}

/** 剥离可能的 markdown 围栏后 JSON.parse（不抛：失败返回结构化结论）。 */
export function parseTranslationPayload(raw: string): { ok: boolean; value: unknown; reason: string | null } {
  let s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return { ok: false, value: null, reason: 'JSON_PARSE' };
  const fenced = /^```[A-Za-z0-9_-]*\s*\n([\s\S]*?)\n?```$/.exec(s);
  if (fenced) {
    s = fenced[1].trim();
  } else {
    s = s.replace(/^```[A-Za-z0-9_-]*\s*/, '').replace(/```$/, '').trim();
  }
  try {
    return { ok: true, value: JSON.parse(s), reason: null };
  } catch {
    return { ok: false, value: null, reason: 'JSON_PARSE' };
  }
}

/** 字符集特征校验（三重校验第 ③ 条）。 */
function validateCharset(source: string, target: TranslateLang, value: string): ValidateOutcome {
  const srcLen = Array.from(source).length;
  if (target === 'vn') {
    // 豁免：源无 CJK（本就拉丁/数字/符号，无「中文未译」问题）或 单字源（品牌/量词等）
    if (!hasCJK(source) || srcLen <= 1) return { ok: true, reason: null, detail: null };
    if (!hasVietnameseDiacritics(value)) {
      return { ok: false, reason: 'CHARSET', detail: 'vn 目标缺少越南语拉丁扩展字符（声调）' };
    }
    return { ok: true, reason: null, detail: null };
  }
  // en：值中无 CJK ⇒ 非 ASCII 属币符号/品牌/URL，豁免；有 CJK 才按占比判
  if (!hasCJK(value)) return { ok: true, reason: null, detail: null };
  const ratio = asciiRatio(value);
  if (ratio > EN_NON_ASCII_MAX) {
    return { ok: false, reason: 'CHARSET', detail: `en 非 ASCII 占比 ${ratio.toFixed(3)} > ${EN_NON_ASCII_MAX}` };
  }
  return { ok: true, reason: null, detail: null };
}

/** 三重校验 · 单条（① 非空 ② 长度比例 ③ 字符集）。JSON 结构校验见 validateFieldSet。 */
export function validateValue(source: string, target: TranslateLang, value: string): ValidateOutcome {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'EMPTY_VALUE', detail: `${target}: 译文为空` };
  }
  const src = typeof source === 'string' ? source : '';
  const srcLen = Array.from(src).length;
  if (srcLen > 0) {
    const ratio = Array.from(value).length / srcLen;
    if (ratio < LENGTH_RATIO_MIN || ratio > LENGTH_RATIO_MAX) {
      return {
        ok: false,
        reason: 'LENGTH_RATIO',
        detail: `ratio=${ratio.toFixed(3)} 越界 [${LENGTH_RATIO_MIN}, ${LENGTH_RATIO_MAX}] (src=${srcLen} 码点)`,
      };
    }
  }
  return validateCharset(src, target, value);
}

/** 三重校验 · 一批（① JSON 可解析 + 顶层键集 == 输入字段集 + 每值非空，②③ 逐条）。 */
export function validateFieldSet(
  sourcePayload: Record<string, string>,
  target: TranslateLang,
  raw: string,
): { ok: boolean; values: Record<string, string>; errors: Record<string, string> } {
  const fields = Object.keys(sourcePayload);
  const values: Record<string, string> = {};
  const errors: Record<string, string> = {};

  const parsed = parseTranslationPayload(raw);
  if (!parsed.ok) {
    for (const f of fields) errors[f] = parsed.reason || 'JSON_PARSE';
    return { ok: false, values, errors };
  }
  const obj = parsed.value;
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    for (const f of fields) errors[f] = 'JSON_PARSE';
    return { ok: false, values, errors };
  }
  const got = Object.keys(obj as Record<string, unknown>).sort();
  const want = [...fields].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    for (const f of fields) errors[f] = 'KEY_SET_MISMATCH';
    return { ok: false, values, errors };
  }
  for (const f of fields) {
    const entry = (obj as Record<string, unknown>)[f];
    let candidate: unknown;
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      candidate = (entry as Record<string, unknown>)[target];
    } else {
      candidate = entry; // 宽松：也接受「字段 → 字符串」的单语言形态
    }
    const outcome = validateValue(sourcePayload[f], target, typeof candidate === 'string' ? candidate : '');
    if (outcome.ok && typeof candidate === 'string') {
      values[f] = candidate;
    } else {
      errors[f] = outcome.reason || 'CHARSET';
    }
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}

// ============================================================ 引擎 =========

/** 调 DeepSeek（OpenAI 兼容）。15s 超时 + 仅 429/5xx 一次重试；**不记请求/响应全文**。 */
export async function callDeepSeek(
  system: string,
  user: string,
  cfg: TranslateServiceConfig,
  fetchImpl?: FetchLike,
  apiKey?: string | null,
): Promise<string> {
  const doFetch: FetchLike = fetchImpl
    || (globalThis as unknown as { fetch: FetchLike }).fetch;
  const key = apiKey !== undefined ? apiKey : (process.env.DEEPSEEK_API_KEY || '');
  if (!key) throw new TranslationError(REASON.NO_API_KEY, 'DEEPSEEK_API_KEY 缺失，无法调用引擎');
  if (typeof doFetch !== 'function') {
    throw new TranslationError(REASON.NETWORK_ERROR, '运行时无 fetch 可用');
  }

  const url = `${cfg.base_url}/chat/completions`;
  const payload = {
    model: cfg.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    // 官方已实测支持；仍要求提示词自带 JSON 约束
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 4000,
    stream: false,
  };

  const attempt = async (): Promise<string> => {
    const ac = new (globalThis as unknown as { AbortController: new () => { abort(): void; signal: unknown } }).AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        try { ac.abort(); } catch { /* noop */ }
        reject(new TranslationError(REASON.TIMEOUT, `请求超时 ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);
    });
    const run = (async () => {
      let res: { ok: boolean; status: number; text(): Promise<string> };
      try {
        res = await doFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(payload),
          signal: ac.signal,
        });
      } catch (e) {
        const name = (e as Error)?.name;
        if (name === 'AbortError') throw new TranslationError(REASON.TIMEOUT, `请求被中止（${REQUEST_TIMEOUT_MS}ms）`);
        throw new TranslationError(REASON.NETWORK_ERROR, `网络错误：${String(name || 'unknown')}`);
      }
      const bodyText = await res.text().catch(() => '');
      if (!res.ok) {
        const status = res.status;
        // 模型名不存在 ⇒ 机读 reason，便于「一句环境变量修复」
        if (status === 400 && /model/i.test(bodyText)
          && /(not\s*(exist|found|available)|invalid\s*model|unknown\s*model|model[_ ]?not)/i.test(bodyText)) {
          throw new TranslationError(
            REASON.MODEL_NOT_AVAILABLE,
            `模型 '${cfg.model}' 被提供方拒（HTTP 400）⇒ 请改 DEEPSEEK_MODEL`,
            400,
          );
        }
        if (status === 429) throw new TranslationError(REASON.RATE_LIMITED, 'HTTP 429', 429);
        throw new TranslationError(REASON.HTTP_ERROR, `HTTP ${status}`, status);
      }
      let envelope: unknown;
      try {
        envelope = JSON.parse(bodyText);
      } catch {
        throw new TranslationError(REASON.BAD_RESPONSE_SHAPE, '提供方返回非 JSON 信封');
      }
      const content = (envelope as { choices?: Array<{ message?: { content?: unknown } }> })
        ?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new TranslationError(REASON.BAD_RESPONSE_SHAPE, '补全内容为空');
      }
      return content;
    })();
    try {
      return await Promise.race([run, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (e) {
    const te = e as TranslationError;
    const retryable = te instanceof TranslationError
      && (te.http_status === 429 || (typeof te.http_status === 'number' && te.http_status >= 500));
    if (retryable) return await attempt();
    throw te;
  }
}

// ============================================================ 编排 =========

/** 一次调用把同一实体的多个字段译成 en/vn（缓存命中不付费；失败不写脏数据）。 */
export async function translateFields(
  payload: Record<string, string>,
  opts: TranslateFieldsOptions,
): Promise<TranslateFieldsOutput> {
  const cfg = opts.config || getTranslateConfig();
  const engine: TranslateEngine = opts.engine || cfg.engine;
  const store: TranslateStore | null = opts.store === null ? null : (opts.store || createDbStore());
  const fetchImpl = opts.fetchImpl;
  const warn = opts.onWarn || ((m: string) => { if (!fallbackWarned) { fallbackWarned = true; console.warn(`[translate-service] ${m}`); } });

  if (engine === 'stub' && cfg.fallback_reason) warn(cfg.fallback_reason);

  const fields = Object.keys(payload).filter((f) => typeof payload[f] === 'string' && payload[f].trim() !== '');
  const out: TranslateFieldsOutput = {
    texts: {}, statuses: {}, errors: {}, engine, deferred: false, deferred_reason: null,
  };
  if (!fields.length) return out;

  const markAll = async (status: TranslationStatus, reason: string): Promise<void> => {
    for (const f of fields) {
      out.texts[f] = {};
      out.statuses[f] = {};
      out.errors[f] = {};
      for (const t of TARGET_LANGS) {
        out.statuses[f][t] = status;
        out.errors[f][t] = reason;
        if (store) {
          await store.upsertTranslation({
            entity_type: opts.entityType, entity_id: opts.entityId, field: f, lang: t,
            text: null, status, attempts: 0, last_error: reason,
          });
        }
      }
    }
  };

  // ---- 闸 ①：单条字符上限
  const totalChars = fields.reduce((n, f) => n + Array.from(payload[f]).length, 0);
  if (totalChars > cfg.max_chars_per_item) {
    const reason = `${REASON.ITEM_TOO_LONG}: chars=${totalChars} > max=${cfg.max_chars_per_item}`;
    await markAll('deferred', reason);
    out.deferred = true;
    out.deferred_reason = reason;
    return out;
  }

  // ---- 闸 ②：日条数上限（派生自 content_translation 当日 updated_at 行数）
  if (store) {
    const used = await store.countToday().catch(() => 0);
    const projected = fields.length * TARGET_LANGS.length;
    if (used + projected > cfg.daily_item_cap) {
      const reason = `${REASON.DAILY_CAP_REACHED}: used=${used} + projected=${projected} > cap=${cfg.daily_item_cap}`;
      await markAll('deferred', reason);
      out.deferred = true;
      out.deferred_reason = reason;
      return out;
    }
  }

  // ---- 缓存优先（命中即不付费）
  const cached: Record<string, Partial<Record<TranslateLang, string>>> = {};
  const misses: Record<string, TranslateLang[]> = {};
  for (const f of fields) {
    cached[f] = {};
    const srcHash = sha256Hex(payload[f]);
    const miss: TranslateLang[] = [];
    for (const t of TRANSLATE_TARGETS) {
      const hit = store ? await store.getCache(srcHash, 'zh', t).catch(() => null) : null;
      if (typeof hit === 'string' && hit.trim()) cached[f][t] = hit;
      else miss.push(t);
    }
    if (miss.length) misses[f] = miss;
  }

  // ---- 逐目标语言调用引擎（一次调用覆盖「需要该语言的字段」）
  const perTarget: Partial<Record<TranslateLang, { values: Record<string, string>; errors: Record<string, string> }>> = {};
  const missFields = Object.keys(misses);
  if (missFields.length) {
    if (engine === 'stub') {
      for (const t of TRANSLATE_TARGETS) {
        const values: Record<string, string> = {};
        for (const f of missFields) if (misses[f].includes(t)) values[f] = stubTranslate(payload[f], t);
        if (Object.keys(values).length) perTarget[t] = { values, errors: {} };
      }
    } else {
      const subset: Record<string, string> = {};
      const targetsPerField: Record<string, TranslateLang[]> = {};
      for (const f of missFields) {
        subset[f] = payload[f];
        targetsPerField[f] = misses[f];
      }
      const { system, user } = buildTranslationPrompt(subset, targetsPerField);
      try {
        const raw = await callDeepSeek(system, user, cfg, fetchImpl, opts.apiKey);
        for (const t of TRANSLATE_TARGETS) {
          const targetSubset: Record<string, string> = {};
          for (const f of missFields) if (misses[f].includes(t)) targetSubset[f] = payload[f];
          if (Object.keys(targetSubset).length) {
            perTarget[t] = validateFieldSet(targetSubset, t, raw);
          }
        }
      } catch (e) {
        // ★ 绝不阻塞提交：引擎/网络/模型错误 ⇒ 该批字段记 failed + 机读 reason，留空待重试
        const reason = e instanceof TranslationError ? e.reason : REASON.NETWORK_ERROR;
        for (const t of TRANSLATE_TARGETS) {
          const targetSubset: Record<string, string> = {};
          for (const f of missFields) if (misses[f].includes(t)) targetSubset[f] = payload[f];
          if (Object.keys(targetSubset).length) {
            const errors: Record<string, string> = {};
            for (const f of Object.keys(targetSubset)) errors[f] = reason;
            perTarget[t] = { values: {}, errors };
          }
        }
      }
    }
  }

  // ---- hk：OpenCC 确定性简繁转换（**不走 LLM、不付费**；缓存按 engine='opencc' 记）
  const hkTexts: Record<string, string> = {};
  for (const f of fields) {
    const srcHash = sha256Hex(payload[f]);
    const cachedHk = store ? await store.getCache(srcHash, 'zh', 'hk').catch(() => null) : null;
    if (typeof cachedHk === 'string' && cachedHk.trim()) {
      hkTexts[f] = cachedHk;
    } else {
      const converted = toTraditional(payload[f]);
      hkTexts[f] = converted;
      if (store && converted) {
        await store.putCache({
          src_hash: srcHash, src_lang: 'zh', tgt_lang: 'hk', text_out: converted, engine: 'opencc',
        });
      }
    }
  }

  // ---- 落库（每 (field, lang) 恰好一次 upsert；lang 含 hk）
  for (const f of fields) {
    out.texts[f] = {};
    out.statuses[f] = {};
    out.errors[f] = {};
    const srcHash = sha256Hex(payload[f]);
    for (const t of TARGET_LANGS) {
      const hit = t === 'hk' ? hkTexts[f] : cached[f][t];
      if (typeof hit === 'string' && hit) {
        out.texts[f][t] = hit;
        out.statuses[f][t] = 'ready';
      } else {
        const result = t === 'en' || t === 'vn' ? perTarget[t] : undefined;
        const value = result ? result.values[f] : undefined;
        if (typeof value === 'string' && value) {
          out.texts[f][t] = value;
          out.statuses[f][t] = 'ready';
          if (store) {
            await store.putCache({
              src_hash: srcHash, src_lang: 'zh', tgt_lang: t, text_out: value, engine,
            });
          }
        } else {
          out.statuses[f][t] = 'failed';
          out.errors[f][t] = (result && result.errors[f]) || 'CHARSET';
        }
      }
      if (store) {
        await store.upsertTranslation({
          entity_type: opts.entityType,
          entity_id: opts.entityId,
          field: f,
          lang: t,
          text: out.texts[f][t] || null,
          status: out.statuses[f][t] as TranslationStatus,
          attempts: 0,
          last_error: out.errors[f][t] || null,
        });
      }
    }
  }
  return out;
}

// ============================================================ 存储端口 =====

interface DbModule {
  readQuery: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>;
  withTransaction: <T>(fn: (tx: { query: <R = Record<string, unknown>>(t: string, p?: unknown[]) => Promise<{ rows: R[] }> }) => Promise<T>) => Promise<T>;
}

function loadDb(): DbModule {
  // 延迟 require：离线单测 import 本模块时不触碰任何连接池。
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('./db') as DbModule;
}

/** 存储端口的生产实现（只读走 readQuery；写走 withTransaction）。 */
export function createDbStore(): TranslateStore {
  const upsertSql = `
    INSERT INTO public.content_translation
      (entity_type, entity_id, field, lang, text, status, attempts, last_error, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, 0, $7, now())
    ON CONFLICT (entity_type, entity_id, field, lang) DO UPDATE SET
      text       = EXCLUDED.text,
      status     = EXCLUDED.status,
      last_error = EXCLUDED.last_error,
      attempts   = public.content_translation.attempts
                   + CASE WHEN EXCLUDED.status IN ('ready', 'failed') THEN 1 ELSE 0 END,
      updated_at = now()`;

  return {
    getCache: async (srcHash, srcLang, tgtLang) => {
      const db = loadDb();
      const rows = await db.readQuery<{ text_out: string }>(
        `SELECT text_out FROM public.translation_cache
          WHERE src_hash = $1 AND src_lang = $2 AND tgt_lang = $3`,
        [srcHash, srcLang, tgtLang],
      );
      return rows[0] ? String(rows[0].text_out) : null;
    },
    putCache: async (row) => {
      const db = loadDb();
      await db.withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO public.translation_cache (src_hash, src_lang, tgt_lang, text_out, engine, created_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (src_hash, src_lang, tgt_lang) DO UPDATE SET
             text_out = EXCLUDED.text_out, engine = EXCLUDED.engine`,
          [row.src_hash, row.src_lang, row.tgt_lang, row.text_out, row.engine],
        );
      });
    },
    countToday: async () => {
      const db = loadDb();
      const rows = await db.readQuery<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.content_translation
          WHERE updated_at >= date_trunc('day', now())`,
      );
      return rows[0] ? Number(rows[0].n) : 0;
    },
    upsertTranslation: async (row) => {
      const db = loadDb();
      await db.withTransaction(async (tx) => {
        await tx.query(upsertSql, [
          row.entity_type, row.entity_id, row.field, row.lang,
          row.text, row.status, row.last_error,
        ]);
      });
    },
    listPending: async (limit, maxAttempts) => {
      const db = loadDb();
      const rows = await db.readQuery<TranslationRow>(
        `SELECT entity_type, entity_id, field, lang, text, status, attempts, last_error
           FROM public.content_translation
          WHERE status IN ('pending', 'failed') AND attempts < $1
          ORDER BY updated_at ASC
          LIMIT $2`,
        [maxAttempts, limit],
      );
      return rows.map((r) => ({ ...r, attempts: Number(r.attempts) }));
    },
    readCurrent: async (entityType, entityId, field, lang) => {
      const db = loadDb();
      const rows = await db.readQuery<{ text: string | null; status: TranslationStatus }>(
        `SELECT text, status FROM public.content_translation
          WHERE entity_type = $1 AND entity_id = $2 AND field = $3 AND lang = $4`,
        [entityType, entityId, field, lang],
      );
      return rows[0] || null;
    },
  };
}

/** 源文本解析器的生产实现（**白名单表/列**；参数化 id；只读）。 */
export function createDbSourceResolver(): SourceResolver {
  const WHITELIST: Record<string, { table: string; idCol: string; fields: Record<string, string> }> = {
    job: { table: 'job', idCol: 'job_id', fields: { title: 'title', description: 'description' } },
    listing: { table: 'listing', idCol: 'listing_id', fields: { title: 'title', description: 'description' } },
    user: { table: 'users', idCol: 'uid', fields: { bio: 'bio' } },
    currency: { table: 'currency', idCol: 'cid', fields: { name: 'name' } },
  };
  return async (row) => {
    const spec = WHITELIST[row.entity_type];
    if (!spec) return null;
    const col = spec.fields[row.field];
    if (!col) return null;
    const db = loadDb();
    const rows = await db.readQuery<{ v: string | null }>(
      `SELECT ${col} AS v FROM public.${spec.table} WHERE ${spec.idCol} = $1::bigint`,
      [row.entity_id],
    );
    return rows[0] && typeof rows[0].v === 'string' ? rows[0].v : null;
  };
}

// ============================================================ 后台回填 =====

/** 扫描 pending/failed 且 attempts < N 的条目重试（**本单只落函数，不接路由**）。 */
export async function backfillPending(
  limit: number,
  opts: {
    store?: TranslateStore;
    resolveSource?: SourceResolver;
    config?: TranslateServiceConfig;
    fetchImpl?: FetchLike;
    apiKey?: string | null;
  } = {},
): Promise<BackfillReport> {
  const cfg = opts.config || getTranslateConfig();
  const store = opts.store || createDbStore();
  const resolveSource = opts.resolveSource || createDbSourceResolver();

  const rows = await store.listPending(limit, MAX_ATTEMPTS);
  const report: BackfillReport = {
    scanned: rows.length, retried: 0, ready: 0, failed: 0, skipped: 0, deferred: 0,
    engine: cfg.engine, reason: null,
  };

  // 按实体分组：一次 translateFields 覆盖同一实体的多个字段
  const groups = new Map<string, TranslationRow[]>();
  for (const r of rows) {
    const k = `${r.entity_type}\u0000${r.entity_id}`;
    const list = groups.get(k);
    if (list) list.push(r); else groups.set(k, [r]);
  }

  for (const [key, group] of groups) {
    const [entityType, entityId] = key.split('\u0000');
    const payload: Record<string, string> = {};
    const kept: TranslationRow[] = [];
    for (const r of group) {
      let src: string | null = null;
      try {
        src = await resolveSource(r);
      } catch {
        src = null;
      }
      if (!src || !src.trim()) {
        report.skipped += 1;
        continue;
      }
      payload[r.field] = src;
      kept.push(r);
    }
    if (!Object.keys(payload).length) continue;
    report.retried += 1;
    const result = await translateFields(payload, {
      entityType,
      entityId,
      store,
      config: cfg,
      fetchImpl: opts.fetchImpl,
      apiKey: opts.apiKey,
    });
    for (const r of kept) {
      const st = result.statuses[r.field] ? result.statuses[r.field][r.lang as TranslateLang] : undefined;
      if (st === 'ready') report.ready += 1;
      else if (st === 'deferred') report.deferred += 1;
      else if (st === 'failed') report.failed += 1;
      else report.skipped += 1;
    }
    if (result.deferred_reason) report.reason = result.deferred_reason;
  }
  return report;
}
