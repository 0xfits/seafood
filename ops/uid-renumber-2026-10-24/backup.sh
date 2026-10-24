#!/usr/bin/env bash
# ops/uid-renumber-2026-10-24/backup.sh
# ============================================================================
# uid 规范化迁移（`backend-ts/migrations/0076_uid_renumber.sql`）**迁移前**备份
# 契约：docs/data-layer.spec.md §40.17.6 `UR6`（+ §40.17.7 `UR7` 回滚锚）
#
# 纪律：
#   · **只读**：本脚本只发 `COPY … TO STDOUT` 与 `SELECT`，不建表 / 不建 schema / 不写 app_config
#     ⇒ 备份是**文件**，不是数据面对象（§40.17.6 B「不入库」）。
#   · `dump/*.csv` 含 `evm` / `bio` / `tg_user_id`（个人数据）⇒ **不入 git**（本目录 `.gitignore` 已挡）。
#     可入库的只有 `manifest.txt`（行数/字节/sha256）与 `preflight.json`（元数据）。
#   · 落点：`ops/uid-renumber-2026-10-24/dump/<table>.csv`（逐表 `FORMAT csv, HEADER true`）
#           `ops/uid-renumber-2026-10-24/manifest.txt` / `preflight.json`
#
# 用法：
#   cp backend-ts/.env.local.example …   # 或直接复用 backend-ts/.env.local
#   bash ops/uid-renumber-2026-10-24/backup.sh                 # 连接串取 DATABASE_URL_UNPOOLED（直连）
#   DATABASE_URL_UNPOOLED='postgres://…' bash ops/…/backup.sh  # 显式指定
#   RUN_TAG=pre bash ops/…/backup.sh                           # 标签（默认时间戳）
#
# 自证（§40.17.6 C，缺一即视为没有备份）：
#   ① 每表 `wc -l`（含表头）与 `SELECT count(*)` 逐表相等；② manifest 的 sha256 与现算相等；
#   ③ `users` 任取一行，其 `evm` 与库内 `lower(evm)` 逐字相等。
# ============================================================================
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
DUMP_DIR="$HERE/dump"
MANIFEST="$HERE/manifest.txt"
PREFLIGHT="$HERE/preflight.json"
RUN_TAG="${RUN_TAG:-$(date -u +%Y%m%dT%H%M%SZ)}"

# libpq 的 psql 在 brew 前缀下（非 PATH）时自动发现；也可 PSQL=/path/to/psql 覆盖
PSQL="${PSQL:-$(command -v psql || true)}"
if [ -z "$PSQL" ] && [ -x /opt/homebrew/opt/libpq/bin/psql ]; then PSQL=/opt/homebrew/opt/libpq/bin/psql; fi
if [ -z "$PSQL" ]; then echo "FATAL: 找不到 psql（安装 libpq 或设 PSQL=/path/to/psql）" >&2; exit 2; fi

# 连接串：DATABASE_URL_UNPOOLED 优先（R56 直连口径 —— 事务/锁面必须直连，不走 pooler）
if [ -z "${DATABASE_URL_UNPOOLED:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "$REPO_ROOT/backend-ts/.env.local" ]; then
    set -a; . "$REPO_ROOT/backend-ts/.env.local"; set +a
  fi
fi
DSN="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}"
if [ -z "$DSN" ]; then echo "FATAL: 缺 DATABASE_URL_UNPOOLED / DATABASE_URL" >&2; exit 2; fi

# Neon dev 偶发「空闲/长连接被掐」，单条 COPY 重试 5 次（指数退避）；SQL/权限错误**不**重试
psql_retry() {
  local out rc i
  for i in 1 2 3 4 5; do
    out="$("$PSQL" "$@" 2>&1)"; rc=$?
    if [ "$rc" -eq 0 ]; then printf '%s\n' "$out"; return 0; fi
    case "$out" in
      *"server closed the connection"*|*"connection to server"*|*"terminating connection"*|*"Connection refused"*|*"timeout expired"*)
        sleep $((i * 2)); continue ;;
      *) printf '%s\n' "$out" >&2; return "$rc" ;;
    esac
  done
  printf '%s\n' "$out" >&2; return 1
}

# §40.17.6 A 表：核心 / 账本 / 留痕 / 引用 / 非 FK / 平台 / 元数据 涉及的**全部**表（逐表全列）
TABLES=(
  users ledger_entry account ledger_owner currency app_config schema_migration
  batt_entry batt_account listing_edit_log campaign_task_reward_pending
  admin_ops_audit_log admin_refund_audit_log admin_user_role
  checkin_log checkin_makeup_log conversation
  currency_review_log currency_status_log
  listing listing_favorite listing_order listing_order_event listing_review_log
  market_order market_trade media message
  project project_wage_claim project_worker
  rating referral subtask_proof user_activity_hour
)

mkdir -p "$DUMP_DIR"
: > "$MANIFEST"
{
  echo "# uid-renumber-2026-10-24 backup manifest"
  echo "# run_tag:   $RUN_TAG"
  echo "# generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# contract:  docs/data-layer.spec.md §40.17.6 UR6（备份不入库、dump/*.csv 不入 git）"
  echo "# columns:   table  rows(count(*))  csv_lines(wc -l, 含表头)  bytes  sha256"
} >> "$MANIFEST"

echo "== preflight.json（元数据快照：31 FK / tgenabled / 序列 / schema_migration / 行数 / NM2·NM3·NM7 读数）"
psql_retry "$DSN" -X -q -A -t -v ON_ERROR_STOP=1 -f "$HERE/preflight.sql" > "$PREFLIGHT"
echo "   -> $PREFLIGHT"

echo "== 逐表 COPY TO STDOUT (FORMAT csv, HEADER true)"
for t in "${TABLES[@]}"; do
  out="$DUMP_DIR/$t.csv"
  psql_retry "$DSN" -X -q -v ON_ERROR_STOP=1 \
    -c "\\copy (SELECT * FROM public.$t) TO '$out' WITH (FORMAT csv, HEADER true)" >/dev/null
  db_rows="$(psql_retry "$DSN" -X -q -A -t -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.$t")"
  lines="$(python3 - "$out" <<'PY'
import csv, sys
with open(sys.argv[1], newline='', encoding='utf-8') as fh:
    print(sum(1 for _ in csv.reader(fh)))
PY
)"
  bytes="$(wc -c < "$out" | tr -d ' ')"
  sha="$(shasum -a 256 "$out" | awk '{print $1}')"
  printf '%-38s %10s %10s %12s  %s\n' "$t" "$db_rows" "$lines" "$bytes" "$sha" | tee -a "$MANIFEST"

  # 自证 ①：CSV 记录数（含表头）= count(*) + 1（用 csv 解析计数：memo/bio 等值内含换行时 wc -l 会多计）
  if [ "$lines" -ne $((db_rows + 1)) ]; then
    echo "FAIL: $t csv_records=$lines ≠ db_rows+1=$((db_rows + 1))" >&2; exit 1
  fi
done

echo "== 自证 ②：manifest sha256 现算复核"
while read -r tbl _rest; do
  case "$tbl" in ''|\#*) continue ;; esac
  f="$DUMP_DIR/$tbl.csv"
  [ -f "$f" ] || continue
  now="$(shasum -a 256 "$f" | awk '{print $1}')"
  old="$(awk -v t="$tbl" '$1==t {print $5}' "$MANIFEST" | tail -1)"
  if [ "$now" != "$old" ]; then echo "FAIL: $tbl sha256 现算 $now ≠ manifest $old" >&2; exit 1; fi
done < "$MANIFEST"
echo "   sha256 全部相符"

echo "== 自证 ③：users 随机一行 evm 与库内 lower(evm) 逐字相等"
u_row="$(psql_retry "$DSN" -X -q -A -t -v ON_ERROR_STOP=1 -c \
  "SELECT uid || ' ' || lower(evm) FROM public.users ORDER BY random() LIMIT 1")"
u_uid="${u_row%% *}"; u_evm="${u_row##* }"
csv_evm="$(awk -F',' -v want="$u_uid" 'NR>1 && $1==want {print $2}' "$DUMP_DIR/users.csv")"
if [ "$csv_evm" != "$u_evm" ]; then
  echo "FAIL: users uid=$u_uid dump evm=$csv_evm ≠ db $u_evm" >&2; exit 1
fi
echo "   ok: uid=${u_uid} evm=${u_evm}"

{
  echo "# ---- 自证结论（UR6 C）----"
  echo "# ① 逐表 db_rows 见上（csv_lines = db_rows + 1 时逐字相等）"
  echo "# ② manifest sha256 现算复核：PASS"
  echo "# ③ users 行 evm 对拍：PASS（uid=${u_uid}）"
  echo "# 体积合计：$(du -sk "$DUMP_DIR" | awk '{print $1}') KB / $(du -sh "$DUMP_DIR" | awk '{print $1}')"
  echo "# dump/*.csv 不入 git（含 evm/bio/tg_user_id）"
} >> "$MANIFEST"

echo "== 完成：$(du -sh "$DUMP_DIR" | awk '{print $1}') 于 $DUMP_DIR"
