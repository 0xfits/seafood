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

# ---------------------------------------------------------------- 3. 回滚后核对（与备份逐项对拍）
if [ "$DRY" = "1" ]; then
  echo "== DRY 完毕（未落库）。核对项由 dryrun.ts 落 readings/*.json"
  exit 0
fi

echo "== 回滚后核对"
FILE_ROWS=$(python3 -c "
import csv,sys
print(sum(1 for _ in csv.reader(open(sys.argv[1], newline='', encoding='utf-8'))) - 1)
" "$DUMP_DIR/users.csv")
DB_ROWS="$(q "SELECT count(*) FROM public.users")"
[ "$FILE_ROWS" = "$DB_ROWS" ] || { echo "FAIL: users 行数 ${DB_ROWS} ≠ dump ${FILE_ROWS}" >&2; exit 5; }
[ "$(q "SELECT uid FROM public.users WHERE lower(evm)='0x59f9f640d15ebb053c94a816232cf8ce91b209b0'")" = "$REAL_DUMP" ] \
  || { echo "FAIL: 真实账号未回到 ${REAL_DUMP}" >&2; exit 5; }
[ "$(q "SELECT count(*) FROM public.users WHERE uid >= 1000 AND uid <= 1192")" = "$(awk -F',' 'NR>1 && $1>=1000 && $1<=1192' "$DUMP_DIR/users.csv" | wc -l | tr -d ' ')" ] \
  || { echo "FAIL: mock 段 1000–1192 行数与备份不符" >&2; exit 5; }
[ "$(q "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname LIKE 'trg_%_append_only' AND tgenabled<>'O'")" = "0" ] \
  || { echo "FAIL: append-only 触发器未全部回到 tgenabled='O'" >&2; exit 5; }
echo "   users/真实号/mock 段/触发器：PASS"
echo "   users_uid_seq = $(q "SELECT last_value || '/' || is_called FROM public.users_uid_seq")（应等于备份 preflight.json 的 last_value/is_called）"
echo "== 回滚完成。★ 仍须：轮换 SECRET_KEY（旧 token 的 sub 是迁移后 uid）并复核业务面。"
