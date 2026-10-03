#!/bin/bash
# L1 硬门复跑（Neng 自跑）· 退出码管道外捕获（offline pack）
BK="$(cd "$(dirname "$0")/.." && pwd)"   # worktree/backend-ts
OUT="$BK/.p9s3qa-artifacts"
mkdir -p "$OUT"
cd "$BK" || exit 3
( npx tsc -p tsconfig.json --noEmit ) > "$OUT/l1-tsc.out" 2>&1; echo "tsc rc=$?"
( npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts ) > "$OUT/l1-offline.out" 2>&1; echo "offline rc=$?"
for g in p8-s1-app-config-gate p8-s2-fee-rebate-gate p8-s3-deposit-gate p8-s3b-address-gate p8-s4-currency-review-gate p8-s5-compliance-gate p8-s6-site-text-gate; do
  ( npx ts-node --transpile-only "scripts/$g.ts" ) > "$OUT/l1-$g.out" 2>&1; echo "$g rc=$?"
done
