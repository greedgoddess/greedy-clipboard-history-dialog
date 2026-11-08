#!/usr/bin/env python3
"""test_patch_release.py — unit tests of scripts/patch_release.py on small,
made-up releases. Run: python3 -m unittest tests/test_patch_release.py"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATCHER = ROOT / 'scripts' / 'patch_release.py'
LEGACY_UUID = 'clipboard-history@manouchehr'
LEGACY_SCHEMA = 'org.gnome.shell.extensions.clipboard-history'
SCHEMA_ID = 'org.gnome.shell.extensions.greedy-clipboard-history-dialog'

EXTENSION_JS = """import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
export default class Original extends Extension {
    enable() {
        Main.panel.addToStatusArea(this.uuid, new PanelMenu.Button(0.5, 'x'));
        Main.wm.addKeybinding('toggle-shortcut', this._settings, 0, 0, () => {});
    }
}
"""
PREFS_JS = "export default class OriginalPrefs { fillPreferencesWindow() {} }\n"
SCHEMA = f"""<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="{LEGACY_SCHEMA}" path="/org/gnome/shell/extensions/clipboard-history/">
    <!-- a comment the build must keep -->
    <key name="max-history-size" type="i"><default>50</default></key>
    <key name="toggle-shortcut" type="as"><default>[]</default></key>
  </schema>
</schemalist>
"""


class PatchReleaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.release = self.tmp / 'release'
        (self.release / 'schemas').mkdir(parents=True)
        self.write('metadata.json', json.dumps({'uuid': LEGACY_UUID, 'settings-schema': LEGACY_SCHEMA,
                                                'shell-version': ['51'], 'version': 3, 'version-name': '1.0'}))
        self.write('extension.js', EXTENSION_JS)
        self.write('prefs.js', PREFS_JS)
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA)

    def write(self, name, text):
        (self.release / name).write_text(text, encoding='utf-8')

    def patch(self):
        out, report = self.tmp / 'out', self.tmp / 'report.json'
        result = subprocess.run([sys.executable, str(PATCHER), str(self.release), str(out),
                                 str(ROOT / 'feature'), str(report)], capture_output=True, text=True)
        warnings = json.loads(report.read_text())['warnings'] if result.returncode == 0 else []
        return result, out, warnings

    def schema_out(self, out):
        return (out / 'schemas' / f'{SCHEMA_ID}.gschema.xml').read_text(encoding='utf-8')

    # ---- Successful builds -------------------------------------------------------

    def test_valid_release(self):
        result, out, warnings = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(warnings, [])
        self.assertEqual((out / 'upstream-extension.js').read_text(), EXTENSION_JS)
        self.assertEqual((out / 'upstream-prefs.js').read_text(), PREFS_JS)
        xml = self.schema_out(out)
        self.assertIn(f'id="{SCHEMA_ID}"', xml)
        self.assertIn('a comment the build must keep', xml)
        for key in ('max-history-size', 'cursor-follow', 'update-notifications'):
            self.assertIn(f'<key name="{key}"', xml)
        meta = json.loads((out / 'metadata.json').read_text())
        self.assertEqual(meta['shell-version'], ['51'])

    def test_missing_shortcut_is_reported(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml',
                   SCHEMA.replace('    <key name="toggle-shortcut" type="as"><default>[]</default></key>\n', ''))
        result, _, warnings = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any('toggle-shortcut' in w for w in warnings))

    def test_missing_preferences_get_a_fallback(self):
        (self.release / 'prefs.js').unlink()
        result, out, _ = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('ExtensionPreferences as default', (out / 'upstream-prefs.js').read_text())

    def test_literal_uuid_only_that_is_replaced(self):
        self.write('helper.js', f"const ID = '{LEGACY_UUID}'; // keep this comment\n")
        result, out, warnings = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((out / 'helper.js').read_text(),
                         "const ID = 'greedy-clipboard-history-dialog@greedgoddess'; // keep this comment\n")
        self.assertTrue(any('helper.js' in w for w in warnings))

    def test_existing_cursor_follow_key_is_kept_and_reported(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace(
            '</schema>', '<key name="cursor-follow" type="b"><default>true</default></key>\n  </schema>'))
        result, out, warnings = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.schema_out(out).count('name="cursor-follow"'), 1)
        self.assertTrue(any('cursor-follow' in w for w in warnings))

    def test_other_schemas_in_the_same_file_are_kept(self):
        other = '<schema id="org.example.other" path="/org/example/other/"><key name="x" type="b"><default>true</default></key></schema>'
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace('</schemalist>', f'  {other}\n</schemalist>'))
        result, out, _ = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        xml = self.schema_out(out)
        self.assertIn(other, xml)
        self.assertIn('<key name="cursor-follow"', xml.split('org.example.other')[0])

    def test_closing_tag_inside_a_comment_is_ignored(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml',
                   SCHEMA.replace('a comment the build must keep', 'ends with </schema> here'))
        result, out, _ = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        xml = self.schema_out(out)
        self.assertIn('<!-- ends with </schema> here -->', xml)
        self.assertLess(xml.index('max-history-size'), xml.index('name="cursor-follow"'))

    def test_attribute_order_quotes_and_spacing(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace(
            f'<schema id="{LEGACY_SCHEMA}" path="/org/gnome/shell/extensions/clipboard-history/">',
            f"<schema  path = '/org/gnome/shell/extensions/clipboard-history/'\n    id = '{LEGACY_SCHEMA}' >"))
        result, out, _ = self.patch()
        self.assertEqual(result.returncode, 0, result.stderr)
        xml = self.schema_out(out)
        self.assertIn(f'id="{SCHEMA_ID}"', xml)
        self.assertIn('path="/org/gnome/shell/extensions/greedy-clipboard-history-dialog/"', xml)

    def test_two_schema_files_with_the_original_id(self):
        self.write('schemas/second.gschema.xml', SCHEMA)
        self.assertRefused('exactly one settings schema')

    # ---- Refused releases ---------------------------------------------------------

    def assertRefused(self, fragment):
        result, _, _ = self.patch()
        self.assertEqual(result.returncode, 1)
        self.assertIn(fragment, result.stderr)

    def test_missing_metadata(self):
        (self.release / 'metadata.json').unlink()
        self.assertRefused('no metadata.json')

    def test_wrong_uuid(self):
        self.write('metadata.json', json.dumps({'uuid': 'other@example.org'}))
        self.assertRefused('not clipboard-history@manouchehr')

    def test_missing_extension_js(self):
        (self.release / 'extension.js').unlink()
        self.assertRefused('no extension.js')

    def test_changed_entry_point(self):
        self.write('extension.js', EXTENSION_JS.replace('export default class', 'class'))
        self.assertRefused('export default class')

    def test_changed_schema_id(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace(LEGACY_SCHEMA, 'org.example.other'))
        self.assertRefused('exactly one settings schema')

    def test_unexpected_schema_structure(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace('<schemalist>', '<list>')
                   .replace('</schemalist>', '</list>'))
        self.assertRefused('expected <schemalist>')

    def test_broken_schema_xml(self):
        self.write(f'schemas/{LEGACY_SCHEMA}.gschema.xml', SCHEMA.replace('</key>', ''))
        self.assertRefused('not valid XML')


if __name__ == '__main__':
    unittest.main()
