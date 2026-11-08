#!/usr/bin/env python3
"""upstream.py — releases of the original Clipboard History extension.

Shared by build.sh, install.sh and update-test-and-push.sh.

  upstream.py latest [--shell N]        newest release on extensions.gnome.org
                                         that supports GNOME Shell N (or the
                                         newest overall); prints its number
  upstream.py download VERSION FILE     downloads release VERSION to FILE
  upstream.py extract ZIP DIR           unpacks a release safely (no absolute or
                                         ".." paths, no links, size limits)
  upstream.py content-hash ZIP          SHA-256 of the release's files, without
                                         metadata.json (which the website
                                         regenerates without a new release)
  upstream.py tested [--shell N]        newest tested release for GNOME Shell N;
                                         prints "VERSION CONTENT_HASH"
  upstream.py record-test REPORT_JSON   adds a test result to tested-releases.json
                                         and refreshes the table in README.md
  upstream.py refresh-readme            rewrites the README table from
                                         tested-releases.json
"""
import hashlib
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

LEGACY_UUID = 'clipboard-history@manouchehr'
EGO = 'https://extensions.gnome.org'
ROOT = Path(__file__).resolve().parent.parent
TESTED_FILE = ROOT / 'tested-releases.json'
README = ROOT / 'README.md'
TABLE_START = '<!-- tested-releases:start -->'
# Limits for unpacking a downloaded release; the real one is about 30 kB.
MAX_FILES = 2000
MAX_UNPACKED_BYTES = 50 * 1024 * 1024
TABLE_END = '<!-- tested-releases:end -->'


def fail(message):
    print(f'ERROR: {message}', file=sys.stderr)
    sys.exit(1)


def option(args, name):
    return args[args.index(name) + 1] if name in args else None


def latest(shell):
    url = f'{EGO}/extension-info/?uuid={LEGACY_UUID}&shell_version={shell or 0}'
    with urllib.request.urlopen(url, timeout=30) as response:
        info = json.load(response)
    versions = info.get('shell_version_map', {})
    if shell and shell in versions:
        return versions[shell]['version']
    if versions:
        return max(entry['version'] for entry in versions.values())
    return info.get('version') or fail('extensions.gnome.org did not report a release')


def download(version, target):
    url = f"{EGO}/extension-data/{LEGACY_UUID.replace('@', '')}.v{version}.shell-extension.zip"
    with urllib.request.urlopen(url, timeout=60) as response:
        Path(target).write_bytes(response.read())


def extract(zip_path, target):
    """Unpacks only regular files and folders inside target; refuses anything else."""
    target = Path(target).resolve()
    with zipfile.ZipFile(zip_path) as archive:
        entries = archive.infolist()
        if len(entries) > MAX_FILES:
            fail(f'the release has {len(entries)} entries (limit {MAX_FILES})')
        if sum(e.file_size for e in entries) > MAX_UNPACKED_BYTES:
            fail(f'the release would unpack to more than {MAX_UNPACKED_BYTES // 1024 // 1024} MB')
        for entry in entries:
            name = entry.filename
            mode = entry.external_attr >> 16
            if name.startswith(('/', '\\')) or '..' in Path(name).parts or ':' in name:
                fail(f'the release contains an unsafe path: {name}')
            if mode and (mode & 0o170000) not in (0, 0o100000, 0o040000):
                fail(f'the release contains a link or special file: {name}')
            destination = (target / name).resolve()
            if target not in destination.parents and destination != target:
                fail(f'the release contains a path outside its folder: {name}')
            if entry.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(archive.read(entry))


def content_hash(zip_path):
    digest = hashlib.sha256()
    with zipfile.ZipFile(zip_path) as archive:
        for name in sorted(archive.namelist()):
            if name.endswith('/') or name == 'metadata.json':
                continue
            digest.update(name.encode() + b'\0' + archive.read(name) + b'\0')
    return digest.hexdigest()


def load_tested():
    return json.loads(TESTED_FILE.read_text(encoding='utf-8')) if TESTED_FILE.exists() else []


def tested(shell):
    candidates = [r for r in load_tested() if not shell or shell in r['shell_versions']]
    if not candidates:
        sys.exit(1)
    best = max(candidates, key=lambda r: r['version'])
    print(best['version'], best['content_sha256'])


def record_test(report_path):
    entry = json.loads(Path(report_path).read_text(encoding='utf-8'))
    releases = [r for r in load_tested() if r['version'] != entry['version']]
    releases.append(entry)
    releases.sort(key=lambda r: r['version'], reverse=True)
    TESTED_FILE.write_text(json.dumps(releases, indent=2) + '\n', encoding='utf-8')
    refresh_readme()


def refresh_readme():
    releases = sorted(load_tested(), key=lambda r: r['version'], reverse=True)
    rows = ['| Release | GNOME Shell (release) | Tested on | Date |', '| --- | --- | --- | --- |']
    for r in releases:
        rows.append(f"| {r['version_name']} ({r['version']}) | {', '.join(r['shell_versions'])} "
                    f"| {r['tested_on']} | {r['date']} |")
    text = README.read_text(encoding='utf-8')
    start, end = text.index(TABLE_START) + len(TABLE_START), text.index(TABLE_END)
    README.write_text(text[:start] + '\n' + '\n'.join(rows) + '\n' + text[end:], encoding='utf-8')


def main(args):
    if not args:
        fail(__doc__)
    command, rest = args[0], args[1:]
    if command == 'latest':
        print(latest(option(rest, '--shell')))
    elif command == 'download' and len(rest) == 2:
        download(*rest)
    elif command == 'extract' and len(rest) == 2:
        extract(*rest)
    elif command == 'content-hash' and len(rest) == 1:
        print(content_hash(rest[0]))
    elif command == 'tested':
        tested(option(rest, '--shell'))
    elif command == 'record-test' and len(rest) == 1:
        record_test(rest[0])
    elif command == 'refresh-readme':
        refresh_readme()
    else:
        fail(__doc__)


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (OSError, zipfile.BadZipFile) as error:  # Network, file and archive errors
        fail(str(error))
