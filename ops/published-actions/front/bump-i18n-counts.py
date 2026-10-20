#!/usr/bin/env python3
"""i18n 计数前推（发布动作三连单 · 2026-10-20）

口径：`frontend/src/test/unit/**` 里 13 个文件硬编了四语计数
  · `flat`（每语拍平键数）· `nodes`（四语节点合计 = flat × 4）
  · `item` 命名空间的键数（仅 `item-type-front.test.jsx`）
每加/删一个 i18n 键都要同步这些断言；本脚本只替换**代码位**的字面量，
`//` 之后的历史链条注释（`flat 1120⇒1122` 这类）**原样保留**，改完在
行尾追加本单增量注释（可机械复核「改了几处」）。

用法：bump-i18n-counts.py <old_flat> <new_flat> <old_nodes> <new_nodes> <old_item> <new_item> <note>
"""
import pathlib
import re
import sys

TEST_DIR = pathlib.Path(__file__).resolve().parents[3] / 'frontend/src/test/unit'


def code_part(line: str) -> int:
    """返回本行代码段长度（首个 `//` 之前；无注释则整行）。"""
    i = line.find('//')
    return len(line) if i < 0 else i


def replace_code(line: str, old: str, new: str) -> tuple[str, int]:
    cut = code_part(line)
    head, tail = line[:cut], line[cut:]
    n = head.count(old)
    return (head.replace(old, new) + tail, n)


def main() -> int:
    old_flat, new_flat, old_nodes, new_nodes, old_item, new_item = sys.argv[1:7]
    note = sys.argv[7] if len(sys.argv) > 7 else ''
    # 只替换「计数断言形态」的字面量，避免误伤同数字的其它用途
    rules = [
        (f'flat: {old_flat}', f'flat: {new_flat}'),
        (f'flat={old_flat}', f'flat={new_flat}'),
        (f'toBe({old_flat})', f'toBe({new_flat})'),
        (f'toBe({old_nodes})', f'toBe({new_nodes})'),
        (f'节点数 = {old_nodes}', f'节点数 = {new_nodes}'),
        (f'item`).toBe({old_item})', f'item`).toBe({new_item})'),
    ]
    total = 0
    touched = []
    for fp in sorted(TEST_DIR.glob('*')):
        if fp.suffix not in ('.js', '.jsx'):
            continue
        lines = fp.read_text(encoding='utf-8').split('\n')
        hits = 0
        for idx, line in enumerate(lines):
            orig = line
            for old, new in rules:
                line, n = replace_code(line, old, new)
                hits += n
            if line != orig and note:
                lines[idx] = f'{line} // [i18n-bump {note}]'
        if hits:
            fp.write_text('\n'.join(lines), encoding='utf-8')
            touched.append((fp.name, hits))
            total += hits
    for name, hits in touched:
        print(f'{name}: {hits}')
    print(f'total replacements = {total}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
