#!/usr/bin/env bash
# test_migration.sh — tests uninstall-previous-version.sh and uninstall.sh
# without GNOME (see tests/sandbox.sh). The original extension's history,
# settings and files must never be lost; this project's must never be
# overwritten by a migration.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=sandbox.sh
source "$ROOT/tests/sandbox.sh"

original_setup() {  # The original extension, installed, with history and settings.
    rm -rf "$LEGACY_EXT_DIR" "$LEGACY_HISTORY" "$HISTORY" "$SANDBOX/dconf.json"
    mkdir -p "$LEGACY_EXT_DIR" "$LEGACY_HISTORY/images"
    echo original > "$LEGACY_EXT_DIR/extension.js"
    echo png > "$LEGACY_HISTORY/images/a.png"
    printf '[{"id":"1","type":"image","imagePath":"%s/images/a.png"},{"id":"2","type":"text","text":"hello"}]' \
        "$LEGACY_HISTORY" > "$LEGACY_HISTORY/history.json"
    dconf write "${OLD_PATH}toggle-shortcut" "['<Super>v']"
    dconf write "${OLD_PATH}max-history-size" "80"
}
image_path() { python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[0]["imagePath"])' "$1/history.json"; }

# ---- Migration --------------------------------------------------------------------
original_setup
legacy_before="$(cat "$LEGACY_HISTORY/history.json")"
run "$REPO/uninstall-previous-version.sh" --yes
check "migration succeeds" '[[ $? -eq 0 ]]'
check "history copied" 'grep -q hello "$HISTORY/history.json" && [[ -f "$HISTORY/images/a.png" ]]'
check "image paths point at the new history" '[[ $(image_path "$HISTORY") == "$HISTORY/images/a.png" ]]'
check "settings copied" '[[ $(setting "$NEW_PATH" toggle-shortcut) == "['"'"'<Super>v'"'"']" && $(setting "$NEW_PATH" max-history-size) == 80 ]]'
check "original history kept unchanged" '[[ "$(cat "$LEGACY_HISTORY/history.json")" == "$legacy_before" ]]'
check "original settings kept" '[[ $(setting "$OLD_PATH" max-history-size) == 80 ]]'
check "original extension removed after copying" '[[ ! -d "$LEGACY_EXT_DIR" ]]'

new_history="$(cat "$HISTORY/history.json")"
dconf write "${NEW_PATH}max-history-size" "120"
run "$REPO/uninstall-previous-version.sh" --yes
check "repeated migration succeeds" '[[ $? -eq 0 ]]'
check "repeated migration does not overwrite this project's history" '[[ "$(cat "$HISTORY/history.json")" == "$new_history" ]]'
check "repeated migration does not overwrite this project's settings" '[[ $(setting "$NEW_PATH" max-history-size) == 120 ]]'

# Interrupted while copying the history: nothing half-copied stays behind.
original_setup
stub cp 'exit 1'
run "$REPO/uninstall-previous-version.sh" --yes
status=$?
rm -f "$SANDBOX/bin/cp"
check "interrupted migration fails" '[[ $status -ne 0 ]]'
check "interrupted migration leaves no partial history" '[[ ! -e "$HISTORY" && ! -e "$HISTORY.partial" ]]'
check "interrupted migration keeps the original installed" 'grep -qx original "$LEGACY_EXT_DIR/extension.js"'
run "$REPO/uninstall-previous-version.sh" --yes
check "migration completes when run again" 'grep -q hello "$HISTORY/history.json"'

# Original installed system-wide: disabled, not deleted.
original_setup
rm -rf "$LEGACY_EXT_DIR"
echo "$LEGACY_UUID" > "$SANDBOX/known"
run "$REPO/uninstall-previous-version.sh" --yes
check "system-wide original is disabled" 'grep -qx "$LEGACY_UUID" "$SANDBOX/disabled"'
rm -f "$SANDBOX/known"

# ---- Uninstall --------------------------------------------------------------------
original_setup
rm -rf "$HISTORY"; mkdir -p "$HISTORY"; echo '[]' > "$HISTORY/history.json"
dconf write "${NEW_PATH}cursor-follow" "true"
make_build true current
run "$REPO/install.sh" --yes
run "$REPO/uninstall.sh" --yes
check "uninstall removes the extension" '[[ ! -d "$EXT_DIR" ]]'
check "uninstall keeps this project's history and settings" '[[ -f "$HISTORY/history.json" && $(setting "$NEW_PATH" cursor-follow) == true ]]'

run "$REPO/install.sh" --yes
run "$REPO/uninstall.sh" --purge --yes
check "purge deletes this project's history and settings" '[[ ! -e "$HISTORY" && -z $(setting "$NEW_PATH" cursor-follow) ]]'
check "purge never touches the original's history" '[[ -f "$LEGACY_HISTORY/history.json" ]]'
check "purge never touches the original's settings" '[[ $(setting "$OLD_PATH" max-history-size) == 80 ]]'
check "purge never touches the original extension" 'grep -qx original "$LEGACY_EXT_DIR/extension.js"'

(( failures == 0 ))
