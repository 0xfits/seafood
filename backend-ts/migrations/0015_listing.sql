-- ============================================================================
-- 0015_listing.sql · P4 第二柱（商品）· `listing` + `listing_order` + 守卫 + 编排函数
-- ============================================================================
-- 权威口径：docs/data-layer.spec.md **v0.5**（md5 ed8e2a1f19c86b39db880533ee1cbae8）
--   §6.1  `0015` = `listing` / `listing_order` + 守卫 + `listing_post_event`（C2 已裁表名；C1 已裁）
--   §6.3  `listing` 逐列契约（DL59）· 状态机（DL60）· `listing_order` 逐列契约（DL61）·
--         退款口径（DL62）· 四个索引（DL63）
--   §6.7  通用规约：三件套（DL75）· 可变表用状态机守卫、禁全表 append-only（DL76）·
--         状态机判负用例（DL77）· uid 列 FK users / `*_txid` 不建 FK（DL78）· 禁 DELETE（DL79）·
--         snake_case 非保留字（DL80）· 索引预算（DL74）
--   §7.1  ②商品：发布/编辑/下架 = **无分录**（DL59）· 购买 = `purchase` + `sale`（DL85 恰好两条）·
--         退款 = `purchase_refund` 恰好两条
--   DL99  不得为「无分录的写」造账本事件占位 ⇒ 发布 / 编辑 / 下架**不经**本迁移的编排函数
--         （创建幂等走 `cli:` + `listing.create_key`）
--   DL85  商品事件的 kind 白名单：购买 = `purchase` + `sale`（恰好两条）；退款 = `purchase_refund`（恰好两条）
--   §8    DL93 键四类前缀闸（逐项同序）· DL94 创建类 `cli:` / 业务类 `biz:` · DL96 指纹由路由层强制传
--   DL20  ✅ 采纳提案 A：业务编排函数（业务行锁 → 派生分录 → 调既有 ledger_post_event → 回写）
--   DL141 加锁全序 = 业务行（主键升序）→ currency（cid 升序）→ account（uid 升序）
--   DL142 编排函数只由迁移创建、**函数体内禁任何 DDL**
--   DL143 每次调用必带幂等键（键由本函数按 §8 确定性派生）+ `ref_type`/`ref_id` 落账本引用列
--   DL144 重放语义逐字对齐 R51/R52：同键同指纹 ⇒ 200 重放且**不重写业务行**、**不追加
--         `ledger_event_keys` 项**；同键异指纹 ⇒ 409
--   DL148 借码已知债：`LEDGER_CURRENCY_INVALID_TRANSITION` 码名窄于实际触发范围（商品状态机）
--   DL149 C8 判负用例（同键重放不追加 ledger_event_keys 项）—— 由 scripts/p3l-02 取证
--   DL151 新数据层所有 SQL 显式限定 `public.`（`neon_auth.account` 同名陷阱）
--   §11.2 逐路由码面（**不新增码**，DL119/DL120）：buy ⇒ 400 `LD005 LD006 LD018 LD020` /
--         409 `LD001 LD004 LD008 LD011` / 404 `LD023`；refund ⇒ 409 `LD001 LD004 LD011`
--         业务 reason（登记于 §11.2）：`listing_stock_insufficient` / `listing_not_listed` /
--         `self_purchase_not_allowed` / `order_not_refundable` / `not_order_buyer`
--   R18/R19/DL83  `ref_type`/`ref_id` 成对且落引用列，**禁**把业务单号塞进 `memo`
--   R28   商品标价与结算类（`purchase`/`sale`）**仅 `listed`**（由 `ledger_assert_currency_op(...,'settle')` 落实）
--
-- 本迁移做什么
--   ① `public.listing`：逐列照 DL59（**不增删列、不自创列名**）13 列 + CHECK + FK users/currency
--   ② `public.listing_order`：逐列照 DL61 14 列 + CHECK + FK（含冗余 `seller_uid`）+ `*_txid` **不建 FK**
--   ③ `public.listing_status_transition_ok` / `public.listing_order_status_transition_ok`：白名单唯一真源
--   ④ 守卫触发器（DL60 状态机 + DL60 库存只在 listed 改 + DL61 订单自洽快照冻结 + DL62 `*_txid` 一次写定
--      + DL75① create_key 不可变 + DL75③ time_updated 刷新 + DL79 禁 DELETE）
--   ⑤ 四个必建索引（DL63，逐字）
--   ⑥ `public.listing_post_event(payload jsonb)`：编排函数（op = buy | refund）
--
-- 本迁移**不**做什么（硬边界）
--   · **不改 `0001`–`0014` 的任何字节**（checksum 冻结；`migrate.ts` 会整链 ABORT/exit 3）
--   · **不改 `ledger_post_event` 的函数体**（CR81 只禁「改函数体」；本文件只**新增**新函数）
--   · **不建**商品发布/编辑/下架的编排路径（DL99：无分录的写不得借账本幂等 ⇒ 创建幂等走
--     `listing.create_key`（`cli:` 键），状态迁移走列级守卫 + 路由层；本函数**只**做 buy / refund）
--   · 不动既有 11 张基表的**数据**或结构（本迁只**增**表/索引/触发器/函数）
--   · 不新增 `kind`（DL81：0 个扩展）、不新增错误码（DL119：一律映射既有 33 码）
--   · 不接路由（`src/` 本单不改）
--
-- ⚠️ 与 §6.3 的**登记式缺口**（不发明，见交付报告 docs/audit/p3-listing-0015.md）
--   · **`listing_order.status` 的转移白名单 §6.3 未逐条枚举**（只给了 4 个取值）。本迁移按
--     「**只能由 §7.1 的分录动作 + 其互补的纯状态迁移构成**」取**最小集**：
--     `created → paid`（购买，purchase+sale）/ `created → cancelled`（未付款取消，无分录 ⇒ DL99）/
--     `paid → refunded`（退款，purchase_refund）；`refunded` / `cancelled` = 终态。登记为缺口。
--   · **退款是否回滚库存 = DL62 明写「由 P4 spec 定 / 登记为未定」** ⇒ 本迁移**不复原库存**（不发明）。
--   · **`listing` 的 `seller_uid` / `cid` / `price` / `media_urls` 可变性 §6.3 未规定** ⇒ 不设守卫
--     （「编辑商品」要求 price/stock/title 可改）；只冻结 DL75① 的 `create_key` 与 DL60 的 status/stock 口径。
--   · **`listing_order` 的卖家读口（`seller_uid` 轴）无索引**：DL63 只列 4 个索引 ⇒ 逐字照办、不擅自增。
--
-- 幂等（DL48）：`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` /
--   `CREATE OR REPLACE FUNCTION` / `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`；
--   末尾 apply-time `DO` 自检（结构 + 纯函数白名单正/负全集 + 触发器启用态 + 函数体内无 DDL）；
--   任一失败 ⇒ 整迁移回滚、不写版本行。
--
-- 诚实边界（不得夸大）
--   · 「状态机 / 一次写定 / 库存只在 listed 改」都是**防应用层事故的护栏**：`TRUNCATE` 不触发行触发器，
--     超管 `ALTER TABLE ... DISABLE TRIGGER USER` 可旁路 ⇒ **不得**表述为「绝对不可变」。
--     本片判负自证正是用 `DROP TRIGGER` 把尺子撞响（见 `scripts/p3l-03`）。
--   · 超卖靠**行锁串行化**（`SELECT ... FOR UPDATE` 锁 `listing` 行）＋ `stock >= 0` 的 CHECK，
--     不是靠乐观版本号；并发窗口内第二个事务会等到提交后读到新 `stock` ⇒ 判 `listing_stock_insufficient`。
--   · 自买自卖的拒绝由**账本**的 `op='settle'`（`v_from = v_to ⇒ LEDGER_SELF_TRANSFER`）落实，
--     本函数另有一道**同判据**的前置闸（两处同码 ⇒ 不产生第二套口径）。
-- ============================================================================


-- ============================================================================
-- §A 状态机白名单 —— 唯一真源，供触发器与自检共用
-- ============================================================================

-- A1 `listing.status`（DL60 写死）：draft → listed → {delisted | frozen}，frozen → listed，
--    delisted 终态。（DL60 原文：`delisted` 终态；未列出的边一律拒绝）
CREATE OR REPLACE FUNCTION public.listing_status_transition_ok(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'draft'    THEN p_to IN ('listed')
    WHEN 'listed'   THEN p_to IN ('delisted', 'frozen')
    WHEN 'frozen'   THEN p_to IN ('listed')
    ELSE false            -- delisted = 终态（无出边）
  END
$$;

COMMENT ON FUNCTION public.listing_status_transition_ok(text, text) IS
  'DL60 状态机白名单唯一真源：draft→{listed}；listed→{delisted,frozen}；frozen→{listed}；delisted 无出边（终态）。';

-- A2 `listing_order.status`（§6.3 未逐条枚举 ⇒ 取最小集，见文件头「登记式缺口」）
CREATE OR REPLACE FUNCTION public.listing_order_status_transition_ok(p_from text, p_to text)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'created' THEN p_to IN ('paid', 'cancelled')
    WHEN 'paid'    THEN p_to IN ('refunded')
    ELSE false            -- refunded / cancelled = 终态（无出边）
  END
$$;

COMMENT ON FUNCTION public.listing_order_status_transition_ok(text, text) IS
  'listing_order 状态白名单：created→{paid,cancelled}；paid→{refunded}；refunded/cancelled 终态。§6.3 未逐条枚举 ⇒ 最小集（§7.1 分录动作 + DL99 互补纯状态迁移），缺口已登记。';


-- ============================================================================
-- §B `public.listing` 表（逐列照 §6.3 / DL59；13 列）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listing (
  listing_id         bigint      GENERATED BY DEFAULT AS IDENTITY,
  seller_uid         bigint      NOT NULL,
  cid                bigint      NOT NULL,
  price              bigint      NOT NULL,
  stock              int         NOT NULL,
  title              text        NOT NULL DEFAULT '',
  description        text        NOT NULL DEFAULT '',
  media_urls         text[]      NOT NULL DEFAULT '{}',
  status             text        NOT NULL DEFAULT 'draft',
  create_key         text        NOT NULL,
  ledger_event_keys  text[]      NOT NULL DEFAULT '{}',
  time_created       timestamptz NOT NULL DEFAULT now(),
  time_updated       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_pk               PRIMARY KEY (listing_id),
  -- DL59 / DL75①：创建幂等键（指纹口径与 R51/R52 一致）
  CONSTRAINT listing_create_key_uniq  UNIQUE (create_key),
  -- DL59：price bigint CHECK (> 0)
  CONSTRAINT listing_price_positive   CHECK (price > 0),
  -- DL59：stock int CHECK (>= 0)（`0` 表示仅剩 0 件，**不允许 NULL 表示无限**）
  CONSTRAINT listing_stock_nonneg     CHECK (stock >= 0),
  -- DL59 状态白名单（draft / listed / delisted / frozen）
  CONSTRAINT listing_status_enum      CHECK (status IN ('draft','listed','delisted','frozen')),
  CONSTRAINT listing_seller_fk        FOREIGN KEY (seller_uid) REFERENCES public.users(uid),
  CONSTRAINT listing_cid_fk           FOREIGN KEY (cid)        REFERENCES public.currency(cid)
);

COMMENT ON TABLE public.listing IS
  'P4 商品柱主表（data-layer.spec v0.5 §6.3 / DL59）。发布不收费 ⇒ 无费用列；无 *_txid 列（账本引用落在 listing_order 上，§7.1 ref=listing_order/order_id）。ledger_event_keys 为 DL75② 三件套之一，本柱暂无 listing 级账本事件 ⇒ 默认空数组。';

-- DL63：listing 的两个必建索引（`create_key` 的唯一约束自带索引，不另建）
CREATE INDEX IF NOT EXISTS idx_listing_status_time ON public.listing (status, time_created DESC);
CREATE INDEX IF NOT EXISTS idx_listing_seller      ON public.listing (seller_uid, time_created DESC);


-- ============================================================================
-- §C `public.listing_order` 表（逐列照 §6.3 / DL61；14 列）
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.listing_order (
  order_id           bigint      GENERATED BY DEFAULT AS IDENTITY,
  listing_id         bigint      NOT NULL,
  buyer_uid          bigint      NOT NULL,
  seller_uid         bigint      NOT NULL,
  cid                bigint      NOT NULL,
  price              bigint      NOT NULL,
  quantity           int         NOT NULL,
  status             text        NOT NULL DEFAULT 'created',
  create_key         text        NOT NULL,
  pay_txid           bigint,
  refund_txid        bigint,
  ledger_event_keys  text[]      NOT NULL DEFAULT '{}',
  time_created       timestamptz NOT NULL DEFAULT now(),
  time_updated       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_order_pk              PRIMARY KEY (order_id),
  -- DL75① / DL61：创建幂等键
  CONSTRAINT listing_order_create_key_uniq UNIQUE (create_key),
  -- DL61：price bigint >0（**下单时的快照价**）
  CONSTRAINT listing_order_price_positive  CHECK (price > 0),
  -- DL61：quantity int >0
  CONSTRAINT listing_order_quantity_pos    CHECK (quantity > 0),
  -- DL61 状态白名单（created / paid / refunded / cancelled）
  CONSTRAINT listing_order_status_enum     CHECK (status IN ('created','paid','refunded','cancelled')),
  CONSTRAINT listing_order_listing_fk      FOREIGN KEY (listing_id) REFERENCES public.listing(listing_id),
  CONSTRAINT listing_order_buyer_fk        FOREIGN KEY (buyer_uid)  REFERENCES public.users(uid),
  CONSTRAINT listing_order_seller_fk       FOREIGN KEY (seller_uid) REFERENCES public.users(uid),
  CONSTRAINT listing_order_cid_fk          FOREIGN KEY (cid)        REFERENCES public.currency(cid)
);

COMMENT ON TABLE public.listing_order IS
  'P4 商品订单表（data-layer.spec v0.5 §6.3 / DL61）：购买/退款记录。price/quantity 是**业务快照**而非余额（DL3）；seller_uid **冗余存一份**（卖家可能在订单后改价/下架，订单必须自洽）；pay_txid/refund_txid **不建 FK** 到 ledger_entry（DL78/R21）。';

-- DL63：listing_order 的两个必建索引（逐字，不擅自增）
CREATE INDEX IF NOT EXISTS idx_listing_order_buyer   ON public.listing_order (buyer_uid, time_created DESC);
CREATE INDEX IF NOT EXISTS idx_listing_order_listing ON public.listing_order (listing_id);


-- ============================================================================
-- §D 守卫触发器（DL60 / DL61 / DL62 / DL75 / DL76 / DL79）
-- ============================================================================

-- D1 listing 状态转移白名单（DL60）
CREATE OR REPLACE FUNCTION public.listing_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.listing_status_transition_ok(OLD.status, NEW.status) THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
        jsonb_build_object('field', 'listing.status', 'reason', 'LISTING_STATE_INVALID',
                           'from', OLD.status, 'to', NEW.status,
                           'listing_id', OLD.listing_id::text));
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_status_guard() IS
  'DL60：listing 状态白名单（唯一真源 = public.listing_status_transition_ok）。违反 ⇒ 借码 LD011 LEDGER_CURRENCY_INVALID_TRANSITION（integrity ⇒ 409）+ reason=LISTING_STATE_INVALID（DL148 已知债：码名窄于触发范围）。';

-- D2 listing 库存变更闸（DL60：「库存变更只允许 `listed` 状态」）
CREATE OR REPLACE FUNCTION public.listing_stock_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock AND OLD.status <> 'listed' THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing.stock', 'reason', 'listing_stock_change_requires_listed',
                         'status', OLD.status, 'old', OLD.stock::text, 'new', NEW.stock::text,
                         'listing_id', OLD.listing_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_stock_guard() IS
  'DL60：库存变更只允许在 listing.status = ''listed'' 时发生（防「下架后偷偷补货/清库存」）。违反 ⇒ LD011 + reason=listing_stock_change_requires_listed。';

-- D3 listing 创建键一次写定（DL75① 指纹稳定）
CREATE OR REPLACE FUNCTION public.listing_create_key_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.create_key IS DISTINCT FROM OLD.create_key THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing.create_key', 'reason', 'listing_create_key_immutable',
                         'listing_id', OLD.listing_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_create_key_guard() IS
  'DL75①：listing.create_key 永不可改（幂等键指纹稳定）。';

-- D4 listing 时间戳统一刷新（DL75③ / R5：不接受客户端传时间）
CREATE OR REPLACE FUNCTION public.listing_touch_time_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.time_updated := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_touch_time_updated() IS
  'DL75③ / R5：listing.time_updated 由 BEFORE UPDATE 触发器统一刷新。';

-- D5 listing 禁 DELETE（DL79：业务行的终结 = status 位 'delisted'）
CREATE OR REPLACE FUNCTION public.listing_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
    jsonb_build_object('field', 'listing', 'reason', 'listing_delete_forbidden',
                       'listing_id', OLD.listing_id::text));
END $$;

COMMENT ON FUNCTION public.listing_no_delete() IS
  'DL79：业务表禁物理删除（终结 = status 位）。';

-- D6 listing_order 状态转移白名单
CREATE OR REPLACE FUNCTION public.listing_order_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.listing_order_status_transition_ok(OLD.status, NEW.status) THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
        jsonb_build_object('field', 'listing_order.status', 'reason', 'LISTING_ORDER_STATE_INVALID',
                           'from', OLD.status, 'to', NEW.status,
                           'order_id', OLD.order_id::text));
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_order_status_guard() IS
  'listing_order 状态白名单（唯一真源 = public.listing_order_status_transition_ok）。违反 ⇒ LD011 + reason=LISTING_ORDER_STATE_INVALID。';

-- D7 listing_order 订单自洽快照冻结（DL61：下单快照列不可改 ⇒ 订单必须自洽）
CREATE OR REPLACE FUNCTION public.listing_order_core_immutable_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.buyer_uid  IS DISTINCT FROM OLD.buyer_uid
     OR NEW.seller_uid IS DISTINCT FROM OLD.seller_uid
     OR NEW.cid        IS DISTINCT FROM OLD.cid
     OR NEW.price      IS DISTINCT FROM OLD.price
     OR NEW.quantity   IS DISTINCT FROM OLD.quantity THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing_order.core_fields', 'reason', 'listing_order_core_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_order_core_immutable_guard() IS
  'DL61：listing_id / buyer_uid / seller_uid / cid / price / quantity 为下单快照，永不可改（「订单必须自洽」的结构性落实；要改就新下单 + 冲正）。';

-- D8 listing_order 创建键一次写定（DL75①）
CREATE OR REPLACE FUNCTION public.listing_order_create_key_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.create_key IS DISTINCT FROM OLD.create_key THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing_order.create_key', 'reason', 'listing_order_create_key_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_order_create_key_guard() IS
  'DL75①：listing_order.create_key 永不可改。';

-- D9 listing_order 账本引用列一次写定（DL62：refund_txid 一次写定；pay_txid 同口径）
CREATE OR REPLACE FUNCTION public.listing_order_ledger_ref_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.pay_txid IS NOT NULL AND NEW.pay_txid IS DISTINCT FROM OLD.pay_txid THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing_order.pay_txid', 'reason', 'listing_order_ledger_ref_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  IF OLD.refund_txid IS NOT NULL AND NEW.refund_txid IS DISTINCT FROM OLD.refund_txid THEN
    PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
      jsonb_build_object('field', 'listing_order.refund_txid', 'reason', 'listing_order_ledger_ref_immutable',
                         'order_id', OLD.order_id::text));
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_order_ledger_ref_guard() IS
  'DL62：pay_txid / refund_txid 一次写定（OLD 非 NULL 后禁改、禁清空）。护栏强度=行触发器；不拦 TRUNCATE / DISABLE TRIGGER USER。';

-- D10 listing_order 时间戳刷新（DL75③）
CREATE OR REPLACE FUNCTION public.listing_order_touch_time_updated() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.time_updated := now();
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.listing_order_touch_time_updated() IS
  'DL75③ / R5：listing_order.time_updated 由 BEFORE UPDATE 触发器统一刷新。';

-- D11 listing_order 禁 DELETE（DL79）
CREATE OR REPLACE FUNCTION public.listing_order_no_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
    jsonb_build_object('field', 'listing_order', 'reason', 'listing_order_delete_forbidden',
                       'order_id', OLD.order_id::text));
END $$;

COMMENT ON FUNCTION public.listing_order_no_delete() IS
  'DL79：业务表禁物理删除（终结 = status 位）。';

-- ---------------------------------------------------------------- 触发器挂载
-- 执行序按名字母序（PG 对同事件同序触发器按 tgname 排序）：
--   listing      : create_key → status → stock → touch
--   listing_order: core_immutable → create_key → ledger_ref → status → touch
DROP TRIGGER IF EXISTS trg_listing_create_key_guard ON public.listing;
CREATE TRIGGER trg_listing_create_key_guard
  BEFORE UPDATE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.listing_create_key_guard();

DROP TRIGGER IF EXISTS trg_listing_status_guard ON public.listing;
CREATE TRIGGER trg_listing_status_guard
  BEFORE UPDATE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.listing_status_guard();

DROP TRIGGER IF EXISTS trg_listing_stock_guard ON public.listing;
CREATE TRIGGER trg_listing_stock_guard
  BEFORE UPDATE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.listing_stock_guard();

DROP TRIGGER IF EXISTS trg_listing_touch_time_updated ON public.listing;
CREATE TRIGGER trg_listing_touch_time_updated
  BEFORE UPDATE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.listing_touch_time_updated();

DROP TRIGGER IF EXISTS trg_listing_no_delete ON public.listing;
CREATE TRIGGER trg_listing_no_delete
  BEFORE DELETE ON public.listing
  FOR EACH ROW EXECUTE FUNCTION public.listing_no_delete();

DROP TRIGGER IF EXISTS trg_listing_order_core_immutable_guard ON public.listing_order;
CREATE TRIGGER trg_listing_order_core_immutable_guard
  BEFORE UPDATE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_core_immutable_guard();

DROP TRIGGER IF EXISTS trg_listing_order_create_key_guard ON public.listing_order;
CREATE TRIGGER trg_listing_order_create_key_guard
  BEFORE UPDATE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_create_key_guard();

DROP TRIGGER IF EXISTS trg_listing_order_ledger_ref_guard ON public.listing_order;
CREATE TRIGGER trg_listing_order_ledger_ref_guard
  BEFORE UPDATE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_ledger_ref_guard();

DROP TRIGGER IF EXISTS trg_listing_order_status_guard ON public.listing_order;
CREATE TRIGGER trg_listing_order_status_guard
  BEFORE UPDATE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_status_guard();

DROP TRIGGER IF EXISTS trg_listing_order_touch_time_updated ON public.listing_order;
CREATE TRIGGER trg_listing_order_touch_time_updated
  BEFORE UPDATE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_touch_time_updated();

DROP TRIGGER IF EXISTS trg_listing_order_no_delete ON public.listing_order;
CREATE TRIGGER trg_listing_order_no_delete
  BEFORE DELETE ON public.listing_order
  FOR EACH ROW EXECUTE FUNCTION public.listing_order_no_delete();


-- ============================================================================
-- §E 业务编排函数 `public.listing_post_event(payload jsonb)`（DL20 / DL141–DL144）
-- ============================================================================
-- 入参契约（金额一律十进制字符串，R70）
--   { "op": "buy" | "refund",
--     "request_fingerprint": "<hex>"|null,           -- 路由层强制传（DL96）；本函数透传
--     "memo": "…"?,                                  -- 可选（**不得**承载业务单号，R18）
--     // op = buy（创建类 ⇒ cli: 键，DL94）
--     "create_key": "cli:<uuid-v4>",
--     "listing_id": "123", "buyer_uid": "900001", "quantity": "2",
--     // op = refund（业务类 ⇒ 主键已存在）
--     "order_id": "456" }
-- 幂等键**由本函数确定性派生**（DL94：键只能由不可变业务标识派生；调用方不得自造）：
--   buy    → `biz:listing:buy:<order_id>`
--   refund → `biz:listing:refund:<order_id>`
-- 账本落点（§7.1 / DL85 逐字）：buy = `purchase` ×1（买家 `balance −n`）+ `sale` ×1（卖家 `balance +n`）
--   —— **恰好两条**；refund = `purchase_refund` ×2（卖家 `balance −n` / 买家 `balance +n`）。
--   ⇒ 用 `ledger_post_event` 的 `op='entries'` **显式两条分录**（`delta` 走**可用余额**，`frozen_delta=0`），
--   **不用** `op='settle'`：后者把「付款方」建模成 `frozen_delta −n`（冻结释放，为 `job_payout` 配的形态），
--   与 §7.1 的「买家 `balance −n`」**不符**（实测：`op='settle'` + `kind='purchase'` ⇒ `LD002
--   LEDGER_INSUFFICIENT_FROZEN`，因为买家没有冻结额）。首版按 `settle` 实现被判负、已就地更正。
--   R28/§19.3 的「结算类仅 `listed`」经 `currency_op='settle'` 在账本内落实；
--   自买自卖由账本 `op='settle'` 的 `v_from = v_to` 闸与本函数的同判据前置闸共同拒绝（§7.1 ids 未定义 ⇒ 取同码）。
-- 出参：{ok, idempotent_replay, op, listing_id, order_id, listing_status, order_status,
--        pay_txid, refund_txid, ledger_event_keys, txid, ledger_idempotency_key, created,
--        entries, accounts, stock, extra}
CREATE OR REPLACE FUNCTION public.listing_post_event(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  v_op         text;
  v_fp         text;
  v_memo       text;
  v_create_key text;
  v_listing_id bigint;
  v_buyer      bigint;
  v_qty        bigint;
  v_order_id   bigint;
  v_qty_int    int;
  v_amount     bigint;
  v_listing    public.listing;
  v_order      public.listing_order;
  v_order_pre  boolean := false;
  v_key        text;
  v_replay     boolean := false;
  v_created    boolean := false;
  v_ledger     jsonb;
  v_entries    jsonb;
  v_txid       text;
  v_seen       integer;
  v_kinds      text;
  v_bad        integer;
  v_cur        record;
BEGIN
  -- ---------------------------------------------------------------- 信封校验
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'payload', 'reason', 'BAD_TYPE'));
  END IF;
  v_op := payload->>'op';
  IF v_op IS NULL OR v_op NOT IN ('buy', 'refund') THEN
    PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
      jsonb_build_object('field', 'op', 'value', COALESCE(v_op, 'null'), 'reason', 'UNKNOWN_LISTING_OP'));
  END IF;
  -- R53 / §19.6：指纹可为 NULL（未传 = 同键即重放）；只作用于事件第 1 条分录
  IF payload ? 'request_fingerprint' AND jsonb_typeof(payload->'request_fingerprint') = 'string' THEN
    v_fp := NULLIF(payload->>'request_fingerprint', '');
  ELSE
    v_fp := NULL;
  END IF;
  v_memo := COALESCE(NULLIF(payload->>'memo', ''), 'listing ' || v_op);

  IF v_op = 'buy' THEN
    -- ============================================================ op = buy
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

    -- ② 入参解析（不含存在性判定）
    v_listing_id := public.ledger_int_amount(COALESCE(payload->>'listing_id', ''), 'listing_id');
    IF v_listing_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_listing_id::text, 'reason', 'listing_not_found'));
    END IF;
    v_qty := public.ledger_int_amount(COALESCE(payload->>'quantity', ''), 'quantity');
    IF v_qty <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'quantity', 'value', v_qty::text));
    END IF;
    IF v_qty > 2147483647 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'quantity', 'reason', 'OUT_OF_INT4_RANGE', 'value', left(v_qty::text, 40)));
    END IF;
    v_qty_int := v_qty::int;
    v_buyer   := public.ledger_uid_arg(COALESCE(payload->>'buyer_uid', ''), 'buyer_uid');
    IF v_buyer < 1 THEN
      PERFORM public.ledger_raise('LEDGER_RESERVED_UID',
        jsonb_build_object('uid', v_buyer::text, 'field', 'buyer_uid',
                           'reason', 'PLATFORM_BUYER_FORBIDDEN'));
    END IF;

    -- ③ 业务行锁（DL141 全序第 1 段：**业务行先于 currency/account**）
    SELECT * INTO v_listing FROM public.listing l WHERE l.listing_id = v_listing_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_listing_id::text, 'reason', 'listing_not_found'));
    END IF;

    -- ④ 订单行解析（创建幂等的唯一权威 = `listing_order.create_key` 唯一约束）
    SELECT * INTO v_order FROM public.listing_order o WHERE o.create_key = v_create_key FOR UPDATE;
    IF FOUND THEN
      v_order_pre := true;
      v_replay    := true;
      -- 同键异业务内容 ⇒ 409（DL144② 的业务侧对应物）
      IF v_order.listing_id <> v_listing_id
         OR v_order.buyer_uid <> v_buyer
         OR v_order.seller_uid <> v_listing.seller_uid
         OR v_order.quantity <> v_qty_int THEN
        PERFORM public.ledger_raise('LEDGER_IDEMPOTENCY_CONFLICT',
          jsonb_build_object('reason', 'CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT',
                             'field', 'create_key', 'idempotency_key', v_create_key,
                             'order_id', v_order.order_id::text));
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    -- ⑤ 纯业务闸（**仅非重放**：重放时业务行已落终态，不得第二次校验/改写，DL144①）
    --     状态机闸（DL60）→ 自买自卖（§11.2）→ 库存（§11.2）
    IF NOT v_replay THEN
      IF v_listing.status <> 'listed' THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing.status', 'reason', 'listing_not_listed',
                             'status', v_listing.status, 'listing_id', v_listing_id::text));
      END IF;
      IF v_buyer = v_listing.seller_uid THEN
        PERFORM public.ledger_raise('LEDGER_SELF_TRANSFER',
          jsonb_build_object('uid', v_buyer::text, 'field', 'buyer_uid',
                             'reason', 'self_purchase_not_allowed', 'listing_id', v_listing_id::text));
      END IF;
      IF v_listing.stock < v_qty_int THEN
        PERFORM public.ledger_raise('LEDGER_INSUFFICIENT_BALANCE',
          jsonb_build_object('uid', v_listing.seller_uid::text, 'field', 'listing.stock',
                             'reason', 'listing_stock_insufficient',
                             'required', v_qty::text, 'available', v_listing.stock::text,
                             'listing_id', v_listing_id::text));
      END IF;
    END IF;

    v_amount := v_listing.price * v_qty;
    IF v_amount <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_amount::text));
    END IF;
    IF v_amount > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'amount', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_amount::text, 40)));
    END IF;

    -- ⑥ 订单行创建（仅新单；卖家用 listing 行的**当前** seller_uid ⇒ 快照自洽）
    IF NOT v_order_pre THEN
      INSERT INTO public.listing_order
        (listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
      VALUES
        (v_listing_id, v_buyer, v_listing.seller_uid, v_listing.cid, v_listing.price, v_qty_int, 'created', v_create_key)
      ON CONFLICT (create_key) DO NOTHING
      RETURNING * INTO v_order;
      IF NOT FOUND THEN
        -- 并发同键：另一事务已建行 ⇒ 重读（持行锁），按重放返回，不重写业务行
        SELECT * INTO v_order FROM public.listing_order o WHERE o.create_key = v_create_key FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
            jsonb_build_object('field', 'create_key', 'reason', 'listing_order_create_race_lost',
                               'idempotency_key', v_create_key));
        END IF;
        v_order_pre := true;
        v_replay    := true;
      ELSE
        v_created := true;
      END IF;
      v_order_id := v_order.order_id;
    END IF;

    v_key := 'biz:listing:buy:' || v_order_id::text;

    -- ⑦ 只读重放探测（按事件根键走既有索引 idx_ledger_event_root_key）
    --     同 0013/0012 同法：它只决定「是否还走业务校验」，不取代账本的权威幂等探针（R51）。
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    IF FOUND THEN v_replay := true; END IF;
    -- 结构性断言：订单行已在库而账本事件不在 ⇒ 同事务语义被破坏（响亮缺陷，R108 类，绝不静默）
    IF v_order_pre AND NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_TRANSACTION_REQUIRED',
        jsonb_build_object('reason', 'listing_order_without_ledger_event',
                           'order_id', v_order_id::text, 'idempotency_key', v_key));
    END IF;

    -- ⑧ 币种存在性（金额/状态闸在账本内；此处只为函数出参与本柱读口的一致性）
    SELECT c.cid, c.status INTO v_cur FROM public.currency c WHERE c.cid = v_listing.cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_listing.cid::text));
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_buyer::text, 'cid', v_listing.cid::text, 'delta', (-v_amount)::text,
                         'frozen_delta', '0', 'kind', 'purchase',
                         'memo', v_memo || '（买家付款 purchase listing_order=' || v_order_id::text || '）'),
      jsonb_build_object('uid', v_listing.seller_uid::text, 'cid', v_listing.cid::text, 'delta', v_amount::text,
                         'frozen_delta', '0', 'kind', 'sale',
                         'memo', v_memo || '（卖家收款 sale listing_order=' || v_order_id::text || '）'));

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'settle',            -- §19.3/R28：结算类（purchase/sale）仅 `listed`
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'listing_order',
      'ref_id',              v_order_id::text,
      'entries',             v_entries));
  ELSE
    -- ============================================================ op = refund
    v_order_id := public.ledger_int_amount(COALESCE(payload->>'order_id', ''), 'order_id');
    IF v_order_id < 1 THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;
    v_key := 'biz:listing:refund:' || v_order_id::text;

    -- ① 业务行锁（DL141 全序第 1 段）
    SELECT * INTO v_order FROM public.listing_order o WHERE o.order_id = v_order_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'order_id', 'value', v_order_id::text, 'reason', 'order_not_found'));
    END IF;

    -- ② 只读重放探测
    SELECT 1 INTO v_seen FROM public.ledger_entry e WHERE e.event_root_key = v_key LIMIT 1;
    v_replay := FOUND;

    -- ③ 状态机闸 + 托管存在性闸（**仅非重放**）
    IF NOT v_replay THEN
      IF v_order.status <> 'paid' THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing_order.status', 'reason', 'order_not_refundable',
                             'status', v_order.status, 'order_id', v_order_id::text));
      END IF;
      IF v_order.pay_txid IS NULL THEN
        PERFORM public.ledger_raise('LEDGER_CURRENCY_INVALID_TRANSITION',
          jsonb_build_object('field', 'listing_order.pay_txid', 'reason', 'order_pay_missing',
                             'order_id', v_order_id::text, 'status', v_order.status));
      END IF;
    END IF;

    -- ④ 业务行锁（listing）—— 与 buy 同一序列：listing 先于 listing_order 的回写
    SELECT * INTO v_listing FROM public.listing l WHERE l.listing_id = v_order.listing_id FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_REF_NOT_FOUND',
        jsonb_build_object('field', 'listing_id', 'value', v_order.listing_id::text, 'reason', 'listing_not_found'));
    END IF;

    -- ④′ 币种存在性（**v3 修正 · 留痕**：v2（sha256 911c7be4…）的 refund 分支从未给 `v_cur` 赋值，
    --   而 RETURN 的 `extra` 块无条件求值 `CASE WHEN v_cur IS NULL …` ⇒ 任何**成功**的 refund 都在
    --   RETURN 处抛 `55000 record "v_cur" is not assigned yet`（实测：行为用例 K6 退款链被此拦下）。
    --   现与 buy 的步骤 ⑧ 对称补齐币种查询，使 refund 的 `extra.currency_status` 亦有意义。）
    SELECT c.cid, c.status INTO v_cur FROM public.currency c WHERE c.cid = v_order.cid;
    IF NOT FOUND THEN
      PERFORM public.ledger_raise('LEDGER_CURRENCY_NOT_FOUND', jsonb_build_object('cid', v_order.cid::text));
    END IF;

    v_amount := v_order.price * v_order.quantity;
    IF v_amount <= 0 THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_NOT_POSITIVE',
        jsonb_build_object('field', 'amount', 'value', v_amount::text));
    END IF;
    IF v_amount > public.ledger_max_single_amount() THEN
      PERFORM public.ledger_raise('LEDGER_AMOUNT_INVALID',
        jsonb_build_object('field', 'amount', 'reason', 'OVER_MAX_SINGLE_AMOUNT', 'value', left(v_amount::text, 40)));
    END IF;

    v_entries := jsonb_build_array(
      jsonb_build_object('uid', v_order.seller_uid::text, 'cid', v_order.cid::text, 'delta', (-v_amount)::text,
                         'frozen_delta', '0', 'kind', 'purchase_refund',
                         'memo', v_memo || '（卖家退回 purchase_refund listing_order=' || v_order_id::text || '）'),
      jsonb_build_object('uid', v_order.buyer_uid::text, 'cid', v_order.cid::text, 'delta', v_amount::text,
                         'frozen_delta', '0', 'kind', 'purchase_refund',
                         'memo', v_memo || '（买家收款 purchase_refund listing_order=' || v_order_id::text || '）'));

    v_ledger := public.ledger_post_event(jsonb_build_object(
      'op',                  'entries',
      'currency_op',         'settle',
      'idempotency_key',     v_key,
      'request_fingerprint', v_fp,
      'memo',                v_memo,
      'ref_type',            'listing_order',
      'ref_id',              v_order_id::text,
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
   WHERE (v_op = 'buy'    AND t.e->>'kind' NOT IN ('purchase', 'sale'))
      OR (v_op = 'refund' AND t.e->>'kind' NOT IN ('purchase_refund'));
  IF COALESCE(v_bad, 0) <> 0 THEN
    PERFORM public.ledger_raise('LEDGER_ACCOUNT_GUARD_VIOLATION',
      jsonb_build_object('reason', 'LISTING_EVENT_KIND_OUT_OF_WHITELIST',
                         'op', v_op, 'kinds', v_kinds));
  END IF;

  -- ---------------------------------------------------------------- 回写业务行
  -- DL144①：重放 ⇒ **不重写业务行**、**不追加 `ledger_event_keys` 项**（DL149 判负用例钉住）；
  -- 判据是账本侧的 `idempotent_replay`（+ 只读根键探测／订单行预存在），**不是** UPDATE 的行数。
  IF NOT v_replay THEN
    IF v_op = 'buy' THEN
      UPDATE public.listing_order o
         SET status = 'paid',
             pay_txid = v_txid::bigint,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
      -- DL60：库存递减与 `purchase` 分录**同一事件**（同一函数、同一事务）
      UPDATE public.listing l
         SET stock = l.stock - v_order.quantity
       WHERE l.listing_id = v_order.listing_id
      RETURNING * INTO v_listing;
    ELSE
      -- DL62：**库存回滚策略由 P4 spec 定**（登记为「未定」）⇒ 本迁移**不复原库存**（不发明）
      UPDATE public.listing_order o
         SET status = 'refunded',
             refund_txid = v_txid::bigint,
             ledger_event_keys = o.ledger_event_keys || v_key
       WHERE o.order_id = v_order_id
      RETURNING * INTO v_order;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', v_replay,
    'op', v_op,
    'listing_id', v_order.listing_id::text,
    'order_id', v_order.order_id::text,
    'listing_status', v_listing.status,
    'order_status', v_order.status,
    'stock', v_listing.stock,
    'created', v_created,
    'pay_txid', CASE WHEN v_order.pay_txid IS NULL THEN NULL ELSE v_order.pay_txid::text END,
    'refund_txid', CASE WHEN v_order.refund_txid IS NULL THEN NULL ELSE v_order.refund_txid::text END,
    'ledger_event_keys', to_jsonb(v_order.ledger_event_keys),
    'txid', v_txid,
    'ledger_idempotency_key', v_key,
    'entries', v_ledger->'entries',
    'accounts', v_ledger->'accounts',
    'extra', jsonb_build_object('amount', v_amount::text, 'currency_status',
                                CASE WHEN v_cur IS NULL THEN NULL ELSE v_cur.status END,
                                'event_kinds', v_kinds));
END $$;

COMMENT ON FUNCTION public.listing_post_event(jsonb) IS
  'P4 商品业务编排函数（DL20 提案 A；硬约束 DL141–DL144）。op=buy|refund；幂等键由本函数按 §8 确定性派生（buy=cli: 创建键 + biz:listing:buy:<order_id> / refund=biz:listing:refund:<order_id>）；同一语句内完成「锁业务行 → 派生分录 → 调 ledger_post_event($1::jsonb) → 回写 ledger_event_keys/托管列/库存」；函数体内无任何 DDL（DL142）；同键重放不重写业务行、不追加 ledger_event_keys 项、不二次扣库存（DL144①/DL149）。发布/编辑/下架**不**走本函数（DL99：无分录的写不得借账本幂等）。';


-- ============================================================================
-- §F apply-time 自检（DL48：不通过则整迁移回滚、不写版本行）
-- ============================================================================
DO $$
DECLARE
  v_missing text;
  v_cols    int;
  v_idx     int;
  v_trg     int;
  v_def     text;
  v_ndef    int;
  v_bad     int;
BEGIN
  -- ---------------------------------------------------------------- 结构断言
  IF to_regclass('public.listing') IS NULL OR to_regclass('public.listing_order') IS NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: public.listing / public.listing_order missing';
  END IF;

  SELECT count(*) INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'listing';
  IF v_cols <> 13 THEN
    RAISE EXCEPTION '0015 self-check FAILED: public.listing has % columns, expected 13 (DL59)', v_cols;
  END IF;
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('listing_id'),('seller_uid'),('cid'),('price'),('stock'),('title'),('description'),
                 ('media_urls'),('status'),('create_key'),('ledger_event_keys'),
                 ('time_created'),('time_updated')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name='listing' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: public.listing missing columns: %', v_missing;
  END IF;

  SELECT count(*) INTO v_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'listing_order';
  IF v_cols <> 14 THEN
    RAISE EXCEPTION '0015 self-check FAILED: public.listing_order has % columns, expected 14 (DL61)', v_cols;
  END IF;
  SELECT string_agg(x.n, ',' ORDER BY x.n) INTO v_missing
    FROM (VALUES ('order_id'),('listing_id'),('buyer_uid'),('seller_uid'),('cid'),('price'),('quantity'),
                 ('status'),('create_key'),('pay_txid'),('refund_txid'),('ledger_event_keys'),
                 ('time_created'),('time_updated')) AS x(n)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name='listing_order' AND c.column_name = x.n);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: public.listing_order missing columns: %', v_missing;
  END IF;

  -- DL59：stock 必须 NOT NULL（「不允许 NULL 表示无限」）
  SELECT count(*) INTO v_ndef
    FROM information_schema.columns c
   WHERE c.table_schema='public' AND c.table_name='listing' AND c.column_name='stock'
     AND c.is_nullable = 'NO';
  IF v_ndef <> 1 THEN
    RAISE EXCEPTION '0015 self-check FAILED: listing.stock must be NOT NULL (DL59)';
  END IF;

  -- DL75② 三件套：ledger_event_keys 在两表都存在且 NOT NULL DEFAULT ''{}''
  SELECT string_agg(x.t, ',' ORDER BY x.t) INTO v_missing
    FROM (VALUES ('listing'),('listing_order')) AS x(t)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                      WHERE c.table_schema='public' AND c.table_name = x.t
                        AND c.column_name='ledger_event_keys' AND c.is_nullable='NO'
                        AND c.data_type='ARRAY');
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: ledger_event_keys (DL75②) missing/not NOT NULL array on: %', v_missing;
  END IF;

  -- DL78：uid 列 FK users；`*_txid` **不建 FK**（断言反面无 FK 指向 ledger_entry）
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.conname IN ('listing_seller_fk','listing_order_buyer_fk','listing_order_seller_fk')
     AND k.contype = 'f';
  IF v_idx <> 3 THEN
    RAISE EXCEPTION '0015 self-check FAILED: uid FKs to users(uid) missing (DL78) — found %', v_idx;
  END IF;
  SELECT count(*) INTO v_idx FROM pg_constraint k
   WHERE k.conrelid IN ('public.listing'::regclass, 'public.listing_order'::regclass)
     AND k.contype = 'f' AND k.confrelid = 'public.ledger_entry'::regclass;
  IF v_idx <> 0 THEN
    RAISE EXCEPTION '0015 self-check FAILED: DL78 violation — *_txid must not FK ledger_entry (%)', v_idx;
  END IF;

  -- DL63：恰好 4 个必建索引（逐名）
  SELECT count(*) INTO v_idx
    FROM pg_indexes i
   WHERE i.schemaname='public'
     AND i.indexname IN ('idx_listing_status_time','idx_listing_seller',
                         'idx_listing_order_buyer','idx_listing_order_listing');
  IF v_idx <> 4 THEN
    RAISE EXCEPTION '0015 self-check FAILED: expected 4 listing indexes (DL63), found %', v_idx;
  END IF;
  -- 逐表确认无「多建的索引」（DL74 预算）；每表索引数 = 4 个必建中的本表份 + 1 个 create_key 唯一索引 (+ PK)
  SELECT count(*) INTO v_idx FROM pg_indexes i
   WHERE i.schemaname='public' AND i.tablename='listing'
     AND i.indexname NOT IN ('listing_pk','listing_create_key_uniq',
                             'idx_listing_status_time','idx_listing_seller');
  IF v_idx <> 0 THEN
    RAISE EXCEPTION '0015 self-check FAILED: unexpected extra index on public.listing (%)', v_idx;
  END IF;
  SELECT count(*) INTO v_idx FROM pg_indexes i
   WHERE i.schemaname='public' AND i.tablename='listing_order'
     AND i.indexname NOT IN ('listing_order_pk','listing_order_create_key_uniq',
                             'idx_listing_order_buyer','idx_listing_order_listing');
  IF v_idx <> 0 THEN
    RAISE EXCEPTION '0015 self-check FAILED: unexpected extra index on public.listing_order (%)', v_idx;
  END IF;

  -- 触发器启用态（DL60/DL61/DL75③/DL79）：listing 4 UPDATE + 1 DELETE；listing_order 5 UPDATE + 1 DELETE
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgrelid = 'public.listing'::regclass;
  IF v_trg <> 5 THEN
    RAISE EXCEPTION '0015 self-check FAILED: listing enabled triggers = %, expected 5', v_trg;
  END IF;
  SELECT count(*) INTO v_trg FROM pg_trigger t
   WHERE NOT t.tgisinternal AND t.tgenabled = 'O' AND t.tgrelid = 'public.listing_order'::regclass;
  IF v_trg <> 6 THEN
    RAISE EXCEPTION '0015 self-check FAILED: listing_order enabled triggers = %, expected 6', v_trg;
  END IF;

  IF to_regprocedure('public.listing_post_event(jsonb)') IS NULL
     OR to_regprocedure('public.listing_status_transition_ok(text,text)') IS NULL
     OR to_regprocedure('public.listing_order_status_transition_ok(text,text)') IS NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: orchestration/whitelist functions missing';
  END IF;

  -- DL142：编排函数体内禁 DDL（类级全树扫描由 scripts/p3s1b-01 覆盖）
  --   注：探测串必须用 chr(36) 拼出 dollar-quote —— 本块自身是 dollar-quoted body，
  --   体内出现字面量 dollar-quote 标记会**提前闭合**该 body（0013 的实测：42601）。
  SELECT string_agg(t.p, ',') INTO v_missing FROM (
    VALUES ('create table'),('alter table'),('drop table'),('truncate'),('create index'),
           ('create function'),('rename to'),('do ' || chr(36) || chr(36))
  ) AS t(p)
   WHERE position(upper(t.p)
          in upper(pg_get_functiondef('public.listing_post_event(jsonb)'::regprocedure))) > 0;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '0015 self-check FAILED: DDL token(s) inside listing_post_event body: %', v_missing;
  END IF;

  -- ---------------------------------------------------------------- 纯函数断言（listing 状态白名单 正/负全集，DL60）
  IF NOT public.listing_status_transition_ok('draft','listed')
     OR NOT public.listing_status_transition_ok('listed','delisted')
     OR NOT public.listing_status_transition_ok('listed','frozen')
     OR NOT public.listing_status_transition_ok('frozen','listed') THEN
    RAISE EXCEPTION '0015 self-check FAILED: listing whitelist missing an allowed transition (DL60)';
  END IF;
  IF public.listing_status_transition_ok('draft','delisted')
     OR public.listing_status_transition_ok('draft','frozen')
     OR public.listing_status_transition_ok('listed','draft')
     OR public.listing_status_transition_ok('listed','listed')
     OR public.listing_status_transition_ok('frozen','delisted')
     OR public.listing_status_transition_ok('delisted','listed')
     OR public.listing_status_transition_ok('delisted','frozen') THEN
    RAISE EXCEPTION '0015 self-check FAILED: listing whitelist admits a forbidden transition (DL60: delisted = 终态)';
  END IF;

  -- 纯函数断言（listing_order 状态白名单 正/负全集）
  IF NOT public.listing_order_status_transition_ok('created','paid')
     OR NOT public.listing_order_status_transition_ok('created','cancelled')
     OR NOT public.listing_order_status_transition_ok('paid','refunded') THEN
    RAISE EXCEPTION '0015 self-check FAILED: order whitelist missing an allowed transition';
  END IF;
  IF public.listing_order_status_transition_ok('created','refunded')
     OR public.listing_order_status_transition_ok('created','created')
     OR public.listing_order_status_transition_ok('paid','cancelled')
     OR public.listing_order_status_transition_ok('paid','paid')
     OR public.listing_order_status_transition_ok('refunded','paid')
     OR public.listing_order_status_transition_ok('cancelled','paid') THEN
    RAISE EXCEPTION '0015 self-check FAILED: order whitelist admits a forbidden transition';
  END IF;

  -- kind 关闭集自检（DL81：0 扩展）：本柱只用 purchase / sale / purchase_refund
  SELECT count(*) INTO v_bad
    FROM (VALUES ('purchase'),('sale'),('purchase_refund')) AS x(k)
   WHERE NOT public.ledger_kind_ok(x.k);
  IF v_bad <> 0 THEN
    RAISE EXCEPTION '0015 self-check FAILED: % listing kind(s) outside the 20-kind closed set (DL81)', v_bad;
  END IF;

  RAISE NOTICE '0015 self-check OK: listing cols=13 trg=5 / listing_order cols=14 trg=6 / 4 indexes / whitelists verified';
END $$;
