# tabbar-home-label · 读数

任务：H5 tabbar 第一格 labelKey `home` 四语改短（海鲜市场→海鲜）。
消费点（现取复核）：`frontend/src/shell/nav.js:20` `{ key: 'home', …, labelKey: 'home' }` —— locale 顶层 `home` 键唯一生产消费点；桌面头部用 `siteTitle`（不同键，未动）。

## 四语对照（改前 → 改后）

| 语 | 改前 | 改后 |
|----|------|------|
| zh | 海鲜市场 | 海鲜 |
| hk | 海鮮市場 | 海鮮 |
| en | Seafood Market | Seafood |
| vn | Chợ hải sản | Hải sản |

改动文件：`frontend/src/locales/{zh,hk,en,vn}.json` 各 1 行（`home` 值），键数不变。

## 门套

| 门 | 基线（改前） | 改后 |
|----|--------------|------|
| `npm run build` | — | exit 0（✓ built in 1.88s） |
| `npm run test:unit` | 59 files / 568 tests 全过 | 59 files / 568 tests 全过 |
| 四语拍平键数 | 1106 / 1106 / 1106 / 1106 | 1106 / 1106 / 1106 / 1106（两两差 0） |
| 黑名单 `node scripts/p4z-i18nviol-global.mjs` | PASS（裸命中 0） | PASS（locale 裸命中 0 + 源面裸命中 0；键集 {1106} 单值；en/vn 残留中文 0） |

## diff（全量）

```diff
--- a/frontend/src/locales/zh.json
-  "home": "海鲜市场",
+  "home": "海鲜",
--- a/frontend/src/locales/en.json
-  "home": "Seafood Market",
+  "home": "Seafood",
--- a/frontend/src/locales/hk.json
-  "home": "海鮮市場",
+  "home": "海鮮",
--- a/frontend/src/locales/vn.json
-  "home": "Chợ hải sản",
+  "home": "Hải sản",
```

## 字面冻结复核

- `theme-shell-isomorphism.test.jsx:269` 断言 `tables[0].siteTitle`（`siteTitle` 键），非 `home` —— 测试无 `home` 值字面冻结。
- 全仓源码 grep 旧值：仅 `theme/tokens.js:1` 注释与 `ops/` 历史产物命中，均非用户可见文案/活代码。
- `siteTitle` / `siteBrand` 值含「海鲜市场」者属其他键，本单未动。

时间：2026-10-19 · commit 不 push。
