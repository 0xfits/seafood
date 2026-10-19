# 四语键数现取（改前 / 改后）

命令（仓根）：

```bash
python3 - <<'EOF'
import json
def flat(d,p=''):
    out=[]
    for k,v in d.items():
        kk=f'{p}.{k}' if p else k
        if isinstance(v,dict): out += flat(v,kk)
        else: out.append(kk)
    return out
for l in ['zh','en','hk','vn']:
    d=json.load(open(f'frontend/src/locales/{l}.json'))
    f=flat(d)
    print(l,'top',len(d),'flat',len(f),'item',len(d['item']),'nodes*4',len(f)*4)
EOF
```

## 改前（基线 224775f）

```
zh top 128 flat 1106 item 49 nodes*4 4424
en top 128 flat 1106 item 49 nodes*4 4424
hk top 128 flat 1106 item 49 nodes*4 4424
vn top 128 flat 1106 item 49 nodes*4 4424
```

## 改后（本单）

```
zh top 128 flat 1109 item 52 nodes*4 4436
en top 128 flat 1109 item 52 nodes*4 4436
hk top 128 flat 1109 item 52 nodes*4 4436
vn top 128 flat 1109 item 52 nodes*4 4436
key-set identical: True
```

增量 = 恰 3 键/语（`item.imagesLabel` / `item.imageRemove` / `item.imageUploadFail`）：
- flat `1106⇒1109`
- 四语节点 `4424⇒4436`
- top `128` 不变（item 命名空间已存在）
- item 节点 `49⇒52`

## 断言前推范围（13 文件，逐一实改）

`i18n-batch-b4a` · `i18n-batch-b4b` · `i18n-batch-b5` · `i18n-violation-closeout` ·
`r9-93-points-symbol` · `r9-96-dashj-copy` · `s19-participants-truth-source` ·
`s23-participants-headcount` · `s5-publish-headcount` · `s7-submissions-panel` ·
`s8-locale-key-coverage` · `s9-ledger-kind-closure` · `tg-bind-qr`（末者无断言、仅口径留痕）。

改后仓内 `grep -rn '\b1106\b|\b4424\b' frontend/src/test frontend/scripts` 仅剩 13 处
= 各文件口径注释里的历史写法「flat 1106⇒1109 / 4424⇒4436」，**无断言残值**。

## 新增键值（四语）

| key | zh | en | hk | vn |
|---|---|---|---|---|
| `item.imagesLabel` | 商品图片（可选，最多 4 张） | Product images (optional, up to 4) | 商品圖片（可選，最多 4 張） | Hình ảnh sản phẩm (không bắt buộc, tối đa 4) |
| `item.imageRemove` | 移除图片 | Remove image | 移除圖片 | Xóa ảnh |
| `item.imageUploadFail` | 图片上传失败，发布已取消 | Image upload failed, publish cancelled | 圖片上傳失敗，發布已取消 | Tải ảnh lên thất bại, đã hủy đăng |

黑名单扫描（`读口|讀口|读面|讀面|服务端|伺服器端|/api/|幂等|冪等|status=|uID|bID|§`）= 0 命中。
