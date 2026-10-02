/**
 * 批 8③b 收口 · **生产库 `app_config` 基线复原**（DELETE + INSERT · 单事务 · 无中间态）。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s3b-03-restore.ts
 * 产物：backend-ts/.p8s3b-artifacts/p8s3b-restore/{pre,post}.json（+ stdout JSON）
 *
 * 背景（自曝事件）：上一轮 8③b 探针跑**真 HTTP** 写（形态 A 回归 + 形态 B 写）后，
 *   `system_settings.time_updated` 被 `BEFORE UPDATE` 触发器 `trg_app_config_touch_updated`
 *   前移到 `2026-10-02 15:57:54.741187+00`（基线 `2026-10-02 14:14:07.502017+00`）。
 *   因两枚触发器（`trg_app_config_touch_updated` 强制 `NEW.time_updated := now()`、
 *   `trg_app_config_key_immutable` 拒 `key` 变更）**均为 BEFORE UPDATE**、且**均不含
 *   INSERT / DELETE 事件**（现取 `pg_trigger` 证据见 `.p8s3b-artifacts/p8s3b-dbstate/pre.json`）
 *   ⇒ 以「单事务内 **DELETE 该行 + 按原样 INSERT**（含基线 `time_updated`）」复原到逐字节。
 *
 * 安全口径：
 *   · 只处理 `key = 'system_settings'`（**绝不**碰其它行）；
 *   · 前置断言现库 == **已知漂移态**（值/updated_by 同基线、`time_updated` 恰为漂移值）；
 *     任何不符 ⇒ **中止写库并报错**（不猜测、不强行改）；
 *   · DELETE + INSERT 在**同一 `withTransaction` 内** ⇒ 无中间态（要么全成、要么全回滚）。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, txQuery, closePools } from '../src/db';
import { SYSTEM_SETTINGS_KEY } from '../src/database';

const HERE = __dirname;
const OUT_DIR = path.join(HERE, '..', '.p8s3b-artifacts', 'p8s3b-restore');
fs.mkdirSync(OUT_DIR, { recursive: true });

/** 基线（自 `p8s3b-effective-20261002T155737Z/effective.json` 的 `baseline.app_config` 逐字取出）。 */
const BASELINE = {
  key: SYSTEM_SETTINGS_KEY,
  value_text: '{"siteName": "p4b2c:siteA", "maintenance": false, "maxDailyTasks": 10, "pointsPerTask": 100, "rewardCooldown": 24, "defaultLanguage": "zh", "siteDescription": "去中心化社区奖励平台", "allowRegistration": true, "emailNotifications": true}',
  updated_by: '1',
  time_updated: '2026-10-02 14:14:07.502017+00',
};
/** 已知漂移态（上一轮自曝的 `time_updated`）。 */
const DRIFTED_TIME_UPDATED = '2026-10-02 15:57:54.741187+00';

const readAll = (): Promise<Array<{ key: string; value_text: string; updated_by: string; time_updated: string }>> =>
  readQuery(`SELECT key, value::text AS value_text, updated_by::text AS updated_by, time_updated::text AS time_updated
               FROM public.app_config ORDER BY key`);

(async () => {
  const pre = await readAll();
  fs.writeFileSync(path.join(OUT_DIR, 'pre.json'), JSON.stringify(pre, null, 1) + '\n', 'utf8');
  const row = pre.find((r) => r.key === SYSTEM_SETTINGS_KEY) || null;

  if (!row) throw new Error('ABORT: system_settings row missing');

  const sameValue = row.value_text === BASELINE.value_text && row.updated_by === BASELINE.updated_by;
  const atBaseline = sameValue && row.time_updated === BASELINE.time_updated;
  const atDrift = sameValue && row.time_updated === DRIFTED_TIME_UPDATED;

  const out: Record<string, unknown> = {
    unit: 'P8-S3B-RESTORE', generated_at: new Date().toISOString(),
    pre, baseline: BASELINE, drifted_time_updated: DRIFTED_TIME_UPDATED,
    pre_row_count: pre.length,
    classification: atBaseline ? 'ALREADY_BASELINE' : atDrift ? 'DRIFTED_KNOWN' : 'UNEXPECTED',
  };

  if (!atBaseline && !atDrift) {
    out.aborted = 'PRE_STATE_UNEXPECTED (value/updated_by/time_updated 与基线+已知漂移均不符 ⇒ 不写)';
    fs.writeFileSync(path.join(OUT_DIR, 'post.json'), JSON.stringify(out, null, 1) + '\n', 'utf8');
    console.log(JSON.stringify(out, null, 1));
    await closePools();
    process.exit(3);
  }

  if (!atBaseline) {
    // —— 单事务：DELETE + INSERT（含基线 time_updated；触发器不含 INSERT/DELETE ⇒ 不被改写）——
    await withTransaction(async (tx) => {
      await txQuery(tx, `DELETE FROM public.app_config WHERE key = $1::text`, [BASELINE.key]);
      await txQuery(tx,
        `INSERT INTO public.app_config (key, value, updated_by, time_updated)
         VALUES ($1::text, $2::jsonb, $3::bigint, $4::timestamptz)`,
        [BASELINE.key, BASELINE.value_text, BASELINE.updated_by, BASELINE.time_updated]);
    });
    out.action = 'DELETE+INSERT (single tx, committed)';
  } else {
    out.action = 'NOOP (already baseline)';
  }

  const post = await readAll();
  fs.writeFileSync(path.join(OUT_DIR, 'post.json'), JSON.stringify({ ...out, post }, null, 1) + '\n', 'utf8');

  const postRow = post.find((r) => r.key === SYSTEM_SETTINGS_KEY) || null;
  const byteIdentical = postRow !== null
    && postRow.key === BASELINE.key && postRow.value_text === BASELINE.value_text
    && postRow.updated_by === BASELINE.updated_by && postRow.time_updated === BASELINE.time_updated;
  out.verify = {
    post,
    key_set: post.map((r) => r.key),
    key_set_is_exactly_system_settings: post.length === 1 && post[0].key === SYSTEM_SETTINGS_KEY,
    system_settings_byte_identical_to_baseline: byteIdentical,
    listing_deposit_policy_absent: !post.some((r) => r.key === 'listing_deposit_policy'),
    time_updated_matches_baseline: postRow?.time_updated === BASELINE.time_updated,
  };
  console.log(JSON.stringify(out, null, 1));
  await closePools();
  process.exit(byteIdentical ? 0 : 4);
})().catch(async (e) => {
  console.error('RESTORE_CRASHED', String((e as Error)?.stack || e).slice(0, 2000));
  await closePools().catch(() => undefined);
  process.exit(2);
});
