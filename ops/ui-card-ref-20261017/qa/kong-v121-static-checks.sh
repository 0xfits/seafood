#!/usr/bin/env bash
# Kong · v1.21 §23 顶栏实黄 · AC-6 结构不变式 + 断言锚 静态读数（可复跑）
# 用法：bash ops/ui-card-ref-20261017/qa/kong-v121-static-checks.sh [> out.txt]
set -u
REPO=/Users/kevin/bistro/seafood
cd "$REPO" || exit 1
echo "===== Kong 静态读数（v1.21 §23 · AC-6 + 断言锚）· $(date '+%F %T %Z') ====="
echo "--- ① shell.css 断点块计数（须 = 1）与主题分支（须 = 0）---"
echo "@media 计数        = $(grep -c '@media' frontend/src/shell/shell.css)"
grep -n '@media' frontend/src/shell/shell.css
echo "data-theme 计数    = $(grep -c 'data-theme' frontend/src/shell/shell.css)"
echo "theme-day/night    = $(grep -c 'theme-day\|theme-night' frontend/src/shell/shell.css)"
echo
echo "--- ② 五 data-sf-region 恒等（产品面字面）---"
grep -rn 'data-sf-region=' frontend/src --include='*.jsx' | sed 's/^/  /'
echo "  region 去重计数 = $(grep -rhno 'data-sf-region="[a-z]*"' frontend/src --include='*.jsx' | sed 's/.*="//;s/"//' | sort -u | tr '\n' ' ')"
echo
echo "--- ③ .nav-link[href] 集合（须恒等 ['/task','/exchange','/profile']）---"
grep -n 'nav-link' frontend/src/components/Header.jsx | sed 's/^/  /'
echo
echo "--- ④ token 面零 diff（tokens.js / theme-tokens.css / shell.css / theme-preview*）---"
git diff --numstat -- frontend/src/theme/tokens.js frontend/src/theme/theme-tokens.css frontend/src/shell/shell.css frontend/src/theme-preview.html frontend/src/pages/theme-preview 2>/dev/null
echo "  （以上应无输出 ⇒ 四处零 diff）"
echo "  TOKEN_KEYS/STRUCT 计数（现盘）:"
node --input-type=module -e "
const t = await import('file://$REPO/frontend/src/theme/tokens.js');
const k = t.TOKEN_KEYS ?? t.default?.TOKEN_KEYS; const s = t.STRUCT ?? t.default?.STRUCT;
const n = (x) => Array.isArray(x) ? x.length : (x ? Object.keys(x).length : null);
console.log('   TOKEN_KEYS =', n(k), '| STRUCT =', n(s));
const has = (x, key) => Array.isArray(x) ? x.includes(key) : !!(x && key in x);
console.log('   topbar 三槽在 TOKEN_KEYS 内 =', ['topbar-bg','topbar-border','brand-fg'].map((x)=>x+':'+has(k,x)).join(' '));
"
echo
echo "--- ⑤ Header.jsx 不得引入 sf-btn 族（p6-btn-impl2 冻结清单）---"
echo "  sf-btn 命中 = $(grep -c 'sf-btn' frontend/src/components/Header.jsx)"
echo
echo "--- ⑥ 本单三处源码改动（git numstat）---"
git diff --numstat -- frontend/src/styles.css frontend/src/components/Header.jsx frontend/src/components/ui/HoverMenu.css | sed 's/^/  /'
echo
echo "--- ⑦ 落点自证：新增日档规则只在 styles.css / HoverMenu.css；shell.css 内零命中 ---"
echo "  styles.css 'root:not(\[data-theme' 命中 = $(grep -c 'root:not(\[data-theme' frontend/src/styles.css)"
echo "  HoverMenu.css 'root:not(\[data-theme' 命中 = $(grep -c 'root:not(\[data-theme' frontend/src/components/ui/HoverMenu.css)"
echo "  shell.css 'root:not(\[data-theme' 命中 = $(grep -c 'root:not(\[data-theme' frontend/src/shell/shell.css)"
echo "  theme-tokens.css 内本单痕迹命中 = $(grep -c 'root:not(\[data-theme' frontend/src/theme/theme-tokens.css)"
echo
echo "--- ⑧ 产物面：新增日档规则进 dist（含 .backdrop-blur-sm 仍在、.bg-opacity-95 仍在 = 夜档冻结件保留）---"
CSS=$(ls frontend/dist/assets/index-*.css 2>/dev/null | head -1)
echo "  dist css = $(basename "${CSS:-<none>}")"
if [ -n "${CSS:-}" ]; then
  echo "  日档限定规则命中 = $(grep -o 'root:not(\[data-theme=\\\\?\"dark\\\\?\"\]) *\.\?#header' "$CSS" | wc -l | tr -d ' ')"
  echo "  var(--sf-topbar-bg) 声明命中 = $(grep -o 'var(--sf-topbar-bg)' "$CSS" | wc -l | tr -d ' ')"
  echo "  var(--sf-topbar-border) 声明命中 = $(grep -o 'var(--sf-topbar-border)' "$CSS" | wc -l | tr -d ' ')"
  echo "  var(--sf-brand-fg) 声明命中 = $(grep -o 'var(--sf-brand-fg)' "$CSS" | wc -l | tr -d ' ')"
  echo "  .backdrop-blur-sm 仍在 = $(grep -c 'backdrop-blur-sm' "$CSS")（夜档 backdropFilter=blur(4px) 承重件）"
  echo "  .bg-opacity-95 仍在   = $(grep -c 'bg-opacity-95' "$CSS")"
  echo "  hover:text-yellow-600 剩余命中 = $(grep -o 'hover\\\\:text-yellow-600' "$CSS" | wc -l | tr -d ' ')（应为 0：两处消费点已改）"
fi
echo
echo "--- ⑨ 相关测试锚（Header 外观类零锚 = §23.4 B8）---"
echo "  test 内 '#header|bg-white|bg-opacity|backdrop' 命中:"
grep -rn '#header\|bg-opacity\|backdrop-blur' frontend/src/test 2>/dev/null | sed 's/^/    /' | head -10
echo "  （Card.test.jsx 的 bg-white 属 Card 组件，与本单无关）"
echo
echo "--- ⑩ 夜档全局前景规则（styles.css 146-147 一带）逐字未动自证 ---"
git diff -- frontend/src/styles.css | grep -E '^[-+].*data-theme="dark"\] #header' | sed 's/^/  /'
echo "  （以上应无输出 ⇒ 该两条未被删改；本单在 styles.css 只做尾部追加）"
echo
echo "===== END ====="
