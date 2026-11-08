#!/usr/bin/env bash
# test_build_swap.sh — tests that build.sh replaces build/ completely or not
# at all: a failed build and an interrupted swap both leave the previous
# build in place. Uses a small made-up release; needs no network or GNOME.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf -- "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/bin"
cp -a "$ROOT/build.sh" "$ROOT/scripts" "$ROOT/feature" "$ROOT/VERSION" "$SANDBOX/"
echo '[]' > "$SANDBOX/tested-releases.json"
printf '#!/usr/bin/env bash\nexit 1\n' > "$SANDBOX/bin/gnome-shell"; chmod +x "$SANDBOX/bin/gnome-shell"
export PATH="$SANDBOX/bin:$PATH"
UUID="greedy-clipboard-history-dialog@greedgoddess"

make_release() {  # make_release FILE VERSION [broken]
    python3 - "$@" <<'PY'
import json, sys, zipfile
path, version = sys.argv[1], int(sys.argv[2])
broken = len(sys.argv) > 3
schema = ('<?xml version="1.0"?>\n<schemalist>\n  <schema id="org.gnome.shell.extensions.clipboard-history" '
          'path="/org/gnome/shell/extensions/clipboard-history/">\n'
          '    <key name="max-history-size" type="i"><default>50</default></key>\n  </schema>\n</schemalist>\n')
with zipfile.ZipFile(path, 'w') as z:
    z.writestr('metadata.json', json.dumps({'uuid': 'clipboard-history@manouchehr', 'version': version,
        'version-name': '1.0', 'settings-schema': 'org.gnome.shell.extensions.clipboard-history', 'shell-version': ['51']}))
    z.writestr('extension.js', ('class X {}' if broken else
        "import * as Main from 'x'; import * as PanelMenu from 'y';\n"
        "export default class X { enable() { Main.panel.addToStatusArea(this.uuid, new PanelMenu.Button()); } }\n"))
    z.writestr('schemas/org.gnome.shell.extensions.clipboard-history.gschema.xml', schema)
PY
}
version_built() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["upstream_version"])' "$SANDBOX/build/$UUID/build-info.json"; }

failures=0
check() { if eval "$2"; then echo "  pass  $1"; else echo "  FAIL  $1"; failures=$((failures + 1)); fi; }

make_release "$SANDBOX/r1.zip" 1; make_release "$SANDBOX/r2.zip" 2; make_release "$SANDBOX/bad.zip" 3 broken
"$SANDBOX/build.sh" --zip "$SANDBOX/r1.zip" >/dev/null 2>&1
check "first build" '[[ $(version_built) == 1 ]]'
"$SANDBOX/build.sh" --zip "$SANDBOX/r2.zip" >/dev/null 2>&1
check "second build replaces it and keeps the first as previous" '[[ $(version_built) == 2 && -d "$SANDBOX/build/previous/$UUID" ]]'
check "previous builds do not pile up" '[[ ! -e "$SANDBOX/build/previous/previous" ]]'

"$SANDBOX/build.sh" --zip "$SANDBOX/bad.zip" >/dev/null 2>&1
check "failed build leaves build/ as it was" '[[ $? -ne 0 && $(version_built) == 2 ]]'

# Interrupted swap: the second rename (.build.new -> build) fails once.
printf '#!/usr/bin/env bash\nif [[ "$2" == *.build.new && "$3" == */build ]]; then exit 1; fi\nexec /bin/mv "$@"\n' > "$SANDBOX/bin/mv"
chmod +x "$SANDBOX/bin/mv"
"$SANDBOX/build.sh" --zip "$SANDBOX/r1.zip" >/dev/null 2>&1
status=$?
rm -f "$SANDBOX/bin/mv"
check "interrupted swap fails" '[[ $status -ne 0 ]]'
check "interrupted swap puts the previous build back" '[[ $(version_built) == 2 ]]'
check "interrupted swap leaves no .build.new" '[[ ! -e "$SANDBOX/.build.new" ]] || [[ ! -e "$SANDBOX/.build.new/previous" ]]'

(( failures == 0 ))
