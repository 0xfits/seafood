#!/bin/zsh
# seafood · 改前基线包（四件套）· 本轮 = 首页卡片 UI（底色分层 / 价格块 / 整卡可点击）
# 口径：必须在实现方动码之前一次取完落盘。
cd /Users/kevin/bistro/seafood || exit 1
D=ops/ui-card-ref-20261017/readings
mkdir -p "$D"
{
  echo "===== HEAD / STATUS （取数时刻：$(date '+%F %T %Z')）====="
  git log --oneline -3
  git status --porcelain

  echo
  echo "===== ① test:unit（改前例数基线）====="
  (cd frontend && npm run test:unit 2>&1 | tail -30)

  echo
  echo "===== ② build（改前产物名基线）====="
  (cd frontend && npm run build 2>&1 | tail -15)
  echo "--- dist assets ---"
  ls -1 frontend/dist/assets 2>/dev/null | grep -E '^index-' | sort

  echo
  echo "===== ③ 生产哨兵（绕本机 DNS 劫持）====="
  echo "--- /api/health ---"
  curl -s -m 20 --resolve 0xseafood.com:443:76.76.21.21 https://0xseafood.com/api/health
  echo
  echo "--- /api/task/all（前 120 字节）---"
  curl -s -m 20 --resolve 0xseafood.com:443:76.76.21.21 https://0xseafood.com/api/task/all | head -c 120
  echo
  echo "--- 线上 HTML 引用的产物名（绕缓存取，先落盘再 grep）---"
  curl -s -m 20 -H 'Cache-Control: no-cache' \
    --resolve 0xseafood.com:443:76.76.21.21 https://0xseafood.com/ -o "$D/prod-index-before.html"
  echo "http_code/size：$(curl -s -m 20 -o /dev/null -w '%{http_code} %{size_download}' -H 'Cache-Control: no-cache' --resolve 0xseafood.com:443:76.76.21.21 https://0xseafood.com/)"
  grep -o 'assets/index-[A-Za-z0-9_-]*\.\(js\|css\)' "$D/prod-index-before.html" | sort -u

  echo
  echo "===== ④ 本地 dev 实例活性 ====="
  echo "5787/ ：$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://localhost:5787/)"
  echo "5788/api/health：$(curl -s -m 10 -o /dev/null -w '%{http_code}' http://localhost:5788/api/health)"

  echo
  echo "===== 基线包完成：$(date '+%F %T %Z') ====="
} 2>&1 | tee "$D/baseline.log"
