# SPEC-NOTE · 上传图片上限 2MiB → 1MiB 规范收口（closures）

- **仓**：`/Users/kevin/bistro/seafood`
- **角色**：Jing（只写 `docs/**` + 本件）
- **Kevin 指令（逐字）**：「可以直接限制上传图片大小不要超出 1M」
- **落笔时点 HEAD**：`793d4b9`（`origin/main = HEAD` · `git rev-list --left-right --count origin/main...HEAD` = `0 0`）
- **本笔不 push**（push 由 Zang 执行）

---

## 0. 一句话

上限从 **2MiB（2,097,152）** 收到 **1MiB（1,048,576）**，三层同口径（路由 handler / DB CHECK / 客户端编码）；三册**纯追加**（删除列全 0）登记，旧 `2MiB` 字面**一处未删**，以新节 + 勘误表收口读法。

## 1. 文件面（本笔只改这 4 个）

| # | 文件 | 动作 | numstat（现取） |
|---|---|---|---|
| 1 | `docs/seafood.master-plan.md` | 前插 **§5.424** + 版本表新行 **v0.341** | `53 0` |
| 2 | `docs/route-layer.spec.md` | 顶部新版本块 **v2.41** + **§48.2 段末 1 行指针** + 文末新节 **§48.9** | `34 0` |
| 3 | `docs/data-layer.spec.md` | 顶部新版本行 **v0.36** + 文末新节 **§40.6** | `24 0` |
| 4 | `ops/media-size-1mb/SPEC-NOTE-closure.md` | 新建（本件） | 新增文件 |

`backend-ts/**` / `frontend/**` **零改动**；`git status` 收尾时除本 4 件外应无改动。

## 2. 实现事实（现取）

- **常量**：`backend-ts/src/index.ts:3680` `const MEDIA_MAX_BYTES = 1 * 1024 * 1024;`（改前 `2 * 1024 * 1024`）。
- **边界**：`index.ts:3706` `if (bytes.length > MEDIA_MAX_BYTES)`；`:3707` `sendMediaBadRequest(res,'MEDIA_SIZE_EXCEEDED',{decoded_bytes,max_bytes})` ⇒ **判据 `>`**（恰 1,048,576 放行），超限仍 **400**。
- **文案**：`index.ts:3650` `'media payload exceeds 1MiB after base64 decode'`。
- **传输层**：`index.ts:134` `app.use(express.json({ limit: '4mb' }))` —— **未改**（1MiB 解码 ≈ 1.40MB base64）。
- **迁移**：`backend-ts/migrations/0051_media_size_cap_1mb.sql`（**81 行**）= `DROP CONSTRAINT IF EXISTS media_size_bytes_check`（`:35`）+ `ADD CONSTRAINT media_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 1048576)`（`:37-38`）+ `DO $$` 自检三面（含 `1048576` / `2097152` 零残留 / 无 `>1MiB` 存量行）；幂等；零 `BEGIN`/`COMMIT`。
- **`0050` 未改**：`:48` 仍 `<= 2097152`、自检 ⑦（`:128-133`）仍断言 `2097152` ⇒ **已知留痕**（只在 `0050` apply 时刻成立；改历史文件会撞 checksum ⇒ 整链 ABORT）。
- **客户端**：`frontend/src/pages/item/PublishItemPage.jsx:52` `MAX_IMAGE_BYTES = 1 * 1024 * 1024`；`:54` `QUALITY_LADDER=[0.82,0.72,0.62,0.5]`；`:55` JPEG `[0.85,0.72,0.62,0.5]`；`:57` `EDGE_LADDER=[1280,1120,960,832]` ⇒ **16 档**交叉、命中即收；全超 ⇒ `compressImage` 返 `null` ⇒ 该张拒收 + `role="alert"` 提示 `item.imageTooLarge`。
- **四语键**：`item.imageTooLarge` 各 1 条（`locales/{zh,hk,en,vn}.json:188`）。
- **键数（现算）**：四语 **top 128 / flat 1110 / `item` 53**（四语节点合计 **4440**）；改前 128 / 1109 / 52 / 4436。
- **注册点**：`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` = **110**（get 49 / post 57 / put 0 / delete 3 / patch 1）。

## 3. 质检读数（`19875e7` · verdict = `ops/media-size-1mb/qa/verdict.json` · **14/14 PASS**）

| 臂 | 读数 |
|---|---|
| S1 | 恰 **1,048,576 B ⇒ 200**（`media_id=5`、`size_bytes=1048576`、`deduplicated=false`、请求体 ≈1,398,150 B 未触 4mb） |
| S2 | **1,048,577 B ⇒ 400 `MEDIA_SIZE_EXCEEDED`**，`details={decoded_bytes:1048577,max_bytes:1048576}`（**非 413**） |
| D1 | `pg_constraint` CHECK = `((size_bytes > 0) AND (size_bytes <= 1048576))` **恰 1 条**、`2097152` 零命中 |
| D2 | 故意 `INSERT size_bytes=1048577` ⇒ **SQLSTATE 23514**、回滚零留行 |
| C1 | 客户端三臂：小图 28,688 B 入列（1 次编码、无提示）/ 强制超限 **16 次编码后拒收** + 提示 / `q0.72` 重编 **24,122 B** 命中入列 |
| 门套 | `build` **0** · `test:unit` **60 文件 577 例 0 failed** · 后端 `tsc` **0** · `p7b-03` **37/37** `regs=110` |
| 不回归 | `GET /api/currencies` 2 行 · 390 档首页占位 `naturalWidth=320` |
| 数据 | QA 自建 `media` 行已回收（**前 0 → 后 0**）；**新建 1 个 QA 用户 `uid 971223` 保留并披露** |

## 4. 上线与生产终验（证据 `ops/media-size-1mb/prod-verify/`）

- **迁移先行**：dev 与生产均 apply `0051`（生产 `schema_version` **0050 → 0051**、`PENDING` 空）。
- **push**：`4b36f33..19875e7`；终验证据笔 `793d4b9`（push 后、只含 `prod-verify/**`、**不触发部署**）。
- **同版证明**：js `c79cd6e6fa336aef…`（`index-1EJi3VaF.js` **494,264 B**）/ css `415fa31f…`（未变）。
- **marker 3/3**：`item.imageTooLarge` / zh「单张图片不能超过 1MB」/ en「1MB or smaller」。
- **接口**：`POST /api/media` 无鉴权 **401**；`GET /api/media/1` **404**；`/api/health` `ok:true` `schema_version="0051"`。
- **390 档**：首页占位 320、`/item/1` 详情占位、`/item/new` 登录闸、三页 `pageerror=0`。

## 5. 规范落点（本笔）

| 册 | 落点 | 内容 |
|---|---|---|
| `master-plan` | **§5.424** + 版本表 **v0.341** | A 口径变更 / B 实现 / C 迁移与留痕 / D 客户端降级 / E 质检 14-14 / F 上线 / G 生产终验 / H 诚实清单 / I 规范连带 / **J 12 处旧字面的状态改写式勘误表** |
| `route-layer.spec` | **v2.41** 版本块 + **§48.9** + §48.2 段末指针 | 1MiB 硬顶 / 边界判据（`>`）/ 400 形状 / 传输层 / 库侧同构 / 客户端 16 档 + 提示键 / 键数 / `regs` 仍 110 / 判负 5 条 / 未做项 |
| `data-layer.spec` | **v0.36** 版本行 + **§40.6** | `0051` 落盘形态（DROP/ADD 同名约束 + 自检三面 + 幂等 + 零事务控制）/ apply 态 / **`0050` 自检 ⑦ 旧值留痕** / 未测项 |

## 6. 纯追加自证

```
$ git diff --numstat docs/seafood.master-plan.md docs/route-layer.spec.md docs/data-layer.spec.md
53	0	docs/seafood.master-plan.md
34	0	docs/route-layer.spec.md
24	0	docs/data-layer.spec.md
```

- **删除列全 0**（三册合计 `+111 / −0`）。
- **位置自证**：§5.424 **紧随 §5.423 之前**（倒序前插；`### 5.424` 命中 1 次、`### 5.423` 仍命中 1 次未被改写）；`v0.341` 行**紧接 v0.340 之前**（版本表最新在首）；route `> **状态：v2.41` 命中 **1** 次、紧跟 v2.40 三行块之后；§48.9 为文末新节（`### 48.9` 命中 1 次、编号连续无跳号）；data `v0.36` 为文件最上方首行版本声明。
- **节号连续性**：route 前值最大子节号 §48.8 ⇒ §48.9；data 前值 §40.5 ⇒ §40.6；master-plan 前值 §5.423 ⇒ §5.424。

## 7. 勘误口径（重要）

**旧 `2MiB` 字面 12 处全部保留**（未删、未改），逐条列在 `master-plan` §5.424 J 表（本册 §5.422 C/D、§5.423 B/C/G、版本表 v0.339 / v0.340 行、route §48.2 / §48.4 #2 / §48.8 表 1、data §40.1 / §40.5 表），右侧给现取口径并标 **「以 §5.424 为准」**。`route §48.2` 段末另加 1 行指针（「本段上限已被 §48.9 收口为 1MiB」），不改原行。

## 8. 诚实清单（禁填 0 / 禁冒充实测）

1. **生产无真实上传 E2E**（需真用户登录；生产 `media` 表 **0 行**）⇒ 1MiB / 1MiB+1 边界**只在 dev 同版本代码实测**；生产只验 401 / 404 / 占位渲染 / 同版 sha256。
2. 生产 `media` 0 行 ⇒ 去重命中、`bytea` 读回、CHECK 兜底在**生产未触发**。
3. **派单口径「12 个测试文件可执行断言 + 第 13 个 `tg-bind-qr` 仅注释」与现取差 1**：`git show --name-only ffa3635` 现取 **14 个测试文件 = 13 可执行 + 1 仅注释**（多出 `i18n-batch-b4b.test.jsx` / `i18n-violation-closeout.test.jsx` 各 2 处断言）⇒ 登记以现取为准，派单数字留痕。
4. `0050` 自检 ⑦ 的旧断言**未在任何临时库重放验证**（标 `NOT_MEASURED`）；「新库 0050→0051 顺序无冲突」为迁移链语义推断 + `0051` 头注明文，不是本笔实测。
5. 客户端降级只覆盖 **WebP / JPEG 两族**，其它编码路径**未单独实测**。
6. `B33` 孤儿 media 清理 / `B34` 上传防刷限速**仍挂账**；`media.err.*` 四语键仍未补（400 文案走 R107 英文 `message`）。
7. 本笔**未跑**任何前后端门套（Jing 只写文档 + 引用质检 `19875e7` 的盘上读数）。

## 9. 待 Zang 动作

- **push**（本笔不推）。push 后 `origin/main` 前移 1 笔**纯文档提交** ⇒ 本仓 push 即部署，但产物哈希应不变（零代码位移）；若需要，可复核 js/css sha256 与 `c79cd6e6…` / `415fa31f…` 逐字相同。
