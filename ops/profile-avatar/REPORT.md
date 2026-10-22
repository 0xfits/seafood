# 用户头像（`/profile/settings`）· 验收报告

> 2026-10-22 · 实现 `e6056a3`（已上线）· 验证产物本目录
> 判据：可判负读数（每类红线都有**注入诱饵/负控**证明尺子有分辨力）

## 1. 交付面

| 层 | 内容 |
|---|---|
| 写口 | `POST /api/user/profile` 加可选 `avatar_url`（`/api/media/<1-12 位数字>` 或 `null`） |
| 语义 | 只带 `avatar_url` 合法（bio 不动、**零翻译入队**）；只带 bio 逐字回归；两者都不传 ⇒ 原 `bio is required` 400 |
| 读口 | `GET /api/user` 与 profile 回执**同源**加性透出 `avatar_url`（`undefined` 不改 / `null` 置空，has-flag 动态 SET，弃 COALESCE） |
| 前端 | `ProfileAvatarEditor`（64px 圆 / 无图首字彩底 / 28px 相机钮 / `accept=image/*` 隐藏 input / 恢复默认行内二次确认） |
| 流水线 | `image-compress`（长边 ≤1280、WebP q0.82→0.5、≤1MiB）→ `POST /api/media` → `POST /api/user/profile` → 刷新会话 |

## 2. 闸（`backend-ts/scripts/p77-00-profile-avatar-gate.ts`）

```
总 18 · 通过 18 · 失败 0
```

- **静态**：注册点 109（49/53/4/3/0）· has-flag 两键 · 形态闸常量 · `if (hasBio)` 守翻译 · 动态 SET · 七个 `data-sf-m` 钩子
- **SA** 只带 bio ⇒ 200、回执含 `avatar_url`、译文登记 > 0（回归臂）
- **SB** 先 `/api/media` 真上传拿真 id ⇒ 只带 `avatar_url` ⇒ 200、bio 不变、**零翻译入队**、`GET /api/user` 同值
- **SC** 六类非法（相对路径 / 外链 / 非数字 id / 超长 / 空串 / 非字符串）⇒ 全 400 `AVATAR_URL_INVALID` 且**零脏写**
- **SD** `{}` / 空白 bio ⇒ 400 `bio is required`（原口径不变）
- **SE** `null` ⇒ 置空
- **F1 负控（真 mutant）**：形态闸短路 ⇒ SC 五类字符串全部 200、脏值落库 ⇒ 必红；类型闸仍 400（证明 mutant 只打穿一处）
- **F2 自检**：谓词可证伪
- **Z1/Z2** 零残留

## 3. 探针（`probe-profile-avatar.mjs`，真 dev 5787/5788）

```
45 / 45 passed · pageErrors = 0
```

| 组 | 覆盖 |
|---|---|
| 基本功 | 设置页可见头像块、无图渲**首字**（uid 派生，非随机）、相机钮真 `<button>` 28×28 带 `aria-label`、input `accept=image/*` 且视觉隐藏 |
| 上传闭环 | `POST /api/media` 恰一次且**真落库**、`POST /api/user/profile` 恰一次、载荷键集恰 `{avatar_url}`（无 `bio` 键）、DB 落值、bio 未动、`GET /api/user` 回读同值 |
| 图片形态 | 上传后 `data-sf-avatar=img`、`src=/api/media/<id>`、**`naturalWidth>0` 真解码**、首字消失、【恢复默认】出现 |
| 清除 | 二次确认前**零 PATCH**、确认后载荷恰 `{avatar_url:null}`、DB 置空、回读 `null`、回到首字形态、按钮消失 |
| 几何 | 390 / 1536 两档：头像块自身 0 溢出、doc 不因本块变大（见 §4） |
| 异常 | `pageerror` 0 |

## 4. 存量缺陷（**非本批引入**，留证）

390 档 `/profile/settings` **doc 横向溢出 17px**。负控读数（临时隐藏头像块后重量）：

```
doc = 17  ·  docWithoutBlock = 17  ⇒  溢出与头像块无关（隐藏后不变）
越界元素：.sf-prof-nav-group(right 444) · .sf-prof-link ×3(至 616) · .sf-prof-content(right 407)
```

⇒ 属**手机档 profile 侧边栏/内容栅格**存量布局缺陷，建议列挂账（下一批由 Jing 记 B 项，修复另单）。

## 5. 环境与残留（诚实披露）

- dev 后端 5788 与前端 5787 由本批拉起；探针自建夹具钱包（`P77_PROBE_KEY`，0600，不打印），**自建自删**，收尾清 `content_translation / media / user_activity_hour / project_worker / account / batt_account / users`。
- 首跑曾用 `findOrCreateUserByEvm`（带注册腿）⇒ dev 库留 uid `971238–971243` 共 **6 行 `invite_signup` 审计**（`batt_entry` append-only，不可删）；后续改直插建户，零新增。
- `users.avatar_url` 为 0052 既有列，**本批零迁移**；形态闸只在服务层（DB 无 CHECK）。

## 6. 门套

- `backend-ts`: `tsc --noEmit` **0**；p77 **18/18**；`node --test market-mm-quotes` 41/41（旁路）
- `frontend`: `test:unit` **92 文件 / 961 例**；`build` **0**
- 生产：`/profile/settings` 已载 `.sf-prof-avatar*`（`index-BBU8UIGw.css`）；写口匿名 ⇒ 401 `AUTH_UNAUTHORIZED`
