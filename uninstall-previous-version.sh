#!/usr/bin/env bash
# uninstall-previous-version.sh — moves from the original Clipboard History
# extension, or from an earlier version of this fork (which used the
# original's identity), to this independent extension.
#
# 1. Copies the clipboard history and settings over, if this extension has
#    none yet. The originals are left in place.
# 2. Removes the old extension (or, if it is installed system-wide, disables
#    it), so that two clipboard panels don't run side by side.
# 3. Offers to delete folders the old installer left in the extensions folder.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./uninstall-previous-version.sh [--yes]"
    say "Copies history and settings from $LEGACY_UUID, then removes it."
    say "  -y, --yes   answer yes to every question"
}
parse_common_options "$@"

require_command gnome-extensions "It is part of GNOME Shell."
require_command dconf "Install it with: sudo dnf install dconf"
require_command python3 "Install it with: sudo dnf install python3"

# ---- 1. Copy clipboard history ----------------------------------------------

if [[ -f "$LEGACY_HISTORY_DIR/history.json" ]]; then
    if [[ -e "$HISTORY_DIR" ]]; then
        say "Clipboard history: $HISTORY_DIR already exists; not copied."
    else
        cp -a -- "$LEGACY_HISTORY_DIR" "$HISTORY_DIR"
        # Image entries store absolute paths into the history folder; point
        # them at the copy.
        python3 - "$HISTORY_DIR/history.json" "$LEGACY_HISTORY_DIR" "$HISTORY_DIR" <<'PY'
import json, sys
index, old, new = sys.argv[1:]
entries = json.load(open(index, encoding='utf-8'))
for entry in entries if isinstance(entries, list) else []:
    path = entry.get('imagePath')
    if isinstance(path, str) and path.startswith(old + '/'):
        entry['imagePath'] = new + path[len(old):]
json.dump(entries, open(index, 'w', encoding='utf-8'))
PY
        say "Clipboard history copied to $HISTORY_DIR"
    fi
fi

# ---- 2. Copy settings -------------------------------------------------------

legacy_settings="$(dconf dump "$LEGACY_SETTINGS_PATH")"
if [[ -n "$legacy_settings" ]]; then
    if [[ -n "$(dconf dump "$SETTINGS_PATH")" ]]; then
        say "Settings: this extension already has settings; not copied."
    else
        printf '%s\n' "$legacy_settings" | dconf load "$SETTINGS_PATH"
        say "Settings copied (keyboard shortcut, history size, images, placement)."
    fi
fi

# ---- 3. Remove or disable the old extension ---------------------------------

if [[ -d "$LEGACY_INSTALL_DIR" ]]; then
    say
    say "Old extension found in $LEGACY_INSTALL_DIR"
    if confirm "Remove it? (Its history and settings stay where they are.)"; then
        gnome-extensions disable "$LEGACY_UUID" >/dev/null 2>&1 || true
        rm -rf -- "$LEGACY_INSTALL_DIR"
        say "Removed."
    else
        gnome-extensions disable "$LEGACY_UUID" >/dev/null 2>&1 || true
        say "Kept, but disabled, so that only one clipboard panel runs."
    fi
elif legacy_present; then
    gnome-extensions disable "$LEGACY_UUID" >/dev/null 2>&1 || true
    say "The old extension is installed system-wide; it has been disabled."
    say "To remove it, use the package manager it came from."
else
    say "No old extension installed."
fi

# ---- 4. Leftovers of the first installer ------------------------------------

leftovers=()
while IFS= read -r -d '' dir; do
    leftovers+=("$dir")
done < <(find "$EXTENSIONS_DIR" -mindepth 1 -maxdepth 1 -type d \
    \( -name ".$LEGACY_UUID.backup.*" -o -name '.clipboard-history-stage.*' \) -print0 2>/dev/null)

if (( ${#leftovers[@]} > 0 )); then
    say
    say "Leftover folders from an earlier installer:"
    printf '  %s\n' "${leftovers[@]}"
    if confirm "Delete them? (They only hold old copies of the extension code.)"; then
        rm -rf -- "${leftovers[@]}"
        say "Deleted."
    fi
fi

say
say "Next: run ./install.sh, then log out and back in."
say "Once everything works, the old history and settings can be deleted with:"
say "  rm -rf $LEGACY_HISTORY_DIR && dconf reset -f $LEGACY_SETTINGS_PATH"
