#!/usr/bin/env python3
"""AC8 · i18n 四语键面（现算，不引用任何测试文件的写死值）

判据：
  1) 四语 item.imagesLabel / imageRemove / imageUploadFail 在场且非空
  2) 拍平叶子数 = 1109/语；四语节点合计 = 4436；顶层键 = 128（open()+json.load 现算）
  3) 两两键集差 = 0（四语同键面）
  4) test/scripts 面无旧残值 1106 / 4424 的可执行断言（注释里 `1106⇒1109` 类变迁留痕不算残值）
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
LOCALES = ['zh', 'en', 'hk', 'vn']
KEYS = ['item.imagesLabel', 'item.imageRemove', 'item.imageUploadFail']
OUT = os.path.join(os.path.dirname(__file__), 'ac8-i18n.json')


def flatten(obj, prefix=''):
    out = {}
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.update(flatten(v, f'{prefix}.{k}' if prefix else k))
    else:
        out[prefix] = obj
    return out


def main():
    out = {'ac': 'AC8', 'generated_at': datetime.utcnow().isoformat() + 'Z', 'checks': []}

    tables, flat = {}, {}
    for l in LOCALES:
        p = os.path.join(REPO, 'frontend/src/locales', f'{l}.json')
        with open(p, encoding='utf-8') as fh:          # ← open() + json.load（现算）
            tables[l] = json.load(fh)
        flat[l] = flatten(tables[l])

    def t(cid, what, ok, reading):
        out['checks'].append({'id': cid, 'what': what, 'pass': bool(ok), 'reading': reading})

    # ---- 1) 三键在场非空 ----
    for key in KEYS:
        vals = {l: flat[l].get(key) for l in LOCALES}
        present = all(isinstance(v, str) and v.strip() for v in vals.values())
        t(f'A8-{key.split(".")[-1]}', f'四语 `{key}` 在场且非空', present,
          ' | '.join(f'{l}="{str(vals[l])[:48]}"' for l in LOCALES))

    # ---- 2) 计数 ----
    per = {l: {'flat': len(flat[l]), 'top': len(tables[l])} for l in LOCALES}
    total_nodes = sum(v['flat'] for v in per.values())
    t('A8-count-flat', '拍平叶子数 = 1109/语（四语各一）', all(v['flat'] == 1109 for v in per.values()),
      ' '.join(f'{l}={per[l]["flat"]}' for l in LOCALES))
    t('A8-count-nodes', '四语节点合计 = 4436', total_nodes == 4436, f'nodes={total_nodes}')
    t('A8-count-top', '顶层键 = 128/语', all(v['top'] == 128 for v in per.values()),
      ' '.join(f'{l}={per[l]["top"]}' for l in LOCALES))

    # ---- 3) 两两键集差 ----
    pairs, maxdiff = [], 0
    for i, a in enumerate(LOCALES):
        for b in LOCALES[i + 1:]:
            sa, sb = set(flat[a]), set(flat[b])
            d = len(sa ^ sb)
            maxdiff = max(maxdiff, d)
            pairs.append({'pair': f'{a}-{b}', 'only_a': sorted(sa - sb)[:5], 'only_b': sorted(sb - sa)[:5], 'diff': d})
    out['pairs'] = pairs
    t('A8-parity', '四语两两键集差 = 0（同键面）', maxdiff == 0,
      '; '.join(f'{p["pair"]}:{p["diff"]}' for p in pairs))

    # ---- 4) 旧残值扫描 ----
    roots = ['frontend/src/test', 'frontend/scripts', 'backend-ts/scripts']
    hits = []
    for root in roots:
        rp = os.path.join(REPO, root)
        if not os.path.isdir(rp):
            continue
        r = subprocess.run(['grep', '-rnE', r'1106|4424', rp], capture_output=True, text=True)
        for line in r.stdout.splitlines():
            parts = line.split(':', 2)
            if len(parts) < 3:
                continue
            path, lineno, text = parts
            bare = re.search(r'(?<![0-9])(1106|4424)(?![0-9])', text)
            if not bare:
                continue
            # 变迁留痕形态：`1106⇒1109` / `4424⇒4436`（旧值紧跟 ⇒ 新值）⇒ 非残值
            legacy = bool(re.search(r'(1106\s*(⇒|->)\s*1109)|(4424\s*(⇒|->)\s*4436)', text))
            hits.append({
                'file': os.path.relpath(path, REPO), 'line': int(lineno),
                'value': bare.group(1), 'legacy_narration': legacy,
                'text': text.strip()[:160],
            })
    stale = [h for h in hits if not h['legacy_narration']]
    out['stale_scan'] = {'roots': roots, 'hits': hits, 'stale_count': len(stale), 'stale': stale}
    t('A8-no-stale', 'test/scripts 无旧残值 1106/4424 的可执行断言（仅注释变迁留痕）', len(stale) == 0,
      f'hits={len(hits)} legacy_narration={len(hits) - len(stale)} stale={len(stale)}'
      + (f' :: {json.dumps(stale[:3], ensure_ascii=False)}' if stale else ''))

    out['counts'] = {'per_locale': per, 'total_nodes': total_nodes}
    out['pass'] = all(c['pass'] for c in out['checks'])
    out['failed'] = [c['id'] for c in out['checks'] if not c['pass']]
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print(json.dumps({k: out[k] for k in ('pass', 'failed')}, ensure_ascii=False))
    for c in out['checks']:
        print(f"{c['id']} {'PASS' if c['pass'] else 'FAIL'} :: {c['reading']}")
    return 0 if out['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
