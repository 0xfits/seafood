# SPEC-NOTE · batch-1019-2 规范补登（Jing · 只写 `docs/**` + 本件）

- **单号**：JING-SPEC-BATCH1019-2 · **角色** = Jing（Specifier · 制度员）· **日期** = 2026-10-19
- **基线**：开工 HEAD = `9c8a460`（`origin/main..HEAD` = 3：`9c8a460` / `a7f0dbc` / `a0a464f`，全部未 push）；工作区开工态干净（仅未跟踪 `ops/batch-1019-2/`）。
- **范围（写面）**：`docs/seafood.master-plan.md` + `docs/route-layer.spec.md` + `docs/data-layer.spec.md` + `docs/design/design-system.spec.md` + `docs/OPEN-ITEMS.md` + 本件。**零代码 / 零迁移文件 / 零库写 / 零 HTTP / 未跑任何门 / 不 push**。

## 一、落点清单（节号 / 锚点现取）

| 册 | 动作 | 锚点现取依据 |
|---|---|---|
| master-plan | **前插 §5.422**（媒体上传单契约冻结 + Kevin 决策链 + 更正块）+ **前插 §5.421**（三小单 + 底栏微单）+ **版本表新行 v0.339**（前插于真表首行 v0.338 之上、早期 v0.1–v0.1x 行段之外） | 最大节号现取 = §5.420；最新版本行现取 = v0.338；前插后 `grep -c '^### 5\.42[12] '` = 2、`'^| v0\.339 '` = 1 |
| route-layer | **新版本块 v2.39**（紧随 v2.38 块 ⑥ 行之后）+ **新节 §48**（48.1 裁定与范围 / 48.2 POST 契约表 / 48.3 GET 契约 / 48.4 判负六条 / 48.5 注册点逐 verb / 48.6 前端面 / 48.7 自证与未做项） | 前值最大节号 = §47；`grep -c '状态：v2\.39'` = 1、`'^## §48 '` = 1、`'^### 48\.'` = 7 |
| data-layer | **头部版本号 +1 = v0.34**（前插于 v0.33 行之上，头注留痕未改写 v0.33 行）+ **文末追加 §40**（40.1 七列表契约 / 40.2 写入面与生命周期 / 40.3 迁移 `0050` 内容契约 / 40.4 冲击与未测项） | 前值最新 = v0.33（`:3`）；`grep -c '^## §40 '` = 1 |
| design-system | **勘误级不升版**：版本头勘误块（第三单，插于 2026-10-19 第二单勘误之后）+ §14.1 `T80` 勘误注（requiresAuth 废除 / 恒 5 格含未登录 / 底栏①文案微单）+ §19.2 `T94` 勘误注（渐变占位图条款）——**均状态改写式，旧句逐字保留** | 两处注分别落 `### 14.2` / `### 19.3` 标题之上 |
| OPEN-ITEMS | **头部新块 v2.41**（插于 v2.40 块之后、`## A.` 之前）+ **B 段末追加 `B33`（孤儿 media 清理策略）/ `B34`（上传防刷限速）** | B 编号域现取 max = B32；旧字面零改动 |

## 二、登记要点（Kevin 2026-10-19 裁定）

1. **三小单**（Neng 独立质检 **8/8 PASS**，`ops/batch-1019-2/qa/verdict.json`）：`a7f0dbc`（zh `jobs.cidNote` 去「悬赏」限定，键数不变）/ `a0a464f`（dev 夹具币清理：9 cid 4,10,16,21,29,31,32,35,36 listed→delisted + `currency_status_log` 7→16，原子单语句，Zang 直写 dev `quiet-math-65207667` 自证，平台币 $/BTTC 保留）/ `9c8a460`（底栏恒 5 格：删 `visibleNavItems` + 去 profile `requiresAuth`，BottomTabBar 恒染 `SHELL_NAV_ITEMS`，三测试改锚）；门套新基线 **59 files / 568 tests / 0 failed**（build exit 0，产物 `index-DAobK5Jq.js` / `index-DnoMyxQu.css`）；**已 commit 未 push（ahead 3），生产终验随下一批 push 后补登**。
2. **底栏第一格文案微单（进行中）**：`home` 键值四语改短（海鲜 / 海鮮 / Seafood / Hải sản），键数不变，消费点唯一 = `frontend/src/shell/nav.js:20`（现取）；实现 commit 并行落盘、只登记不冲突。
3. **媒体上传单（契约冻结 · 实现未落）**：Kevin 三裁定（**存储 = A「Neon 存图」** · 张数 ≤4 卡用第一张 · 占位 = 机械鱼图首页卡+详情页都用）+ 决策链 A/B 成本对比（Neon 0.5GB / $0.35 每GB·月 vs Vercel Blob 1GB / $10 每GB·月；Hobby 硬顶不能买超额；50GB/月量级两边都 ≈$19-20）⇒ 裁 A。
4. **两口**：`POST /api/media`（requireActor；JSON `{content_type,data_base64}`；类型魔数校验 fail-loud；≤2MiB；sha256 去重命中返既有 id；成功 `data={url:'/api/media/<id>'}`）+ `GET /api/media/:id`（公开；`Cache-Control: public, immutable`；miss 404 R107）。判负：无 Authorization 上传 401 / >2MiB 400 / `content_type` 超闭集 400 / GET miss 404 R107 / 公开 GET 200+immutable / 同字节重传返既有 id。
5. **注册点 108 → 110**（get 48→49 / post 56→57；改前现取 = 108 = get 48 / post 56 / put 0 / delete 3 / patch 1）；`p7b-03` `AC10-2` 冻结面 108 ⇒ **110** 同批前推（归实现单；门现值 108 = 前推前正常态）。
6. **数据面**：迁移 `0050_media_store.sql` 建 `public.media`（`media_id` identity PK / `sha256` char(64) / `content_type` CHECK IN (image/webp,image/jpeg,image/png) / `bytes` bytea / `size_bytes` int CHECK ≤2MiB / `owner_uid` FK users / `time_created`；**UNIQUE(sha256,size_bytes)** 内容去重；**零动既有表**）；**文件由实现单创建、apply 由 Zang、先 apply 后 push**。
7. **前端面**：发布页可选图片 ≤4（客户端压缩长边 ≤1280 · WebP ≤300KB）；上传失败 ⇒ 发布取消、明确报错、不留半截商品；`media_urls` 写口零改；首页卡与详情页 image 槽 = `media_urls[0] || 机械鱼占位`；design T94「渐变占位图」条款勘误（渲染面允许真图/占位图填充原几何盒）。
8. **★ 占位资产（收笔口径更新 · Kevin 2026-10-19 拍板）**：~~压缩 ≤10KB~~ ⇒ **320×320 q25 WebP = 12,616 bytes（≈12.6KB）**，sha256 `df33258e964447072486b376dfd3936d9c99ca89d8d69022cb4c9fac70be74ec`（落盘现取：`ls -l` 12,616 B + `file` 自证 `RIFF…Web/P…320x320`）——**放弃 10KB 线换画质**。源附件 = 1024×1024 PNG 2.1MB（sha256 `7df54243…`）。**全部新落册字面均已按新口径书写**（本单中途收到的口径更新，无「≤10KB」残留）。
9. **更正（状态改写式）**：§5.420 标题/D 段与版本表 v0.338 行「BTTC cid **dev=21**」**实为 dev=399**（dev cid 21 = QA 夹具币 `P4B3B590800X`，已在 `a0a464f` 退市）；现取依据 = QA `AC6`（`GET /api/currencies` 200 rows=2：cid 1 `$` / cid **399** `BTTC battcoin`）+ §5.416 既有登记；旧字面不删、以 §5.422 G 与 v0.339 行为准。
10. **OPEN-ITEMS 挂账两条**：`B33` 孤儿 media 清理策略 / `B34` 上传防刷限速（均「只登记、不实现」）。

## 三、纪律自证（收笔现取）

- **`git diff --numstat`（五册，删除列全 0 = 纯追加/前插）**：
  - `docs/seafood.master-plan.md` = **34 + / 0 −**（含 §5.421 D′ 续段 2 行）
  - `docs/route-layer.spec.md` = **61 + / 0 −**
  - `docs/data-layer.spec.md` = **37 + / 0 −**
  - `docs/design/design-system.spec.md` = **6 + / 0 −**
  - `docs/OPEN-ITEMS.md` = **5 + / 0 −**
- **锚点复验**：§5.421 / §5.422 / v0.339 / v2.39 / §48（含 48.1–48.7）/ v0.34 / §40 / design 三处勘误注 / v2.41 / B33+B34 —— 逐项 `grep -c` = 恰 1（节号对 = 2）；v0.339 行邻行核验 = `:8916` v0.10（早期行段末行）→ `:8917` v0.339 → `:8918` v0.338，**未落入早期升序行段**。
- **★ 收笔续取**：底栏第一格文案微单**已并行入库 = `402a146`**（四语 `home` 现值 = 海鲜 / Seafood / 海鮮 / Hải sản，与本单 §二.2 逐字一致；`nav.js` 零触碰 ⇒ 消费点 `nav.js:20` 行号仍有效；键数 1106×4 不变）⇒ `origin/main..HEAD` 收笔现取 = **5**（3 小单 + 微单 + 本登记件），**仍未 push**；master-plan §5.421 已补 **D′ 续段**同批登记。
- **本 commit 只 add**：上述五册 + `ops/batch-1019-2/SPEC-NOTE.md`（**不 `git add -A`**）；`ops/batch-1019-2/qa/**`（Neng 质检证据：verdict + readings + 探针 + REPORT）保持未跟踪，**入库归质检方/收口方**（本单不代提交）。
- **未 push**（铁律：实现未落、迁移 `0050` 未 apply；本批纯 docs）。

## 四、未做项（诚实边界）

- 门 `p7b-03` `AC10-2` 常量未改（现值 108；前推 110 归实现单同批）。
- `0050_media_store.sql` 未创建；两口零实跑；`media` 表未建、未测。
- 四语键零改动（若实现需新文案键 ⇒ 13 文件硬编计数前推，另行登记）。
- ~~底栏第一格文案微单实现 commit 待落盘~~ ⇒ **已并行入库 = `402a146`**（四语 home 值与本单 §二.2 逐字一致；`nav.js` 零触碰；本单登记与实现零冲突）。
- 生产终验未做（三小单随下一批 push 后补登；媒体单待实现 + apply + push 后另轮）。
