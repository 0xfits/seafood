# 390×844 发布页表单探针（dev 5800）

环境：Chrome（浏览器助手）· `http://localhost:5800/item/new` · `Emulation.setDeviceMetricsOverride(390×844, mobile)`
时间：2026-10-19

会话处理：本地注入探针会话（`localStorage.user`，exp 远期）后，用
`Network.setBlockedURLs(['*://localhost:5800/api/*'])` 阻断 `/api/*` —— 否则真实后端的
401 治理（`AUTH_UNAUTHORIZED ⇒ expireAuthSession`）会按设计清掉无效会话。**零写请求**。

## ① 表单壳 + 钩子

```json
{"viewport":[390,844],"docScrollWidth":390,"sessionKept":true,"loginWall":false,"formPresent":true,
 "imageInput":{"type":"file","accept":"image/*","multiple":true,"display":"none"},
 "imageAdd":{"tag":"BUTTON","text":"+","w":34,"h":44,"visible":true,"disabled":false},
 "thumbs":0,"formRect":{"w":228,"right":238}}
```

（首测 `formRect.w=228` 为布局未稳时的中间值；随后复测 `panelW=352`，与 390 视口减去两侧内边距一致。）

## ② 一次选 5 张 ⇒ 上限 4

```json
{"count":4,"thumbGeom":[[64,64],[64,64],[64,64],[64,64]],
 "srcPrefix":["data:image/webp;","data:image/webp;","data:image/webp;","data:image/webp;"],
 "addDisabled":true,"scrollWidth":390,"layoutMainW":352,"itemW":352,"panelW":352}
```

## ③ 移除第 1 张

```json
{"count":3,"ids":["item-image-thumb-0","item-image-thumb-1","item-image-thumb-2"],"addDisabled":false}
```

## ④ 压缩几何自证（2400×600 PNG ⇒ 编码后）

```json
{"naturalW":1280,"naturalH":320,"mime":"data:image/webp;base","bytes":1310}
```

长边 → 1280（WebP q0.82）真实生效；缩略图 `<img>` 直接复用压缩后的 data URL。

## ⑤ 运行期错误

```json
{"errors":[],"count":4,"lastThumb":"data:image/webp;"}
```

`window.onerror` + `unhandledrejection` 均为 0。
