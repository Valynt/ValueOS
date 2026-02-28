#!/usr/bin/env python3
"""Resolve git merge conflict markers by keeping the incoming (second) block.
Usage: python3 scripts/auto_resolve_conflicts.py
"""
import os
import sys
import io

root = os.getcwd()
changed = []

for dirpath, dirnames, filenames in os.walk(root):
    # skip .git
    if '.git' in dirpath.split(os.sep):
        continue
    for fname in filenames:
        path = os.path.join(dirpath, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception:
            continue
        if '' in text and '            out = []
            i = 0
            L = len(text)
            while i < L:
                idx = text.find('', idx)
                if j == -1:
                    # malformed; bail
                    out.append(text[idx:])
                    break
                k = text.find('                if k == -1:
                    # malformed; bail
                    out.append(text[idx:])
                    break
                # content A is between idx+len(marker) and j
                # content B is between j+len('=======') and k
                bstart = j + len('=======')
                bend = k
                # take content B
                out.append(text[bstart:bend])
                i = k + len('>>>>>>> ')
                # advance to end of line after label
                nl = text.find('\n', i)
                if nl != -1:
                    i = nl+1
            new_text = ''.join(out)
            if new_text != text:
                try:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_text)
                    changed.append(path)
                except Exception as e:
                    print(f"Failed to write {path}: {e}", file=sys.stderr)

if changed:
    print('Resolved conflict markers in:')
    for p in changed:
        print(' -', os.path.relpath(p, root))
    sys.exit(0)
else:
    print('No conflict markers found')
    sys.exit(0)
