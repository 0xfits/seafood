# P59 · 详情读口缓存头改「无条件 no-store」（修复 CDN 缓存导致浏览数不增/跳动）

日期：2026-10-20 · 仓：`/Users/kevin/bistro/seafood` · 基线 HEAD：`4ae86d1`
状态：**代码 + 门 + 读数已提交（本地 commit，未 push）**；生产复测待 push 后执行（配方见文末）。

## 1. 缺陷

生产实测 `GET /api/prize/:bID` 的 `views` 读数呈 `2 → 4 → 4`、连续打开不涨。

根因（单行级）：该路由在**非「新发访客 cookie」分支**挂 `setPublicCache(res)` ⇒
`Cache-Control: public, s-maxage=30, stale-while-revalidate=300` ⇒ **CDN 缓存该 JSON**，
命中时请求根本不到 origin（响应内是 `views` 自增后的值）⇒
① 浏览数不增（语义要求「每次打开 +1」被缓存直接破坏）；
② 读数在「边缘缓存值」与「库内真值」之间跳动（用户看到 2→4→4）。

## 2. 改动（`backend-ts/src/index.ts`，仅详情路由 + 一个 helper 的返回形状）

| 位置 | 改前 | 改后 |
|---|---|---|
| `app.get('/api/prize/:bID')` 响应头 | `if (detailViewer?.mintedCookie) setPrivateNoStore(res); else setPublicCache(res);` | **无条件** `setPrivateNoStore(res)`（`private, no-store`），二分删除 |
| `resolveDetailViewViewerKey` | 返回 `{ viewerKey, mintedCookie }` | 返回 `viewerKey: string`（`mintedCookie` 唯一消费点就是那个二分 ⇒ 字段一并删，不留死码） |
| 其余读口 | — | **一字未改**：`/api/prize/all`、`/api/task/all`、`/api/task/:tID`、`/api/home` 匿名臂仍 `public, s-maxage=30, stale-while-revalidate=300` |

`Vary: Authorization`：本路由**历史上没有**该头（全仓只有 `/api/home` 设），故无既有体例需保留；
`no-store` 已使任何缓存键区分失去意义。归档层面已在路由注释里写明这两条理由与「二分已删」，
避免下一轮又有人把 `public` 加回来。

为什么不是只降 `s-maxage` 或加 `Vary`：`views` 是**每次请求都变**的计数值，
任何共享缓存（哪怕 1 秒）都会让同秒内的第二个访客拿到别人的读数；私有 `no-store` 是唯一与
「每次打开 +1」自洽的语义。安全面同时收口：去重开关 on 时本口可能发 `Set-Cookie: sf_viewer`，
共享缓存会把 A 的 Set-Cookie 回放给 B —— `no-store` 一并覆盖。

## 3. 证据（全部现取，读数随提交入库）

| 件 | 结论 |
|---|---|
| `readings/p59-detail-nocache-gate-20261020T043407Zd32z.json` | **13/13** — 进程内 `http.createServer(app)` 临时端口（不占 5788、不占 5793–5799）真 HTTP 读数 |
| `readings/p59-dev-instance-20261020T043503Z0icn.json` | **6/6** — 打**面板托管的 dev 实例 5788**（前端实际消费的那个进程），重启后的人肉链 |
| `readings/p7b-03-offline-gates-20261020T043433Zs0xz.json` | **37/37**，`registration_points=110`（零新路由） |
| `readings/p57-view-count-gate-20261020T043434Zjpm4.json` | **40/40**（post-apply） |
| `readings/p58-view-dedup-gate-20261020T043459Z0q9u.json` | **29/29**（post-apply；A3 断言已随本单改写，见 §4） |
| `backend-ts` `tsc --noEmit -p tsconfig.json` | **exit 0**（零输出） |

实测头字符串（原样抄自读数）：

```
详情 /api/prize/1        → cache-control: private, no-store      (×3，均无 public / s-maxage / max-age)
详情（带垃圾 Bearer）     → cache-control: private, no-store      set-cookie: none
feed /api/prize/all       → cache-control: public, s-maxage=30, stale-while-revalidate=300
/api/task/all             → cache-control: public, s-maxage=30, stale-while-revalidate=300
/api/home（匿名）         → cache-control: public, s-maxage=30, stale-while-revalidate=300 · vary: Authorization
```

`views` 逐次 +1（两条独立路径同一个数）：

- 进程序内（临时端口）：`pre=2 ⇒ 3 → 4 → 5`
- dev 运行实例（5788）：`pre=2 ⇒ 3 → 4 → 5`，`view_count` 事后回写复原为 `2`（`restored_views=2`，`listing_view_log` 本次探针 viewer_key 命中 0 行）。

## 4. 门改动（只改断言措辞与反向臂，判据不放松）

`ops/item-detail/p58-00-view-dedup-gate.ts` 的 `A3` 原本断言详情块里**存在**
`detailViewer?.mintedCookie` 二分（那是旧形态的正面断言）。本单删掉二分后它必然红，故改写为
「等价强度」的新断言：`setPrivateNoStore(res)` 在场 **且** `setPublicCache(` / `mintedCookie`
在详情块**零命中**（反向臂比旧断言更严：旧断言只要求「发 cookie 时降级」，新断言要求
「任何情况都不许出现 public」）。检查条数不变 ⇒ 仍 **29/29**。

新增 `ops/item-detail/p59-00-detail-nocache-gate.ts`（13 条，A 静态 / B 真 HTTP / E 零残留），
其中 B2 是「每次打开 +1」的直接判据、B1 是头字符串判据；`A3` 用「全仓 `setPublicCache(res)`
调用点 = 4」把「其余路由缓存语义一字不改」钉成可机读断言。

> 迭代记录（透明起见）：首跑 11/13，红在 A2/A4 —— 原因是**我写的路由注释里出现了
> `mintedCookie` / `Vary` 这两个词**，而这两条门按词面扫描详情块切片。改法是**只改注释措辞**
> （产品代码未动），随后 13/13。这类「注释命中扫描词」的假红在本仓有先例（`/*` 吞注释一脉），
> 门与注释两边都不放水：门继续扫词面，注释改写避免歧义。

## 5. dev 库副作用（披露）

探针为了让「每次打开 +1」成为真读数，对 dev 库 `listing_id=1` 做了**产品自身行为**的那次自增；
两条探针均在结束时 `UPDATE … SET view_count = <改前值>` **回写复原**，并读回复核（实测 `2 → 2`）。
去重开关现值 = `off`（`app_config.detail_view_dedup = {"dedup":"off"}`）⇒ 未写 `listing_view_log`（实测 0 行）。
零造夹具、零删行、零迁移。

## 6. 未做 / 待生产复测（push 后，由 Zang 执行）

1. **生产复测（必做）**：`views` 逐次 +1 且 `x-vercel-cache` 不再出现 `HIT`。

```bash
# 取一个真 id
curl -s --resolve 0xseafood.com:443:76.76.21.21 'https://0xseafood.com/api/prize/all?limit=1' | python3 -c "import json,sys;print(json.load(sys.stdin)['data'][0]['bID'])"
# 连打 3 次：看 views 与边缘缓存头
for i in 1 2 3; do
  curl -sS -D /tmp/p59-h$i.txt -o /tmp/p59-b$i.json --resolve 0xseafood.com:443:76.76.21.21 \
    "https://0xseafood.com/api/prize/<ID>" -H 'Cache-Control: no-cache'
  grep -iE '^(cache-control|x-vercel-cache|age):' /tmp/p59-h$i.txt
  python3 -c "import json;print('views',json.load(open('/tmp/p59-b$i.json'))['data']['views'])"
done
```

判据：`cache-control: private, no-store` ×3 · `x-vercel-cache` 不再是 `HIT`（期望 `MISS`/`BYPASS`/缺省）·
`views` 三次严格递增（步长 1）。三件都满足才算生产闭环。

2. **台账**（`docs/seafood.master-plan.md` 的 `§5.x` 新节 + 版本表新行，倒序前插）本单按派单口径
   **未改 docs**，留给 Zang 收口时补；节号以现取最大 `### 5.NNN` 为准。

3. 截止本提交**未 push**（Zang 统一 push）。仓库 HEAD 仍含本次 commit，`origin/main..HEAD` = 1 笔。
