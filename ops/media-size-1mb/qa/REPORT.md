# 1MiB 上限 · 独立复验报告（`ffa3635`）

- 单号：`ffa3635 feat(seafood): 上传图片上限收到 1MiB（Kevin 指令：不要超出 1M）`
- 复验时间：2026-10-19 12:29–12:33 CST（dev）
- 复验范围：服务端 1MiB 边界 · DB CHECK 硬闸 · 客户端降级 · 门套 · 不回归
- **结论：PASS（14/14）** —— 机读见 `qa/verdict.json`
- 状态：**未 commit / 未 push**；未调用任何发布接口（零业务行写入）

---

## 0. 环境与前提（现取）

| 面 | 读数 |
|---|---|
| dev 后端 | `http://localhost:5788` · `ts-node src/index.ts`（HEAD `ffa3635` 工作区） · `/api/health` ⇒ `ok:true` · `schema_version:"0051"` |
| dev 前端 | `http://localhost:5800`（vite dev，页面 `dist` 无关） |
| 视口 | 390×844 @2x（mobile） |
| 库 | dev `DATABASE_URL`（`.env.local`） |
| 鉴权 | **每次运行随机生成 ethers 钱包** → `/api/auth/challenge`(200) → `signMessage` → `/api/auth/verify`(200，token 239 字符) · 私钥/地址不落盘，仅打地址尾 6 位 `846388` |

登录链路本身已证明后端跑的是**新常量**：超限响应文案 = `media payload exceeds 1MiB after base64 decode`（旧版为 2MiB）。

---

## 1. 服务端边界（关键）—— 两例都命中

请求体均为 `{content_type:"image/webp", data_base64:…}`；webp 容器 12 字节 RIFF/WEBP 头合规（过魔数闸），实测请求体 ≈ **1,398,150 bytes**（< `express.json` 4mb ⇒ 应走 handler 的 400 路径而非 413）。

| 用例 | 解码字节 | body ≈ | http | 机读结果 |
|---|---|---|---|---|
| S1 恰 1MiB | 1,048,576 | 1,398,150 | **200** | `{url:"/api/media/5", media_id:5, size_bytes:1048576, sha256…6ad250, deduplicated:false}` |
| S2 1MiB+1 | 1,048,577 | 1,398,150 | **400** | `code=MEDIA_SIZE_EXCEEDED` · `i18n_key=media.err.MEDIA_SIZE_EXCEEDED` · `details={decoded_bytes:1048577, max_bytes:1048576}` |

- S2 **没有** 落成 413：`express.json({limit:'4mb'})` 未动，业务闸在 handler 内先于入库判。
- S1 证明 `>` 而非 `>=`：恰 1MiB 被接收并真实入库（`size_bytes=1048576`）。该行随后回收（见 §5）。

---

## 2. DB 硬闸

```
media_size_bytes_check | CHECK (((size_bytes > 0) AND (size_bytes <= 1048576)))
```

- `pg_constraint` 中涉及 `size_bytes` 的 CHECK **恰 1 条**；定义含 `1048576`、**不含** `2097152`（无双约束并存放行）。
- 故意失败 INSERT（`size_bytes=1048577`，其余列正常，事务内）⇒ **`23514`** · `constraint=media_size_bytes_check` · `new row for relation "media" violates check constraint "media_size_bytes_check"` ⇒ `ROLLBACK`，**零留行**。
- 反向对照：同事务插入 `size_bytes=1048576` **无报错**（随后 `ROLLBACK`）⇒ 边界值在 CHECK 内侧，不是「一刀切拒 1MiB」。

---

## 3. 客户端降级（390 档 · 重跑入库脚本）

`node ops/media-size-1mb/probe-390.mjs`（`**/api/**` 全 abort、假 JWT、零写）：

| 臂 | 读数 | 判 |
|---|---|---|
| P1 正常图 2400×600 PNG | 入列 1 张 · `28,688 B` ≤ 1,048,576 · 1 次编码 · 零提示 | PASS |
| P2 全档位强制超限（`toDataURL` 桩） | **16 次编码**（4 质量档 × 4 边长档）后拒收 · 缩略图 0 张 · 提示 `单张图片不能超过 1MB` · `role=alert` · 可见 | PASS |
| P3 首档超限 ⇒ 降级 | 第 2 次编码 `quality=0.72` 命中 ⇒ 入列 1 张 · `24,122 B` | PASS |

三臂 `pageErrors=0`。与实现轮读数（`28,688 / 16 次 / 24,122`）**逐字一致**；`probe-390.json` 的 diff 仅 `at` 时间戳一行。

i18n `item.imageTooLarge` 四语在场（`frontend/src/locales/*.json:188`）：

- zh：单张图片不能超过 1MB · hk：單張圖片不能超過 1MB · en：Each image must be 1MB or smaller · vn：Mỗi ảnh không được vượt quá 1MB

---

## 4. 门套（HEAD 自跑）

| 门 | 读数 | 判 |
|---|---|---|
| `npm run build`（frontend） | exit 0 · `✓ built in 1.81s` · `index-1EJi3VaF.js 454.41 kB` | PASS |
| `npx vitest run src/test/unit` | **60 文件 / 577 例全绿**（=预期下限，未减） | PASS |
| `npx tsc --noEmit`（backend-ts） | 输出 0 字节（0 error） | PASS |
| `p7b-03-offline-gates` | **37/37** · `failed:0` · `registration_points=110`（< 111 ⇒ 零新路由） | PASS |

---

## 5. 不回归

| 检查 | 读数 |
|---|---|
| `GET /api/currencies` | 2 行：`cid=1 $ 平台积分` / `cid=399 BTTC battcoin` |
| 390 档首页占位图 | `home-items` 下 8 个 `<img>` 全部 `placeholder-item.webp` · `naturalWidth=320`/`naturalHeight=320`/`complete=true`（未传图商品仍走机械鱼占位） |
| `/item/new` 选图字段 | `input[data-sf-m=item-image-input]`：`type=file` · `accept=image/*` · `multiple=true`；`+` 按钮（`item-image-add`）在且未 disabled；`docScrollWidth=390` 无横向溢出；`pageErrors=0` |

---

## 6. 数据回收与留痕

- `public.media` 行数：**前 0 → 后 0**（S1 建的 `media_id=5` 已按 id DELETE，`deleted_rows=1`）。
- media 表 CHECK 之外无新约束/索引变更；0050 历史文件一字未动（checksum 冻结）。
- 越界请求（S2）与两次事务内 INSERT 全部零留行。
- **披露 1**：真钱包登录按登录路径新建 `users` 一行（`uid=971223`，地址尾 `846388`，`bio` 空，无任何子表引用）—— 登录固有写入、非媒体行；未删除（避免多余写）。
- **披露 2**：`media_id` identity 序列已推进（末值 5 的那行已删，仅序列前进，行数为 0）。
- **披露 3**：0050 迁移自检块仍断言旧上限 `2097152`（历史文件不改）⇒ 只在「重建 ledger 全链重放」时需以 0051 为终态，日常 apply 不构成回归。

---

## 7. 证据清单

```
ops/media-size-1mb/
├── probe-api-1mb.mjs                # 本次新增：真钱包 + 1MiB 边界 + DB CHECK/INSERT + 回收
├── probe-390.mjs                    # 既有（重跑）
├── probe-regression-390.mjs         # 本次新增：占位图 320 + /item/new 选图字段
├── readings/
│   ├── api-1mb.json                 # S1/S2/D1/D2/R1 原始读数（含 error.details）
│   ├── probe-390.json               # 三臂（重跑；与实现轮仅 at 不同）
│   ├── regression-390.json          # N2/N3
│   ├── qa-gates.json                # 门套等值机读摘要（logs 被 .gitignore 的 *.log 挡住）
│   ├── qa-build.log · qa-test-unit.log · qa-backend-tsc.log · qa-p7b-03.log
│   └── qa-p7b-03-artifact.json      # p7b-03 run-tagged 原件（含 registration_points=110）
└── qa/
    ├── verdict.json                 # 14 项机读判定（由 aggregate-verdict.mjs 从读数聚合）
    ├── aggregate-verdict.mjs
    └── REPORT.md                    # 本文件
```
