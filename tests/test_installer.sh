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

# ---- Password manager integration: left out unless asked for --------------------
make_build true plain
run "$REPO/install.sh" --yes
check "password manager integration left out by default" '[[ ! -e "$EXT_DIR/passwordManagerSwitch.js" && ! -e "$EXT_DIR/passwordManagers.js" && ! -e "$EXT_DIR/roundedCorners.js" ]] && grep -q "passwordManagers: false" "$EXT_DIR/features.js"'
check "hover preview is always installed" '[[ -f "$EXT_DIR/hoverPreview.js" && -f "$EXT_DIR/hoverPreview.css" ]]'
run "$REPO/install.sh" --yes --with-password-managers
check "--with-password-managers includes it" '[[ -f "$EXT_DIR/passwordManagerSwitch.js" && -f "$EXT_DIR/passwordManagers.js" && -f "$EXT_DIR/roundedCorners.js" ]] && grep -q "passwordManagers: true" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes
check "a plain install keeps it" 'grep -q "passwordManagers: true" "$EXT_DIR/features.js"'
dconf write "${NEW_PATH}password-managers" "['1password']"
run "$REPO/install.sh" --yes --without-password-managers
check "--without-password-managers removes it and switches every password manager off" '[[ ! -e "$EXT_DIR/passwordManagerSwitch.js" ]] && grep -q "passwordManagers: false" "$EXT_DIR/features.js" && [[ $(setting "$NEW_PATH" password-managers) == "@as []" ]]'
run "$REPO/install.sh" --yes --with-1password
check "--with-1password still works, as the older name" 'grep -q "passwordManagers: true" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes --without-1password

# An installation from before 1.2.0 (1Password integration, its switch on)
# keeps it: 1Password enabled and opened by the second shortcut press.
echo "export const FEATURES = {quickAccess: true, largeSpacing: false};" > "$EXT_DIR/features.js"
dconf write "${NEW_PATH}quick-access" true
run "$REPO/install.sh" --yes
check "the 1Password integration carries over as password managers" 'grep -q "passwordManagers: true" "$EXT_DIR/features.js" && [[ $(setting "$NEW_PATH" password-managers) == "['"'"'1password'"'"']" && $(setting "$NEW_PATH" shortcut-password-manager) == "'"'"'1password'"'"'" && -z $(setting "$NEW_PATH" quick-access) ]]'
run "$REPO/install.sh" --yes --without-password-managers

# ---- Gestures: left out unless asked for ----------------------------------------
make_build true plain
run "$REPO/install.sh" --yes
check "gestures left out by default" '[[ ! -e "$EXT_DIR/gestures.js" ]] && grep -q "gestures: false" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes --with-gestures
check "--with-gestures includes them" '[[ -f "$EXT_DIR/gestures.js" ]] && grep -q "gestures: true" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes
check "a plain install keeps them" 'grep -q "gestures: true" "$EXT_DIR/features.js"'
dconf write "${NEW_PATH}gesture-touchscreen-tap" true
run "$REPO/install.sh" --yes --without-gestures
check "--without-gestures removes them and switches them off" '[[ ! -e "$EXT_DIR/gestures.js" && $(setting "$NEW_PATH" gesture-touchscreen-tap) == false ]]'

# ---- Large spacing: left out unless asked for, independent of 1Password ------------
run "$REPO/install.sh" --yes
check "large spacing left out by default" '[[ ! -e "$EXT_DIR/largeSpacing.js" && ! -e "$EXT_DIR/largeSpacing.css" ]] && grep -q "largeSpacing: false" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes --with-large-spacing
check "--with-large-spacing includes it, password managers stay out" '[[ -f "$EXT_DIR/largeSpacing.js" && -f "$EXT_DIR/largeSpacing.css" && ! -e "$EXT_DIR/passwordManagerSwitch.js" ]] && grep -q "largeSpacing: true" "$EXT_DIR/features.js"'
run "$REPO/install.sh" --yes --with-password-managers
check "adding password managers keeps large spacing" 'grep -q "passwordManagers: true, largeSpacing: true" "$EXT_DIR/features.js"'
dconf write "${NEW_PATH}large-spacing" true
run "$REPO/install.sh" --yes --without-large-spacing
check "--without-large-spacing removes it and switches it off, password managers stay" '[[ ! -e "$EXT_DIR/largeSpacing.js" && -f "$EXT_DIR/passwordManagerSwitch.js" && $(setting "$NEW_PATH" large-spacing) == false ]]'
run "$REPO/install.sh" --yes --without-password-managers

# An installation from before the rename (touch mode) keeps its choice and switch.
echo "export const FEATURES = {passwordManagers: false, touchMode: true};" > "$EXT_DIR/features.js"
dconf write "${NEW_PATH}touch-mode" true
run "$REPO/install.sh" --yes
check "touch mode carries over as large spacing" 'grep -q "largeSpacing: true" "$EXT_DIR/features.js" && [[ $(setting "$NEW_PATH" large-spacing) == true && -z $(setting "$NEW_PATH" touch-mode) ]]'
run "$REPO/install.sh" --yes --without-large-spacing

# Interrupted install: moving the new copy into place fails.
make_build true third
stub mv 'if [[ "$2" == *staging.* && "$3" == *'"$UUID"' ]]; then exit 1; fi; exec /bin/mv "$@"'
run "$REPO/install.sh" --yes
check "interrupted install fails" '[[ $? -ne 0 ]]'
check "interrupted install restores the previous copy" 'grep -q "// plain" "$EXT_DIR/extension.js"'
check "interrupted install leaves no staging folder" '! ls "$XDG_DATA_HOME/greedy-clipboard-history-dialog" | grep -q staging'
rm -f "$SANDBOX/bin/mv"

(( failures == 0 ))
