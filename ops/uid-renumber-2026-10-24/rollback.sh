#!/usr/bin/env bash
# ops/uid-renumber-2026-10-24/rollback.sh
# ============================================================================
# uid 规范化迁移的**回滚**入口（契约：docs/data-layer.spec.md §40.17.7 `UR7`）
#
# ★ 铁律（§40.17.7 A）：回滚 = 把 `ur_map` 的 `old_uid` / `new_uid` **对调后重跑同一 12 步**。
#   本脚本**不写任何换号 SQL**：12 步全部来自 `backend-ts/migrations/0076_uid_renumber.sql`，
#   本脚本只做三件事 —— ① 从 `dump/users.csv`（迁移前备份）与现库按 `lower(evm)` 重建反向映射；
#   ② 把映射装进与迁移同形的 TEMP 表 `ur_map`（`ON COMMIT DROP`）；③ 以 `ur.direction='down'`
#   包一层 `BEGIN/COMMIT` 执行同一文件（`--dry` 则 `ROLLBACK`，用于演练）。
#
# ★ 回滚窗口（§40.17.7 D，写死在预案第一行）：**只在「迁移提交后、首笔新写入之前」成立**。
#   一旦出现 uid >= 100101 的新用户 / 新账本行 / 新业务行，反向映射不再覆盖全库
#   ⇒ 此时**正确动作是正向修复（补映射后前滚），不是回滚**。本脚本在开跑前会检查该窗口。
#
# ★★ 能力边界（2026-10-24 复核 B2 登记，**先读再跑**）：本脚本**不复活那 9 行** account。
#   `0076` 步骤 2c 按 Kevin 授权删除 9 行无账本 mock 余额，全文无 `INSERT INTO public.*` ⇒
#   down 方向命中 0 行、不重建 ⇒ 回滚后 `account` 永久 132 行（迁移前 141）。核对段 §3 已把
#   「132 = 备份 141 − 9」写成**硬断言**（不是提示）：若那 9 行被别的东西复活，本脚本会 FAIL。
#   ★ 也**不要**指望从 `dump/account.csv` 逐字回灌：该 csv 只有 7 列，而 account 是 20 列
#     （`accountId`/`providerId`/`userId` NOT NULL 无默认）⇒ 结构上无法复原；详 README §7.1。
#     ⇒ 本项的处置口径 =「可前滚、不回滚此项」，那 9 行视为永久删除。
#
# ★ 序列口径（易踩）：down 的 `RESTART WITH` 目标是**回滚起点**的序列值（正常 apply 后 = 100101），
#   **不是**迁移前的 48 —— `preflight.json` 不记录 seq，故 §3 以 `100101/false` 硬断言，
#   可用 `UR_EXPECT_SEQ=<last>/<is_called>` 覆盖。
#
# 用法：
#   bash ops/uid-renumber-2026-10-24/rollback.sh --dry              # 演练：跑完整回滚后 ROLLBACK（零残留）
#   bash ops/uid-renumber-2026-10-24/rollback.sh                    # 真回滚（COMMIT）—— 需 Kevin 授权
#   bash ops/…/rollback.sh --dump other/dump --force-window         # 指定备份目录 / 跳过窗口检查（登记后果）
# ============================================================================
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATION="$REPO_ROOT/backend-ts/migrations/0076_uid_renumber.sql"
DUMP_DIR="$HERE/dump"
DRY=0
FORCE_WINDOW=0

while [ $# -gt 0 ]; do
  case "$1" in
    --dry) DRY=1; shift ;;
    --dump) DUMP_DIR="$2"; shift 2 ;;
    --force-window) FORCE_WINDOW=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

PSQL="${PSQL:-$(command -v psql || true)}"
if [ -z "$PSQL" ] && [ -x /opt/homebrew/opt/libpq/bin/psql ]; then PSQL=/opt/homebrew/opt/libpq/bin/psql; fi
[ -n "$PSQL" ] || { echo "FATAL: 找不到 psql" >&2; exit 2; }

if [ -z "${DATABASE_URL_UNPOOLED:-}" ] && [ -z "${DATABASE_URL:-}" ] && [ -f "$REPO_ROOT/backend-ts/.env.local" ]; then
  set -a; . "$REPO_ROOT/backend-ts/.env.local"; set +a
fi
DSN="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}"
[ -n "$DSN" ] || { echo "FATAL: 缺 DATABASE_URL_UNPOOLED / DATABASE_URL" >&2; exit 2; }

[ -f "$MIGRATION" ] || { echo "FATAL: 缺 $MIGRATION" >&2; exit 2; }
[ -f "$DUMP_DIR/users.csv" ] || { echo "FATAL: 缺 $DUMP_DIR/users.csv（迁移前备份；回滚的唯一映射来源）" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/ur-rollback.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

q() { "$PSQL" "$DSN" -X -q -A -t -v ON_ERROR_STOP=1 -c "$1"; }

# ---------------------------------------------------------------- 0. 状态闸
REAL_NOW="$(q "SELECT uid FROM public.users WHERE lower(evm)='0x59f9f640d15ebb053c94a816232cf8ce91b209b0'")"
REAL_DUMP="$(awk -F',' 'NR>1 && $2=="0x59f9f640d15ebb053c94a816232cf8ce91b209b0" {print $1}' "$DUMP_DIR/users.csv")"
if [ "$REAL_NOW" = "$REAL_DUMP" ]; then
  echo "FATAL: 真实账号 uid=${REAL_NOW} 仍为备份值 ⇒ 迁移未 apply（或已回滚），无需回滚" >&2; exit 3
fi
echo "== 目标：真实账号 uid ${REAL_NOW} → ${REAL_DUMP}（按 lower(evm) 定位）"

AGEING="$(q "SELECT count(*) FROM public.users WHERE uid >= 100101")"
if [ "$AGEING" != "0" ] && [ "$FORCE_WINDOW" != "1" ]; then
  echo "FATAL: §40.17.7 D 回滚窗口已关闭 —— 已有 ${AGEING} 行 uid >= 100101（新注册/新业务行不在 ur_map 内）。" >&2
  echo "       正确动作是正向修复（补映射后前滚），不是回滚。确需强跑请加 --force-window 并登记后果。" >&2
  exit 3
fi

# ---------------------------------------------------------------- 1. 反向映射（dump.users × 现库，按 lower(evm) 连接）
# dump/users.csv 列序 = users 表列序：uid,evm,bio,is_admin,... ⇒ 只需前两列（evm 不含逗号，bio 在第 3 列起）
{
  echo 'uid,evm'
  awk -F',' 'NR>1 && NF>=2 {print $1","$2}' "$DUMP_DIR/users.csv"
} > "$WORK/prev.csv"

cat > "$WORK/prelude.sql" <<SQL
\\set ON_ERROR_STOP on
CREATE TEMP TABLE ur_prev (uid bigint PRIMARY KEY, evm text NOT NULL);
\\copy ur_prev FROM '$WORK/prev.csv' WITH (FORMAT csv, HEADER true)
\\copy (SELECT p.uid AS old_uid, u.uid AS new_uid
         FROM ur_prev p JOIN public.users u ON lower(u.evm) = lower(p.evm)) TO '$WORK/map.csv' WITH (FORMAT csv, HEADER true)
SQL
"$PSQL" "$DSN" -X -q -v ON_ERROR_STOP=1 -f "$WORK/prelude.sql" >/dev/null

MAP_ROWS=$(( $(python3 -c "
import csv,sys
print(sum(1 for _ in csv.reader(open(sys.argv[1], newline='', encoding='utf-8'))))
" "$WORK/map.csv") - 1 ))
if [ "$MAP_ROWS" -ne 194 ]; then
  echo "FATAL: 反向映射行数 ${MAP_ROWS} ≠ 194（备份与现库 evm 对不上：dump 过期或被别的迁移改过）" >&2; exit 4
fi
echo "== 反向映射 194 行（old=dump 旧号 / new=现库新号）"

# ---------------------------------------------------------------- 2. 同一 12 步反向跑（ur.direction=down）
cat > "$WORK/rollback.sql" <<SQL
\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';
SET ur.direction = 'down';
CREATE TEMP TABLE ur_map (old_uid bigint PRIMARY KEY, new_uid bigint NOT NULL UNIQUE) ON COMMIT DROP;
\\copy ur_map FROM '$WORK/map.csv' WITH (FORMAT csv, HEADER true)
\\i $MIGRATION
$( [ "$DRY" = "1" ] && echo "ROLLBACK;" || echo "COMMIT;" )
SQL

echo "== 执行（$( [ "$DRY" = "1" ] && echo 'DRY：末尾 ROLLBACK，零残留' || echo '真回滚：COMMIT')）"
T0=$(date +%s)
"$PSQL" "$DSN" -X -v ON_ERROR_STOP=1 -f "$WORK/rollback.sql"
T1=$(date +%s)
echo "== 耗时 $((${T1} - T0))s"

# ---------------------------------------------------------------- 3. 回滚后核对（**断言**，不是打印）
if [ "$DRY" = "1" ]; then
  echo "== DRY 完毕（未落库，零残留）。"
  echo "   ★ dry 演练**只能在 branch 库或 apply 前的事务内**做：真回滚后 --dry 会因「真实账号已是备份值」"
  echo "     在状态闸（exit 3）停住，属预期，不是缺陷。读数以 dryrun.ts / updown.ts 的 readings/*.json 为准。"
  exit 0
fi

fail() { echo "FAIL: $*" >&2; exit 5; }

echo "== 回滚后核对（任一红即 exit 5；本脚本不放宽任何一项）"

# 3.1 users：行数 / 真实账号 / mock 段
FILE_ROWS=$(python3 -c "
import csv,sys
print(sum(1 for _ in csv.reader(open(sys.argv[1], newline='', encoding='utf-8'))) - 1)
" "$DUMP_DIR/users.csv")
DB_ROWS="$(q "SELECT count(*) FROM public.users")"
[ "$FILE_ROWS" = "$DB_ROWS" ] || fail "users 行数 ${DB_ROWS} ≠ dump ${FILE_ROWS}"
[ "$(q "SELECT uid FROM public.users WHERE lower(evm)='0x59f9f640d15ebb053c94a816232cf8ce91b209b0'")" = "$REAL_DUMP" ] \
  || fail "真实账号未回到 ${REAL_DUMP}"
[ "$(q "SELECT count(*) FROM public.users WHERE uid >= 1000 AND uid <= 1192")" = "$(awk -F',' 'NR>1 && $1>=1000 && $1<=1192' "$DUMP_DIR/users.csv" | wc -l | tr -d ' ')" ] \
  || fail "mock 段 1000–1192 行数与备份不符"
echo "   users 行数 / 真实号 / mock 段：PASS"

# 3.2 users_uid_seq：**断言**（原来只 print；口径见头注：down 回卷到回滚起点值，不是迁移前的 48）
EXP_SEQ="${UR_EXPECT_SEQ:-100101/false}"
GOT_SEQ="$(q "SELECT last_value || '/' || is_called FROM public.users_uid_seq")"
[ "$GOT_SEQ" = "$EXP_SEQ" ] || fail "users_uid_seq = ${GOT_SEQ} ≠ 期望 ${EXP_SEQ}（down 的回卷目标 = 回滚起点序列值；正常 apply 后为 100101/false。若确为其它已知值，用 UR_EXPECT_SEQ 显式覆盖并登记）"
echo "   users_uid_seq = ${GOT_SEQ}：PASS（= ${EXP_SEQ}）"

# 3.3 ledger_entry：Σdelta / Σfrozen_delta / 按 cid 分解，与备份 preflight.json 逐项相等
LEDGER_NOW="$(q "SELECT json_build_object(
    'rows', count(*), 'sum_delta', sum(delta), 'sum_frozen_delta', sum(frozen_delta),
    'by_cid', (SELECT json_object_agg(cid::text, d) FROM (SELECT cid, sum(delta) AS d FROM public.ledger_entry GROUP BY cid) t))::text
  FROM public.ledger_entry")"
python3 - "$HERE/preflight.json" "$LEDGER_NOW" <<'PY' || fail "ledger_entry 的 Σdelta / by_cid 与备份不符（数值列被改过？回滚不是「复原」）"
import json, sys
b = json.load(open(sys.argv[1], encoding='utf-8'))['ledger']
n = json.loads(sys.argv[2])
n['by_cid'] = {str(k): int(v) for k, v in (n.get('by_cid') or {}).items()}
bad = []
for k in ('rows', 'sum_delta', 'sum_frozen_delta', 'by_cid'):
    if b.get(k) != n.get(k):
        bad.append(f"{k}: backup={b.get(k)} now={n.get(k)}")
if bad:
    print('   ' + '; '.join(bad)); sys.exit(1)
PY

# 3.4 account 快照：132 = 备份 141 − 9（★ 那 9 行**不复活**，见头注 B2）+ 剩余行漂移必须 0
ACCT_BACKUP="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1], encoding='utf-8'))['account']['rows'])" "$HERE/preflight.json")"
ACCT_EXP=$(( ACCT_BACKUP - 9 ))
ACCT_NOW="$(q "SELECT count(*) FROM public.account")"
[ "$ACCT_NOW" = "$ACCT_EXP" ] || fail "account 行数 ${ACCT_NOW} ≠ 期望 ${ACCT_EXP}（= 备份 ${ACCT_BACKUP} − 9 行已删；多出 ⇒ 那 9 行被复活或有人写入）"
NINE_LEFT="$(q "SELECT count(*) FROM public.account WHERE uid IN (971469,971591,976489,979689,981486,983264,987867,988363,988399)")"
[ "$NINE_LEFT" = "0" ] || fail "那 9 行 account 又出现了（${NINE_LEFT} 行）—— 与本迁移「回滚不复活」的登记冲突，先查清是谁写的"
ACCT_DRIFT="$(q "SELECT count(*) FROM public.account a WHERE a.uid > 0
   AND EXISTS (SELECT 1 FROM public.users u WHERE u.uid = a.uid)
   AND ROW(a.balance, a.frozen) IS DISTINCT FROM (
         SELECT ROW(e.balance_after, e.frozen_after) FROM public.ledger_entry e
          WHERE e.uid = a.uid AND e.cid = a.cid ORDER BY e.txid DESC LIMIT 1)")"
[ "$ACCT_DRIFT" = "0" ] || fail "回滚后仍有 ${ACCT_DRIFT} 行 account 漂移（账本快照对不上）"
echo "   account = ${ACCT_NOW}（备份 ${ACCT_BACKUP} − 9，那 9 行未复活）· 漂移 0：PASS"

# 3.5 **19 个守卫**全部 tgenabled='O'（14 append-only + 5 额外写闸；原名只能覆盖 14，故改为逐名断言）
GUARDS="'trg_ledger_entry_append_only','trg_referral_append_only','trg_market_trade_append_only',
 'trg_currency_status_log_append_only','trg_admin_ops_audit_log_append_only','trg_admin_refund_audit_log_append_only',
 'trg_currency_review_log_append_only','trg_listing_review_log_append_only','trg_checkin_log_append_only',
 'trg_checkin_makeup_log_append_only','trg_rating_append_only','trg_listing_order_event_append_only',
 'trg_listing_edit_log_append_only','trg_batt_entry_append_only','trg_admin_user_role_key_immutable',
 'trg_conversation_read_mark_only','trg_message_no_update_or_delete','trg_listing_order_core_immutable_guard',
 'trg_market_order_core_immutable_guard'"
GUARD_TOTAL="$(q "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY (ARRAY[${GUARDS}])")"
GUARD_NOT_O="$(q "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY (ARRAY[${GUARDS}]) AND tgenabled <> 'O'")"
[ "$GUARD_TOTAL" = "19" ] || fail "19 个守卫中在册的只有 ${GUARD_TOTAL} 个（触发器被删/改名？）"
[ "$GUARD_NOT_O" = "0" ] || fail "${GUARD_NOT_O} 个守卫未回到 tgenabled='O'（带着关闭的守卫提交 = 事故）"
echo "   19 个守卫 tgenabled='O'：PASS（在册 ${GUARD_TOTAL} / 非 O ${GUARD_NOT_O}）"

# 3.6 31 个 users FK 已复原 NOT DEFERRABLE（INITIALLY DEFERRED 会让全站 FK 校验点静默后移）
FK_DEF="$(q "SELECT count(*) FROM pg_constraint WHERE contype='f' AND confrelid='public.users'::regclass AND (condeferrable OR condeferred)")"
[ "$FK_DEF" = "0" ] || fail "${FK_DEF} 个 users FK 仍是 DEFERRABLE（应全部复原为 NOT DEFERRABLE）"
echo "   31 个 users FK = NOT DEFERRABLE：PASS"

echo "== 回滚完成（全部断言 PASS）。★ 仍须："
echo "   ① 轮换 SECRET_KEY（旧 token 的 sub 是迁移后 uid）；"
echo "   ② 若业务面需要那 9 行 mock 余额，按 README §7.1 从 dump/account.csv 人工回灌（回滚不包含）；"
echo "   ③ 复核业务面读数（ledger/account 已在 §3 对拍，业务表行数按需人工抽查）。"
