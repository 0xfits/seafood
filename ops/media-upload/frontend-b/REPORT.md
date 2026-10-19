# 媒体单 · 前端阶段 B（写侧上传）读数

日期：2026-10-19 · 仓：`/Users/kevin/bistro/seafood` · 基线：`224775f`

## 改动面

| 文件 | 内容 |
|---|---|
| `frontend/src/pages/item/item-api.js` | `+8`：`uploadMedia(user, {content_type, data_base64})` ⇒ `POST /api/media` |
| `frontend/src/pages/item/PublishItemPage.jsx` | `+118/-2`：图片字段（input/add/缩略图/移除）+ 客户端压缩 + 先上传后发布（失败即取消） |
| `frontend/src/pages/item/item.css` | `+47`：`.sf-item-file`（隐藏 input）/ `.sf-item-image-row` / `.sf-item-image-thumb`（64×64）/ `.sf-item-image-remove` |
| `frontend/src/locales/{zh,hk,en,vn}.json` | 各 `+4/-1`：item 命名空间恰 3 个新键（四语同补） |
| `frontend/src/test/unit/*.jsx|js`（13 文件） | 各 `+1~2/-1~2`：键数断言等值前推（1106⇒1109 / 4424⇒4436，top 128 不变）+ 口径留痕 |
| `frontend/src/test/unit/publish-item-image.test.jsx` | 新增 269 行 · 6 例 |

## 门套

- `npm run test:unit` ⇒ **60 files / 574 tests 全绿**（基线 59/568 ⇒ 例数只增不减，+1 文件 +6 例）
  - 日志：`gates-test-unit.log`；退出码：`gates-exit-codes.txt`（TEST_EXIT=0）
- `npm run build` ⇒ **exit 0**（`✓ built in 1.96s`）
  - 日志：`gates-build.log`；退出码：BUILD_EXIT=0
- 注：仓内**无 ESLint 配置文件**（`npm run lint` 对全仓本就不工作）⇒ 未纳入门套；`npm run build`（esbuild 语法层）已过。

## 四语键数（python 现取 · 改前/改后）

| 语言 | top | flat | item | 四语节点（flat×4） |
|---|---|---|---|---|
| zh/en/hk/vn 改前 | 128 | 1106 | 49 | 4424 |
| zh/en/hk/vn 改后 | **128** | **1109** | **52** | **4436** |

- 四语拍平键集**逐文件相同**（`set` 相等 = True）。
- 改后逐语：zh top 128 / flat 1109 / item 52 / nodes*4 4436；en/hk/vn 同数（见 `i18n-counts.md`）。
- 新增值过工程口径黑名单（`读口/讀口/读面/服务端/伺服器端//api//幂等/status=/uID/bID/§`）扫描 = 0 命中；
  en/hk/vn 无残留中文，vn 无中文残留。

## 真浏览器探针（dev 5800 · 390×844）

见 `probe-390.md`。要点：
- form 在场、login wall = false、`docScrollWidth = 390`（零横向溢出）；
- `item-image-input`：`type=file accept=image/* multiple`、`display:none`（隐藏）；
- `item-image-add`：可见 34×44、初始 enabled；
- **5 张同选 ⇒ 只收 4 张**（上限生效），4 缩略图均 64×64、`src` 前缀 `data:image/webp;`；
  4 张时 add 自动 disabled，移除 1 张后恢复；
- 压缩几何自证：2400×600 PNG ⇒ 编码后 **1280×320** WebP（长边 ≤1280 真实生效）；
- 选图/移除路径 `window.onerror` + `unhandledrejection` = 0。

探针会话说明：真实后端会按 401 治理清掉伪造本地会话（行为正确）；本探针用
`Network.setBlockedURLs(['*://localhost:5800/api/*'])` 阻断 `/api/*` 以停在表单面，
**未发任何写请求**。上传 E2E（真登录 + POST /api/media + 发布落库）留给 Neng。

## 纪律

- 未 push、未改 docs、未写库。
- commit 只含本单文件（含本读数目录）。
