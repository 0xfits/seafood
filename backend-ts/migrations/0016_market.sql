-- ============================================================================
-- 0016_market.sql · P5 第三柱（积分交易所）· `market_order` + `market_trade` +
--   `candle_view`（视图）+ 守卫 + 编排函数 `market_post_event`
-- ============================================================================
-- 权威口径：docs/data-layer.spec.md **v0.5**（md5 ed8e2a1f19c86b39db880533ee1cbae8）
--   §6.1  `0016` = `market_order` / `market_trade` + 撮合串行化所需对象 + `candle_view`（C9 已裁：视图）
--         + `market_post_event`
--   §6.4  `market_order` 逐列契约与挂单冻结（DL64）· `market_trade` append-only（DL65）·
--         K 线用视图（DL66 / DL150）· 单位上市不建新表（DL67）· 撮合串行化与冻结归属（DL68）·
--         持仓/转让不建新表（DL69）
--   §6.7  通用规约：三件套（DL75）· 可变表用状态机守卫、禁全表 append-only（DL76）·
--         状态机判负用例（DL77）· uid 列 FK users / `*_txid` 不建 FK（DL78）· 禁 DELETE（DL79）·
--         snake_case 非保留字（DL80）· 索引预算（DL74）
--   §7.1  ③交易所：挂单 = `hold`（买/卖各一组，R39 不跨币种）· 撤单 = `hold_release` ×2 ·
--         撮合成交 = `trade` **×4** + `trade_fee` **×2**（taker `balance −f` / `uid −1` `+f`，R47）
--   §7.2  DL85 交易所事件 kind 白名单：挂单 = `hold` 族；成交 = `trade`(4) + `trade_fee`(2)，**超范围即拒绝**；
--         DL87 `trade_fee` 承担方 = taker、币种恒 `$`(cid=1)、是消耗不是冻结；DL88 保证金语义；
--         DL89 mint/burn 边界（本柱不用）；DL90 禁新增 `market_hold` 类 kind（R43）
--   §8    DL93 键三类前缀闸（逐项同序）· DL94 创建类 `cli:` / 业务类 `biz:` · DL99 无分录的写不得借账本幂等 ·
--         DL100 键的落盘自证
--   DL20  ✅ 采纳提案 A：业务编排函数（业务行锁 → 派生分录 → 调既有 ledger_post_event → 回写）
--   DL141 加锁全序 = 业务行（主键升序）→ currency（cid 升序）→ account（uid 升序）
--   DL142 编排函数只由迁移创建、**函数体内禁任何 DDL**
--   DL143 每次调用必带幂等键（键由本函数按 §8 确定性派生）+ `ref_type`/`ref_id` 落账本引用列
--         + 根键写回业务行 `ledger_event_keys`
--   DL144 重放语义逐字对齐 R51/R52：同键同指纹 ⇒ 200 重放且**不重写业务行**、**不追加
--         `ledger_event_keys` 项**；同键异指纹 ⇒ 409
--   DL149 C8 判负用例（同键重放不追加 ledger_event_keys 项）—— 由 scripts/p3m-02 取证
--   DL151 新数据层所有 SQL 显式限定 `public.`（neon_auth.account 同名陷阱）
--   R21 / DL78  `*_txid` 列不建 FK 到 ledger_entry；uid 列一律 FK users(uid)
--   R28  状态 × 操作矩阵（唯一真源 = 既有 `public.ledger_assert_currency_op`）：
--          挂单 `hold` ⇒ **仅 `listed`**；撤单 `hold_release` ⇒ 四态全可
--   R47 / DL87  `trade_fee` 承担方 = taker、币种恒 `$`(cid = 1)（手续费是消耗，撤单不退）
--   R79 / DL141 加锁全序；R93/DL77 状态机判负用例；R109 编排函数原子性与幂等口径
--
-- 本迁移做什么
--   ① `public.market_order`：逐列照 §6.4 / DL64（**不增删列、不自创列名**）13 列 + CHECK + FK
--   ② `public.market_trade`：逐列照 §6.4 / DL65 10 列 + CHECK + FK（append-only）
--   ③ `public.candle_view`：逐列照 §6.4 / DL66 的 8 列**视图**（DL150：不落表、不物化）
--   ④ `public.market_order_status_transition_ok`：状态机白名单唯一真源（供触发器与自检共用）
--   ⑤ 守卫触发器（状态机 + DL75① create_key 不可变 + 挂单核心快照不可变 + `amount_filled` 单调
--      + DL75③ time_updated 刷新 + DL79 禁 DELETE + DL65 market_trade append-only）
--   ⑥ `public.market_post_event(payload jsonb)`：编排函数（op = order | cancel | trade）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0015` 的任何字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · **不改 `ledger_post_event` 的函数体**（CR81 只禁「改函数体」；本文件只**新增**新函数）
--   · **不建** `market_hold` / `product_hold` 类新 kind（DL90/R43 已裁）；**不新增任何 kind**（DL81：0 扩展）
--   · **不建** `shard` / `shard_transfer` / 持仓表 / 成交流水第二真源（DL29 / DL69）
--   · 不建 K 线落表或物化视图（DL66 C9 已裁「视图」；升级门槛与手续见 DL150 ⇒ 本迁移**不预埋**）
--   · 不动既有 13 张基表的**数据**或结构（本迁只**增**对象）
--   · 不接路由（`src/` 本单不改）；**撮合算法不由本迁移发明**（见「登记式缺口」第 2 条）
--
-- ⚠️ 与 §6.4 的**登记式缺口 / 工程口径**（不发明；逐条见交付报告 docs/audit/p3-market-0016.md §3）
--   1. **`market_order.status` 的转移白名单 §6.4 未逐条枚举**（只经 DL68 的 `status IN ('open','partial')`
--      与 §7.1「撤单（全量或部分）」侧写）。本迁移取**最小集**：
--      `open → {partial, filled, cancelled}`、`partial → {filled, cancelled}`；`filled` / `cancelled` = 终态。
--   2. **撮合规则（价格—时间优先 / 价差改善）§6.4 未定义** ⇒ 本编排函数**不发明撮合算法**：成交由
--      调用方（未来的撮合服务）显式给出 `buy_order_id` / `sell_order_id` / `price` / `amount` / `fee`，
--      本函数只负责「业务行 + 6 条分录同一事件」的**记账编排与守恒**。因 §7.1 + DL85 把成交事件钉死为
--      **恰好 6 条分录**，任何「价差改善要额外释放冻结」的形态都需要第 7 条分录 ⇒ 本实现要求
--      **成交价 = 买单限价**（否则买单侧冻结与实付不相等）；不满足即拒（`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`）。
--      价差改善需**新裁定**（登记缺口）。
--   3. **§6.4 未列索引清单**（DL63 之于 §6.3 有，§6.4 **无**）⇒ 逐字照办：**只**建约束自带索引
--      （PK ×2 + `market_order.create_key` 唯一 ×1），**不擅自增**（DL74 的「新增须说明」不适用 ⇒ 不增）。
--   4. **§6.4 规定 `quote_cid` 恒 = 1** ⇒ 以 CHECK 落实（`market_order_quote_cid_is_one`），显式存列。
--   5. **`market_trade` 无 `create_key` / `ledger_event_keys` / `time_updated`**（§6.4 列清单未含）⇒ 逐列照办
--      **不加**：它是 append-only 的**事件载体**（DL76 的不可变族），幂等由账本键 `biz:market:trade:…` 承担
--      （DL99：无分录的写才需要业务侧幂等键）。
--   6. **`candle_view` 的桶宽**：DL66 写 `date_trunc('minute'|'hour', …)` 两档，而视图列只有一个
--      `bucket_start` ⇒ 本迁移取**分钟桶**（`minute`）；小时档可由 `date_trunc('hour', bucket_start)`
--      在上层聚合得出（**不新建第二个视图名** —— 那会自创对象名）。登记缺口。
--   7. **零额手续费**：`fee = 0` 时**不写** `trade_fee` 分录（对齐 R44「零额手续费 ⇒ 不写 fee 分录」的
--      同类口径），此时成交事件 = `trade` ×4；`fee > 0` 时 = `trade` ×4 + `trade_fee` ×2（DL85 逐字）。
--
-- 幂等（DL48）：`CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` / `CREATE OR REPLACE VIEW` /
--   `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`；末尾 apply-time `DO` 自检（结构 + 纯函数白名单正/负全集
--   + 视图列 + 触发器启用态 + 函数体内无 DDL）；任一失败 ⇒ 整迁移回滚、不写版本行。
--
-- 诚实边界（不得夸大）
--   · 「append-only / 状态机 / 快照不可变」都是**防应用层事故的护栏**：`TRUNCATE` 不触发行触发器，
--     超管 `ALTER TABLE … DISABLE TRIGGER USER` 可旁路 ⇒ **不得**表述为「绝对不可变」（DL65 的诚实边界同）。
--   · 「不超卖 / 不超额成交」靠**行锁串行化**（`SELECT … FOR UPDATE` 按主键升序锁两张 order 行）
--     + `amount_filled <= amount` 的 CHECK + 账本 `frozen >= 0` 的账户守卫，**不是**乐观版本号。
--   · 「冻结守恒」由账本的事件级不变式落实（`Σ(delta + frozen_delta) = 0`，实测读见于 0004/0012 的
--     `EVENT_NOT_BALANCED` 分支）；本迁移不自造第二套守恒判定。
-- ============================================================================


-- ============================================================================
-- §A 状态机白名单 —— 唯一真源，供触发器与自检共用
-- ============================================================================

-- A1 `market_order.status`（§6.4 未逐条枚举 ⇒ 取最小集，见文件头「登记式缺口」第 1 条）
CREATE OR REPLACE FUNCTION public.market_order_status_transition_ok(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'open'    THEN p_to IN ('partial', 'filled', 'cancelled')
    WHEN 'partial' THEN p_to IN ('filled', 'cancelled')
    ELSE false            -- filled / cancelled = 终态（无出边）
  END
$$;

COMMENT ON FUNCTION public.market_order_status_transition_ok(text, text) IS
  'market_order 状态白名单唯一真源：open→{partial,filled,cancelled}；partial→{filled,cancelled}；filled/cancelled 终态。§6.4 未逐条枚举 ⇒ 最小集（DL68 的 status IN (open,partial) + §7.1 撤单），缺口已登记。';


-- ============================================================================
-- §B `public.market_order` 表（逐列照 §6.4 / DL64；13 列）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.market_order (
  order_id           bigint      GENERATED BY DEFAULT AS IDENTITY,
  owner_uid          bigint      NOT NULL,
  side               text        NOT NULL,
  base_cid           bigint      NOT NULL,
  quote_cid          bigint      NOT NULL,
  price              bigint      NOT NULL,
  amount             bigint      NOT NULL,
  amount_filled      bigint      NOT NULL DEFAULT 0,
  status             text        NOT NULL DEFAULT 'open',
  create_key         text        NOT NULL,
  ledger_event_keys  text[]      NOT NULL DEFAULT '{}',
  time_created       timestamptz NOT NULL DEFAULT now(),
  time_updated       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_order_pk                PRIMARY KEY (order_id),
  -- DL75① / DL64：创建幂等键（指纹口径与 R51/R52 一致）
  CONSTRAINT market_order_create_key_uniq   UNIQUE (create_key),
  -- §6.4 / DL68：side 取值（`buy` / `sell`）—— DL68 的挂单判据按 side='buy'/'sell' 分式
  CONSTRAINT market_order_side_enum         CHECK (side IN ('buy','sell')),
  -- §6.4 / DL64：`quote_cid` **恒 = 1**（`$` 是交易所基础货币；显式存列以便未来多基础货币）
  CONSTRAINT market_order_quote_cid_is_one  CHECK (quote_cid = 1),
  -- §6.4：base 与 quote 必须是两种币（R39：不跨币种）
  CONSTRAINT market_order_cid_distinct      CHECK (base_cid <> quote_cid),
  -- §6.4：`price bigint >0`
  CONSTRAINT market_order_price_positive    CHECK (price > 0),
  -- §6.4：`amount bigint >0`
  CONSTRAINT market_order_amount_positive   CHECK (amount > 0),
  -- §6.4：`amount_filled bigint >=0`
  CONSTRAINT market_order_amount_filled_nonneg CHECK (amount_filled >= 0),
  -- §6.4：`-- CHECK (amount_filled <= amount)`（不超额成交）
  CONSTRAINT market_order_filled_le_amount  CHECK (amount_filled <= amount),
  -- §6.4 状态白名单（open / partial / filled / cancelled）
  CONSTRAINT market_order_status_enum       CHECK (status IN ('open','partial','filled','cancelled')),
  CONSTRAINT market_order_owner_fk          FOREIGN KEY (owner_uid) REFERENCES public.users(uid),
  CONSTRAINT market_order_base_fk           FOREIGN KEY (base_cid)  REFERENCES public.currency(cid),
  CONSTRAINT market_order_quote_fk          FOREIGN KEY (quote_cid) REFERENCES public.currency(cid)
);

COMMENT ON TABLE public.market_order IS
  'P5 交易所挂单表（data-layer.spec v0.5 §6.4 / DL64）。买单冻结 quote=(amount−amount_filled)×price，卖单冻结 base=(amount−amount_filled)（kind=hold，两组分录，R39 不跨币种）。quote_cid 恒=1 但显式存列。无 *_txid 列（§6.4 未列）⇒ 账本引用以 ledger_event_keys（DL75②/DL100）+ ledger_entry.ref_type/ref_id 承担。';

-- §6.4 未列索引清单 ⇒ **不擅自增**（见文件头「登记式缺口」第 3 条）；create_key 唯一约束自带索引。


-- ============================================================================
-- §C `public.market_trade` 表（逐列照 §6.4 / DL65；10 列，append-only）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.market_trade (
  trade_id       bigint      GENERATED BY DEFAULT AS IDENTITY,
  base_cid       bigint      NOT NULL,
  quote_cid      bigint      NOT NULL,
  price          bigint      NOT NULL,
  amount         bigint      NOT NULL,
  buy_order_id   bigint      NOT NULL,
  sell_order_id  bigint      NOT NULL,
  taker_uid      bigint      NOT NULL,
  fee            bigint      NOT NULL DEFAULT 0,
  time_created   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_trade_pk             PRIMARY KEY (trade_id),
  -- §6.4：`price bigint >0`
  CONSTRAINT market_trade_price_positive CHECK (price > 0),
  -- §6.4：`amount bigint >0`
  CONSTRAINT market_trade_amount_positive CHECK (amount > 0),
  -- §6.4：`fee bigint >=0`
  CONSTRAINT market_trade_fee_nonneg     CHECK (fee >= 0),
  -- §6.4：base / quote 两种币
  CONSTRAINT market_trade_cid_distinct   CHECK (base_cid <> quote_cid),
  -- §6.4：买卖两侧订单各一（自成交由编排函数 + 账本 `v_from = v_to` 双闸拒绝）
  CONSTRAINT market_trade_pair_distinct  CHECK (buy_order_id <> sell_order_id),
  CONSTRAINT market_trade_base_fk        FOREIGN KEY (base_cid)      REFERENCES public.currency(cid),
  CONSTRAINT market_trade_quote_fk       FOREIGN KEY (quote_cid)     REFERENCES public.currency(cid),
  CONSTRAINT market_trade_buy_fk         FOREIGN KEY (buy_order_id)  REFERENCES public.market_order(order_id),
  CONSTRAINT market_trade_sell_fk        FOREIGN KEY (sell_order_id) REFERENCES public.market_order(order_id),
  CONSTRAINT market_trade_taker_fk       FOREIGN KEY (taker_uid)     REFERENCES public.users(uid)
);

COMMENT ON TABLE public.market_trade IS
  'P5 交易所成交表（data-layer.spec v0.5 §6.4 / DL65）：**append-only**（BEFORE UPDATE OR DELETE 无条件 RAISE，对齐 R73 的手段选择）。成交价/量是行情与审计的基点；冲正走 reversal 分录，**不得**改本表。无 create_key / ledger_event_keys / time_updated（§6.4 列清单未含 ⇒ 逐列照办；幂等由账本键 biz:market:trade:<taker_order_id>:<fill_no> 承担）。护栏**不拦** TRUNCATE 与 DISABLE TRIGGER USER（诚实边界同 commission.spec §2.2）。';

-- §6.4 未列索引清单 ⇒ **不擅自增**。


-- ============================================================================
-- §D `public.candle_view` —— K 线**视图**（逐列照 §6.4 / DL66；8 列）
-- ============================================================================
-- DL66：由 `market_trade` 按 (base_cid, quote_cid, date_trunc('minute'|'hour', time_created)) 聚合；
--   open = 桶内首笔、high/low = max/min、close = 末笔、volume = Σ amount。**不落表**（C9 已裁）。
--   本迁移取**分钟桶**（桶宽缺口见文件头第 6 条）；DL150：升级到物化/落表**须先开 DL 规则** ⇒ 本迁移不预埋。
CREATE OR REPLACE VIEW public.candle_view AS
SELECT t.base_cid                                            AS base_cid,
       t.quote_cid                                           AS quote_cid,
       date_trunc('minute', t.time_created)                  AS bucket_start,
       (array_agg(t.price ORDER BY t.time_created, t.trade_id))[1]            AS open,
       max(t.price)                                                          AS high,
       min(t.price)                                                          AS low,
       (array_agg(t.price ORDER BY t.time_created DESC, t.trade_id DESC))[1] AS close,
       sum(t.amount)                                                         AS volume
  FROM public.market_trade t
 GROUP BY t.base_cid, t.quote_cid, date_trunc('minute', t.time_created);

COMMENT ON VIEW public.candle_view IS
  'P5 交易所 K 线视图（data-layer.spec v0.5 §6.4 / DL66；C9 已裁 = 视图非表）：按 (base_cid, quote_cid, 分钟桶) 聚合 market_trade ⇒ open/high/low/close = 桶内首/最大/最小/末笔价，volume = Σ amount。无陈旧度问题；大表聚合压力是已知代价（升级门槛见 DL150）。';


-- ============================================================================
-- §E 守卫函数 + 触发器（DL64 / DL65 / DL75 / DL76 / DL79）
-- ============================================================================

-- E1 market_order 状态转移白名单（DL68 侧写 + §7.1 撤单）
CREATE OR REPLACE FUNCTION public.market_order_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.market_order_status_transition_ok(OLD.status, NEW.status) THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
        jsonb_build_object('field', 'market_order.status', 'reason', 'MARKET_ORDER_STATE_INVALID',
                           'from', OLD.status, 'to', NEW.status,
                           'order_id', OLD.order_id::text));
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.market_order_status_guard() IS
  '状态白名单（唯一真源 = public.market_order_status_transition_ok）。违反 ⇒ 借码 LED011 LEDGER_CURRENCY_INVALID_TRANSITION（integrity ⇒ 409）+ reason=MARKET_ORDER_STATE_INVALID（与 0013/0015 同族；DL148 的已知债同形态）。';

-- E2 market_order 创建键一次写定（DL75① 指纹稳定）
CREATE OR REPLACE FUNCTION public.market_order_create_key_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.create_key IS DISTINCT FROM OLD.create_key THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'market_order.create_key', 'reason', 'market_order_create_key_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.market_order_create_key_guard() IS
  'DL75①：market_order.create_key 永不可改（幂等键指纹稳定）。';

-- E3 market_order 挂单核心快照不可变（DL64：owner/side/币对/限价/数量 = 挂单契约）
CREATE OR REPLACE FUNCTION public.market_order_core_immutable_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_uid  IS DISTINCT FROM OLD.owner_uid
     OR NEW.side       IS DISTINCT FROM OLD.side
     OR NEW.base_cid   IS DISTINCT FROM OLD.base_cid
     OR NEW.quote_cid  IS DISTINCT FROM OLD.quote_cid
     OR NEW.price      IS DISTINCT FROM OLD.price
     OR NEW.amount     IS DISTINCT FROM OLD.amount THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'market_order.core_fields', 'reason', 'market_order_core_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.market_order_core_immutable_guard() IS
  'DL64：owner_uid / side / base_cid / quote_cid / price / amount 为挂单快照，永不可改（冻结额 (amount−amount_filled)×price 靠它自洽；要改就撤单重挂）。';

-- E4 market_order 成交进度单调（§6.4 的 CHECK 只挡 super-amount；本条挡「回退 amount_filled」）
CREATE OR REPLACE FUNCTION public.market_order_amount_filled_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.amount_filled < OLD.amount_filled THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'market_order.amount_filled', 'reason', 'market_order_amount_filled_monotonic',
                         'order_id', OLD.order_id::text,
                         'old', OLD.amount_filled::text, 'new', NEW.amount_filled::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.market_order_amount_filled_guard() IS
  '成交进度只增不减（挂单判据 DL68 的 Σ(amount−amount_filled)×price 与在冻额的一致性靠它成立）；超过 amount 由 CHECK market_order_filled_le_amount 拒。';

-- E5 market_order 时间戳统一刷新（DL75③ / R5：不接受客户端传时间）
CREATE OR REPLACE FUNCTION public.market_order_touch_time_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.time_updated := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.market_order_touch_time_updated() IS
  'DL75③ / R5：market_order.time_updated 由 BEFORE UPDATE 触发器统一刷新。';

-- E6 market_order 禁 DELETE（DL79：业务行的终结 = status 位 'cancelled' / 'filled'）
CREATE OR REPLACE FUNCTION public.market_order_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
    jsonb_build_object('field', 'market_order', 'reason', 'market_order_delete_forbidden',
                       'order_id', OLD.order_id::text));
END $$;

COMMENT ON FUNCTION public.market_order_no_delete() IS
  'DL79：业务表禁物理删除（终结 = status 位）。';

-- E7 market_trade append-only（DL65：BEFORE UPDATE OR DELETE 无条件 RAISE）
CREATE OR REPLACE FUNCTION public.market_trade_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.ledger_raise('LEDGER_APPEND_ONLY_VIOLATION',
    jsonb_build_object('field', 'market_trade', 'reason', 'market_trade_is_append_only',
                       'op', TG_OP, 'trade_id', COALESCE(OLD.trade_id, NEW.trade_id)::text));
END $$;

COMMENT ON FUNCTION public.market_trade_append_only() IS
  'DL65：成交一旦落表只能靠 reversal 冲正**分录**，不得改 market_trade。借码 LD029 LEDGER_APPEND_ONLY_VIOLATION（既有码，DL119：不新增码）。护栏不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- ---------------------------------------------------------------- 触发器挂载
-- 执行序按名字母序（PG 对同事件同序触发器按 tgname 排序）：
--   market_order: amount_filled → core_immutable → create_key → status → touch
--   market_trade: append_only
DROP TRIGGER IF EXISTS trg_market_order_amount_filled_guard ON public.market_order;
CREATE TRIGGER trg_market_order_amount_filled_guard
  BEFORE UPDATE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_amount_filled_guard();

DROP TRIGGER IF EXISTS trg_market_order_core_immutable_guard ON public.market_order;
CREATE TRIGGER trg_market_order_core_immutable_guard
  BEFORE UPDATE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_core_immutable_guard();

DROP TRIGGER IF EXISTS trg_market_order_create_key_guard ON public.market_order;
CREATE TRIGGER trg_market_order_create_key_guard
  BEFORE UPDATE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_create_key_guard();

DROP TRIGGER IF EXISTS trg_market_order_status_guard ON public.market_order;
CREATE TRIGGER trg_market_order_status_guard
  BEFORE UPDATE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_status_guard();

DROP TRIGGER IF EXISTS trg_market_order_touch_time_updated ON public.market_order;
CREATE TRIGGER trg_market_order_touch_time_updated
  BEFORE UPDATE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_touch_time_updated();

DROP TRIGGER IF EXISTS trg_market_order_no_delete ON public.market_order;
CREATE TRIGGER trg_market_order_no_delete
  BEFORE DELETE ON public.market_order
  FOR EACH ROW EXECUTE FUNCTION public.market_order_no_delete();

DROP TRIGGER IF EXISTS trg_market_trade_append_only ON public.market_trade;
CREATE TRIGGER trg_market_trade_append_only
  BEFORE UPDATE OR DELETE ON public.market_trade
  FOR EACH ROW EXECUTE FUNCTION public.market_trade_append_only();


-- ============================================================================
-- §F 业务编排函数 `public.market_post_event(payload jsonb)`（DL20 / DL141–DL144）
-- ============================================================================
-- 入参契约（金额一律十进制字符串，R70；价格/数量 = 最小单位 raw bigint）
--   { "op": "order" | "cancel" | "trade",
--     "request_fingerprint": "<hex>"|null,     -- 路由层强制传（DL96）；本函数透传
--     "memo": "…"?,                            -- 可选（**不得**承载业务单号，R18）
--     // op = order（创建类 ⇒ cli: 键，DL94）
--     "create_key": "cli:<uuid-v4>", "owner_uid": "900001", "side": "buy"|"sell",
--     "base_cid": "104", "quote_cid": "1", "price": "10", "amount": "5",
--     // op = cancel（业务类 ⇒ 主键已存在）
--     "order_id": "7",
--     // op = trade（业务类；撮合决策由调用方给出，DL141 只约束记账编排）
--     "taker_order_id": "8", "buy_order_id": "8", "sell_order_id": "9",
--     "price": "10", "amount": "3", "fee": "1", "fill_no": "1" }
-- 幂等键**由本函数按 §8 确定性派生**（DL94：键只能由不可变业务标识派生；调用方不得自造）：
--   order  → `cli:<uuid>`（创建键**即**挂单事件根键；R49 键域 = 客户端键，DL94①）
--   cancel → `biz:market:cancel:<order_id>`
--   trade  → `biz:market:trade:<taker_order_id>:<fill_no>`
-- 账本落点（§7.1 / DL85 / R28 / R47 逐字）：
--   order  = `hold` ×2（买单冻结 quote、卖单冻结 base；同 uid 同 cid 两条，R34/R39）
--   cancel = `hold_release` ×2（释放剩余在冻额）
--   trade  = `trade` ×4（买方 −quote/+base、卖方 −base/+quote）+ `trade_fee` ×2（taker `$` −f / `uid −1` +f）
--   ⇒ 全部走 `ledger_post_event(op='entries')`（**显式分录**：`hold` 族用 `currency_op='hold'` /
--     `'hold_release'` 触发 R28 的币种状态矩阵；`trade` 族不传 `currency_op`，其 base 侧状态闸由本函数
--     前置调用同一个 `ledger_assert_currency_op(…, 'hold')` 落实 —— 两处同码、同真源）。
--   出参：{ok, idempotent_replay, op, order_id, owner_uid, side, base_cid, quote_cid, price, amount,
--          amount_filled, status, frozen_hold, trade_id, txid, ledger_idempotency_key, created,
--          entries, accounts, extra}
CREATE OR REPLACE FUNCTION public.market_post_event(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_op          text;
  v_fp          text;
  v_memo        text;
  v_key         text;
  v_create_key  text;
  v_owner       bigint;
  v_side        text;
  v_base        bigint;
  v_quote       bigint;
  v_price       bigint;
  v_amount      bigint;
  v_qty         bigint;
  v_fee         bigint;
  v_fill_no     bigint;
  v_order_id    bigint;
  v_buy_id      bigint;
  v_sell_id     bigint;
  v_taker_id    bigint;
  v_taker       bigint;
  v_order       public.market_order;
  v_buy         public.market_order;
  v_sell        public.market_order;
  v_trade       public.market_trade;
  v_trade_id    bigint;
  v_freeze      bigint;
  v_xfer        bigint;
  v_base_cur    public.currency;
  v_quote_cur   public.currency;
  v_entries     jsonb;
  v_ledger      jsonb;
  v_txid        text;
  v_replay      boolean := false;
  v_created     boolean := false;
  v_seen        integer;
  v_kinds       text;
  v_bad         integer;
  v_lock        record;
BEGIN
  -- ---------------------------------------------------------------- 信封校验
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'payload', 'reason', 'BAD_TYPE'));
  END IF;
  v_op := payload->>'op';
  IF v_op IS NULL OR v_op NOT IN ('order', 'cancel', 'trade') THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'op', 'value', COALESCE(v_op, 'null'), 'reason', 'UNKNOWN_MARKET_OP'));
  END IF;
  -- R53 / §19.6：指纹可为 NULL（未传 = 同键即重放）；只作用于事件第 1 条分录
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;
  v_memo := COALESCE(NULLIF(payload->>'memo', ''), 'market ' || v_op);

  IF v_op = 'order' THEN
    -- ============================================================ op = order（挂单）
    -- ① 创建幂等键闸（DL93 的字符集闸，逐项同序：TOO_LONG → PREFIX_REQUIRED →
    --    RESERVED_SEPARATOR → CONTROL_CHARACTER）
    v_create_key := btrim(COALESCE(payload->>'create_key', ''));
    IF v_create_key = '' OR jsonb_typeof(payload->'create_key') <> 'string' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_REQUIRED',
        jsonb_build_object('field', 'create_key'));
    END IF;
    IF length(v_create_key) > 256 THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'TOO_LONG', 'field', 'create_key'));
    END IF;
    IF v_create_key !~ '^(biz|cm|cli|ops):' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'PREFIX_REQUIRED', 'provided', left(v_create_key, 8), 'field', 'create_key'));
    END IF;
    IF position('#' in v_create_key) > 0 THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'RESERVED_SEPARATOR', 'field', 'create_key'));
    END IF;
    IF v_create_key ~ '[[:cntrl:]]' THEN
      PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_KEY_INVALID',
        jsonb_build_object('reason', 'CONTROL_CHARACTER', 'field', 'create_key'));
    END IF;

    -- ② 入参解析
    v_owner := public.ledger_uid_arg(COALESCE(payload->>'owner_uid', ''), 'owner_uid');
    IF v_owner < 1 THEN
      PERFORM public.ledger_raise('LEDGER_RESERVED_UID',
        jsonb_build_object('uid', v_owner::text, 'field', 'owner_uid',
                           'reason', 'PLATFORM_OWNER_FORBIDDEN'));
    END IF;
    v_side := NULLIF(payload->>'side', '');
    IF v_side IS NULL OR v_side NOT IN ('buy', 'sell') THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'side', 'value', COALESCE(v_side, 'null'), 'reason', 'UNKNOWN_MARKET_SIDE'));
    END IF;
    v_base  := public.ledger_cid_arg(COALESCE(payload->>'base_cid', ''));
    v_quote := public.ledger_cid_arg(COALESCE(payload->>'quote_cid', ''));
    IF v_quote <> 1 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'quote_cid', 'value', v_quote::text,
                           'reason', 'QUOTE_CID_MUST_BE_ONE'));   -- DL64：quote_cid 恒 = 1
    END IF;
    IF v_base = v_quote THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'base_cid', 'value', v_base::text,
                           'reason', 'BASE_QUOTE_CID_EQUAL'));    -- R39：不跨币种
    END IF;
    v_price  := public.ledger_int_amount(COALESCE(payload->>'price', ''), 'price');
    IF v_price <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'price', 'value', v_price::text));
    END IF;
    v_amount := public.ledger_int_amount(COALESCE(payload->>'amount', ''), 'amount');
    IF v_amount <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_amount::text));
    END IF;

    -- ③ 挂单冻结额（DL64；创建时 amount_filled = 0）
    IF v_side = 'buy' THEN
      v_freeze := v_amount * v_price;    -- 买单冻结 quote
    ELSE
      v_freeze := v_amount;              -- 卖单冻结 base
    END IF;
    IF v_freeze <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'freeze', 'value', v_freeze::text));
    END IF;
    IF v_freeze > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'freeze', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_freeze::text, 40)));
    END IF;

    -- ④ 创建键查重（唯一权威 = market_order.create_key 唯一约束）
    SELECT * INTO v_order FROM public.market_order o WHERE o.create_key = v_create_key FOR UPDATE;
    IF FOUND THEN
      v_replay  := true;
      -- 同键异业务内容 ⇒ 409（DL144② 的业务侧对应物）
      IF v_order.owner_uid <> v_owner OR v_order.side <> v_side
         OR v_order.base_cid <> v_base OR v_order.quote_cid <> v_quote
         OR v_order.price <> v_price OR v_order.amount <> v_amount THEN
        PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT',
          jsonb_build_object('reason', 'CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT',
                             'field', 'create_key', 'idempotency_key', v_create_key,
                             'order_id', v_order.order_id::text));
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    -- ⑤ 只读重放探测（按事件根键走既有索引 idx_ledger_event_root_key）
    v_key := v_create_key;      -- DL94①：创建类 = 客户端键，挂单事件根键即创建键
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    IF FOUND THEN v_replay := true; END IF;
    -- 结构性断言：挂单行已在库而账本事件不在 ⇒ 同事务语义被破坏（响亮缺陷，绝不静默）
    IF v_replay AND v_order_id IS NOT NULL AND NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_TRANSACTION_REQUIRED',
        jsonb_build_object('reason', 'market_order_without_ledger_event',
                           'order_id', v_order_id::text, 'idempotency_key', v_key));
    END IF;

    -- ⑥ 币种存在性 + R28 状态矩阵（挂单/买卖标的均仅 listed）
    SELECT * INTO v_base_cur FROM public.currency c WHERE c.cid = v_base;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_base::text));
    END IF;
    PERFORM public.ledger_assert_currency_op(v_base_cur, 'hold');   -- R28：hold 仅 listed
    SELECT * INTO v_quote_cur FROM public.currency c WHERE c.cid = v_quote;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_quote::text));
    END IF;
    PERFORM public.ledger_assert_currency_op(v_quote_cur, 'hold');  -- R26：$ 恒 listed

    -- ⑦ 挂单行创建（仅新单）
    IF NOT v_replay THEN
      INSERT INTO public.market_order
        (owner_uid, side, base_cid, quote_cid, price, amount, amount_filled, status, create_key)
      VALUES
        (v_owner, v_side, v_base, v_quote, v_price, v_amount, 0, 'open', v_create_key)
      ON CONFLICT (create_key) DO NOTHING
      RETURNING * INTO v_order;
      IF NOT FOUND THEN
        SELECT * INTO v_order FROM public.market_order o WHERE o.create_key = v_create_key FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
            jsonb_build_object('field', 'create_key', 'reason', 'market_order_create_race_lost',
                               'idempotency_key', v_create_key));
        END IF;
        v_replay := true;
      ELSE
        v_created := true;
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    -- ⑧ 分录（§7.1：hold ×2，同 uid 同 cid；R34/R39）
    IF v_side = 'buy' THEN
      v_entries := jsonb_build_array(
        jsonb_build_object('uid', v_order.owner_uid::text, 'cid', v_order.quote_cid::text,
                           'delta', (-v_freeze)::text, 'frozen_delta', '0', 'kind', 'hold',
                           'memo', v_memo || '（买单冻结 quote market_order=' || v_order_id::text || '）'),
        jsonb_build_object('uid', v_order.owner_uid::text, 'cid', v_order.quote_cid::text,
                           'delta', '0', 'frozen_delta', v_freeze::text, 'kind', 'hold',
                           'memo', v_memo || '（买单冻结 quote market_order=' || v_order_id::text || '）'));
    ELSE
      v_entries := jsonb_build_array(
        jsonb_build_object('uid', v_order.owner_uid::text, 'cid', v_order.base_cid::text,
                           'delta', (-v_freeze)::text, 'frozen_delta', '0', 'kind', 'hold',
                           'memo', v_memo || '（卖单冻结 base market_order=' || v_order_id::text || '）'),
        jsonb_build_object('uid', v_order.owner_uid::text, 'cid', v_order.base_cid::text,
                           'delta', '0', 'frozen_delta', v_freeze::text, 'kind', 'hold',
                           'memo', v_memo || '（卖单冻结 base market_order=' || v_order_id::text || '）'));
    END IF;

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'hold',           -- R28：hold ⇒ 仅 listed（真源 = ledger_assert_currency_op）
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'market_order',
      'ref_id',              v_order_id::text,
      'entries',             v_entries));

  ELSIF v_op = 'cancel' THEN
    -- ============================================================ op = cancel（撤单，全量或部分剩余）
    v_order_id := public.ledger_int_amount(COALESCE(payload->>'order_id', ''), 'order_id');
    IF v_order_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;
    v_key := 'biz:market:cancel:' || v_order_id::text;

    -- ① 业务行锁（DL141 全序第 1 段）
    SELECT * INTO v_order FROM public.market_order o WHERE o.order_id = v_order_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;

    -- ② 只读重放探测
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    v_replay := FOUND;

    -- ③ 状态机闸（**仅非重放**）
    IF NOT v_replay THEN
      IF NOT public.market_order_status_transition_ok(v_order.status, 'cancelled') THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'market_order.status', 'reason', 'MARKET_ORDER_STATE_INVALID',
                             'from', v_order.status, 'to', 'cancelled', 'order_id', v_order_id::text));
      END IF;
    END IF;

    -- ④ 剩余在冻额（DL64 公式；买单 = (amount−amount_filled)×price，卖单 = amount−amount_filled）
    IF v_order.side = 'buy' THEN
      v_freeze := (v_order.amount - v_order.amount_filled) * v_order.price;
    ELSE
      v_freeze := v_order.amount - v_order.amount_filled;
    END IF;
    IF v_freeze <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
        jsonb_build_object('field', 'market_order.amount_filled', 'reason', 'market_order_nothing_to_release',
                           'order_id', v_order_id::text, 'amount', v_order.amount::text,
                           'amount_filled', v_order.amount_filled::text));
    END IF;

    -- ⑤ 币种存在性 + R28（hold_release 四态全可 ⇒ 冻结中的币也能解冻退钱）
    SELECT * INTO v_base_cur FROM public.currency c WHERE c.cid = v_order.base_cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_order.base_cid::text));
    END IF;

    -- ⑥ 分录（§7.1：hold_release ×2，同 uid 同 cid）
    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_order.owner_uid::text, 'cid',
                         CASE WHEN v_order.side = 'buy' THEN v_order.quote_cid ELSE v_order.base_cid END::text,
                         'delta', '0', 'frozen_delta', (-v_freeze)::text, 'kind', 'hold_release',
                         'memo', v_memo || '（撤单解冻 market_order=' || v_order_id::text || '）'),
      jsonb_build_object('uid', v_order.owner_uid::text, 'cid',
                         CASE WHEN v_order.side = 'buy' THEN v_order.quote_cid ELSE v_order.base_cid END::text,
                         'delta', v_freeze::text, 'frozen_delta', '0', 'kind', 'hold_release',
                         'memo', v_memo || '（撤单解冻 market_order=' || v_order_id::text || '）'));

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'hold_release',   -- R28：hold_release ⇒ 四态全可
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'market_order',
      'ref_id',              v_order_id::text,
      'entries',             v_entries));

  ELSE
    -- ============================================================ op = trade（撮合成交）
    v_buy_id   := public.ledger_int_amount(COALESCE(payload->>'buy_order_id', ''), 'buy_order_id');
    v_sell_id  := public.ledger_int_amount(COALESCE(payload->>'sell_order_id', ''), 'sell_order_id');
    v_taker_id := public.ledger_int_amount(COALESCE(payload->>'taker_order_id', ''), 'taker_order_id');
    IF v_buy_id < 1 OR v_sell_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'buy_order_id', 'value', v_buy_id::text,
                           'sell_order_id', v_sell_id::text, 'reason', 'order_not_found'));
    END IF;
    IF v_taker_id <> v_buy_id AND v_taker_id <> v_sell_id THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'taker_order_id', 'value', v_taker_id::text,
                           'reason', 'TAKER_NOT_A_PARTY'));
    END IF;
    v_qty := public.ledger_int_amount(COALESCE(payload->>'amount', ''), 'amount');
    IF v_qty <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_qty::text));
    END IF;
    v_price := public.ledger_int_amount(COALESCE(payload->>'price', ''), 'price');
    IF v_price <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'price', 'value', v_price::text));
    END IF;
    v_fee := 0;
    IF jsonb_typeof(payload->'fee') = 'string' AND payload->>'fee' <> '' THEN
      v_fee := public.ledger_int_amount(payload->>'fee', 'fee');
    END IF;
    IF v_fee < 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'fee', 'value', v_fee::text));
    END IF;
    v_fill_no := public.ledger_int_amount(COALESCE(payload->>'fill_no', ''), 'fill_no');
    IF v_fill_no < 1 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'fill_no', 'value', v_fill_no::text, 'reason', 'FILL_NO_REQUIRED'));
    END IF;
    v_key := 'biz:market:trade:' || v_taker_id::text || ':' || v_fill_no::text;

    -- ① 业务行锁（DL141 全序第 1 段：**按主键升序**锁两张挂单行；先于 currency/account）
    IF v_buy_id = v_sell_id THEN
      PERFORM public.ledger_raise('LEDGER_SELF_TRANSFER',
        jsonb_build_object('field', 'buy_order_id', 'uid', v_buy_id::text,
                           'reason', 'self_trade_not_allowed'));
    END IF;
    FOR v_lock IN
      SELECT o.order_id FROM public.market_order o
       WHERE o.order_id IN (v_buy_id, v_sell_id) ORDER BY o.order_id FOR UPDATE
    LOOP
      NULL;
    END LOOP;

    -- ② 只读重放探测
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    v_replay := FOUND;
    IF v_replay THEN
      SELECT e.ref_id INTO v_trade_id FROM public.ledger_entry e
       WHERE e.event_root_key = v_key AND e.ref_type = 'market_trade' ORDER BY e.txid LIMIT 1;
      SELECT * INTO v_trade FROM public.market_trade t WHERE t.trade_id = v_trade_id;
    END IF;

    SELECT * INTO v_buy  FROM public.market_order o WHERE o.order_id = v_buy_id;
    SELECT * INTO v_sell FROM public.market_order o WHERE o.order_id = v_sell_id;
    IF v_buy.order_id IS NULL OR v_sell.order_id IS NULL THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'buy_order_id', v_buy_id::text,
                           'sell_order_id', v_sell_id::text, 'reason', 'order_not_found'));
    END IF;

    -- ③ 订单对自洽（**仅非重放**：重放时业务行已在终态/进度位，不得第二次校验）
    IF NOT v_replay THEN
      IF v_buy.side <> 'buy' OR v_sell.side <> 'sell' THEN
        PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
          jsonb_build_object('field', 'order_pair', 'reason', 'ORDER_SIDE_MISMATCH',
                             'buy_order_id', v_buy_id::text, 'sell_order_id', v_sell_id::text,
                             'buy_side', v_buy.side, 'sell_side', v_sell.side));
      END IF;
      IF v_buy.status NOT IN ('open', 'partial') OR v_sell.status NOT IN ('open', 'partial') THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'market_order.status', 'reason', 'MARKET_ORDER_STATE_INVALID',
                             'buy_status', v_buy.status, 'sell_status', v_sell.status,
                             'order_id', CASE WHEN v_buy.status NOT IN ('open', 'partial')
                                              THEN v_buy_id::text ELSE v_sell_id::text END));
      END IF;
      IF v_buy.base_cid <> v_sell.base_cid OR v_buy.quote_cid <> v_sell.quote_cid THEN
        PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
          jsonb_build_object('field', 'order_pair', 'reason', 'ORDER_PAIR_CID_MISMATCH',
                             'buy_base_cid', v_buy.base_cid::text, 'sell_base_cid', v_sell.base_cid::text,
                             'buy_quote_cid', v_buy.quote_cid::text, 'sell_quote_cid', v_sell.quote_cid::text));
      END IF;
      IF v_buy.owner_uid = v_sell.owner_uid THEN
        PERFORM public.ledger_raise('LEDGER_SELF_TRANSFER',
          jsonb_build_object('uid', v_buy.owner_uid::text, 'field', 'owner_uid',
                             'reason', 'self_trade_not_allowed',
                             'buy_order_id', v_buy_id::text, 'sell_order_id', v_sell_id::text));
      END IF;
      -- §7.1 + DL85：成交事件**恰好 6 条分录** ⇒ 不得存在第 7 条「价差改善释放」⇒ 成交价 = 买单限价
      IF v_price <> v_buy.price THEN
        PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
          jsonb_build_object('field', 'price', 'reason', 'MARKET_PRICE_MUST_EQUAL_BUY_LIMIT',
                             'price', v_price::text, 'buy_limit', v_buy.price::text,
                             'buy_order_id', v_buy_id::text));
      END IF;
      IF v_qty > (v_buy.amount - v_buy.amount_filled) THEN
        PERFORM public.ledger_raise('LEDGER_INSUFFICIENT_BALANCE',
          jsonb_build_object('uid', v_buy.owner_uid::text, 'field', 'market_order.amount',
                             'reason', 'market_order_amount_insufficient', 'side', 'buy',
                             'required', v_qty::text,
                             'available', (v_buy.amount - v_buy.amount_filled)::text,
                             'order_id', v_buy_id::text));
      END IF;
      IF v_qty > (v_sell.amount - v_sell.amount_filled) THEN
        PERFORM public.ledger_raise('LEDGER_INSUFFICIENT_BALANCE',
          jsonb_build_object('uid', v_sell.owner_uid::text, 'field', 'market_order.amount',
                             'reason', 'market_order_amount_insufficient', 'side', 'sell',
                             'required', v_qty::text,
                             'available', (v_sell.amount - v_sell.amount_filled)::text,
                             'order_id', v_sell_id::text));
      END IF;
    END IF;

    v_taker := CASE WHEN v_taker_id = v_buy_id THEN v_buy.owner_uid ELSE v_sell.owner_uid END;
    v_xfer  := v_qty * v_price;
    IF v_xfer <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'trade_amount', 'value', v_xfer::text));
    END IF;
    IF v_xfer > public.ledger_max_single_amount() OR v_fee > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'trade_amount', 'reason', 'OVER_MAX_SINGLE_AMOUNT',
                           'value', left(v_xfer::text, 40), 'fee', left(v_fee::text, 40)));
    END IF;

    -- ④ 币种存在性 + R28（成交的 base 标的须仍 listed；quote 恒 cid=1 由账本 R26 兜）
    SELECT * INTO v_base_cur FROM public.currency c WHERE c.cid = v_buy.base_cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_buy.base_cid::text));
    END IF;
    PERFORM public.ledger_assert_currency_op(v_base_cur, 'hold');   -- R28：hold 仅 listed

    -- ⑤ 成交行（append-only；DL65）
    IF NOT v_replay THEN
      INSERT INTO public.market_trade
        (base_cid, quote_cid, price, amount, buy_order_id, sell_order_id, taker_uid, fee)
      VALUES
        (v_buy.base_cid, v_buy.quote_cid, v_price, v_qty, v_buy_id, v_sell_id, v_taker, v_fee)
      RETURNING * INTO v_trade;
      v_trade_id := v_trade.trade_id;
      v_created  := true;
    END IF;

    -- ⑥ 分录（§7.1：trade ×4 + trade_fee ×2；R47 taker 付、$ 计价、是消耗）
    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_buy.owner_uid::text, 'cid', v_buy.quote_cid::text,
                         'delta', '0', 'frozen_delta', (-v_xfer)::text, 'kind', 'trade',
                         'memo', v_memo || '（买方出 quote market_trade=' || v_trade_id::text || '）'),
      jsonb_build_object('uid', v_buy.owner_uid::text, 'cid', v_buy.base_cid::text,
                         'delta', v_qty::text, 'frozen_delta', '0', 'kind', 'trade',
                         'memo', v_memo || '（买方入 base market_trade=' || v_trade_id::text || '）'),
      jsonb_build_object('uid', v_sell.owner_uid::text, 'cid', v_sell.base_cid::text,
                         'delta', '0', 'frozen_delta', (-v_qty)::text, 'kind', 'trade',
                         'memo', v_memo || '（卖方出 base market_trade=' || v_trade_id::text || '）'),
      jsonb_build_object('uid', v_sell.owner_uid::text, 'cid', v_sell.quote_cid::text,
                         'delta', v_xfer::text, 'frozen_delta', '0', 'kind', 'trade',
                         'memo', v_memo || '（卖方入 quote market_trade=' || v_trade_id::text || '）'));
    IF v_fee > 0 THEN
      v_entries := v_entries || jsonb_build_array(
        jsonb_build_object('uid', v_taker::text, 'cid', '1',
                           'delta', (-v_fee)::text, 'frozen_delta', '0', 'kind', 'trade_fee',
                           'memo', v_memo || '（taker 手续费 trade_fee market_trade=' || v_trade_id::text || '）'),
        jsonb_build_object('uid', '-1', 'cid', '1',
                           'delta', v_fee::text, 'frozen_delta', '0', 'kind', 'trade_fee',
                           'memo', v_memo || '（平台手续费收入 trade_fee market_trade=' || v_trade_id::text || '）'));
    END IF;

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'market_trade',
      'ref_id',              v_trade_id::text,
      'entries',             v_entries));
  END IF;

  v_txid := v_ledger->>'txid';
  IF (v_ledger->>'idempotent_replay')::boolean THEN
    v_replay := true;
  END IF;

  -- ---------------------------------------------------------------- DL85 事件级 kind 白名单（事后核对）
  SELECT string_agg(DISTINCT t.e->>'kind', ',' ORDER BY t.e->>'kind') INTO v_kinds
    FROM jsonb_array_elements(v_ledger->'entries') AS t(e);
  SELECT count(*) INTO v_bad
    FROM jsonb_array_elements(v_ledger->'entries') AS t(e)
   WHERE (v_op = 'order'  AND t.e->>'kind' NOT IN ('hold'))
      OR (v_op = 'cancel' AND t.e->>'kind' NOT IN ('hold_release'))
      OR (v_op = 'trade'  AND t.e->>'kind' NOT IN ('trade', 'trade_fee'));
  IF COALESCE(v_bad, 0) <> 0 THEN
    PERFORM public.ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION',
      jsonb_build_object('reason', 'MARKET_EVENT_KIND_OUT_OF_WHITELIST',
                         'op', v_op, 'kinds', v_kinds));
  END IF;

  -- ---------------------------------------------------------------- 回写业务行
  -- DL144①：重放 ⇒ **不重写业务行**、**不追加 `ledger_event_keys` 项**（DL149 判负用例钉住）；
  -- 判据是账本侧的 `idempotent_replay`（+ 只读根键探测／业务行预存在），**不是** UPDATE 的行数。
  IF NOT v_replay THEN
    IF v_op = 'order' THEN
      UPDATE public.market_order o
         SET ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
    ELSIF v_op = 'cancel' THEN
      UPDATE public.market_order o
         SET status = 'cancelled',
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
    ELSE
      -- DL64/DL60 同精神：成交进度与 `trade` 分录**同一事件**（同一函数、同一事务）
      UPDATE public.market_order o
         SET amount_filled = o.amount_filled + v_qty,
             status = CASE WHEN o.amount_filled + v_qty = o.amount THEN 'filled' ELSE 'partial' END,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_buy_id
      RETURNING * INTO v_buy;
      UPDATE public.market_order o
         SET amount_filled = o.amount_filled + v_qty,
             status = CASE WHEN o.amount_filled + v_qty = o.amount THEN 'filled' ELSE 'partial' END,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_sell_id
      RETURNING * INTO v_sell;
    END IF;
  END IF;

  IF v_op = 'trade' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', v_replay,
      'op', v_op,
      'trade_id', CASE WHEN v_trade_id IS NULL THEN NULL ELSE v_trade_id::text END,
      'buy_order_id', v_buy_id::text,
      'sell_order_id', v_sell_id::text,
      'taker_order_id', v_taker_id::text,
      'taker_uid', v_taker::text,
      'side', 'trade',
      'base_cid', v_buy.base_cid::text,
      'quote_cid', v_buy.quote_cid::text,
      'price', v_price::text,
      'amount', v_qty::text,
      'fee', v_fee::text,
      'transfer_amount', v_xfer::text,
      'buy_status', v_buy.status,
      'buy_amount_filled', v_buy.amount_filled::text,
      'sell_status', v_sell.status,
      'sell_amount_filled', v_sell.amount_filled::text,
      'ledger_event_keys', to_jsonb(COALESCE(v_buy.ledger_event_keys, '{}'::text[])),
      'txid', v_txid,
      'ledger_idempotency_key', v_key,
      'created', v_created,
      'entries', v_ledger->'entries',
      'accounts', v_ledger->'accounts',
      'extra', jsonb_build_object('currency_status', v_base_cur.status, 'event_kinds', v_kinds));
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', v_replay,
    'op', v_op,
    'order_id', v_order_id::text,
    'owner_uid', v_order.owner_uid::text,
    'side', v_order.side,
    'base_cid', v_order.base_cid::text,
    'quote_cid', v_order.quote_cid::text,
    'price', v_order.price::text,
    'amount', v_order.amount::text,
    'amount_filled', v_order.amount_filled::text,
    'status', v_order.status,
    'frozen_hold', CASE WHEN v_order.side = 'buy'
                        THEN ((v_order.amount - v_order.amount_filled) * v_order.price)::text
                        ELSE (v_order.amount - v_order.amount_filled)::text END,
    'created', v_created,
    'ledger_event_keys', to_jsonb(v_order.ledger_event_keys),
    'txid', v_txid,
    'ledger_idempotency_key', v_key,
    'entries', v_ledger->'entries',
    'accounts', v_ledger->'accounts',
    'extra', jsonb_build_object('trade_id', CASE WHEN v_trade_id IS NULL THEN NULL ELSE v_trade_id::text END,
                                'currency_status', v_base_cur.status,
                                'event_kinds', v_kinds));
END $$;

COMMENT ON FUNCTION public.market_post_event(jsonb) IS
  'P5 交易所业务编排函数（DL20 提案 A；硬约束 DL141–DL144）。op=order|cancel|trade；幂等键由本函数按 §8 确定性派生（order=cli: 创建键即事件根键 / cancel=biz:market:cancel:<order_id> / trade=biz:market:trade:<taker_order_id>:<fill_no>）；同一语句内完成「锁业务行（主键升序）→ 派生分录 → 调 ledger_post_event($1::jsonb) → 回写 ledger_event_keys/status/amount_filled」；函数体内无任何 DDL（DL142）；同键重放不重写业务行、不追加 ledger_event_keys 项（DL144①/DL149）；撮合算法不由本函数发明（成交由调用方给出，见交付报告 §3 缺口 2）。';


-- ============================================================================
-- §G apply-time 自检（DL48：不通过则整迁移回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_missing text;
  v_cols    int;
  v_idx     int;
  v_trg     int;
  v_ndef    int;
  v_bad     int;
BEGIN
  -- ---------------------------------------------------------------- 结构断言
  IF to_regclass('public.market_order') IS NULL OR to_regclass('public.market_trade') IS NULL
     OR to_regclass('public.candle_view') IS NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order / market_trade / candle_view missing';
  END IF;
  -- DL66：candle_view 必须是**视图**而不是表
  SELECT count(*) INTO v_bad FROM information_schema.tables t
   WHERE t.table_schema='public' AND t.table_name='candle_view' AND t.table_type='BASE TABLE';
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0016 self-check FAILED: candle_view must be a VIEW, not a base table (DL66)';
  END IF;

  -- 逐表列数 + 逐列名（**不增删列、不自创列名**）
  SELECT count(*) INTO v_cols FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='market_order';
  IF v_cols <> 13 THEN
    RAISE EXCEPTION '0016 self-check FAILED: public.market_order has % columns, expected 13 (§6.4)', v_cols;
  END IF;
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('order_id'),('owner_uid'),('side'),('base_cid'),('quote_cid'),('price'),('amount'),
                 ('amount_filled'),('status'),('create_key'),('ledger_event_keys'),
                 ('time_created'),('time_updated')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name='market_order' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: public.market_order missing columns: %', v_missing;
  END IF;

  SELECT count(*) INTO v_cols FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='market_trade';
  IF v_cols <> 10 THEN
    RAISE EXCEPTION '0016 self-check FAILED: public.market_trade has % columns, expected 10 (§6.4)', v_cols;
  END IF;
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('trade_id'),('base_cid'),('quote_cid'),('price'),('amount'),('buy_order_id'),
                 ('sell_order_id'),('taker_uid'),('fee'),('time_created')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name='market_trade' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: public.market_trade missing columns: %', v_missing;
  END IF;
  -- §6.4 列清单**未含**这三列 ⇒ 断言「确实没有」（逐列照办、不自创）
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('create_key'),('ledger_event_keys'),('time_updated')) AS x(n)
   WHERE EXISTS (SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema='public' AND c.table_name='market_trade' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_trade must NOT have columns (not in §6.4 list): %', v_missing;
  END IF;

  -- DL75③：time_updated 由触发器刷新（NOT NULL DEFAULT now()）
  SELECT count(*) INTO v_ndef FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='market_order' AND c.column_name IN ('time_created','time_updated')
     AND c.is_nullable='NO' AND c.column_default = 'now()';
  IF v_ndef <> 2 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order time columns (DL75③) = %, expected 2', v_ndef;
  END IF;
  -- DL75②：ledger_event_keys 为 NOT NULL 数组
  SELECT count(*) INTO v_ndef FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='market_order' AND c.column_name='ledger_event_keys'
     AND c.is_nullable='NO' AND c.data_type='ARRAY';
  IF v_ndef <> 1 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order.ledger_event_keys (DL75②) not a NOT NULL array';
  END IF;

  -- §6.4 的 CHECK 逐条在场（逐名）
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('market_order_side_enum'),('market_order_quote_cid_is_one'),('market_order_cid_distinct'),
                 ('market_order_price_positive'),('market_order_amount_positive'),
                 ('market_order_amount_filled_nonneg'),('market_order_filled_le_amount'),
                 ('market_order_status_enum'),
                 ('market_trade_price_positive'),('market_trade_amount_positive'),('market_trade_fee_nonneg'),
                 ('market_trade_cid_distinct'),('market_trade_pair_distinct')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conname = x.n AND k.contype = 'c');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: CHECK constraints missing ( §6.4 逐条 ): %', v_missing;
  END IF;
  -- 默认值口径：status='open' / amount_filled=0 / fee=0
  SELECT count(*) INTO v_ndef FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='market_order' AND c.column_name='status'
     AND c.column_default = '''open''::text';
  IF v_ndef <> 1 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order.status default must be ''open''';
  END IF;

  -- DL78：uid 列 FK users(uid) = 2（market_order.owner_uid / market_trade.taker_uid）
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.conname IN ('market_order_owner_fk','market_trade_taker_fk') AND k.contype='f'
     AND k.confrelid = 'public.users'::regclass;
  IF v_idx <> 2 THEN
    RAISE EXCEPTION '0016 self-check FAILED: uid FKs to users(uid) = %, expected 2 (DL78)', v_idx;
  END IF;
  -- §6.4：cid FK currency = 4（order base/quote + trade base/quote）；market_order 内部 FK = 2
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.conrelid IN ('public.market_order'::regclass, 'public.market_trade'::regclass)
     AND k.contype='f' AND k.confrelid = 'public.currency'::regclass;
  IF v_idx <> 4 THEN
    RAISE EXCEPTION '0016 self-check FAILED: cid FKs to currency(cid) = %, expected 4 (§6.4)', v_idx;
  END IF;
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.contype='f' AND k.confrelid = 'public.market_order'::regclass;
  IF v_idx <> 2 THEN
    RAISE EXCEPTION '0016 self-check FAILED: FKs to market_order = %, expected 2 (§6.4)', v_idx;
  END IF;
  -- R21 / DL78：**不得**对 ledger_entry 建 FK
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.conrelid IN ('public.market_order'::regclass, 'public.market_trade'::regclass)
     AND k.contype='f' AND k.confrelid = 'public.ledger_entry'::regclass;
  IF v_idx <> 0 THEN
    RAISE EXCEPTION '0016 self-check FAILED: DL78/R21 violation — *_txid / ledger_entry FK (%)', v_idx;
  END IF;

  -- DL74 / §6.4（无索引清单）：**只**允许约束自带索引（PK ×2 + create_key 唯一 ×1）
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (SELECT i.indexname AS n FROM pg_indexes i
           WHERE i.schemaname='public' AND i.tablename IN ('market_order','market_trade')
             AND i.indexname NOT IN ('market_order_pk','market_order_create_key_uniq','market_trade_pk')) AS x;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: unexpected extra index beyond §6.4 (none listed): %', v_missing;
  END IF;
  -- 同一断言的反面：三个自带的必须在场
  SELECT count(*) INTO v_idx FROM pg_indexes i
   WHERE i.schemaname='public'
     AND i.indexname IN ('market_order_pk','market_order_create_key_uniq','market_trade_pk');
  IF v_idx <> 3 THEN
    RAISE EXCEPTION '0016 self-check FAILED: constraint-owned indexes = %, expected 3', v_idx;
  END IF;

  -- 触发器启用态：market_order 5 UPDATE + 1 DELETE；market_trade 1（UPDATE OR DELETE）
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.market_order'::regclass;
  IF v_trg <> 6 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order enabled triggers = %, expected 6', v_trg;
  END IF;
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.market_trade'::regclass;
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_trade enabled triggers = %, expected 1 (DL65)', v_trg;
  END IF;
  -- DL65：append-only 触发器必须同时覆盖 UPDATE 与 DELETE
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled='O' AND t.tgrelid='public.market_trade'::regclass
     AND t.tgtype & 16 <> 0 AND t.tgtype & 8 <> 0;
  IF v_trg <> 1 THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_trade append-only trigger must cover UPDATE OR DELETE (DL65)';
  END IF;

  IF to_regprocedure('public.market_post_event(jsonb)') IS NULL
     OR to_regprocedure('public.market_order_status_transition_ok(text,text)') IS NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: orchestration/whitelist functions missing';
  END IF;

  -- DL142：编排函数体内禁 DDL（类级全树扫描由 scripts/p3s1b-01 覆盖；此块用 chr(36) 拼 dollar-quote）
  SELECT string_agg(t.p, ',') INTO v_missing FROM (
    VALUES ('create table'),('alter table'),('drop table'),('truncate'),('create index'),
           ('create function'),('create view'),('rename to'),('do ' || chr(36) || chr(36))
  ) AS t(p)
   WHERE position(upper(t.p)
          in upper(pg_get_functiondef('public.market_post_event(jsonb)'::regprocedure))) > 0;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: DDL token(s) inside market_post_event body: %', v_missing;
  END IF;

  -- ---------------------------------------------------------------- 纯函数断言（状态白名单 正/负全集）
  IF NOT public.market_order_status_transition_ok('open','partial')
     OR NOT public.market_order_status_transition_ok('open','filled')
     OR NOT public.market_order_status_transition_ok('open','cancelled')
     OR NOT public.market_order_status_transition_ok('partial','filled')
     OR NOT public.market_order_status_transition_ok('partial','cancelled') THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order whitelist missing an allowed transition';
  END IF;
  IF public.market_order_status_transition_ok('open','open')
     OR public.market_order_status_transition_ok('partial','open')
     OR public.market_order_status_transition_ok('partial','partial')
     OR public.market_order_status_transition_ok('filled','open')
     OR public.market_order_status_transition_ok('filled','partial')
     OR public.market_order_status_transition_ok('filled','cancelled')
     OR public.market_order_status_transition_ok('cancelled','open')
     OR public.market_order_status_transition_ok('cancelled','partial')
     OR public.market_order_status_transition_ok('cancelled','filled') THEN
    RAISE EXCEPTION '0016 self-check FAILED: market_order whitelist admits a forbidden transition (终态无出边)';
  END IF;

  -- 视图列（DL66：8 列，逐名）
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('base_cid'),('quote_cid'),('bucket_start'),('open'),('high'),('low'),('close'),('volume')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name='candle_view' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0016 self-check FAILED: candle_view missing columns (DL66): %', v_missing;
  END IF;

  -- kind 关闭集自检（DL81：0 扩展）；并**反向**证明 DL90 的禁项确实不在关闭集
  SELECT count(*) INTO v_bad
    FROM (VALUES ('hold'),('hold_release'),('trade'),('trade_fee')) AS x(k)
   WHERE NOT public.ledger_kind_ok(x.k, false);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0016 self-check FAILED: % exchange kind(s) outside the 20-kind closed set (DL81)', v_bad;
  END IF;
  IF public.ledger_kind_ok('market_hold', false) THEN
    RAISE EXCEPTION '0016 self-check FAILED: DL90 violation — kind % must not exist', 'market_hold';
  END IF;

  RAISE NOTICE '0016 self-check OK: market_order cols=13 trg=6 / market_trade cols=10 trg=1 / candle_view 8 cols / whitelist verified / 4 kinds in close set';
END $$;
