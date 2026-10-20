/**
 * 商品对外标识生成器（Kevin 2026-10-20 指令第 3 条）
 * ---------------------------------------------------------------------------
 * 一次给两件东西（**单一真源**：迁移 0060 的回填口径与本文件的算法逐字对齐）：
 *   ① `nextSnowflake()` —— 商品唯一标识（**对外 id**）：41 位毫秒 + 10 位机器位 + 12 位序号；
 *   ② `codeFromSnowflake()` —— 7 位页面地址码 `item_code`（base62 去混淆字母表 / 57 字符基数），
 *      页面地址从 `/item/<数字 id>` 换成 `/item/<item_code>`。
 *
 * 为什么不换主键：`listing.listing_id bigserial` 被 10+ 张表 FK 引用（订单 / 台账 / 收藏 /
 *   会话 / 审计…），换主键是跨表破坏性变更；`snowflake_id` 与之 **1:1 并列**，对外只认它。
 *
 * 雪花位布局（63 bit、恒正 ⇒ 不触 bigint 符号位）：
 *   [62..22] 41 位 = 公历毫秒 − `SNOWFLAKE_EPOCH_MS`（2024-01-01T00:00:00Z）
 *   [21..12] 10 位 = 机器位（`SNOWFLAKE_MACHINE_ID`，缺省 0；多实例部署时按实例给值）
 *   [11..0]  12 位 = 同毫秒序号 0..4095（耗尽 ⇒ 自旋等下一毫秒，绝不回退）
 * 纪元取 2024 而非 1970：41 位毫秒从 2024 起算可撑到 **2093**（从 1970 起算只能到 2039）。
 *
 * 单调保证：进程内 `lastMs` 单调不降 —— 时钟回拨 ⇒ 钉住上次毫秒继续发号（宁可短暂复用毫秒段
 *   也不发重号）；同毫秒序号耗尽 ⇒ 忙等下一毫秒（`Date.now()` 前即为止，不用 sleep 以免引入
 *   异步签名）。跨进程唯一由机器位承担（迁移 0060 回填恒 0，服务层镜像亦默认 0）。
 *
 * 码表：`23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz` —— base62 **去掉
 *   `0/O/1/l/I`** 五个易混字形后的 **57** 字符（8 数字 + 24 大写 + **25** 小写 —— 小写只剔 `l`：
 *   表内既无 `0` 也无 `O`，故 `o` 本身无歧义，62 − 5 = 57）。
 *   · 57^7 = 1,954,897,493,193 ≈ 1.95e12 码位；
 *   · 编码前先做 `(sf mod 57^7) * 1000003 mod 57^7` 的确定性打散（1000003 与 57^7 = 3^7·19^7 互质 ⇒
 *     **双射**，不引入碰撞），避免「建单越晚码越大」的连号页面地址；
 *   · **永不产纯数字码**：路由层「全数字 ref ⇒ 按 listing_id」是向后兼容判据，纯数字 item_code
 *     会永不可达 ⇒ 撞纯数字码就 `+1` 换码（迁移回填同口径，尾部自检 ⑦ 反断言 0 行）。
 *
 * 冲突重试：`createListing` 生成→写入，撞唯一约束（23505）⇒ **重生重试 ≤3 次**后上抛
 *   （`isItemIdUniqueViolation` 只认两列的唯一索引，`create_key` 撞车照旧直接上抛 —— 那是
 *   幂等键语义，不是本单的 id 重试面）。
 */

/** 项目纪元（毫秒）：2024-01-01T00:00:00Z。★ 迁移 0060 `c_epoch_ms` 必须与本值相同。 */
export const SNOWFLAKE_EPOCH_MS = 1704067200000;

export const SNOWFLAKE_SEQ_BITS = 12;
export const SNOWFLAKE_MACHINE_BITS = 10;
export const SNOWFLAKE_SEQ_MAX = (1 << SNOWFLAKE_SEQ_BITS) - 1;      // 4095
export const SNOWFLAKE_MACHINE_MAX = (1 << SNOWFLAKE_MACHINE_BITS) - 1; // 1023
export const SNOWFLAKE_MACHINE_ENV = 'SNOWFLAKE_MACHINE_ID';

/** 7 位码表（★ 迁移 0060 `c_alphabet` 必须与本值逐字相同；门 p60 A6 对拍） */
export const ITEM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const ITEM_CODE_LENGTH = 7;
export const ITEM_CODE_RADIX = ITEM_CODE_ALPHABET.length;            // 57（★ 迁移 0060 `c_radix` 必须同值，门 p60 A8 对拍）
/** 打散常量（★ 迁移 0060 同值）：与 57^7 = 3^7·19^7 互质 ⇒ 乘映射在 Z_(57^7) 上双射 */
export const ITEM_CODE_MIX = 1000003;

const RADIX = BigInt(ITEM_CODE_RADIX);
const CODE_MOD = RADIX ** BigInt(ITEM_CODE_LENGTH);
const MIX = BigInt(ITEM_CODE_MIX);
const SEQ_MAX = BigInt(SNOWFLAKE_SEQ_MAX);
const SEQ_BITS = BigInt(SNOWFLAKE_SEQ_BITS);
const MACHINE_BITS = BigInt(SNOWFLAKE_MACHINE_BITS);
const EPOCH = BigInt(SNOWFLAKE_EPOCH_MS);
const ALL_DIGITS = /^[0-9]+$/;
/** 路由判定用：7 位字母数字（与迁移 CHECK `^[0-9A-Za-z]{7}$` 同源） */
export const ITEM_CODE_PATTERN = /^[0-9A-Za-z]{7}$/;
/** 创建时 id 冲突重试上限（唯一约束 23505 ⇒ 重生重试） */
export const ITEM_ID_CREATE_ATTEMPTS = 3;
/** 单毫秒序号耗尽后的自旋上限（5e6 次 ≈ 数秒；超限视为环境异常，宁可抛也不发重号） */
const SPIN_LIMIT = 5_000_000;

/** 机器位：`SNOWFLAKE_MACHINE_ID` 缺省 0；非法/负值 ⇒ 0；超上限 ⇒ 夹到 1023 */
export const resolveMachineId = (raw: unknown = process.env[SNOWFLAKE_MACHINE_ENV]): number => {
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  if (!/^\d+$/.test(text)) return 0;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value)) return 0;
  return Math.min(value, SNOWFLAKE_MACHINE_MAX);
};

let lastMs = -1n;
let lastSeq = 0n;

/** 仅供门/测试复位发号器（生产路径不调用；复位后同毫秒可能重号，故只在探针里用） */
export const resetSnowflakeState = (): void => {
  lastMs = -1n;
  lastSeq = 0n;
};

/**
 * 取下一个雪花（bigint）。`nowMs` 仅供门注入（缺省 `Date.now()`）。
 * 语义（逐条都是承重墙）：
 *   · **单调不降**：`ms < lastMs`（时钟回拨）⇒ 沿用 `lastMs`；
 *   · 同毫秒 ⇒ 序号 +1；序号 > 4095 ⇒ 自旋到真正的下一毫秒再发（序号归 0）；
 *   · 返回恒为正 bigint（41+10+12 位 = 63 bit，最高位不置）。
 */
export const nextSnowflake = (nowMs?: number): bigint => {
  const machine = BigInt(resolveMachineId()) << MACHINE_BITS;
  let ms = BigInt(nowMs === undefined ? Date.now() : nowMs);
  if (ms < lastMs) ms = lastMs;

  if (ms === lastMs) {
    lastSeq += 1n;
    if (lastSeq > SEQ_MAX) {
      let spins = 0;
      while (BigInt(Date.now()) <= lastMs) {
        spins += 1;
        if (spins > SPIN_LIMIT) {
          throw new Error('nextSnowflake: 单毫秒 4096 号耗尽且等不到下一毫秒');
        }
      }
      ms = BigInt(Date.now());
      lastMs = ms;
      lastSeq = 0n;
    }
  } else {
    lastMs = ms;
    lastSeq = 0n;
  }

  return ((ms - EPOCH) << SEQ_BITS) | machine | lastSeq;
};

/** 纯编码：把 `0..57^7-1` 的余数写成 7 位码（左补首位字符，故短数也恒 7 位） */
export const encodeItemCodeValue = (value: bigint): string => {
  let rest = ((value % CODE_MOD) + CODE_MOD) % CODE_MOD;
  let out = '';
  for (let i = 0; i < ITEM_CODE_LENGTH; i += 1) {
    out = ITEM_CODE_ALPHABET[Number(rest % RADIX)] + out;
    rest /= RADIX;
  }
  return out;
};

/**
 * 雪花 ⇒ 7 位 item_code（确定性；同一雪花 + 同一 offset 恒同码）。
 *   · `offset` = 冲突重试位移（撞已有码时由调用方 +1 递增；编码层自身也会跳过纯数字码）；
 *   · 纯数字码（`^[0-9]{7}$`）⇒ 内部 `+1` 继续找，最多 64 次（57^7 空间里连撞 64 个纯数字码
 *     的概率为 (8/57)^64 ≈ 0；仍撞则抛错而不是下发不可达地址）。
 */
export const codeFromSnowflake = (snowflake: bigint, offset = 0): string => {
  const base = (((snowflake % CODE_MOD) + CODE_MOD) % CODE_MOD) * MIX % CODE_MOD
    + ((BigInt(offset) % CODE_MOD) + CODE_MOD) % CODE_MOD;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const code = encodeItemCodeValue(base + BigInt(attempt));
    if (!ALL_DIGITS.test(code)) return code;
  }
  throw new Error(`codeFromSnowflake: 连续 64 个候选码均为纯数字（snowflake=${snowflake}）`);
};

/** 7 位字母数字码判定（路由层「非数字 ref ⇒ 按 item_code 查」的入口闸） */
export const isItemCode = (value: unknown): value is string =>
  typeof value === 'string' && ITEM_CODE_PATTERN.test(value);

/** 纯数字 ref 判定（= 向后兼容面：数字 ⇒ 按 `listing_id` 解释） */
export const isNumericRef = (value: unknown): value is string =>
  typeof value === 'string' && ALL_DIGITS.test(value);

/**
 * 唯一约束冲突判定（只认**本单两列**的唯一索引）：
 *   · `code = 23505`（含 neon 驱动的 `cause.code`）；
 *   · 且错误里**不含** `create_key` —— `create_key` 撞车属幂等键语义（既有行为：直接上抛
 *     `LEDGER_IDEMPOTENCY_CONFLICT` 一族），不是 id 重生重试面。
 */
export const isItemIdUniqueViolation = (error: unknown): boolean => {
  const e = error as {
    code?: string;
    constraint?: string;
    detail?: string;
    message?: string;
    cause?: { code?: string; constraint?: string; detail?: string; message?: string };
  } | null;
  const code = e?.code ?? e?.cause?.code;
  if (code !== '23505') return false;
  const text = [e?.constraint, e?.detail, e?.message, e?.cause?.constraint, e?.cause?.detail, e?.cause?.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return !text.includes('create_key');
};
