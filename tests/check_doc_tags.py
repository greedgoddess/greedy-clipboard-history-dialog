#!/usr/bin/env python3
"""check_doc_tags.py — every tag in this project's code has its doc entry.

Code sections start with a tag such as [gestures:tap]; the docs explain each
one under an anchor such as <a id="gestures-tap">. This fails when a tag has
no anchor (a section without explanation) or a page uses an anchor twice.
Only this project's own files are checked, not the original's code.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CODE = [*ROOT.glob('feature/*.js'), *ROOT.glob('feature/*.css'), *ROOT.glob('feature/*.xml'),
        ROOT / 'install.sh', ROOT / 'update-test-and-push.sh', *ROOT.glob('scripts/*.py')]
TAG = re.compile(r'\[([a-z]+(?:-[a-z]+)*:[a-z]+(?:-[a-z]+)*)\]')
ANCHOR = re.compile(r'<a id="([^"]+)"></a>')

anchors = {}
problems = []
for doc in sorted([*ROOT.glob('docs/*.md'), ROOT / 'CONTRIBUTING.md']):
    seen = set()
    for anchor in ANCHOR.findall(doc.read_text(encoding='utf-8')):
        if anchor in seen:
            problems.append(f'{doc.name}: anchor "{anchor}" used twice')
        seen.add(anchor)
        anchors.setdefault(anchor, doc)

tags = 0
for path in CODE:
    for tag in TAG.findall(path.read_text(encoding='utf-8')):
        tags += 1
        anchor = tag.replace(':', '-')
        prefix = tag.split(':')[0]
        if prefix == 'release':     # Scripts' tags are explained in CONTRIBUTING.md
            anchor = 'manual-checks'
        if anchor not in anchors:
            problems.append(f'{path.relative_to(ROOT)}: [{tag}] has no <a id="{anchor}"> in the docs')

for problem in problems:
    print(f'  FAIL  {problem}')
print(f'  {"pass" if not problems else "FAIL"}  {tags} code tags, {len(anchors)} doc anchors')
sys.exit(1 if problems else 0)
