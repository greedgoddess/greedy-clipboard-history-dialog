#!/usr/bin/env bash
# test_installer.sh — tests install.sh without GNOME (see tests/sandbox.sh):
# first install, untested builds, modes, the old extension, and rollback
# when an install is interrupted.
set -uo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=sandbox.sh
source "$ROOT/tests/sandbox.sh"

make_build true first
run "$REPO/install.sh" --yes
check "first install of a tested build" '[[ $? -eq 0 && -f "$EXT_DIR/extension.js" ]]'
check "first install switches both settings on" '[[ $(setting "$NEW_PATH" cursor-follow) == true && $(setting "$NEW_PATH" update-notifications) == true ]]'
check "first install is a user machine" '[[ $(setting "$NEW_PATH" developer-mode) == false ]]'

make_build false untested
run "$REPO/install.sh" --yes
check "untested build refused with --yes alone" '[[ $? -ne 0 ]] && grep -q "// first" "$EXT_DIR/extension.js"'
run "$REPO/install.sh" --yes --allow-untested
check "untested build installed with --allow-untested" '[[ $? -eq 0 ]] && grep -q "// untested" "$EXT_DIR/extension.js"'

make_build true second
run "$REPO/install.sh" --dev --yes
check "--dev makes a developer machine" '[[ $(setting "$NEW_PATH" developer-mode) == true ]]'
run "$REPO/install.sh" --yes
check "a plain install keeps the mode" '[[ $(setting "$NEW_PATH" developer-mode) == true ]]'
run "$REPO/install.sh" --user --yes
check "--user switches back" '[[ $(setting "$NEW_PATH" developer-mode) == false ]]'

echo "['$LEGACY_UUID']" > "$SANDBOX/gs-enabled-extensions"
run "$REPO/install.sh" --yes
check "refused while the old extension is enabled" '[[ $? -ne 0 ]] && grep -q "uninstall-previous-version" "$SANDBOX/out"'
rm -f "$SANDBOX/gs-enabled-extensions"

mkdir -p "$LEGACY_EXT_DIR"; echo original > "$LEGACY_EXT_DIR/extension.js"
make_build true fourth
run "$REPO/install.sh" --yes
check "installing never touches the original extension" 'grep -qx original "$LEGACY_EXT_DIR/extension.js"'
rm -rf "$LEGACY_EXT_DIR"

# Interrupted install: moving the new copy into place fails.
make_build true third
stub mv 'if [[ "$2" == *staging.* && "$3" == *'"$UUID"' ]]; then exit 1; fi; exec /bin/mv "$@"'
run "$REPO/install.sh" --yes
check "interrupted install fails" '[[ $? -ne 0 ]]'
check "interrupted install restores the previous copy" 'grep -q "// fourth" "$EXT_DIR/extension.js"'
check "interrupted install leaves no staging folder" '! ls "$XDG_DATA_HOME/greedy-clipboard-history-dialog" | grep -q staging'
rm -f "$SANDBOX/bin/mv"

(( failures == 0 ))
