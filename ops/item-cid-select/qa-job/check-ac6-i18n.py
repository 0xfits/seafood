#!/usr/bin/env python3
# QA-job AC6 checker · 四语 jobs.cid / jobs.cidNote 只改值、键数不变；item.* 未动；黑名单自查。
# 独立现取：直接对比 git 对象 1d9b415^（改前）与工作盘 HEAD（9087c51）。
import json, subprocess, sys

REPO = '/Users/kevin/bistro/seafood'
LOCALES = ['zh', 'en', 'hk', 'vn']
PATH = 'frontend/src/locales/{lang}.json'
KEYS = [('jobs', 'cid'), ('jobs', 'cidNote')]

def show(rev, path):
    r = subprocess.run(['git', '-C', REPO, 'show', f'{rev}:{path}'], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)

def flat(d, prefix=''):
    out = {}
    for k, v in d.items():
        key = f'{prefix}{k}'
        if isinstance(v, dict):
            out.update(flat(v, key + '.'))
        else:
            out[key] = v
    return out

BLACKLIST = ['读口', '服务端', '未注册', '/api/', '状态码', 'status=']
# spec §47.8.5 #25：手填/编号提示语义不得再出现（jobs.cidNote 不得含手填提示；jobs.cid 不得以「编号/id」为核心词）
HANDFILL_RE = ['填1', '填 1', '填寫', '手动', '手動', 'enter 1', 'nhập 1', 'bằng tay']
NUMBERED_CID_RE = ['编号', '編號', 'id', 'Id', 'ID', 'Mã']

rec = {'langs': {}, 'keys_checked': [f'{a}.{b}' for a, b in KEYS]}
ok_all = True

for lang in LOCALES:
    path = PATH.format(lang=lang)
    old = show('1d9b415^', path)
    new_doc = json.load(open(f'{REPO}/{path}'))          # 现盘 = HEAD 9087c51（工作盘干净）
    old_f, new_f = flat(old), flat(new_doc)
    entry = {
        'flat_keys_old': len(old_f),
        'flat_keys_new': len(new_f),
        'top_keys_old': len(old), 'top_keys_new': len(new_doc),
        'flat_keyset_identical': set(old_f) == set(new_f),
        'jobs_cid_changed': old_f.get('jobs.cid') != new_f.get('jobs.cid'),
        'jobs_cidNote_changed': old_f.get('jobs.cidNote') != new_f.get('jobs.cidNote'),
        'jobs_cid_new': new_f.get('jobs.cid'),
        'jobs_cidNote_new': new_f.get('jobs.cidNote'),
        'item_cid_untouched': old_f.get('item.cid') == new_f.get('item.cid'),
        'item_cidNote_untouched': old_f.get('item.cidNote') == new_f.get('item.cidNote'),
        'item_keys_diff': [k for k in set(old_f) | set(new_f) if k.startswith('item.') and old_f.get(k) != new_f.get(k)],
        'jobs_other_keys_diff': sorted(
            k for k in set(old_f) | set(new_f)
            if k.startswith('jobs.') and not k.endswith(('.cid', '.cidNote')) and old_f.get(k) != new_f.get(k)
        ),
        'non_jobs_non_item_diff': sorted(
            k for k in set(old_f) | set(new_f)
            if not k.startswith(('jobs.', 'item.')) and old_f.get(k) != new_f.get(k)
        ),
    }
    # 黑名单 + 手填语义
    blob = ' || '.join(str(new_f.get(f'jobs.{k}')) for k, _ in KEYS)
    entry['blacklist_hits'] = [b for b in BLACKLIST if b in blob]
    entry['handfill_hits'] = [h for h in HANDFILL_RE if h in blob]
    entry['jobs_cid_numbered_core'] = [w for w in NUMBERED_CID_RE if w in str(new_f.get('jobs.cid'))]
    bad = (
        entry['flat_keys_old'] != entry['flat_keys_new']
        or not entry['flat_keyset_identical']
        or not entry['item_cid_untouched'] or not entry['item_cidNote_untouched']
        or entry['item_keys_diff'] or entry['non_jobs_non_item_diff']
        or entry['blacklist_hits'] or entry['handfill_hits']
        or not entry['jobs_cid_changed'] or not entry['jobs_cidNote_changed']
        or entry['jobs_cid_numbered_core']
    )
    entry['lang_ok'] = not bad
    ok_all &= not bad
    rec['langs'][lang] = entry

# 四语键数彼此相同 + 与改前相同
counts = {l: rec['langs'][l]['flat_keys_new'] for l in LOCALES}
rec['flat_counts_new'] = counts
rec['flat_counts_all_equal'] = len(set(counts.values())) == 1
rec['top_counts_new'] = {l: rec['langs'][l]['top_keys_new'] for l in LOCALES}
rec['nodes_total'] = sum(counts.values())
rec['verdict_ok'] = ok_all and rec['flat_counts_all_equal']
rec['observation_zh_cidNote'] = rec['langs']['zh']['jobs_cidNote_new']
rec['observation_note'] = 'zh jobs.cidNote 含「悬赏」限定（…选择悬赏币种），en/hk/vn 无对应词 —— 已知观察项，登记不进判负'
print(json.dumps(rec, ensure_ascii=False, indent=2))
with open(f'{REPO}/ops/item-cid-select/qa-job/readings/ac6-i18n.json', 'w') as f:
    json.dump(rec, f, ensure_ascii=False, indent=2)
sys.exit(0 if rec['verdict_ok'] else 1)
