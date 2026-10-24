-- 0076 · uid 规范化迁移（**contract** = `docs/data-layer.spec.md` §40.17 / v0.47；姊妹 `docs/seafood.master-plan.md` §5.468 / v0.387）
-- ============================================================================
-- ★★★ 本文件不得自动执行。apply 需 Kevin 授权（§40.17.10 `UR10` 第 4 关）★★★
--     第 1 关（契约）✅ 第 2 关（实现单 + 事务内 dry-run + ROLLBACK 自证）= 本文件 +
--     `ops/uid-renumber-2026-10-24/`（backup.sh / dryrun.ts / rollback.sh / README.md）
--     第 3 关 = Neng 只读复核；第 4 关 = Kevin 授权 apply（维护窗口 · 后端只读 · 会话全失效）
--
-- 目标（§40.17.0 K1–K3）：真实账号 `970213 → 100100`（按 `lower(evm)` 定位，不按 uid）·
--   其余 193 个 mock 按**旧 uid 升序**重编 `1000, 1001, … 1192` · 序列重启 `100101`
--   ⇒ 194 行用户在 31 处 FK + `ledger_entry` / `account` / 6 处非 FK uid 面上一次性换号。
--
-- 形态（§40.17.3）：**单事务**（本文件不写 BEGIN/COMMIT —— `scripts/migrate.ts` 逐文件包事务；
--   `ops/**/rollback.sh` 用 `psql --single-transaction` 包同一事务）· **两相 offset**
--   （相 1 `uid + 10^7` 回收区、相 2 落终值；`users` PK 是唯一索引、唯一索引冲突**不可延迟**，
--   新旧号段必然相交 ⇒ 单相 UPDATE 必撞 23505，见 §40.17.3 D）· FK 方案 **Ⅰ**
--   （31 条 `ALTER CONSTRAINT … DEFERRABLE INITIALLY IMMEDIATE` + `SET CONSTRAINTS ALL DEFERRED`，
--   收口 `SET CONSTRAINTS ALL IMMEDIATE` 后复原 `NOT DEFERRABLE`）。
--
-- 12 步时序（§40.17.3 E，顺序即契约；2b/2c/2d 为子步，编号沿用）：
--   0 预检（本文件头部 `UR-PRE-*` 闸：31 FK 现取集 / 14 触发器 / 行数 / 真实号 / 段不相交 / 账本无漂移）
--   1 BEGIN（由执行器提供）      2 关 14 个 append-only 触发器（**逐个按名**，禁 `ALL` / `session_replication_role`）
--   2b 关 5 个额外写闸（`UR-BLOCK-6`；**逐个按名** + 先断言「名字 × 挂载表」在册且 `tgenabled='O'`）
--   2b-2 断言 19 个触发器全部 `tgenabled='D'`（防「名字对而挂错表 / 已被他人改 'R'」的静默失效）
--   2c **删除 9 行无账本 mock 余额**（Kevin 2026-10-24 授权 · 精确谓词 · 删前 9 / 删后 0 · 漂移降为 0）
--   3 31 × FK `DEFERRABLE`       4 `SET CONSTRAINTS ALL DEFERRED`   5 `ur_map`（TEMP · ON COMMIT DROP · 单一映射源）
--   6 `users` 相 1（+10^7）      7 `users` 相 2（落终值）            8 A 类 31 列逐列 `UPDATE … FROM ur_dir`
--   9 `ledger_entry` **再** `account`（顺序被 `trg_account_guard` 硬绑定，不可换）
--   10 B 类其余（`batt_entry` / `batt_account` / `listing_edit_log` / `campaign_task_reward_pending`）
--   11 `SET CONSTRAINTS ALL IMMEDIATE`（主动引爆延迟校验）
--   12 复原 31 × `NOT DEFERRABLE` → 19 触发器 `ENABLE` → 序列 `RESTART WITH 100101`
--      → **17 条判负**（§40.17.9 `UR9-1..15` + 本轮新增 `UR9-16`（9 行已不存在）/ `UR9-17`（19 触发器全 `O`），
--      全为 `DO $$ … RAISE EXCEPTION … $$`，任一红即整体回滚）
--
-- ★ R73 / §40.17.8 `UR8-1` 登记（临时禁用 append-only 触发器**须显式登记原因与时长**）：
--   原因 = 换号必须 `UPDATE` 留痕表的 uid 列（append-only 守卫 `BEFORE UPDATE` 拦死）；
--   范围 = **本事务内**、**逐触发器按名**、**仅 14 个**（`trg_ledger_entry_append_only` + §40.17.4 A 表 13 个）；
--   时长 = 单事务（毫秒～秒级，维护窗口内后端只读）；收口 = 逐项 `ENABLE` + `UR9-10` 现取断言 `tgenabled='O'`。
--   关闭期间**不改**任何数值列（`delta` / `balance_after` / `frozen_after` 逐字不变，`UR9-14` 以 md5 证明）。
--
-- ★ 授权边界（Kevin 2026-10-24 补授权，本轮已落地）：**仅限** `ALTER TABLE … DISABLE TRIGGER <名>` 逐个按名；
--   `DISABLE TRIGGER ALL` 与 `session_replication_role` **一律判负**（§40.17.4 ★）。
--   `trg_batt_account_user_fk` **始终保持启用**（uid 完整性守卫）。
--   `trg_account_guard` 的唯一例外：步骤 2c 删除那 9 行 mock 余额时，`account_guard()` 对 `TG_OP='DELETE'`
--   硬失败（`0001_ledger_core.sql:129-131`）⇒ 仅在**该 DELETE 前后** `DISABLE`/`ENABLE` 它，
--   并在同一步断言 `tgenabled='O'`。步骤 9 的 `UPDATE account` 全程在守卫开启下执行（那才是它的本职）。
--
-- ★★ `UR-BLOCK-6`（**已由 Kevin 2026-10-24 授权关闭**，不再是阻断项）：
--   除 14 个 append-only 触发器外，另有 **5 个非 append-only 的写闸**同样拦「改 uid」：
--     ① `admin_user_role`  — `trg_admin_user_role_key_immutable`（`platform_config_key_immutable`，`uid` 是键列；`0017:160-180`）
--     ② `conversation`     — `trg_conversation_read_mark_only`（只放行两读水位 + `time_updated`，**显式禁** `buyer_uid`/`seller_uid`；`0045:107-131`）
--     ③ `message`          — `trg_message_no_update_or_delete`（无条件 append-only；`0045:150-158`）
--     ④ `listing_order`    — `trg_listing_order_core_immutable_guard`（`buyer_uid`/`seller_uid` 属下单快照；`0015:286-300`）
--     ⑤ `market_order`     — `trg_market_order_core_immutable_guard`（`owner_uid` 属挂单快照；`0016:254-268`）
--   处置（**直接按名，不再走 `ur.allow_extra_guards` 开关**）：
--     预检 `UR-PRE-6` 断言 5 个「表 × 触发器名」对在册且 `tgenabled='O'`（拼错名 / 挂错表 ⇒ 停止，而非静默失效）；
--     步骤 2b 逐个 `DISABLE`；步骤 2d 断言 19 个（14 + 5）全部 `tgenabled='D'`；
--     步骤 12b-2 逐个 `ENABLE`；判负 `UR9-17` 断言 19 个全部 `tgenabled='O'`。
--
-- ★ 步骤 2c 登记（R73 同法：临时禁用守卫须显式登记原因与时长）：
--   授权 = Kevin 2026-10-24「直接删掉那 9 行 account（无账本、无余额支撑、纯 mock）」；
--   对象 = `uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399) AND cid=399
--          AND balance=40 AND frozen=0`（**精确谓词，不得改成清零**）；
--   原因 = 这 9 行「无任何 ledger_entry 兜底」⇒ `trg_account_guard` 在步骤 9 的 `UPDATE account` 上必 P0001（NM2）；
--   关联残留 = **无**（`account` 无任何入向 FK；这 9 个 uid/cid 的 `ledger_entry` 计数 = 0，步骤内以现取断言证明）；
--   时长 = 单事务、单条 DELETE；守卫 `DISABLE` → DELETE → `ENABLE` 三步紧邻，收口断言 `tgenabled='O'`。
--
-- ★ 已知副作用登记（**非 uid 列** · 由既有 touch 触发器产生，不是本迁移引入）：
--   `listing` / `listing_order` / `market_order` / `project` / `batt_account` 上的 `*_touch_time_updated`
--   会把 `time_updated` 刷成 `now()`（任何 UPDATE 都会，含本迁移）。改写只落在 uid 列；`time_updated` 的变化
--   是既有触发器语义 ⇒ 收口以 `UR-NOTE-touch` 出逐表读数（**登记，不消除**，也不进 `UR9-14` 的三表 md5 口径）。
--
-- ★ 方向参数（§40.17.7 A「回滚与正向必须同源」，**禁**另写一套 SQL）：
--   `SET ur.direction = 'up'`（默认，正向）/ `'down'`（回滚：把 `ur_map` 的 `new_uid → old_uid` 反跑同一 12 步）。
--   回滚时 `ur_map` 由 `rollback.sh` 以**同一张 TEMP 表**（`ON COMMIT DROP`）预置（`\copy` 自 `map.csv`），
--   本文件在 `down` 方向**不重算**映射（旧号在库内已不可推导，映射只能来自备份）。
-- ============================================================================

-- ---------------------------------------------------------------- §40.17.0 预检闸（步骤 0）
DO $ur_pre$
DECLARE
  v_expect text[] := ARRAY[
    'admin_ops_audit_log.actor_uid', 'admin_ops_audit_log.target_uid',
    'admin_refund_audit_log.actor_uid', 'admin_refund_audit_log.buyer_uid', 'admin_refund_audit_log.seller_uid',
    'admin_user_role.uid',
    'checkin_log.uid', 'checkin_makeup_log.uid',
    'conversation.buyer_uid', 'conversation.seller_uid',
    'currency_review_log.actor_uid', 'currency_status_log.actor_uid',
    'listing.seller_uid', 'listing_favorite.fav_uid',
    'listing_order.buyer_uid', 'listing_order.seller_uid', 'listing_order_event.actor_uid',
    'listing_review_log.actor_uid', 'market_order.owner_uid', 'market_trade.taker_uid',
    'media.owner_uid', 'message.from_uid', 'project.owner_uid',
    'project_wage_claim.uid', 'project_worker.uid',
    'rating.ratee_uid', 'rating.rater_uid',
    'referral.child_uid', 'referral.parent_uid',
    'subtask_proof.uid', 'user_activity_hour.uid'
  ];
  v_trig text[] := ARRAY[
    'trg_ledger_entry_append_only', 'trg_referral_append_only', 'trg_market_trade_append_only',
    'trg_currency_status_log_append_only', 'trg_admin_ops_audit_log_append_only',
    'trg_admin_refund_audit_log_append_only', 'trg_currency_review_log_append_only',
    'trg_listing_review_log_append_only', 'trg_checkin_log_append_only',
    'trg_checkin_makeup_log_append_only', 'trg_rating_append_only',
    'trg_listing_order_event_append_only', 'trg_listing_edit_log_append_only', 'trg_batt_entry_append_only'
  ];
  v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
  v_extra text[] := ARRAY[
    'trg_admin_user_role_key_immutable', 'trg_conversation_read_mark_only',
    'trg_message_no_update_or_delete', 'trg_listing_order_core_immutable_guard',
    'trg_market_order_core_immutable_guard'
  ];
  v_live text[]; v_n int; v_drift int; v_txt text; v_nx int; v_t9 int; v_oth int; v_livex text[];
  v_extra_pair text[] := ARRAY[
    'admin_user_role.trg_admin_user_role_key_immutable',
    'conversation.trg_conversation_read_mark_only',
    'message.trg_message_no_update_or_delete',
    'listing_order.trg_listing_order_core_immutable_guard',
    'market_order.trg_market_order_core_immutable_guard'
  ];
BEGIN
  -- UR-PRE-0 方向参数只允许 up / down（写错方向 = 事故）
  IF coalesce(current_setting('ur.direction', true), 'up') NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'UR-PRE-0 FAILED: ur.direction=% 只允许 up / down', current_setting('ur.direction', true);
  END IF;

  -- UR-PRE-1 §40.17.2 UR2-d / NM1：31 处 FK 以 pg_constraint **现取**复核，与契约集逐项相等（差异即停止，不得硬跑）
  SELECT array_agg(c.conrelid::regclass::text || '.' || a.attname ORDER BY 1) INTO v_live
    FROM pg_constraint c
    JOIN LATERAL unnest(c.conkey) k ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
   WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass;
  -- 集合比较（顺序无关）：live ⊇ 期望 且 live ⊆ 期望 且 基数 = 31
  IF v_live IS NULL
     OR coalesce(array_length(v_live, 1), 0) <> 31
     OR NOT (v_live @> v_expect AND v_live <@ v_expect) THEN
    RAISE EXCEPTION 'UR-PRE-1 FAILED: 活的 users FK 集 ≠ 契约 31 项（live 基数 %）。live=%（期望 31 项，见 §40.17.2 A 表）',
      coalesce(array_length(v_live, 1), 0), coalesce(array_to_string(v_live, ', '), '<空>');
  END IF;

  -- UR-PRE-2 §40.17.4：14 个 append-only 触发器必须**存在**且现值 tgenabled='O'（既有 D 残留 ⇒ 基线要重定，NM4）
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = ANY (v_trig) AND tgenabled = 'O';
  IF v_n <> 14 THEN
    RAISE EXCEPTION 'UR-PRE-2 FAILED: 14 个 append-only 触发器中 tgenabled=''O'' 的只 % 个（NM4 基线不成立，停止）', v_n;
  END IF;

  -- UR-PRE-3 §40.17.1 边界：194 行、真实账号按 lower(evm) 唯一定位
  SELECT count(*) INTO v_n FROM public.users;
  IF v_n <> 194 THEN
    RAISE EXCEPTION 'UR-PRE-3 FAILED: users 行数 % ≠ 194（映射规则与 mock 段上界 1192 均以此为前提）', v_n;
  END IF;
  IF v_up THEN
    SELECT count(*) INTO v_n FROM public.users WHERE uid = 970213
      AND lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
  ELSE
    SELECT count(*) INTO v_n FROM public.users WHERE uid = 100100
      AND lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
  END IF;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'UR-PRE-3 FAILED: 真实账号定位命中 % 行（期望 1；up 期望 uid=970213 / down 期望 uid=100100，evm 0x59f9…09b0）', v_n;
  END IF;

  -- UR-PRE-4 §40.17.1：旧号段与新号段必须**不相交**（否则「残留旧号」类断言（UR9-5①/6①/9）会与合法新号混淆）
  IF v_up THEN
    SELECT count(*) INTO v_n FROM public.users WHERE uid BETWEEN 1000 AND 1192 OR uid = 100100;
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'UR-PRE-4 FAILED: 现盘已有 % 行落在新号段 1000–1192 / 100100 内（段相交）', v_n;
    END IF;
  END IF;

  -- UR-PRE-5 §40.17.11 NM2（口径本轮修订：**已验证并清理，漂移降为 0**）
  --   本迁移步骤 9 会 `UPDATE account.uid`，`trg_account_guard` 对「无 ledger 行」与「快照不等」两种漂移硬失败（P0001）。
  --   现盘漂移必须**恰好**是 Kevin 2026-10-24 授权的 9 行 mock 余额（步骤 2c 以精确谓词删除，删后漂移 = 0）；
  --   除此 9 行之外的**任何**漂移一律 fail-closed（在第一次写之前停，并点名 uid/cid）。
  SELECT count(*) INTO v_drift
    FROM public.account a
   WHERE a.uid > 0
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
     AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1);

  -- 授权清理目标（精确谓词；**不得**改成清零 / 不得扩面）
  SELECT count(*) INTO v_t9 FROM public.account a
   WHERE a.uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)
     AND a.cid = 399 AND a.balance = 40 AND a.frozen = 0;
  IF v_t9 <> 9 THEN
    RAISE EXCEPTION 'UR-PRE-5 FAILED (NM2 清理目标漂移): 精确谓词命中 % 行 ≠ 9（uid 清单/cid=399/balance=40/frozen=0；可能已被清理或数据已变，停止并核对授权清单，不得放宽谓词）', v_t9;
  END IF;

  -- 9 行之外不得有任何漂移（含 uid 0 / 负号平台行以外的 users 行）
  SELECT count(*) INTO v_oth
    FROM public.account a
   WHERE a.uid > 0
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
     AND NOT (a.uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)
              AND a.cid = 399 AND a.balance = 40 AND a.frozen = 0)
     AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1);
  IF v_oth <> 0 THEN
    SELECT string_agg(x.uid::text || '/' || x.cid::text, ',' ORDER BY x.uid) INTO v_txt
      FROM (SELECT a.uid, a.cid FROM public.account a
             WHERE a.uid > 0
               AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
               AND NOT (a.uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)
                        AND a.cid = 399 AND a.balance = 40 AND a.frozen = 0)
               AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
                     SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
                      WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)) x;
    RAISE EXCEPTION 'UR-PRE-5 FAILED (NM2 越界漂移): 9 行授权清单之外仍有 % 个 account 行与其最新 ledger 快照不一致 ⇒ 步骤 9 必 P0001。须先按 §40.17.11 NM2 单独清理（本迁移只授权那 9 行）：%',
      v_oth, v_txt;
  END IF;

  -- 9 行必须**全部**处于漂移态（= 确实无 ledger 兜底）；若已与快照一致，说明目标集已变，停止核对
  IF v_drift <> 9 THEN
    RAISE EXCEPTION 'UR-PRE-5 FAILED (NM2 目标集失真): 全表漂移 % 行 ≠ 9（授权目标应全部无账本兜底；停止并重新核数）', v_drift;
  END IF;

  -- UR-PRE-7 §40.17.9 UR9-12 的**原始基线**：必须在步骤 3（把 31 FK 改成 DEFERRABLE）**之前**现取 ——
  --   步骤 5 的 `ur_base` 在步骤 3 之后才建，届时已看不到「迁移前」的可延迟性（本轮 dry-run 抓到的结构性缺陷）。
  --   契约要求：迁移前 31 FK 全部 `NOT DEFERRABLE`；出现任何 `condeferrable=true` ⇒ 停止（否则 UR9-12 的口径失去基准）。
  SELECT string_agg(c.conname || '=' || c.condeferrable::text || '/' || c.condeferred::text, ',' ORDER BY c.conname)
    INTO v_txt FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass;
  IF v_txt IS NULL OR position('=t' in v_txt) > 0 THEN
    RAISE EXCEPTION 'UR-PRE-7 FAILED: 31 users FK 中存在可延迟项（原值 %）⇒ 契约基线应为全部 NOT DEFERRABLE，停止', coalesce(v_txt, '<空>');
  END IF;
  PERFORM set_config('ur.fk_baseline', v_txt, false);

  RAISE NOTICE 'UR-PRE ok: 31 FK live-match / 14 triggers O / users=194 / real-account located / ranges disjoint / NM2 drift = 9 authorized mock rows only (deleted in step 2c → drift 0) (direction=%)',
    coalesce(current_setting('ur.direction', true), 'up');

  -- UR-PRE-6（**UR-BLOCK-6** · Kevin 2026-10-24 已授权直接按名 DISABLE/ENABLE）：契约 §40.17.4 未列、
  --   但同样拦「改 uid」的 5 个非 append-only 写闸。
  --   口径（保持 fail-closed，但不再依赖 `ur.allow_extra_guards` 开关）：
  --     **名字 × 挂载表**必须**逐项在册**且现值均 `tgenabled='O'`；拼错名 / 挂错表 / 已被别人禁用 ⇒ 停止。
  --     这是「直接按名 DISABLE」的前置证明：名字断言通过后才允许步骤 2b 的 5 条 ALTER。
  SELECT array_agg(c.relname || '.' || t.tgname ORDER BY 1) INTO v_livex
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE NOT t.tgisinternal AND t.tgname = ANY (v_extra);
  IF v_livex IS NULL
     OR coalesce(array_length(v_livex, 1), 0) <> 5
     OR NOT (v_livex @> v_extra_pair AND v_livex <@ v_extra_pair) THEN
    RAISE EXCEPTION 'UR-PRE-6 FAILED: 5 个额外写闸的「表.触发器」集 ≠ 授权清单（live 基数 %）。live=%；期望=%',
      coalesce(array_length(v_livex, 1), 0), coalesce(array_to_string(v_livex, ', '), '<空>'),
      array_to_string(v_extra_pair, ', ');
  END IF;
  SELECT count(*) INTO v_nx FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = ANY (v_extra) AND tgenabled = 'O';
  IF v_nx <> 5 THEN
    SELECT string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) INTO v_txt
      FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY (v_extra);
    RAISE EXCEPTION 'UR-PRE-6 FAILED: 5 个额外写闸中 tgenabled=''O'' 的只 % 个（现值：%）⇒ 禁用清单失真，停止', v_nx, coalesce(v_txt, '<空>');
  END IF;
  RAISE NOTICE 'UR-PRE-6 ok: 5 个额外写闸「表×名」逐项在册且 tgenabled=O（Kevin 授权：步骤 2b 逐个 DISABLE，12b-2 逐个 ENABLE，UR9-17 复核 19/19）';
END
$ur_pre$;

-- ---------------------------------------------------------------- 步骤 2：关 14 个 append-only 触发器（逐个按名）
ALTER TABLE public.ledger_entry              DISABLE TRIGGER trg_ledger_entry_append_only;
ALTER TABLE public.referral                  DISABLE TRIGGER trg_referral_append_only;
ALTER TABLE public.market_trade              DISABLE TRIGGER trg_market_trade_append_only;
ALTER TABLE public.currency_status_log       DISABLE TRIGGER trg_currency_status_log_append_only;
ALTER TABLE public.admin_ops_audit_log       DISABLE TRIGGER trg_admin_ops_audit_log_append_only;
ALTER TABLE public.admin_refund_audit_log    DISABLE TRIGGER trg_admin_refund_audit_log_append_only;
ALTER TABLE public.currency_review_log       DISABLE TRIGGER trg_currency_review_log_append_only;
ALTER TABLE public.listing_review_log        DISABLE TRIGGER trg_listing_review_log_append_only;
ALTER TABLE public.checkin_log               DISABLE TRIGGER trg_checkin_log_append_only;
ALTER TABLE public.checkin_makeup_log        DISABLE TRIGGER trg_checkin_makeup_log_append_only;
ALTER TABLE public.rating                    DISABLE TRIGGER trg_rating_append_only;
ALTER TABLE public.listing_order_event       DISABLE TRIGGER trg_listing_order_event_append_only;
ALTER TABLE public.listing_edit_log          DISABLE TRIGGER trg_listing_edit_log_append_only;
ALTER TABLE public.batt_entry                DISABLE TRIGGER trg_batt_entry_append_only;

-- 步骤 2b（`UR-BLOCK-6` · Kevin 2026-10-24 授权）：5 个非 append-only 写闸 —— **逐个按名**直接 DISABLE
--   （前置证明在 UR-PRE-6：「表 × 名」逐项在册且 tgenabled='O'；名字打错 = ALTER 报错，挂错表 = 集合断言不通过）
ALTER TABLE public.admin_user_role DISABLE TRIGGER trg_admin_user_role_key_immutable;
ALTER TABLE public.conversation    DISABLE TRIGGER trg_conversation_read_mark_only;
ALTER TABLE public.message         DISABLE TRIGGER trg_message_no_update_or_delete;
ALTER TABLE public.listing_order   DISABLE TRIGGER trg_listing_order_core_immutable_guard;
ALTER TABLE public.market_order    DISABLE TRIGGER trg_market_order_core_immutable_guard;

-- 步骤 2b-2：断言 19 个守卫（14 append-only + 5 写闸）**确实**全部 tgenabled='D'
--   目的：`DISABLE TRIGGER <错名>` 在 PG 里不会静默成功（会报错），但「名字对、挂错表」或
--   「别的事务已把某个守卫改成 'R'(replica)」这类失真必须在**任何写之前**炸出来。
DO $ur_disabled$
DECLARE v_n int; v_bad text;
BEGIN
  SELECT count(*) FILTER (WHERE tgenabled = 'D'),
         string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) FILTER (WHERE tgenabled <> 'D')
    INTO v_n, v_bad
    FROM pg_trigger WHERE NOT tgisinternal
     AND tgname = ANY (ARRAY['trg_ledger_entry_append_only','trg_referral_append_only','trg_market_trade_append_only',
       'trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only','trg_admin_refund_audit_log_append_only',
       'trg_currency_review_log_append_only','trg_listing_review_log_append_only','trg_checkin_log_append_only',
       'trg_checkin_makeup_log_append_only','trg_rating_append_only','trg_listing_order_event_append_only',
       'trg_listing_edit_log_append_only','trg_batt_entry_append_only',
       'trg_admin_user_role_key_immutable','trg_conversation_read_mark_only','trg_message_no_update_or_delete',
       'trg_listing_order_core_immutable_guard','trg_market_order_core_immutable_guard']);
  IF v_n <> 19 OR v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'UR-DISABLE FAILED: 19 个守卫中 tgenabled=''D'' 的 % 个，异常项：%', v_n, coalesce(v_bad, '<无>');
  END IF;
END
$ur_disabled$;

-- ---------------------------------------------------------------- 步骤 2c：删除 9 行无账本 mock 余额（Kevin 2026-10-24 授权）
-- 授权（逐字）：直接删掉那 9 行 account（无账本、无余额支撑、纯 mock）；
--   精确谓词 = `uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)
--               AND cid = 399 AND balance = 40 AND frozen = 0`；**不得改成清零**、不得扩面。
-- 证据链（全部在本步现取，任一不满足即整体回滚）：
--   ① 删前：精确谓词命中 **9** 行（v_target=9）；
--   ② 关联残留：这 9 个 uid 的 `ledger_entry` = **0** 行（无账本兜底，删除的合法性前提）；
--      `account` 的入向 FK = **0** 条（现取 `pg_constraint` 证明 ⇒ **无关联残留需要清理**）；
--   ③ DELETE 的 `GET DIAGNOSTICS ROW_COUNT` = **9**；
--   ④ 删后：`uid = ANY(9 uids)` = **0** 行；`trg_account_guard` 已复启（tgenabled='O'）；
--   ⑤ NM2 收口：全表 users 行漂移 = **0**（这正是 UR-PRE-5 改写后的「已验证并清理，漂移降为 0」）。
-- ★ 守卫例外登记：`account_guard()` 对 `TG_OP='DELETE'` 硬失败（`0001_ledger_core.sql:129-131`）
--   ⇒ **仅本 DELETE 前后** DISABLE/ENABLE `trg_account_guard`（三步紧邻，同一步内复启并断言）。
--   ★ 这不是「关掉账本一致性守卫」：步骤 9 的 `UPDATE account` 全程在守卫**开启**下执行。
DO $ur_del9$
DECLARE
  v_uids bigint[] := ARRAY[971469,971591,976489,979689,981486,983264,987867,988363,988399];
  v_target int; v_led bigint; v_child int; v_hit int; v_after int; v_drift int; v_txt text;
BEGIN
  -- 2c-① 删前断言：精确谓词恰好 9 行（不足 = 已被清理/数据已变，超出 = 谓词写宽 ⇒ 都停，不得放宽）
  SELECT count(*) INTO v_target FROM public.account
   WHERE uid = ANY (v_uids) AND cid = 399 AND balance = 40 AND frozen = 0;
  IF v_target <> 9 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED (删前断言): 精确谓词命中 % 行 ≠ 9（uid 清单 / cid=399 / balance=40 / frozen=0）。停止核对授权清单，不得放宽谓词、不得改成清零', v_target;
  END IF;

  -- 2c-② 关联残留现取：无账本 + 无入向 FK ⇒ 明确「无关联残留」
  SELECT count(*) INTO v_led FROM public.ledger_entry WHERE uid = ANY (v_uids);
  IF v_led <> 0 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED: 9 个 uid 仍有 % 行 ledger_entry（有账本兜底 ⇒ 不得删除，须回退到 §40.17.11 NM2 单独处置）', v_led;
  END IF;
  SELECT count(*) INTO v_child FROM pg_constraint
   WHERE contype = 'f' AND confrelid = 'public.account'::regclass;
  IF v_child <> 0 THEN
    SELECT string_agg(conrelid::regclass::text || '.' || conname, ', ' ORDER BY conname) INTO v_txt
      FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.account'::regclass;
    RAISE EXCEPTION 'UR-DEL9 FAILED: account 新增了入向 FK（%）。关联残留必须先在**本步**清理并补登记，不得盲删', v_txt;
  END IF;

  -- 2c-③ DELETE（守卫仅此刻关闭；单条语句；命中行数硬断言）
  ALTER TABLE public.account DISABLE TRIGGER trg_account_guard;
  DELETE FROM public.account
   WHERE uid = ANY (v_uids) AND cid = 399 AND balance = 40 AND frozen = 0;
  GET DIAGNOSTICS v_hit = ROW_COUNT;
  ALTER TABLE public.account ENABLE TRIGGER trg_account_guard;
  IF v_hit <> 9 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED: DELETE 命中 % 行 ≠ 9（谓词与现盘不一致；事务将整体回滚）', v_hit;
  END IF;

  -- 2c-④ 删后断言：0 行残留 + 守卫已复启
  SELECT count(*) INTO v_after FROM public.account WHERE uid = ANY (v_uids);
  IF v_after <> 0 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED (删后断言): 仍有 % 行匹配那 9 个 uid', v_after;
  END IF;
  SELECT count(*) INTO v_child FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = 'trg_account_guard' AND tgenabled = 'O';
  IF v_child <> 1 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED: trg_account_guard 未复启（tgenabled<>O，命中 % 行）—— 禁止带着关闭的账本守卫提交', v_child;
  END IF;

  -- 2c-⑤ NM2 收口：漂移降为 0（UR-PRE-5 已证「9 行之外无漂移」，此处证「删后无漂移」）
  SELECT count(*) INTO v_drift FROM public.account a
   WHERE a.uid > 0
     AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
     AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1);
  IF v_drift <> 0 THEN
    RAISE EXCEPTION 'UR-DEL9 FAILED (NM2 收口): 删后仍有 % 行 account 漂移 ⇒ 步骤 9 必 P0001', v_drift;
  END IF;

  RAISE NOTICE 'UR-DEL9 ok: 删前 9 / DELETE 命中 9 / 删后 0；ledger=0 · account 入向 FK=0（无关联残留）· trg_account_guard 已复启 · NM2 漂移=0';
END
$ur_del9$;

-- ---------------------------------------------------------------- 步骤 3：31 × FK → DEFERRABLE INITIALLY IMMEDIATE
ALTER TABLE public.admin_ops_audit_log    ALTER CONSTRAINT admin_ops_audit_log_actor_fk      DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.admin_ops_audit_log    ALTER CONSTRAINT admin_ops_audit_log_target_fk     DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_actor_fk   DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_buyer_fk   DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_seller_fk  DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.admin_user_role        ALTER CONSTRAINT admin_user_role_uid_fk            DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.checkin_log            ALTER CONSTRAINT checkin_log_uid_fk                DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.checkin_makeup_log     ALTER CONSTRAINT checkin_makeup_log_uid_fk         DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.conversation           ALTER CONSTRAINT conversation_buyer_fk             DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.conversation           ALTER CONSTRAINT conversation_seller_fk            DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.currency_review_log    ALTER CONSTRAINT currency_review_log_actor_fk      DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.currency_status_log    ALTER CONSTRAINT currency_status_log_actor_fk      DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing                ALTER CONSTRAINT listing_seller_fk                 DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing_favorite       ALTER CONSTRAINT listing_favorite_uid_fk           DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing_order          ALTER CONSTRAINT listing_order_buyer_fk            DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing_order          ALTER CONSTRAINT listing_order_seller_fk           DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing_order_event    ALTER CONSTRAINT listing_order_event_actor_fk      DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.listing_review_log     ALTER CONSTRAINT listing_review_log_actor_fk       DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.market_order           ALTER CONSTRAINT market_order_owner_fk             DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.market_trade           ALTER CONSTRAINT market_trade_taker_fk             DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.media                  ALTER CONSTRAINT media_owner_uid_fkey              DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.message                ALTER CONSTRAINT message_from_fk                   DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.project                ALTER CONSTRAINT project_owner_fk                  DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.project_wage_claim     ALTER CONSTRAINT project_wage_claim_uid_fk         DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.project_worker         ALTER CONSTRAINT project_worker_uid_fk             DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.rating                 ALTER CONSTRAINT rating_ratee_fk                   DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.rating                 ALTER CONSTRAINT rating_rater_fk                   DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.referral               ALTER CONSTRAINT referral_child_fk                 DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.referral               ALTER CONSTRAINT referral_parent_fk                DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.subtask_proof          ALTER CONSTRAINT subtask_proof_uid_fk              DEFERRABLE INITIALLY IMMEDIATE;
ALTER TABLE public.user_activity_hour     ALTER CONSTRAINT user_activity_hour_uid_fk         DEFERRABLE INITIALLY IMMEDIATE;

-- ---------------------------------------------------------------- 步骤 4：延迟校验（只对已 DEFERRABLE 的约束生效）
SET CONSTRAINTS ALL DEFERRED;

-- ---------------------------------------------------------------- 步骤 5：ur_map（单一映射源）+ ur_dir（方向投影）+ 基线快照
-- `ur_map` 是**唯一**映射源（§40.17.1 UR1-c）：PK(old_uid) + UNIQUE(new_uid) 在建表那一刻判死「非双射」。
-- `ON COMMIT DROP` ⇒ 不产生新表、不写 schema_migration、不留残留对象。
-- `down` 方向：本表由 `rollback.sh` 以同形 TEMP 表预置（`\copy` 自 `map.csv`），此处 `IF NOT EXISTS` 不重建。
CREATE TEMP TABLE IF NOT EXISTS ur_map (
  old_uid bigint PRIMARY KEY,
  new_uid bigint NOT NULL UNIQUE
) ON COMMIT DROP;

DO $ur_map$
DECLARE
  v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
  v_n int; v_nd int;
BEGIN
  IF v_up THEN
    -- UR1-a / UR1-b：真实号按 evm 定位（上闸已证 uid=970213）；其余 193 行按旧 uid 升序 ⇒ 1000, 1001, …
    INSERT INTO ur_map (old_uid, new_uid)
    SELECT uid,
           CASE WHEN uid = 970213 THEN 100100
                ELSE 1000 + (row_number() OVER (PARTITION BY (uid = 970213) ORDER BY uid) - 1)
           END
      FROM public.users;
  END IF;

  SELECT count(*), count(DISTINCT old_uid) + count(DISTINCT new_uid) INTO v_n, v_nd FROM ur_map;
  IF v_n <> 194 OR v_nd <> 388 THEN
    RAISE EXCEPTION 'UR-MAP FAILED: ur_map 行数 % ≠ 194 或 PK/UNIQUE 基数异常（% ；down 方向须由 rollback.sh 预置 194 行映射）', v_n, v_nd;
  END IF;

  -- down 方向：库内必须恰好是映射的 new_uid 集合（否则映射与库面不匹配 ⇒ 停止）
  IF NOT v_up THEN
    SELECT count(*) INTO v_n FROM public.users u WHERE NOT EXISTS (SELECT 1 FROM ur_map m WHERE m.new_uid = u.uid);
    IF v_n <> 0 THEN
      RAISE EXCEPTION 'UR-MAP FAILED: down 方向有 % 行 users.uid 不在 map.new_uid 内（映射与库面不匹配）', v_n;
    END IF;
  END IF;
END
$ur_map$;

-- 方向投影：up = (old → new)；down = (new → old)。映射真源仍是 ur_map（此处只是方向解引用，便于 40+ 条 UPDATE 同一写法）。
CREATE TEMP TABLE IF NOT EXISTS ur_dir (from_uid bigint PRIMARY KEY, to_uid bigint NOT NULL UNIQUE) ON COMMIT DROP;
DELETE FROM ur_dir;
INSERT INTO ur_dir (from_uid, to_uid)
SELECT CASE WHEN coalesce(current_setting('ur.direction', true), 'up') = 'up' THEN old_uid ELSE new_uid END,
       CASE WHEN coalesce(current_setting('ur.direction', true), 'up') = 'up' THEN new_uid ELSE old_uid END
  FROM ur_map;

-- 基线快照（**任何写之前**）：供 UR9-1/5②/6②/7b/8/12/14 与序列回卷目标逐值对拍。
CREATE TEMP TABLE IF NOT EXISTS ur_base (k text PRIMARY KEY, v text) ON COMMIT DROP;
TRUNCATE ur_base;

DO $ur_base$
DECLARE
  v_tab text[] := ARRAY['users','ledger_entry','account','batt_entry','batt_account',
                        'admin_ops_audit_log','admin_refund_audit_log','admin_user_role','checkin_log',
                        'checkin_makeup_log','conversation','currency_review_log','currency_status_log',
                        'listing','listing_favorite','listing_order','listing_order_event',
                        'listing_review_log','market_order','market_trade','media','message',
                        'project','project_wage_claim','project_worker','rating','referral',
                        'subtask_proof','user_activity_hour','listing_edit_log','campaign_task_reward_pending'];
  v_t text; v_n bigint; v_s text; v_last bigint; v_called boolean; v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
BEGIN
  INSERT INTO ur_base VALUES ('direction', coalesce(current_setting('ur.direction', true), 'up'));

  -- 行数（逐表；UR9-5② 逐表对拍基准）
  FOREACH v_t IN ARRAY v_tab LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', v_t) INTO v_n;
    INSERT INTO ur_base VALUES ('cnt:' || v_t, v_n::text);
  END LOOP;

  -- users 非 uid 列 md5（UR9-14：只改身份键的唯一机器证明；按 evm 排序，避免用被改列排序）
  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', evm, coalesce(bio,'∅'), is_admin::text, time_reg::text, time_login_last::text,
                     coalesce(tg_user_id::text,'∅'), coalesce(tg_linked_at::text,'∅'), coalesce(avatar_url,'∅')) AS x
      FROM public.users) s;
  INSERT INTO ur_base VALUES ('md5:users_nouid', coalesce(v_s, ''));

  -- ledger_entry 非 uid 列 md5 + Σdelta / Σfrozen_delta 按 cid（UR9-6②/14）
  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', txid::text, cid::text, delta::text, frozen_delta::text, balance_after::text,
                     frozen_after::text, kind, coalesce(ref_type,'∅'), coalesce(ref_id::text,'∅'),
                     coalesce(idempotency_key,'∅'), coalesce(request_fingerprint,'∅'),
                     coalesce(reversal_of_txid::text,'∅'), coalesce(memo,'∅'), time_created::text,
                     coalesce(event_root_key,'∅')) AS x
      FROM public.ledger_entry) s;
  INSERT INTO ur_base VALUES ('md5:ledger_nouid', coalesce(v_s, ''));
  SELECT string_agg(cid::text || '=' || delta::text || '/' || frz::text, ',' ORDER BY cid) INTO v_s
    FROM (SELECT cid, sum(delta) AS delta, sum(frozen_delta) AS frz FROM public.ledger_entry GROUP BY cid) s;
  INSERT INTO ur_base VALUES ('sum:ledger_by_cid', coalesce(v_s, ''));
  SELECT string_agg(kind || '=' || delta::text, ',' ORDER BY kind) INTO v_s
    FROM (SELECT kind, sum(delta) AS delta FROM public.ledger_entry GROUP BY kind) s;
  INSERT INTO ur_base VALUES ('sum:ledger_by_kind', coalesce(v_s, ''));

  -- account 非 uid 列 md5 + uid<=0 行数（UR9-8）+ cid=399 行数（UR9-16 防误删相邻行；
  --   ★ 本基线在步骤 2c 删除**之后**捕获，故已扣掉那 9 行）
  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', cid::text, balance::text, frozen::text, version::text,
                     time_created::text, time_updated::text) AS x
      FROM public.account) s;
  INSERT INTO ur_base VALUES ('md5:account_nouid', coalesce(v_s, ''));
  SELECT count(*) INTO v_n FROM public.account WHERE cid = 399;
  INSERT INTO ur_base VALUES ('cnt:account_cid399', v_n::text);
  SELECT count(*) INTO v_n FROM public.account WHERE uid <= 0;
  INSERT INTO ur_base VALUES ('cnt:account_plat', v_n::text);
  SELECT count(*) INTO v_n FROM public.ledger_entry WHERE uid < 0;
  INSERT INTO ur_base VALUES ('cnt:ledger_neg', v_n::text);
  SELECT string_agg(uid::text, ',' ORDER BY uid) INTO v_s FROM public.ledger_owner;
  INSERT INTO ur_base VALUES ('set:ledger_owner_uids', coalesce(v_s, ''));

  -- 漂移基线（UR9-7b：平台/孤儿行（uid ∉ 映射集）的**既有**漂移必须逐值不变，不由本迁移制造）
  SELECT count(*) INTO v_n FROM public.account a
   WHERE ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)
     AND a.uid NOT IN (SELECT to_uid FROM ur_dir);
  INSERT INTO ur_base VALUES ('cnt:drift_outside', v_n::text);

  -- 触发器基线（UR9-10）+ FK 可延迟性基线（UR9-12）
  SELECT string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) INTO v_s FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = ANY (ARRAY['trg_ledger_entry_append_only','trg_referral_append_only',
     'trg_market_trade_append_only','trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only',
     'trg_admin_refund_audit_log_append_only','trg_currency_review_log_append_only','trg_listing_review_log_append_only',
     'trg_checkin_log_append_only','trg_checkin_makeup_log_append_only','trg_rating_append_only',
     'trg_listing_order_event_append_only','trg_listing_edit_log_append_only','trg_batt_entry_append_only']);
  INSERT INTO ur_base VALUES ('trg:14', coalesce(v_s, ''));
  -- FK 基线：取自 UR-PRE-7 的**迁移前** GUC（此时 31 FK 已被步骤 3 改成 DEFERRABLE，现取会得到错误基准）
  INSERT INTO ur_base VALUES ('fk:31', coalesce(current_setting('ur.fk_baseline', true), ''));

  -- 序列基线（UR9-11 与 §40.17.7 B 回滚回卷目标）
  EXECUTE 'SELECT last_value, is_called FROM public.users_uid_seq' INTO v_last, v_called;
  INSERT INTO ur_base VALUES ('seq:last_value', v_last::text);
  INSERT INTO ur_base VALUES ('seq:is_called', v_called::text);
  INSERT INTO ur_base VALUES ('seq:next', (CASE WHEN v_called THEN v_last + 1 ELSE v_last END)::text);

  -- 真实账号非 uid 列（UR9-4 逐字对拍）
  SELECT lower(evm) || '#' || is_admin::text INTO v_s FROM public.users
   WHERE lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
  INSERT INTO ur_base VALUES ('real:evm_admin', coalesce(v_s, ''));

  -- app_config.updated_by 读数（§40.17.2 B / DL78：**不改写**，但须如实出读数）
  SELECT count(*) INTO v_n FROM public.app_config
   WHERE updated_by IN (SELECT CASE WHEN v_up THEN old_uid ELSE new_uid END FROM ur_map);
  INSERT INTO ur_base VALUES ('appcfg:hits', v_n::text);

  -- `UR-NOTE-touch` 基线：既有 touch 触发器会把 time_updated 刷成 now()（非 uid 列副作用，登记不消除）
  INSERT INTO ur_base VALUES ('touch:listing',
    (SELECT md5(string_agg(listing_id::text || '@' || time_updated::text, '|' ORDER BY listing_id)) FROM public.listing));
  INSERT INTO ur_base VALUES ('touch:listing_order',
    (SELECT md5(string_agg(order_id::text || '@' || time_updated::text, '|' ORDER BY order_id)) FROM public.listing_order));
  INSERT INTO ur_base VALUES ('touch:market_order',
    (SELECT md5(string_agg(order_id::text || '@' || time_updated::text, '|' ORDER BY order_id)) FROM public.market_order));
  INSERT INTO ur_base VALUES ('touch:project',
    (SELECT md5(string_agg(project_id::text || '@' || time_updated::text, '|' ORDER BY project_id)) FROM public.project));
  INSERT INTO ur_base VALUES ('touch:batt_account',
    (SELECT md5(string_agg(uid::text || '@' || time_updated::text, '|' ORDER BY uid)) FROM public.batt_account));
END
$ur_base$;

-- ---------------------------------------------------------------- 步骤 6：users 相 1（整体推到回收区 +10^7）
-- 旧段 ≤ 997295、新段 ≤ 100100 ⇒ +10^7 后区间 [10,000,001, 10,997,295] 与二者均不相交（§40.17.3 D）。
-- 不得改用负数回收（负号段属平台保留，且 CHECK uid > 0 会判死）。
UPDATE public.users SET uid = uid + 10000000;

-- ---------------------------------------------------------------- 步骤 7：users 相 2（落终值）
UPDATE public.users u
   SET uid = d.to_uid
  FROM ur_dir d
 WHERE u.uid = d.from_uid + 10000000;

-- ---------------------------------------------------------------- 步骤 8：A 类 31 列逐列 UPDATE（每列一条，便于逐列 count 对拍 UR9-5）
UPDATE public.admin_ops_audit_log    t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.admin_ops_audit_log    t SET target_uid = d.to_uid FROM ur_dir d WHERE t.target_uid = d.from_uid;
UPDATE public.admin_refund_audit_log t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.admin_refund_audit_log t SET buyer_uid  = d.to_uid FROM ur_dir d WHERE t.buyer_uid  = d.from_uid;
UPDATE public.admin_refund_audit_log t SET seller_uid = d.to_uid FROM ur_dir d WHERE t.seller_uid = d.from_uid;
UPDATE public.admin_user_role        t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.checkin_log            t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.checkin_makeup_log     t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.conversation           t SET buyer_uid  = d.to_uid FROM ur_dir d WHERE t.buyer_uid  = d.from_uid;
UPDATE public.conversation           t SET seller_uid = d.to_uid FROM ur_dir d WHERE t.seller_uid = d.from_uid;
UPDATE public.currency_review_log    t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.currency_status_log    t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.listing                t SET seller_uid = d.to_uid FROM ur_dir d WHERE t.seller_uid = d.from_uid;
UPDATE public.listing_favorite       t SET fav_uid    = d.to_uid FROM ur_dir d WHERE t.fav_uid    = d.from_uid;
UPDATE public.listing_order          t SET buyer_uid  = d.to_uid FROM ur_dir d WHERE t.buyer_uid  = d.from_uid;
UPDATE public.listing_order          t SET seller_uid = d.to_uid FROM ur_dir d WHERE t.seller_uid = d.from_uid;
UPDATE public.listing_order_event    t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.listing_review_log     t SET actor_uid  = d.to_uid FROM ur_dir d WHERE t.actor_uid  = d.from_uid;
UPDATE public.market_order           t SET owner_uid  = d.to_uid FROM ur_dir d WHERE t.owner_uid  = d.from_uid;
UPDATE public.market_trade           t SET taker_uid  = d.to_uid FROM ur_dir d WHERE t.taker_uid  = d.from_uid;
UPDATE public.media                  t SET owner_uid  = d.to_uid FROM ur_dir d WHERE t.owner_uid  = d.from_uid;
UPDATE public.message                t SET from_uid   = d.to_uid FROM ur_dir d WHERE t.from_uid   = d.from_uid;
UPDATE public.project                t SET owner_uid  = d.to_uid FROM ur_dir d WHERE t.owner_uid  = d.from_uid;
UPDATE public.project_wage_claim     t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.project_worker         t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.rating                 t SET ratee_uid  = d.to_uid FROM ur_dir d WHERE t.ratee_uid  = d.from_uid;
UPDATE public.rating                 t SET rater_uid  = d.to_uid FROM ur_dir d WHERE t.rater_uid  = d.from_uid;
UPDATE public.referral               t SET child_uid  = d.to_uid FROM ur_dir d WHERE t.child_uid  = d.from_uid;
UPDATE public.referral               t SET parent_uid = d.to_uid FROM ur_dir d WHERE t.parent_uid = d.from_uid;
UPDATE public.subtask_proof          t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;
UPDATE public.user_activity_hour     t SET uid        = d.to_uid FROM ur_dir d WHERE t.uid        = d.from_uid;

-- ---------------------------------------------------------------- 步骤 9：ledger_entry **再** account（顺序不可换）
-- ★ `trg_account_guard`（0001:130-163）在 UPDATE account 时去查「该 uid/cid 的最新 ledger_entry」：
--   ledger 未先改 ⇒ `last_bal IS NULL` ⇒ `P0001 account update without any ledger_entry`；快照不等 ⇒ 另一条 P0001。
--   两表**均无 FK**（§40.17.2 B，R21 既有裁定）⇒ 漏改不会报错，只会延时爆炸；`UR9-6`/`UR9-7` 是唯一当场判据。
UPDATE public.ledger_entry t SET uid = d.to_uid FROM ur_dir d WHERE t.uid = d.from_uid;
UPDATE public.account      t SET uid = d.to_uid FROM ur_dir d WHERE t.uid = d.from_uid;

-- ---------------------------------------------------------------- 步骤 10：B 类其余（无 FK 面，逐表）
-- `batt_account` 必须在步骤 7 之后（`trg_batt_account_user_fk` 是 BEFORE UPDATE OF uid，要能在 users 里查到新号）；
-- 该守卫**保持启用**（关掉即 §40.17.4 UR4-d 判负）。
UPDATE public.batt_entry   t SET uid = d.to_uid FROM ur_dir d WHERE t.uid = d.from_uid;
UPDATE public.batt_account t SET uid = d.to_uid FROM ur_dir d WHERE t.uid = d.from_uid;
UPDATE public.listing_edit_log t SET actor_uid = d.to_uid FROM ur_dir d WHERE t.actor_uid = d.from_uid;
UPDATE public.listing_edit_log t SET owner_uid = d.to_uid FROM ur_dir d WHERE t.owner_uid = d.from_uid;
UPDATE public.campaign_task_reward_pending t SET uid = d.to_uid FROM ur_dir d WHERE t.uid = d.from_uid;

-- ---------------------------------------------------------------- 步骤 11：主动引爆延迟校验（此刻全库已自洽 ⇒ 应全过）
SET CONSTRAINTS ALL IMMEDIATE;

-- ---------------------------------------------------------------- 步骤 12a：31 × FK 复原 → NOT DEFERRABLE
-- 必须在 `SET CONSTRAINTS ALL IMMEDIATE` **之后**（有 pending trigger events 时 PG 拒绝改 deferrability）。
ALTER TABLE public.admin_ops_audit_log    ALTER CONSTRAINT admin_ops_audit_log_actor_fk      NOT DEFERRABLE;
ALTER TABLE public.admin_ops_audit_log    ALTER CONSTRAINT admin_ops_audit_log_target_fk     NOT DEFERRABLE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_actor_fk   NOT DEFERRABLE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_buyer_fk   NOT DEFERRABLE;
ALTER TABLE public.admin_refund_audit_log ALTER CONSTRAINT admin_refund_audit_log_seller_fk  NOT DEFERRABLE;
ALTER TABLE public.admin_user_role        ALTER CONSTRAINT admin_user_role_uid_fk            NOT DEFERRABLE;
ALTER TABLE public.checkin_log            ALTER CONSTRAINT checkin_log_uid_fk                NOT DEFERRABLE;
ALTER TABLE public.checkin_makeup_log     ALTER CONSTRAINT checkin_makeup_log_uid_fk         NOT DEFERRABLE;
ALTER TABLE public.conversation           ALTER CONSTRAINT conversation_buyer_fk             NOT DEFERRABLE;
ALTER TABLE public.conversation           ALTER CONSTRAINT conversation_seller_fk            NOT DEFERRABLE;
ALTER TABLE public.currency_review_log    ALTER CONSTRAINT currency_review_log_actor_fk      NOT DEFERRABLE;
ALTER TABLE public.currency_status_log    ALTER CONSTRAINT currency_status_log_actor_fk      NOT DEFERRABLE;
ALTER TABLE public.listing                ALTER CONSTRAINT listing_seller_fk                 NOT DEFERRABLE;
ALTER TABLE public.listing_favorite       ALTER CONSTRAINT listing_favorite_uid_fk           NOT DEFERRABLE;
ALTER TABLE public.listing_order          ALTER CONSTRAINT listing_order_buyer_fk            NOT DEFERRABLE;
ALTER TABLE public.listing_order          ALTER CONSTRAINT listing_order_seller_fk           NOT DEFERRABLE;
ALTER TABLE public.listing_order_event    ALTER CONSTRAINT listing_order_event_actor_fk      NOT DEFERRABLE;
ALTER TABLE public.listing_review_log     ALTER CONSTRAINT listing_review_log_actor_fk       NOT DEFERRABLE;
ALTER TABLE public.market_order           ALTER CONSTRAINT market_order_owner_fk             NOT DEFERRABLE;
ALTER TABLE public.market_trade           ALTER CONSTRAINT market_trade_taker_fk             NOT DEFERRABLE;
ALTER TABLE public.media                  ALTER CONSTRAINT media_owner_uid_fkey              NOT DEFERRABLE;
ALTER TABLE public.message                ALTER CONSTRAINT message_from_fk                   NOT DEFERRABLE;
ALTER TABLE public.project                ALTER CONSTRAINT project_owner_fk                  NOT DEFERRABLE;
ALTER TABLE public.project_wage_claim     ALTER CONSTRAINT project_wage_claim_uid_fk         NOT DEFERRABLE;
ALTER TABLE public.project_worker         ALTER CONSTRAINT project_worker_uid_fk             NOT DEFERRABLE;
ALTER TABLE public.rating                 ALTER CONSTRAINT rating_ratee_fk                   NOT DEFERRABLE;
ALTER TABLE public.rating                 ALTER CONSTRAINT rating_rater_fk                   NOT DEFERRABLE;
ALTER TABLE public.referral               ALTER CONSTRAINT referral_child_fk                 NOT DEFERRABLE;
ALTER TABLE public.referral               ALTER CONSTRAINT referral_parent_fk                NOT DEFERRABLE;
ALTER TABLE public.subtask_proof          ALTER CONSTRAINT subtask_proof_uid_fk              NOT DEFERRABLE;
ALTER TABLE public.user_activity_hour     ALTER CONSTRAINT user_activity_hour_uid_fk         NOT DEFERRABLE;

-- ---------------------------------------------------------------- 步骤 12b：14 个触发器逐项 ENABLE（§40.17.4 D）
ALTER TABLE public.ledger_entry              ENABLE TRIGGER trg_ledger_entry_append_only;
ALTER TABLE public.referral                  ENABLE TRIGGER trg_referral_append_only;
ALTER TABLE public.market_trade              ENABLE TRIGGER trg_market_trade_append_only;
ALTER TABLE public.currency_status_log       ENABLE TRIGGER trg_currency_status_log_append_only;
ALTER TABLE public.admin_ops_audit_log       ENABLE TRIGGER trg_admin_ops_audit_log_append_only;
ALTER TABLE public.admin_refund_audit_log    ENABLE TRIGGER trg_admin_refund_audit_log_append_only;
ALTER TABLE public.currency_review_log       ENABLE TRIGGER trg_currency_review_log_append_only;
ALTER TABLE public.listing_review_log        ENABLE TRIGGER trg_listing_review_log_append_only;
ALTER TABLE public.checkin_log               ENABLE TRIGGER trg_checkin_log_append_only;
ALTER TABLE public.checkin_makeup_log        ENABLE TRIGGER trg_checkin_makeup_log_append_only;
ALTER TABLE public.rating                    ENABLE TRIGGER trg_rating_append_only;
ALTER TABLE public.listing_order_event       ENABLE TRIGGER trg_listing_order_event_append_only;
ALTER TABLE public.listing_edit_log          ENABLE TRIGGER trg_listing_edit_log_append_only;
ALTER TABLE public.batt_entry                ENABLE TRIGGER trg_batt_entry_append_only;

-- 步骤 12b-2（`UR-BLOCK-6`）：5 个非 append-only 写闸逐项 ENABLE + 逐项复核
ALTER TABLE public.admin_user_role ENABLE TRIGGER trg_admin_user_role_key_immutable;
ALTER TABLE public.conversation    ENABLE TRIGGER trg_conversation_read_mark_only;
ALTER TABLE public.message         ENABLE TRIGGER trg_message_no_update_or_delete;
ALTER TABLE public.listing_order   ENABLE TRIGGER trg_listing_order_core_immutable_guard;
ALTER TABLE public.market_order    ENABLE TRIGGER trg_market_order_core_immutable_guard;
DO $$
DECLARE v_n int; v_bad text;
BEGIN
  SELECT count(*) FILTER (WHERE tgenabled = 'O'),
         string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) FILTER (WHERE tgenabled <> 'O')
    INTO v_n, v_bad
    FROM pg_trigger WHERE NOT tgisinternal
     AND tgname = ANY (ARRAY['trg_admin_user_role_key_immutable','trg_conversation_read_mark_only',
                             'trg_message_no_update_or_delete','trg_listing_order_core_immutable_guard',
                             'trg_market_order_core_immutable_guard']);
  IF v_n <> 5 OR v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'UR9-10b FAILED（UR-BLOCK-6 收口）: 5 个额外写闸中 ''O'' 的 % 个，异常项：%', v_n, coalesce(v_bad, '<无>');
  END IF;
END $$;

-- ---------------------------------------------------------------- 步骤 12c：序列重启（§40.17.5：RESTART，非 setval）
-- up ⇒ `RESTART WITH 100101`（last_value=100101 / is_called=false ⇒ nextval 返回 100101）
-- down ⇒ `RESTART WITH <迁移前现取的下一个号>`（回卷目标取本事务基线 `seq:next`）
DO $ur_seq$
DECLARE
  v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
  v_target bigint;
BEGIN
  IF v_up THEN
    v_target := 100101;
  ELSE
    SELECT v::bigint INTO v_target FROM ur_base WHERE k = 'seq:next';
  END IF;
  EXECUTE format('ALTER TABLE public.users ALTER COLUMN uid RESTART WITH %s', v_target);
END
$ur_seq$;

-- ============================================================================
-- 步骤 12d：17 条判负（§40.17.9 `UR9-1..15` + 本轮 `UR9-16` / `UR9-17`）—— 全部在 COMMIT 之前；任一红 ⇒ 整体回滚
--   口径：`up` = 迁移前 → 迁移后；`down` = 回滚方向（同一断言的反向形态，映射真源仍是 ur_map）
-- ============================================================================

-- UR9-1 总行数不变（194 = 1 真实 + 193 mock；并表/误插会绕过 PK 层面的其它断言）
DO $$
DECLARE v_n bigint; v_b bigint;
BEGIN
  SELECT count(*) INTO v_n FROM public.users;
  SELECT v::bigint INTO v_b FROM ur_base WHERE k = 'cnt:users';
  IF v_n <> 194 OR v_n <> v_b THEN
    RAISE EXCEPTION 'UR9-1 FAILED: users 行数 % （期望 194，基线 %）', v_n, v_b;
  END IF;
END $$;

-- UR9-2 无重复 uid
DO $$
DECLARE v_n bigint; v_d bigint;
BEGIN
  SELECT count(*), count(DISTINCT uid) INTO v_n, v_d FROM public.users;
  IF v_n <> v_d THEN
    RAISE EXCEPTION 'UR9-2 FAILED: count(*)=% ≠ count(DISTINCT uid)=%', v_n, v_d;
  END IF;
END $$;

-- UR9-3 双射（双向 EXCEPT 为空 + 基数 194）
DO $$
DECLARE v_a bigint; v_b bigint; v_c bigint; v_n bigint;
BEGIN
  SELECT count(*) INTO v_a FROM (SELECT uid FROM public.users EXCEPT SELECT to_uid FROM ur_dir) x;
  SELECT count(*) INTO v_b FROM (SELECT to_uid FROM ur_dir EXCEPT SELECT uid FROM public.users) x;
  SELECT count(*), count(DISTINCT to_uid) INTO v_n, v_c FROM ur_dir;
  IF v_a <> 0 OR v_b <> 0 OR v_n <> 194 OR v_c <> 194 THEN
    RAISE EXCEPTION 'UR9-3 FAILED: 旧→新残留 % / 新→旧多余 % / ur_dir 基数 %（distinct %）', v_a, v_b, v_n, v_c;
  END IF;
END $$;

-- UR9-4 真实账号：uid 到位，且 evm / is_admin 与基线逐字相等（防 UPDATE 写宽）
DO $$
DECLARE v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
        v_expect bigint; v_uid bigint; v_txt text; v_base text;
BEGIN
  SELECT to_uid INTO v_expect FROM ur_dir
   WHERE from_uid = CASE WHEN v_up THEN 970213 ELSE 100100 END;
  SELECT uid, lower(evm) || '#' || is_admin::text INTO v_uid, v_txt
    FROM public.users WHERE lower(evm) = '0x59f9f640d15ebb053c94a816232cf8ce91b209b0';
  SELECT v INTO v_base FROM ur_base WHERE k = 'real:evm_admin';
  IF v_uid IS DISTINCT FROM v_expect THEN
    RAISE EXCEPTION 'UR9-4 FAILED: 真实账号 uid=%（期望 %）', v_uid, v_expect;
  END IF;
  IF v_txt IS DISTINCT FROM v_base THEN
    RAISE EXCEPTION 'UR9-4 FAILED: 真实账号非 uid 列被改：现值 % vs 基线 %', v_txt, v_base;
  END IF;
END $$;

-- UR9-5 A 类 31 列逐列：① 源号残留 = 0   ② count(*) 与基线逐表相等（必须逐列出读数，汇总会掩盖漏列）
DO $$
DECLARE
  v_tab text[] := ARRAY['admin_ops_audit_log','admin_ops_audit_log','admin_refund_audit_log','admin_refund_audit_log',
    'admin_refund_audit_log','admin_user_role','checkin_log','checkin_makeup_log','conversation','conversation',
    'currency_review_log','currency_status_log','listing','listing_favorite','listing_order','listing_order',
    'listing_order_event','listing_review_log','market_order','market_trade','media','message','project',
    'project_wage_claim','project_worker','rating','rating','referral','referral','subtask_proof','user_activity_hour'];
  v_col text[] := ARRAY['actor_uid','target_uid','actor_uid','buyer_uid','seller_uid','uid','uid','uid','buyer_uid',
    'seller_uid','actor_uid','actor_uid','seller_uid','fav_uid','buyer_uid','seller_uid','actor_uid','actor_uid',
    'owner_uid','taker_uid','owner_uid','from_uid','owner_uid','uid','uid','ratee_uid','rater_uid','child_uid',
    'parent_uid','uid','uid'];
  i int; v_res bigint; v_cnt bigint; v_base bigint;
BEGIN
  IF array_length(v_tab, 1) <> 31 OR array_length(v_col, 1) <> 31 THEN
    RAISE EXCEPTION 'UR9-5 FAILED: 断言表项数 ≠ 31（tab=% col=%）', array_length(v_tab,1), array_length(v_col,1);
  END IF;
  FOR i IN 1..31 LOOP
    EXECUTE format('SELECT count(*) FILTER (WHERE %I IN (SELECT from_uid FROM ur_dir)), count(*) FROM public.%I',
                   v_col[i], v_tab[i]) INTO v_res, v_cnt;
    IF v_res <> 0 THEN
      RAISE EXCEPTION 'UR9-5① FAILED: %.% 仍有 % 行指向旧号', v_tab[i], v_col[i], v_res;
    END IF;
    SELECT v::bigint INTO v_base FROM ur_base WHERE k = 'cnt:' || v_tab[i];
    IF v_cnt <> v_base THEN
      RAISE EXCEPTION 'UR9-5② FAILED: % 行数 % ≠ 基线 %（误删/误插）', v_tab[i], v_cnt, v_base;
    END IF;
  END LOOP;
END $$;

-- UR9-6 ledger_entry 与 account：① 源号残留 = 0  ② Σdelta / Σfrozen_delta（按 cid、按 kind）逐值不变  ③ 行数不变
DO $$
DECLARE v_res bigint; v_s text; v_b text; v_n bigint; v_bn bigint;
BEGIN
  SELECT count(*) FILTER (WHERE uid IN (SELECT from_uid FROM ur_dir)) INTO v_res FROM public.ledger_entry;
  IF v_res <> 0 THEN RAISE EXCEPTION 'UR9-6① FAILED: ledger_entry 仍有 % 行指向旧号', v_res; END IF;
  SELECT count(*) FILTER (WHERE uid IN (SELECT from_uid FROM ur_dir)) INTO v_res FROM public.account;
  IF v_res <> 0 THEN RAISE EXCEPTION 'UR9-6① FAILED: account 仍有 % 行指向旧号', v_res; END IF;

  SELECT string_agg(cid::text || '=' || delta::text || '/' || frz::text, ',' ORDER BY cid) INTO v_s
    FROM (SELECT cid, sum(delta) AS delta, sum(frozen_delta) AS frz FROM public.ledger_entry GROUP BY cid) s;
  SELECT v INTO v_b FROM ur_base WHERE k = 'sum:ledger_by_cid';
  IF v_s IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'UR9-6② FAILED: ledger Σ 按 cid 变了：现值 % vs 基线 %', v_s, v_b;
  END IF;
  SELECT string_agg(kind || '=' || delta::text, ',' ORDER BY kind) INTO v_s
    FROM (SELECT kind, sum(delta) AS delta FROM public.ledger_entry GROUP BY kind) s;
  SELECT v INTO v_b FROM ur_base WHERE k = 'sum:ledger_by_kind';
  IF v_s IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'UR9-6② FAILED: ledger Σ 按 kind 变了：现值 % vs 基线 %', v_s, v_b;
  END IF;

  SELECT count(*) INTO v_n FROM public.ledger_entry;
  SELECT v::bigint INTO v_bn FROM ur_base WHERE k = 'cnt:ledger_entry';
  IF v_n <> v_bn THEN RAISE EXCEPTION 'UR9-6③ FAILED: ledger_entry 行数 % ≠ 基线 %', v_n, v_bn; END IF;
  SELECT count(*) INTO v_n FROM public.account;
  SELECT v::bigint INTO v_bn FROM ur_base WHERE k = 'cnt:account';
  IF v_n <> v_bn THEN RAISE EXCEPTION 'UR9-6③ FAILED: account 行数 % ≠ 基线 %', v_n, v_bn; END IF;
END $$;

-- UR9-7 账本快照与账户一致（= trg_account_guard 判据的全表化）
--   7a（硬判，**spec 本体**）：**本轮被改号的** account 行（uid ∈ ur_dir.to）漂移必须为 0
--       —— 这是唯一能在提交前抓住「步骤 9 先改 account 或 ledger 漏改」的断言。
--   7b（登记，**基线口径**）：映射集之外的既有漂移（平台 uid<=0 行 / 孤儿行 uid ∉ users）必须**逐值等于基线**，
--       不得由本迁移制造 —— 现盘基线见 `readings/preflight.json` 的 `drift_outside`（不为 0 属既有数据面问题，登记不消除）。
DO $$
DECLARE v_a bigint; v_b bigint; v_base bigint; v_txt text;
BEGIN
  SELECT count(*) INTO v_a FROM public.account a
   WHERE a.uid IN (SELECT to_uid FROM ur_dir)
     AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1);
  IF v_a <> 0 THEN
    SELECT string_agg(x.uid::text || '/' || x.cid::text, ',' ORDER BY x.uid) INTO v_txt FROM (
      SELECT a.uid, a.cid FROM public.account a
       WHERE a.uid IN (SELECT to_uid FROM ur_dir)
         AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
               SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
                WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)) x;
    RAISE EXCEPTION 'UR9-7a FAILED: 本轮改号的 account 有 % 行与最新 ledger 快照不一致（步骤 9 错序 / ledger 漏改）：%', v_a, v_txt;
  END IF;

  SELECT count(*) INTO v_b FROM public.account a
   WHERE a.uid NOT IN (SELECT to_uid FROM ur_dir)
     AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
           SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
            WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1);
  SELECT v::bigint INTO v_base FROM ur_base WHERE k = 'cnt:drift_outside';
  IF v_b <> v_base THEN
    RAISE EXCEPTION 'UR9-7b FAILED: 映射集之外的漂移行 % ≠ 基线 %（本迁移不得改变既有漂移）', v_b, v_base;
  END IF;
END $$;

-- UR9-8 平台保留 uid 未被改（`UPDATE` 少了 `JOIN ur_dir` 会把平台号一起改 —— 灾难级）
DO $$
DECLARE v_set text; v_b text; v_n bigint; v_bn bigint;
BEGIN
  SELECT string_agg(uid::text, ',' ORDER BY uid) INTO v_set FROM public.ledger_owner;
  SELECT v INTO v_b FROM ur_base WHERE k = 'set:ledger_owner_uids';
  IF v_set IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'UR9-8 FAILED: ledger_owner.uid 集合 % ≠ 基线 %', v_set, v_b;
  END IF;
  SELECT count(*) INTO v_n FROM public.account WHERE uid <= 0;
  SELECT v::bigint INTO v_bn FROM ur_base WHERE k = 'cnt:account_plat';
  IF v_n <> v_bn THEN RAISE EXCEPTION 'UR9-8 FAILED: account 平台行 % ≠ 基线 %', v_n, v_bn; END IF;
  SELECT count(*) INTO v_n FROM public.ledger_entry WHERE uid < 0;
  SELECT v::bigint INTO v_bn FROM ur_base WHERE k = 'cnt:ledger_neg';
  IF v_n <> v_bn THEN RAISE EXCEPTION 'UR9-8 FAILED: ledger_entry uid<0 行 % ≠ 基线 %', v_n, v_bn; END IF;
END $$;

-- UR9-9 非 FK 面按登记口径处理（无 FK 兜底 ⇒ 漏改即孤儿行，且当场不会报错）
DO $$
DECLARE v_tab text[] := ARRAY['batt_entry','batt_account','listing_edit_log','listing_edit_log','campaign_task_reward_pending'];
        v_col text[] := ARRAY['uid','uid','actor_uid','owner_uid','uid'];
        i int; v_res bigint;
BEGIN
  FOR i IN 1..array_length(v_tab, 1) LOOP
    EXECUTE format('SELECT count(*) FILTER (WHERE %I IN (SELECT from_uid FROM ur_dir)) FROM public.%I',
                   v_col[i], v_tab[i]) INTO v_res;
    IF v_res <> 0 THEN
      RAISE EXCEPTION 'UR9-9 FAILED: %.% 残留旧号 % 行（B 类漏改 ⇒ 孤儿行）', v_tab[i], v_col[i], v_res;
    END IF;
  END LOOP;
END $$;

-- UR9-10 14 个触发器逐项 tgenabled='O'（只 ENABLE 不复核 / A|R 冒充 ⇒ 判负）
DO $$
DECLARE v_n int; v_txt text; v_b text;
BEGIN
  SELECT count(*), string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) INTO v_n, v_txt
    FROM pg_trigger WHERE NOT tgisinternal
     AND tgname = ANY (ARRAY['trg_ledger_entry_append_only','trg_referral_append_only','trg_market_trade_append_only',
       'trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only','trg_admin_refund_audit_log_append_only',
       'trg_currency_review_log_append_only','trg_listing_review_log_append_only','trg_checkin_log_append_only',
       'trg_checkin_makeup_log_append_only','trg_rating_append_only','trg_listing_order_event_append_only',
       'trg_listing_edit_log_append_only','trg_batt_entry_append_only'])
     AND tgenabled = 'O';
  IF v_n <> 14 THEN
    SELECT string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) INTO v_b FROM pg_trigger
     WHERE NOT tgisinternal AND tgname LIKE 'trg_%_append_only';
    RAISE EXCEPTION 'UR9-10 FAILED: 14 个触发器中 tgenabled=''O'' 的 % 个（现值：%）', v_n, coalesce(v_b, '<空>');
  END IF;
END $$;

-- UR9-11 序列下一号（**禁止** nextval 探针 —— 会真烧号，§40.17.5 E）
DO $$
DECLARE v_last bigint; v_called boolean; v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
        v_exp_last bigint; v_exp_called boolean;
BEGIN
  EXECUTE 'SELECT last_value, is_called FROM public.users_uid_seq' INTO v_last, v_called;
  IF v_up THEN
    v_exp_last := 100101; v_exp_called := false;
  ELSE
    SELECT v::bigint INTO v_exp_last FROM ur_base WHERE k = 'seq:next';
    v_exp_called := false;
  END IF;
  IF v_last IS DISTINCT FROM v_exp_last OR v_called IS DISTINCT FROM v_exp_called THEN
    RAISE EXCEPTION 'UR9-11 FAILED: users_uid_seq = %/%（期望 %/%）', v_last, v_called, v_exp_last, v_exp_called;
  END IF;
END $$;

-- UR9-12 31 个 FK 可延迟性已复原（留 INITIALLY DEFERRED ⇒ 全站 FK 校验点静默后移）
DO $$
DECLARE v_txt text; v_b text; v_n int;
BEGIN
  SELECT string_agg(c.conname || '=' || c.condeferrable::text || '/' || c.condeferred::text, ',' ORDER BY c.conname) INTO v_txt
    FROM pg_constraint c WHERE c.contype = 'f' AND c.confrelid = 'public.users'::regclass;
  SELECT v INTO v_b FROM ur_base WHERE k = 'fk:31';
  IF v_txt IS DISTINCT FROM v_b THEN
    RAISE EXCEPTION 'UR9-12 FAILED: 31 FK 可延迟性没复原：现值 % vs 基线 %', v_txt, v_b;
  END IF;
  SELECT count(*) INTO v_n FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.users'::regclass;
  IF v_n <> 31 THEN
    RAISE EXCEPTION 'UR9-12 FAILED: 活的 users FK 数 % ≠ 31', v_n;
  END IF;
END $$;

-- UR9-13 无新号段污染（回收区无残留；up 方向且不得出现 uid >= 100101 的新注册）
DO $$
DECLARE v_n bigint; v_up boolean := coalesce(current_setting('ur.direction', true), 'up') = 'up';
BEGIN
  SELECT count(*) INTO v_n FROM public.users WHERE uid >= 10000000;
  IF v_n <> 0 THEN RAISE EXCEPTION 'UR9-13 FAILED: 回收区（uid >= 10^7）残留 % 行', v_n; END IF;
  IF v_up THEN
    SELECT count(*) INTO v_n FROM public.users WHERE uid >= 100101;
    IF v_n <> 0 THEN RAISE EXCEPTION 'UR9-13 FAILED: 出现 uid >= 100101 的行 % 行（静默窗被穿透）', v_n; END IF;
  END IF;
END $$;

-- UR9-14 只改了 uid 列（users / ledger_entry / account 的非 uid 列 md5 与基线逐字相等 = 「只改身份键」的唯一机器证明）
--        另如实出 `app_config.updated_by` 读数（§40.17.2 B / DL78：**不改写**）
DO $$
DECLARE v_s text; v_b text; v_n bigint;
BEGIN
  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', evm, coalesce(bio,'∅'), is_admin::text, time_reg::text, time_login_last::text,
                     coalesce(tg_user_id::text,'∅'), coalesce(tg_linked_at::text,'∅'), coalesce(avatar_url,'∅')) AS x
      FROM public.users) s;
  SELECT v INTO v_b FROM ur_base WHERE k = 'md5:users_nouid';
  IF v_s IS DISTINCT FROM v_b THEN RAISE EXCEPTION 'UR9-14 FAILED: users 非 uid 列 md5 % ≠ 基线 %', v_s, v_b; END IF;

  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', txid::text, cid::text, delta::text, frozen_delta::text, balance_after::text,
                     frozen_after::text, kind, coalesce(ref_type,'∅'), coalesce(ref_id::text,'∅'),
                     coalesce(idempotency_key,'∅'), coalesce(request_fingerprint,'∅'),
                     coalesce(reversal_of_txid::text,'∅'), coalesce(memo,'∅'), time_created::text,
                     coalesce(event_root_key,'∅')) AS x
      FROM public.ledger_entry) s;
  SELECT v INTO v_b FROM ur_base WHERE k = 'md5:ledger_nouid';
  IF v_s IS DISTINCT FROM v_b THEN RAISE EXCEPTION 'UR9-14 FAILED: ledger_entry 非 uid 列 md5 % ≠ 基线 %', v_s, v_b; END IF;

  SELECT md5(string_agg(x, '|' ORDER BY x)) INTO v_s FROM (
    SELECT concat_ws('|', cid::text, balance::text, frozen::text, version::text,
                     time_created::text, time_updated::text) AS x
      FROM public.account) s;
  SELECT v INTO v_b FROM ur_base WHERE k = 'md5:account_nouid';
  IF v_s IS DISTINCT FROM v_b THEN RAISE EXCEPTION 'UR9-14 FAILED: account 非 uid 列 md5 % ≠ 基线 %', v_s, v_b; END IF;

  SELECT count(*) INTO v_n FROM public.app_config
   WHERE updated_by IN (SELECT from_uid FROM ur_dir);
  SELECT v::bigint INTO v_b FROM ur_base WHERE k = 'appcfg:hits';
  IF v_n <> v_b::bigint THEN
    RAISE EXCEPTION 'UR9-14 FAILED: app_config.updated_by 命中旧号读数 % ≠ 基线 %（该列按 DL78 不改写，但必须如实出读数）', v_n, v_b;
  END IF;
  RAISE NOTICE 'UR9-14 app_config.updated_by 命中迁移集读数 = % 行（DL78：不改写）', v_n;
END $$;

-- UR9-15 batt_account 守卫仍活着且已过（关守卫即 UR4-d 判负；改 uid 但 users 没跟上 ⇒ 孤儿）
DO $$
DECLARE v_n int; v_orph bigint;
BEGIN
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = 'trg_batt_account_user_fk' AND tgenabled = 'O';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'UR9-15 FAILED: trg_batt_account_user_fk 未保持启用（命中 % 行）', v_n;
  END IF;
  SELECT count(*) INTO v_orph FROM public.batt_account b
   WHERE b.uid <> 0 AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.uid = b.uid);
  IF v_orph <> 0 THEN
    RAISE EXCEPTION 'UR9-15 FAILED: batt_account 有 % 行挂在不存在的 uid 上（守卫被绕过或 users 没跟上）', v_orph;
  END IF;
END $$;

-- UR9-16 授权删除的 9 行 mock 余额**确已不存在**（步骤 2c 的唯一终态证明；防「DELETE 被跳过 / 谓词写窄」）
--   口径：`uid IN (9 uids)` 在 `account` 上必须 0 行；且全表 `cid=399 AND balance=40 AND frozen=0` 的
--   「9 uid 之外」的行数必须等于基线（防误删相邻 mock 行）；这 9 个 uid 的 ledger 必须仍为 0（删账户不得删账本）。
DO $$
DECLARE
  v_left bigint; v_ledger bigint; v_cid399 bigint; v_bn bigint;
  v_uids bigint[] := ARRAY[971469,971591,976489,979689,981486,983264,987867,988363,988399];
BEGIN
  SELECT count(*) INTO v_left FROM public.account WHERE uid = ANY (v_uids);
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'UR9-16 FAILED: 那 9 行 account 仍有 % 行存在（步骤 2c 未执行或谓词不匹配）', v_left;
  END IF;

  SELECT count(*) INTO v_ledger FROM public.ledger_entry WHERE uid = ANY (v_uids);
  IF v_ledger <> 0 THEN
    RAISE EXCEPTION 'UR9-16 FAILED: 删除账户却动了账本：这 9 个 uid 的 ledger_entry = % 行（应恒为 0）', v_ledger;
  END IF;

  -- 相邻 mock 行不得被误删：cid=399 的 account 行数必须等于基线（基线在步骤 5 捕获，已含本步删除）
  SELECT count(*) INTO v_cid399 FROM public.account WHERE cid = 399;
  SELECT v::bigint INTO v_bn FROM ur_base WHERE k = 'cnt:account_cid399';
  IF v_bn IS NULL OR v_cid399 <> v_bn THEN
    RAISE EXCEPTION 'UR9-16 FAILED: account(cid=399) 行数 % ≠ 基线 %（删 9 行之外的相邻行被动了）', v_cid399, coalesce(v_bn::text, '<缺失>');
  END IF;
END $$;

-- UR9-17 19 个守卫（14 append-only + 5 写闸）全部 tgenabled='O'（本迁移关过的东西一件都没留在关闭态）
DO $$
DECLARE v_n int; v_bad text;
BEGIN
  SELECT count(*) FILTER (WHERE tgenabled = 'O'),
         string_agg(tgname || '=' || tgenabled::text, ',' ORDER BY tgname) FILTER (WHERE tgenabled <> 'O')
    INTO v_n, v_bad
    FROM pg_trigger WHERE NOT tgisinternal
     AND tgname = ANY (ARRAY['trg_ledger_entry_append_only','trg_referral_append_only','trg_market_trade_append_only',
       'trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only','trg_admin_refund_audit_log_append_only',
       'trg_currency_review_log_append_only','trg_listing_review_log_append_only','trg_checkin_log_append_only',
       'trg_checkin_makeup_log_append_only','trg_rating_append_only','trg_listing_order_event_append_only',
       'trg_listing_edit_log_append_only','trg_batt_entry_append_only',
       'trg_admin_user_role_key_immutable','trg_conversation_read_mark_only','trg_message_no_update_or_delete',
       'trg_listing_order_core_immutable_guard','trg_market_order_core_immutable_guard']);
  IF v_n <> 19 OR v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'UR9-17 FAILED: 19 个守卫中 tgenabled=''O'' 的只 % 个，异常项：%', v_n, coalesce(v_bad, '<无>');
  END IF;
  -- 账本守卫在同一断言里单独复核（它只在步骤 2c 短暂关闭过）
  SELECT count(*) INTO v_n FROM pg_trigger
   WHERE NOT tgisinternal AND tgname = 'trg_account_guard' AND tgenabled = 'O';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'UR9-17 FAILED: trg_account_guard 未处于启用态（步骤 2c 关过它，必须复启）';
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE '0076 uid renumber: 12 steps + 17 judgments all green (direction=%)', coalesce(current_setting('ur.direction', true), 'up');
END $$;
