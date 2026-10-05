# S42 —— run-tagged 证据链产物 `.gitignore` 收敛

- 角色：Kong（微单）｜执行日：2026-10-05｜runid：`20261005T124024Z`
- 父单：Kevin 已批准（S43 派单单据 §5.368 一并列明本单范围）
- 产物目录：`backend-ts/.s42-artifacts/20261005T124024Z/`（另 `pre/` 存原始快照）
- 唯一被改动的非产物文件：`.gitignore`（仅**新增**本段，未改任何既有行）

---

## §0 对锚

```
$ git log --oneline -3          # 开工现取
0a2b886 docs: §5.368/v0.368 …（Kevin 批准 S42/S43 收尾两件）
7178126 chore(gate): S41b …（24 单 · 16 门 · 台账全清）
5e3d0fb docs: §5.366/v0.366 …（S41 核盘）
$ git status --porcelain | grep -v '^??'   -> 0 行（纯净工作面）
$ git status --porcelain | grep -c '^??'   -> 394
$ git ls-files | wc -l                     -> 3673
```

- `.gitignore` 现取：`sha256 0f7689543ded7978da8b71c60a57556c5b1979553fdf19a1728192f85b252c3f`，md5 `3eb276020454670d500772876f1b1325`，**325 行**（存在，非缺失）。
- ★对锚漂移自曝：**本单开工首次读 HEAD=7178126**，执行中途 HEAD 前进到 `0a2b886`（另一路的 docs 提交，非本单所为，本单全程未 commit/push）。`ls-files` 前后均 3673 ⇒ 该提交未动已跟踪计数，本单读数不受影响。

---

## §1 未跟踪件归并表（现取，对锚前的 `??` 快照）

原始快照见产物 `00-default-before.txt`（默认视图 393 行）/ `00-uall-before.txt`（`-uall` 全展开 1027 行）。

**归并结论：未跟踪件共 1027 个（`-uall` 全展开），100% 落在 run-tagged 产物目录内，非产物面 = 0。**

- 默认 `git status`（393 行）中：**359 行**是「整目录未跟踪 ⇒ 折叠为 `dir/`」，**34 行**是「目录部分被跟踪 ⇒ 逐文件列出」；两类 393 行**全部**是产物。
- `-uall`（1027 文件）按目录归并如下（55 个目录）：

| # | 目录（现取真实名） | 未跟踪件数 | 类 |
|---|---|---:|---|
| 1 | `backend-ts/.p3j-artifacts/` | 4 | 产物类（证据链） |
| 2 | `backend-ts/.p3v-artifacts/` | 3 | 产物类（证据链） |
| 3 | `backend-ts/.p4-artifacts/` | 2 | 产物类（证据链） |
| 4 | `backend-ts/.p7b-artifacts/` | 25 | 产物类（证据链） |
| 5 | `backend-ts/.p8s1-artifacts/` | 16 | 产物类（证据链） |
| 6 | `backend-ts/.p8s10-artifacts/` | 27 | 产物类（证据链） |
| 7 | `backend-ts/.p8s11-artifacts/` | 30 | 产物类（证据链） |
| 8 | `backend-ts/.p8s2-artifacts/` | 20 | 产物类（证据链） |
| 9 | `backend-ts/.p8s3-artifacts/` | 29 | 产物类（证据链） |
| 10 | `backend-ts/.p8s3b-artifacts/` | 27 | 产物类（证据链） |
| 11 | `backend-ts/.p8s4-artifacts/` | 25 | 产物类（证据链） |
| 12 | `backend-ts/.p8s5-artifacts/` | 29 | 产物类（证据链） |
| 13 | `backend-ts/.p8s6-artifacts/` | 20 | 产物类（证据链） |
| 14 | `backend-ts/.p8s6-ro/` | 2 | 产物类（证据链） |
| 15 | `backend-ts/.p8s7-artifacts/` | 35 | 产物类（证据链） |
| 16 | `backend-ts/.p8s8-artifacts/` | 36 | 产物类（证据链） |
| 17 | `backend-ts/.p8s9-artifacts/` | 25 | 产物类（证据链） |
| 18 | `backend-ts/.p9s10-s4a/` | 13 | 产物类（证据链） |
| 19 | `backend-ts/.p9s11-arms/` | 5 | 产物类（证据链） |
| 20 | `backend-ts/.p9s11-recon/` | 4 | 产物类（证据链） |
| 21 | `backend-ts/.p9s12-arms/` | 5 | 产物类（证据链） |
| 22 | `backend-ts/.p9s12-recon/` | 5 | 产物类（证据链） |
| 23 | `backend-ts/.p9s13/` | 4 | 产物类（证据链） |
| 24 | `backend-ts/.p9s15-archive/` | 3 | 产物类（证据链） |
| 25 | `backend-ts/.p9s16-arms/` | 5 | 产物类（证据链） |
| 26 | `backend-ts/.p9s16-recon/` | 6 | 产物类（证据链） |
| 27 | `backend-ts/.p9s7-impl/` | 5 | 产物类（证据链） |
| 28 | `backend-ts/.p9s8-s2/` | 2 | 产物类（证据链） |
| 29 | `backend-ts/.p9s9-s3/` | 6 | 产物类（证据链） |
| 30 | `backend-ts/.s19-artifacts/` | 14 | 产物类（证据链） |
| 31 | `backend-ts/.s20-artifacts/` | 3 | 产物类（证据链） |
| 32 | `backend-ts/.s21-artifacts/` | 9 | 产物类（证据链） |
| 33 | `backend-ts/.s23-artifacts/` | 15 | 产物类（证据链） |
| 34 | `backend-ts/.s26-artifacts/` | 11 | 产物类（证据链） |
| 35 | `backend-ts/.s27-artifacts/` | 31 | 产物类（证据链） |
| 36 | `backend-ts/.s29-artifacts/` | 25 | 产物类（证据链） |
| 37 | `backend-ts/.s31-artifacts/` | 52 | 产物类（证据链） |
| 38 | `backend-ts/.s32-artifacts/` | 20 | 产物类（证据链） |
| 39 | `backend-ts/.s32b-artifacts/` | 20 | 产物类（证据链） |
| 40 | `backend-ts/.s32c-artifacts/` | 39 | 产物类（证据链） |
| 41 | `backend-ts/.s34-artifacts/` | 9 | 产物类（证据链） |
| 42 | `backend-ts/.s36-artifacts/` | 22 | 产物类（证据链） |
| 43 | `backend-ts/.s37-artifacts/` | 42 | 产物类（证据链） |
| 44 | `backend-ts/.s38-artifacts/` | 41 | 产物类（证据链） |
| 45 | `backend-ts/.s40-artifacts/` | 93 | 产物类（证据链） |
| 46 | `backend-ts/.s41-artifacts/` | 12 | 产物类（证据链） |
| 47 | `backend-ts/.s42-artifacts/` | 1 | 产物类（证据链） |
| 48 | `backend-ts/.zang-artifacts/` | 1 | 产物类（证据链） |
| 49 | `docs/audit/.s35-artifacts/` | 7 | 产物类（证据链） |
| 50 | `frontend/.s22-artifacts/` | 15 | 产物类（证据链） |
| 51 | `frontend/.s25-artifacts/` | 14 | 产物类（证据链） |
| 52 | `frontend/.s28-artifacts/` | 25 | 产物类（证据链） |
| 53 | `frontend/.s30-artifacts/` | 19 | 产物类（证据链） |
| 54 | `frontend/.s33-artifacts/` | 32 | 产物类（证据链） |
| 55 | `frontend/.s39-artifacts/` | 37 | 产物类（证据链） |

> 旁证：仓库本就把「旧轮次」证据产物入库（已跟踪 2633 件落在产物目录内，如 `backend-ts/.p4-artifacts/` 544 件、`.p7aqa-artifacts/` 153 件等）。本单**不动已跟踪件**，只让「新增未跟踪件」不再冒泡。

---

## §2 新增规则逐条与理由

写入 `.gitignore` **末尾**，不改动上方任何既有行（325 → 349 行，+24 行）。原文件备份于产物 `05-gitignore-after.txt`，改前内容哈希见 §0。

```
# (1) **/.*-artifacts/
# (2) **/.*-ro/
# (3) backend-ts/.p9s*/
```

| 规则 | 命中目录（现取） | 理由 |
|---|---|---|
| `**/.*-artifacts/` | 42 个 `.xxx-artifacts/`：backend-ts 34 个（.p3j/.p3v/.p4/.p7b/.p8s1..p8s11/.s19..s41 含 .s32b/.s32c）、frontend 6 个（.s22/.s25/.s28/.s30/.s33/.s39）、docs/audit 1 个（.s35）、.zang-artifacts | 证据链产物目录的**统一命名族**；`**/` 前缀让任意层级（backend-ts/、frontend/、docs/audit/）一次覆盖，且**自动续接后续新轮次**，无需每轮改 .gitignore |
| `**/.*-ro/` | 现取唯一：`backend-ts/.p8s6-ro/`（2 件：diag-submit2.out/.ts） | `-ro`=只读 run 取证件，命名族同源；同样自动续接 |
| `backend-ts/.p9s*/` | 12 个：.p9s7-impl/.p9s8-s2/.p9s9-s3/.p9s10-s4a/.p9s11-arms/.p9s11-recon/.p9s12-arms/.p9s12-recon/.p9s13/.p9s15-archive/.p9s16-arms/.p9s16-recon | 这批阶段目录**既不叫 `-artifacts` 也不叫 `-ro`**（后缀 -impl/-s2/-s3/-s4a/-arms/-recon/-archive），前两条通配全落空，必须单列一条 |

未采用的候选：不写单目录长清单（55+ 条易腐化），改用 3 条通配族规则；`backend-ts/.s42-artifacts/` 无需单列，已被 (1) 覆盖。

---

## §3 六项验证读数

| # | 验证项 | 命令 | 读数 | 判定 |
|---|---|---|---|---|
| ① | 未跟踪件前后对照 | `git status --porcelain \| grep -c '^??'` | **394 → 0** | ✅ 降为 0 |
| ② | 已跟踪件零影响 | `git ls-files \| wc -l` | **3673 → 3673**（逐字相同） | ✅ |
| ③ | 工作面不受影响 | `git status --porcelain \| grep -v '^??'` | pre **0 行** → post **1 行**：` M .gitignore` | ⚠️ 见下注 |
| ④ | 仍未忽略清单 | `git status --porcelain \| grep '^??'` | **空**（0 件，见 §4） | ✅ |
| ⑤ | `check-ignore` 样本 ≥3 | `git check-ignore -v <p>` | 6 条样本全部命中（见下） | ✅ |
| ⑥ | 负对照 | 见下 | 新建件不显示 + check-ignore 命中 + rm 零残留 | ✅ |

**③ 注（自曝）**：改 `.gitignore` 本身即是一次「已跟踪件的工作区修改」，故 post 的非 `??` 行不可能是 0，而是恰好 1 行 ` M .gitignore`。除它之外**无任何其它已跟踪改动**（`git status --porcelain | grep -v '^??'` 只此一行；`git diff --stat` 仅 `.gitignore`）。即「工作面（代码/迁移/规范/台账/主计划）零改动」成立，唯一变更 = 本单被授权的那一次 `.gitignore` 新增。

**⑤ `check-ignore -v` 样本（6 条，>3）**：
```
.gitignore:342:**/.*-artifacts/   backend-ts/.p3j-artifacts/p3j-20261004T014036-cases.json
.gitignore:345:**/.*-ro/          backend-ts/.p8s6-ro/diag-submit2.ts
.gitignore:342:**/.*-artifacts/   frontend/.s39-artifacts/s39-20261005T053352Z/00-git-anchor.txt
.gitignore:342:**/.*-artifacts/   docs/audit/.s35-artifacts/.latest
.gitignore:349:backend-ts/.p9s*/  backend-ts/.p9s13/diag.ts
.gitignore:342:**/.*-artifacts/   backend-ts/.zang-artifacts/post-0043.ts
```

**⑥ 负对照（零残留）**：
```
touch backend-ts/.s40-artifacts/__s42_negctl_probe.tmp
git status --porcelain | grep __s42_negctl_probe   -> (空 → 不显示，OK)
git check-ignore -v backend-ts/.s40-artifacts/__s42_negctl_probe.tmp
   -> .gitignore:342:**/.*-artifacts/	… (命中，OK)
rm -f …/__s42_negctl_probe.tmp     -> 文件不存在，主仓零残留
改后 ?? 计数 -> 0
```

**产物零删除旁证**：把 `00-uall-before.txt` 的 1027 条路径逐一 `os.path.exists` ⇒ **missing=0**，证据链产物全部仍在磁盘。

---

## §4 仍未忽略的未跟踪件清单（待 Zang 裁）

**现取（补 `.gitignore` 后）：真正「非产物面」的未跟踪件 = 0 件。**

- 唯一的非产物未跟踪件将是**本单的报告自身** `docs/audit/s42-gitignore-artifacts.md`（新建、未跟踪、未被忽略）——它待入库属实、应保持可见，故**不**加忽略规则。其写入后 `??` 计数为 1。
- ⚠️ **待裁争议点（本单不自行处理）**：规则 (2) `**/.*-ro/` 会把 `backend-ts/.p8s6-ro/diag-submit2.ts`（**`.ts` 源文件形态**，非 JSON/输出）一并忽略。该目录内其它 `*.ts`（cap.ts/cols.ts/inv.ts/verify-*.ts 等 22 件）**已被入库跟踪**，仅 `diag-submit2.ts/.out` 两件未跟踪。若 Zang 认定 `diag-submit2.ts` 属「真源码」而非产物 ⇒ 需追加负向例外 `!backend-ts/.p8s6-ro/diag-submit2.ts`，或把 (2) 收窄为逐目录规则。**本单按任务建议形态 `**/.*-ro/` 落规，未另设例外，留待裁定。**

---

## §5 自曝（口径与边界）

1. **`??` 计数漂移**：开工首读 392，patch 前现取 394。差额 = 本单自建 `backend-ts/.s42-artifacts/`（折叠 1 行）+ 会话期内另一路写入。前后对照以**同一现取基线 394** 为准。
2. **对锚漂移**：HEAD 由 7178126 前进到 0a2b886（非本单所为，本单无 commit/push）；`ls-files` 前后同为 3673，读数不受影响。
3. **③ 非 0 是结构必然**：改 `.gitignore` ⇒ 必产生 1 行 ` M .gitignore`；「工作面仍空」应读作「除该次被授权改动外，已跟踪面零改动」。
4. **忽略 ≠ 删除**：所有规则仅作用于 `git status` 显示；1027 件产物磁盘 0 缺失（§3 旁证）。未用 `git rm --cached`，未删任何产物，未动 `git config`。
5. **过宽风险**：`**/.*-artifacts/` 对**全仓任意层级**生效；若未来某些 `-artifacts` 目录需要**入库**，需另加负向例外。命名的统一族使此风险低，但已如实标注。
6. **未测项**：未在 clone/CI 环境复验（本单仅本地工作区）；未验证 `.gitignore` 对非 git 工具（如 `git archive`）的行为（超出本单范围）。
7. **只改一文件**：唯一被改动的跟踪文件是 `.gitignore`；报告与产物均为新增，未触碰代码/迁移/规范/台账/主计划。
