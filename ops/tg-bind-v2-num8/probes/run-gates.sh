#!/bin/zsh
# 窄质检门套 · tg-bind-v2-num8（AC-6）—— 逐条捕获退出码，日志落 gates/
set -u
REPO=/Users/kevin/bistro/seafood
G=$REPO/ops/tg-bind-v2-num8/gates
mkdir -p "$G"

cd "$REPO/frontend"
npm run build > "$G/fe-build.log" 2>&1; echo "fe_build_exit=$?" >> "$G/exitcodes.txt"

cd "$REPO/frontend"
npx vitest run src/test/unit --reporter=basic > "$G/vitest.log" 2>&1; echo "vitest_exit=$?" >> "$G/exitcodes.txt"

cd "$REPO/backend-ts"
npm run build > "$G/be-build.log" 2>&1; echo "be_build_exit=$?" >> "$G/exitcodes.txt"

cd "$REPO/backend-ts"
npx ts-node --transpile-only scripts/test-tg-bind-v2-offline.ts > "$G/offline-tg-bind-v2.log" 2>&1; echo "offline_exit=$?" >> "$G/exitcodes.txt"

echo "GATES_DONE" >> "$G/exitcodes.txt"
