/**
 * P9⑤ 库面只读探针（Jing · 规范方·只读）—— 不入 scripts/ 扫面根。
 * 目的：现取 commission_policy 活体行 + 相关约束 / 触发器 / referral / app_config 键面。
 * 只读：仅 SELECT / 目录查询；不写库、不建表。
 */
import { readQuery, closePools } from '../src/db';

(async () => {
  const out: Record<string, unknown> = {};
  try {
    out.schema_version = await readQuery<{ v: string | null }>(
      'SELECT (SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1) AS v');

    // ① commission_policy 活体行（全列）—— 现行政策真源
    out.commission_policy_rows = await readQuery(
      `SELECT policy_id::text, fee_rate_bp, levels,
              weights_bp::text AS weights_bp,
              effective_from::text, created_by::text, time_created::text
         FROM public.commission_policy ORDER BY effective_from DESC`);

    // ② commission_policy 列定义（现取 DDL 实态）
    out.commission_policy_cols = await readQuery(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='commission_policy'
        ORDER BY ordinal_position`);

    // ③ commission_policy 约束（CHECK / UNIQUE / PK）
    out.commission_policy_constraints = await readQuery(
      `SELECT conname, contype, pg_get_constraintdef(oid) AS def
         FROM pg_constraint
        WHERE conrelid='public.commission_policy'::regclass
        ORDER BY conname`);

    // ④ commission_policy 触发器 + 函数
    out.commission_policy_triggers = await readQuery(
      `SELECT tgname, pg_get_triggerdef(oid) AS def
         FROM pg_trigger
        WHERE tgrelid='public.commission_policy'::regclass AND NOT tgisinternal
        ORDER BY tgname`);

    // ⑤ referral 表结构 + 触发器（方向性：只向上）
    out.referral_cols = await readQuery(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='referral'
        ORDER BY ordinal_position`);
    out.referral_constraints = await readQuery(
      `SELECT conname, contype, pg_get_constraintdef(oid) AS def
         FROM pg_constraint WHERE conrelid='public.referral'::regclass ORDER BY conname`);
    out.referral_triggers = await readQuery(
      `SELECT tgname, pg_get_triggerdef(oid) AS def
         FROM pg_trigger WHERE tgrelid='public.referral'::regclass AND NOT tgisinternal ORDER BY tgname`);
    out.referral_live_rows = await readQuery<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.referral');

    // ⑥ ledger_entry 上的佣金守恒断言触发器（DB 后置断言口径）
    out.ledger_entry_commission_triggers = await readQuery(
      `SELECT tgname, pg_get_triggerdef(oid) AS def
         FROM pg_trigger
        WHERE tgrelid='public.ledger_entry'::regclass AND NOT tgisinternal
          AND tgname LIKE '%commission%' ORDER BY tgname`);

    // ⑦ ledger_kind_enum 现取（关闭集）
    out.ledger_kind_enum = await readQuery<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='ledger_kind_enum'`);

    // ⑧ app_config 键面（邀请奖励 / 权重配比 / 层级权重 相关键）
    out.app_config_keys = await readQuery<{ key: string }>(
      `SELECT key FROM public.app_config ORDER BY key`);

    // ⑨ users 行数 + account −1/−2 存在性（守恒池方）
    out.users_count = await readQuery<{ n: number }>('SELECT count(*)::int AS n FROM public.users');
    out.minus1_minus2 = await readQuery(
      `SELECT uid::text, count(*)::int AS n FROM public.account WHERE uid IN (-1,-2) GROUP BY uid ORDER BY uid`);
  } catch (e) {
    out.ERROR = (e as Error).message;
  }
  console.log(JSON.stringify(out, null, 2));
  await closePools().catch(() => {});
})();
