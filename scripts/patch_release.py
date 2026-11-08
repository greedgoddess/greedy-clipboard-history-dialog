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
from xml.etree import ElementTree

LEGACY_UUID = 'clipboard-history@manouchehr'
UUID = 'greedy-clipboard-history-dialog@greedgoddess'
SCHEMA_ID = 'org.gnome.shell.extensions.greedy-clipboard-history-dialog'
SCHEMA_PATH = '/org/gnome/shell/extensions/greedy-clipboard-history-dialog/'
NAME = 'Greedy Clipboard History Dialog'
URL = 'https://github.com/greedgoddess/greedy-clipboard-history-dialog'
FEATURE_FILES = ['extension.js', 'prefs.js', 'cursorFollow.js', 'updateNotifier.js']

PREFS_SHIM = """// Created by the build: the original has no prefs.js.
export {ExtensionPreferences as default} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
"""

warnings = []


def fatal(message):
    print(f'ERROR: {message}', file=sys.stderr)
    sys.exit(1)


def parse_xml(text, what):
    try:
        return ElementTree.fromstring(text)
    except ElementTree.ParseError as error:
        fatal(f'{what} is not valid XML: {error}')


def key_names(schema_element):
    return [key.get('name') for key in schema_element.findall('key')]


def read_project_keys(path):
    """This project's keys: their names, and their text with the comment above
    each, so that they can be added one by one."""
    text = path.read_text(encoding='utf-8')
    names = key_names(parse_xml(f'<schema>{text}</schema>', path.name))
    texts = re.findall(r'((?:[ \t]*<!--.*?-->\s*)?[ \t]*<key name="[^"]+".*?</key>\n)', text, re.S)
    if len(names) != len(set(names)) or len(texts) != len(names):
        fatal(f'{path.name}: keys are duplicated or not one per <key> element')
    return names, texts


def find_upstream_schema(schemas_dir, schema_id):
    """The one schema file and element with the original's schema ID, and its
    key names. (None, []) if the release has no schemas at all."""
    files = sorted(schemas_dir.glob('*.gschema.xml'))
    if not files:
        return None, []
    found = []
    for path in files:
        root = parse_xml(path.read_text(encoding='utf-8'), path.name)
        if root.tag != 'schemalist':
            fatal(f'{path.name}: expected <schemalist>, found <{root.tag}>')
        for schema in root.findall('schema'):
            if schema.get('id') == schema_id:
                found.append((path, schema))
            elif schema.get('id', '').startswith(f'{schema_id}.'):
                warnings.append(f'{path.name} has a further schema, {schema.get("id")}; it keeps its ID')
    if len(found) != 1:
        fatal(f'expected exactly one settings schema with ID {schema_id}, found {len(found)}')
    path, schema = found[0]
    names = key_names(schema)
    if len(names) != len(set(names)) or None in names:
        fatal(f'{path.name}: the original schema has duplicated or unnamed keys')
    return path, names


def verify_final_schema(xml, upstream_names, added_names):
    root = parse_xml(xml, 'the patched schema')
    schemas = [s for s in root.findall('schema') if s.get('id') == SCHEMA_ID]
    if len(schemas) != 1 or schemas[0].get('path') != SCHEMA_PATH:
        fatal('the patched schema does not have exactly one schema with this project\'s ID and path')
    names = key_names(schemas[0])
    if len(names) != len(set(names)):
        fatal('the patched schema has duplicated keys')
    missing = (set(upstream_names) | set(added_names)) - set(names)
    if missing:
        fatal(f'the patched schema lacks keys: {", ".join(sorted(missing))}')


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
                            'by an empty window with only the Cursor-Follow switches')
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

    # ---- Settings schema: own ID and path, plus this project's keys ----------------
    # The schema is checked with an XML parser before and after the change; the
    # change itself is made on the text, so that the original's comments and
    # layout stay as they are.
    our_names, our_texts = read_project_keys(feature / 'settings-keys.xml')
    schemas_dir = out / 'schemas'
    schemas_dir.mkdir(exist_ok=True)
    schema_file, upstream_names = find_upstream_schema(schemas_dir, legacy_schema_id)

    if schema_file is None:
        warnings.append('the release has no settings schema; one is created with only this project\'s keys')
        xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<schemalist>\n'
               f'  <schema id="{SCHEMA_ID}" path="{SCHEMA_PATH}">\n'
               + '\n'.join(our_texts) + '  </schema>\n</schemalist>\n')
        added = our_names
    else:
        xml = schema_file.read_text(encoding='utf-8')
        openings = list(re.finditer(r'<schema\b[^>]*\bid="' + re.escape(legacy_schema_id) + r'"[^>]*>', xml))
        if len(openings) != 1:
            fatal(f'expected one <schema id="{legacy_schema_id}"> tag in {schema_file.name}, found {len(openings)}')
        match = openings[0]
        new_tag = re.sub(r'\bid="[^"]*"', f'id="{SCHEMA_ID}"', match.group(0))
        if re.search(r'\bpath="[^"]*"', new_tag):
            new_tag = re.sub(r'\bpath="[^"]*"', f'path="{SCHEMA_PATH}"', new_tag)
        else:
            new_tag = new_tag[:-1] + f' path="{SCHEMA_PATH}">'
        xml = xml[:match.start()] + new_tag + xml[match.end():]

        added, texts = [], []
        for name, text in zip(our_names, our_texts):
            if name in upstream_names:
                warnings.append(f'the release already has a {name} key; it was kept and ours not added')
            else:
                added.append(name)
                texts.append(text)
        close = xml.find('</schema>', match.start())
        line_start = xml.rfind('\n', 0, close) + 1
        xml = xml[:line_start] + '\n'.join(texts) + '\n' + xml[line_start:]
        schema_file.unlink()

    verify_final_schema(xml, upstream_names, added)
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
    project_version = (feature.parent / 'VERSION').read_text(encoding='utf-8').strip()
    upstream_version = metadata.get('version')
    upstream_version_name = metadata.get('version-name', str(upstream_version))
    new_metadata = {
        'uuid': UUID,
        'name': NAME,
        'description': ('Based on Clipboard History by Manouchehr Ghalevand, adding an option to open '
                        'the panel at the mouse pointer and optional update notifications. Not '
                        'affiliated with or endorsed by the original author. When update '
                        'notifications are on, it contacts GitHub (and, on developer machines, '
                        'extensions.gnome.org) at most once a day; see docs/update-notifications.md.\n\n'
                        + metadata.get('description', '').replace(LEGACY_UUID, UUID)),
        'settings-schema': SCHEMA_ID,
        'shell-version': metadata.get('shell-version', []),
        'url': URL,
        'version': upstream_version,
        # This project's own version, with the original release it is built on.
        'version-name': f'{project_version} (Clipboard History {upstream_version_name}, release {upstream_version})',
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
