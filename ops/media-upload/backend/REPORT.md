# 媒体上传 · 后端阶段（实现单）

**日期**：2026-10-19 · **执行**：Kong（实现子代理）· **契约真源**：`route-layer.spec v2.39 §48` + `data-layer.spec v0.34 §40` + `master-plan §5.422`（全部现读）

## 交付面（4 文件 + 读数）

| 文件 | 内容 |
|---|---|
| `backend-ts/migrations/0050_media_store.sql` | 新建 `public.media`（7 列逐字 = §40.1 契约：identity PK / sha256 char(64) / content_type 三值闭集 CHECK / bytea / size_bytes ≤2MiB CHECK / owner_uid FK→users / time_created）+ `UNIQUE(sha256, size_bytes)` 去重键 + `media_sha256_idx` 索引 + 尾部 `DO $$` 自检块（表/列/类型/identity=BY DEFAULT/PK/UNIQUE/2×CHECK/FK/索引 九面，任一缺席 ⇒ RAISE 整迁移回滚）。**文件内零 BEGIN/COMMIT**（migrate.ts 逐文件包事务）。零动既有表。 |
| `backend-ts/src/database.ts` | `createMedia({sha256, contentType, bytes, sizeBytes, ownerUid})`（单语句 CTE：INSERT … ON CONFLICT (sha256,size_bytes) DO NOTHING + UNION ALL 取既有行 ⇒ `{outcome:'inserted'|'existing', row}`，同 createFavoriteRow 手法）+ `getMediaById(id)`（bytes/content_type，miss ⇒ null）。bytea 绑定 = hex 字符串 + 服务端 `decode(…,'hex')`（驱动无关，不经 Buffer 参数序列化路径）；bytea 读回经 `normalizeBytea`（Buffer/Uint8Array/`\x<hex>` 三形态归一）。 |
| `backend-ts/src/index.ts` | ① `POST /api/media`（requireActor ⇒ 401；content_type 闭集 ⇒ 400；RFC 4648 严格 base64 ⇒ 400；解码 ≤2MiB ⇒ 400；魔数 fail-loud webp=RIFF….WEBP/jpeg=FF D8 FF/png=89 50 4E 47 ⇒ 400；成功 `sendSuccess({url, media_id, sha256, size_bytes, deduplicated})`）；② `GET /api/media/:id`（公开无闸；命中 200 + Content-Type + `Cache-Control: public, max-age=31536000, immutable`；miss/非数字 id ⇒ 404 走既有 `sendRefNotFound` = R107 统一口径，承 §48.3 冻结）；基础设施异常走既有 `sendInfraMapped`（503 族）。**MEDIA_\* 400 族 4 码集中定义**于两口上方（逐条注释码语义；i18n 指针域 `media.err.*`；**不碰** ledger-errors.ts 33 码账本闭集）。 |
| `backend-ts/scripts/p7b-03-offline-gates.ts` | `AC10-2` 冻结面 108 → **110** + 派生注释链追加本单出处（→110 media-upload 两口）；其余判据一字未动。 |

## 门套（全绿 · 读数在本目录）

- `npx tsc --noEmit` ⇒ **exit 0**（`tsc-noemit.txt`）。
- `npx ts-node --transpile-only scripts/p7b-03-offline-gates.ts` ⇒ **37/37 passed / 0 failed**，`AC10-2` = pass、`registration_points=110`（`p7b-03-run.log` + artifact JSON）。
- 注册点现取：开工 = **108**（get 48 / post 56 / put 0 / delete 3 / patch 1）= §48.5 改前口径；落盘后 = **110**（get 49 / post 57 / put 0 / delete 3 / patch 1）= §48.5 目标态（`registration-points.txt`）。
- 迁移结构自证 = **21/21**（`check-migration-0050.cjs` → `check-migration-0050-result.json`：语句面/列面逐字契约/加法面零 UPDATE·DELETE·DROP·ALTER/括号面）。

## 启用性改动（超出「纯增两口」的最小必要面，单列明示）

- `app.use(express.json())` → `app.use(express.json({ limit: '4mb' }))`（index.ts:131 一处）。**为什么必须**：`data_base64` = 解码后 ≤2MiB 的 base64 文本（2MiB ≈ 2.80MB）+ JSON 信封；缺省 100kb 上限连前端 ≤300KB 的正常压缩图（≈405KB 请求体）都会 413，**两口根本不可用**，且 §48.4 #2 的「解码后 >2MiB ⇒ 400」判负探针（~2.8MB 体）在 100kb 下也到不了 handler。4mb 上限覆盖 ~3MiB 解码量 ⇒ 合同内全部载荷可达 400 业务闸；超过传输上限的体属合同外（HTTP 413 语义诚实）。全局影响面 = 解析层上限放宽，既有路由各自的形状/金额闸不受影响。

## 判定与借码（§48.2 授权实现单裁量处，随质检回写）

- 400 族借码定为新增 `MEDIA_*` 域 4 码（`MEDIA_CONTENT_TYPE_INVALID` / `MEDIA_BASE64_INVALID` / `MEDIA_SIZE_EXCEEDED` / `MEDIA_MAGIC_MISMATCH`），集中定义于 index.ts 两口上方，错误体 = R107 形状（同 `ledgerErrorBody` 形状；i18n_key 指针域 `media.err.<CODE>`，四语键随前端单补——本单不碰 frontend/）。
- 404 用既有 `sendRefNotFound`（code = `LEDGER_REF_NOT_FOUND`）：§48.3 冻结「走 sendRefNotFound（R107 统一 404 口径）」，故 GET miss/非数字 id 不新开 MEDIA_ 404 码——`MEDIA_*` 只覆盖 POST 400 族。

## 未做项（诚实边界）

- 迁移**未 apply**（dev/生产 apply 归 Zang，先 apply 后 push）；两口**未实跑 HTTP**（表未建；`@neondatabase/serverless` 对 bytea 的读回形态已做三形态防御归一，apply 后首轮探针应核 `normalizeBytea` 命中分支）。
- `media.err.*` 四语键未加（前端另单，本单禁碰 frontend/ 与 docs/）。
- 未建 owner_uid 索引（§40.3 实现单裁量：owner 轴一期零读口消费，B33 清理落地时随单补）。
