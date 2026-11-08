#!/usr/bin/env python3
"""check_build.py — static checks of build/ against the release it was built from.

Run by tests/run-tests.sh. Prints one line per check; exit status 1 if any fails.
"""
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build'
UUID = 'greedy-clipboard-history-dialog@greedgoddess'
LEGACY_UUID = 'clipboard-history@manouchehr'
SCHEMA_ID = 'org.gnome.shell.extensions.greedy-clipboard-history-dialog'
EXT = BUILD / UUID

failures = 0


def check(name, ok, detail=''):
    global failures
    print(f"  {'pass' if ok else 'FAIL'}  {name}{f' ({detail})' if detail and not ok else ''}")
    failures += 0 if ok else 1


release = zipfile.ZipFile(BUILD / 'release.zip')
original = {n: release.read(n) for n in release.namelist() if not n.endswith('/')}
original_meta = json.loads(original['metadata.json'])
built_meta = json.loads((EXT / 'metadata.json').read_text(encoding='utf-8'))
report = json.loads((BUILD / 'report.json').read_text(encoding='utf-8'))

# The original code is carried over unchanged, only renamed. The one change
# the build may make is replacing the original's UUID and schema ID, written
# out literally, in JavaScript; the expected bytes include exactly that.
renamed = {'extension.js': 'upstream-extension.js', 'prefs.js': 'upstream-prefs.js'}
replacements = {LEGACY_UUID: UUID}
if original_meta.get('settings-schema'):
    replacements[original_meta['settings-schema']] = SCHEMA_ID
legacy_ids = tuple(replacements)
for name, data in original.items():
    if name == 'metadata.json' or name.startswith('schemas/'):
        continue
    expected = data
    if name.endswith('.js'):
        for old, new in replacements.items():
            expected = expected.replace(old.encode(), new.encode())
    target = EXT / renamed.get(name, name)
    check(f'original {name} carried over unchanged', target.is_file() and target.read_bytes() == expected)

# This project's files are the repository's.
for name in ('extension.js', 'prefs.js', 'cursorFollow.js', 'updateNotifier.js'):
    check(f'{name} is this project\'s', (EXT / name).read_bytes() == (ROOT / 'feature' / name).read_bytes())

# Identity.
check('UUID', built_meta.get('uuid') == UUID)
check('settings schema', built_meta.get('settings-schema') == SCHEMA_ID)
check('GNOME Shell versions taken from the release',
      built_meta.get('shell-version') == original_meta.get('shell-version'))
leaks = [p.name for p in EXT.rglob('*.js') if any(i in p.read_text(encoding='utf-8') for i in legacy_ids)]
check('no JavaScript names the original UUID or schema', not leaks, ', '.join(leaks))

# Settings schema.
schema = EXT / 'schemas' / f'{SCHEMA_ID}.gschema.xml'
xml = schema.read_text(encoding='utf-8') if schema.is_file() else ''
check('schema file present', schema.is_file())
check('schema has its own ID and path',
      f'id="{SCHEMA_ID}"' in xml and 'path="/org/gnome/shell/extensions/greedy-clipboard-history-dialog/"' in xml)
check('cursor-follow key, off by default',
      re.search(r'<key name="cursor-follow" type="b">\s*<default>false</default>', xml) is not None)
compiled = subprocess.run(['glib-compile-schemas', '--strict', '--dry-run', str(schema.parent)],
                          capture_output=True, text=True)
check('schema compiles', compiled.returncode == 0, compiled.stderr.strip())
for key in ('update-notifications', 'developer-mode', 'checkout-path', 'update-last-check', 'update-notified'):
    check(f'{key} key', f'<key name="{key}"' in xml)
info_file = EXT / 'build-info.json'
info = json.loads(info_file.read_text(encoding='utf-8')) if info_file.is_file() else {}
provenance = ('project_version', 'feature_commit', 'upstream_url', 'upstream_version', 'source_url',
              'content_sha256', 'tested_release', 'built_at', 'built_on_gnome_shell')
check('build-info.json records the provenance',
      info.get('upstream_version') == original_meta.get('version') and all(k in info for k in provenance))
original_keys = set(re.findall(rb'<key name="([^"]+)"', b''.join(
    d for n, d in original.items() if n.startswith('schemas/') and n.endswith('.xml'))))
built_keys = set(re.findall(r'<key name="([^"]+)"', xml))
check('all original settings kept', {k.decode() for k in original_keys} <= built_keys)

# Build warnings count as failures for testing.
check('build reported no warnings', not report['warnings'], '; '.join(report['warnings']))

sys.exit(1 if failures else 0)
