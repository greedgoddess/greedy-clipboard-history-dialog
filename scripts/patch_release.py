#!/usr/bin/env python3
"""patch_release.py — turns a release of the original Clipboard History
extension into Greedy Clipboard History Dialog. Called by build.sh.

Usage: patch_release.py UPSTREAM_DIR OUTPUT_DIR FEATURE_DIR REPORT_JSON

The original code is not edited. Its entry points are renamed
(extension.js -> upstream-extension.js, prefs.js -> upstream-prefs.js), and
this project's files, which extend them, take their place. Only the
extension's identity (UUID, settings schema, name) and one settings key are
changed. Every step is explained in docs/cursor-follow.md#how-the-build-works

Exit status: 0 = built (warnings, if any, are in the report), 1 = cannot build.
"""
import json
import re
import shutil
import sys
from pathlib import Path

LEGACY_UUID = 'clipboard-history@manouchehr'
UUID = 'greedy-clipboard-history-dialog@greedgoddess'
SCHEMA_ID = 'org.gnome.shell.extensions.greedy-clipboard-history-dialog'
SCHEMA_PATH = '/org/gnome/shell/extensions/greedy-clipboard-history-dialog/'
NAME = 'Greedy Clipboard History Dialog'
URL = 'https://github.com/greedgoddess/greedy-clipboard-history-dialog'
FEATURE_FILES = ['extension.js', 'prefs.js', 'cursorFollow.js']

PREFS_SHIM = """// Created by the build: the original has no prefs.js.
export {ExtensionPreferences as default} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
"""

warnings = []


def fatal(message):
    print(f'ERROR: {message}', file=sys.stderr)
    sys.exit(1)


def main(upstream, out, feature, report_path):
    upstream, out, feature = Path(upstream), Path(out), Path(feature)

    # ---- Identify the release --------------------------------------------------
    metadata_file = upstream / 'metadata.json'
    if not metadata_file.is_file():
        fatal('the release has no metadata.json')
    metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
    if metadata.get('uuid') != LEGACY_UUID:
        fatal(f"the release is '{metadata.get('uuid')}', not {LEGACY_UUID}")
    legacy_schema_id = metadata.get('settings-schema')

    # ---- Copy the original ---------------------------------------------------------
    shutil.copytree(upstream, out, ignore=shutil.ignore_patterns('.git', 'gschemas.compiled'))

    # ---- Entry points: keep the original's, unchanged, under new names -----------
    extension_js = out / 'extension.js'
    if not extension_js.is_file():
        fatal('the release has no extension.js')
    if not re.search(r'^export default class\b', extension_js.read_text(encoding='utf-8'), re.M):
        fatal('extension.js has no "export default class", so it cannot be extended')
    extension_js.rename(out / 'upstream-extension.js')

    prefs_js = out / 'prefs.js'
    if prefs_js.is_file() and re.search(r'^export default class\b', prefs_js.read_text(encoding='utf-8'), re.M):
        prefs_js.rename(out / 'upstream-prefs.js')
    else:
        if prefs_js.is_file():
            warnings.append('prefs.js has no "export default class"; the original preferences are replaced '
                            'by an empty window with only the Placement switch')
            prefs_js.unlink()
        (out / 'upstream-prefs.js').write_text(PREFS_SHIM, encoding='utf-8')

    # ---- Identity strings written into the original code ---------------------------
    # The original normally takes both from metadata.json; replace any that are
    # written out literally, so that this build never touches its settings or
    # history.
    replacements = {LEGACY_UUID: UUID}
    if legacy_schema_id:
        replacements[legacy_schema_id] = SCHEMA_ID
    for js in out.rglob('*.js'):
        text = js.read_text(encoding='utf-8')
        new = text
        for old, value in replacements.items():
            new = new.replace(old, value)
        if new != text:
            js.write_text(new, encoding='utf-8')
            warnings.append(f'{js.relative_to(out)} names the original UUID or schema literally; replaced')

    # ---- Settings schema: own ID and path, plus the cursor-follow key --------------
    key_xml = (feature / 'cursor-follow-key.xml').read_text(encoding='utf-8')
    schemas_dir = out / 'schemas'
    schemas_dir.mkdir(exist_ok=True)
    schema_file = None
    for candidate in schemas_dir.glob('*.gschema.xml'):
        if legacy_schema_id and f'id="{legacy_schema_id}"' in candidate.read_text(encoding='utf-8'):
            schema_file = candidate
            break

    if schema_file is None:
        warnings.append('the release has no settings schema; one is created with only the cursor-follow key')
        xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<schemalist>\n'
               f'  <schema id="{SCHEMA_ID}" path="{SCHEMA_PATH}">\n{key_xml}  </schema>\n</schemalist>\n')
    else:
        xml = schema_file.read_text(encoding='utf-8')
        schema_open = re.compile(r'<schema\b[^>]*\bid="' + re.escape(legacy_schema_id) + r'"[^>]*>', re.S)
        match = schema_open.search(xml)
        tag = match.group(0)
        new_tag = re.sub(r'\bid="[^"]*"', f'id="{SCHEMA_ID}"', tag)
        if re.search(r'\bpath="[^"]*"', new_tag):
            new_tag = re.sub(r'\bpath="[^"]*"', f'path="{SCHEMA_PATH}"', new_tag)
        else:
            new_tag = new_tag[:-1] + f' path="{SCHEMA_PATH}">'
        xml = xml[:match.start()] + new_tag + xml[match.end():]

        if 'name="cursor-follow"' in xml:
            warnings.append('the release already has a cursor-follow key; it was kept and ours not added')
        else:
            close = xml.find('</schema>', match.start())
            line_start = xml.rfind('\n', 0, close) + 1
            xml = xml[:line_start] + key_xml + '\n' + xml[line_start:]
        schema_file.unlink()
    (schemas_dir / f'{SCHEMA_ID}.gschema.xml').write_text(xml, encoding='utf-8')

    # ---- Checks on how the original builds its panel button -------------------------
    original = (out / 'upstream-extension.js').read_text(encoding='utf-8')
    if 'addToStatusArea(' not in original:
        warnings.append('the original no longer calls Main.panel.addToStatusArea(); '
                        '"Open at mouse pointer" will probably be inactive')
    if 'PanelMenu' not in original:
        warnings.append('the original no longer uses PanelMenu; "Open at mouse pointer" will probably be inactive')

    # ---- This project's files -------------------------------------------------------
    for name in FEATURE_FILES:
        shutil.copy2(feature / name, out / name)

    # ---- metadata.json: own identity, the original's version and GNOME versions ----
    upstream_version = metadata.get('version')
    upstream_version_name = metadata.get('version-name', str(upstream_version))
    new_metadata = {
        'uuid': UUID,
        'name': NAME,
        'description': ('Personal build of Clipboard History by Manouchehr Ghalevand, with an option '
                        'to open the panel at the mouse pointer.\n\n'
                        + metadata.get('description', '').replace(LEGACY_UUID, UUID)),
        'settings-schema': SCHEMA_ID,
        'shell-version': metadata.get('shell-version', []),
        'url': URL,
        'version': upstream_version,
        'version-name': f'{upstream_version_name}+cursor-follow',
    }
    for key in ('gettext-domain', 'session-modes'):
        if key in metadata:
            new_metadata[key] = metadata[key]
    # Translations are looked up by gettext domain, which defaults to the UUID.
    # Keep the original's domain so that its translations, if any, still load.
    if 'gettext-domain' not in new_metadata and (out / 'locale').is_dir():
        new_metadata['gettext-domain'] = LEGACY_UUID
    (out / 'metadata.json').write_text(json.dumps(new_metadata, indent=4, ensure_ascii=False) + '\n',
                                       encoding='utf-8')

    Path(report_path).write_text(json.dumps({
        'upstream_version': upstream_version,
        'upstream_version_name': upstream_version_name,
        'shell_versions': new_metadata['shell-version'],
        'warnings': warnings,
    }, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    if len(sys.argv) != 5:
        fatal(__doc__.split('\n\n')[1])
    main(*sys.argv[1:])
