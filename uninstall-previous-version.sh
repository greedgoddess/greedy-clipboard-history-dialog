#!/usr/bin/env bash
# uninstall-previous-version.sh — removes the previous version of this fork
# (metadata version 4, with the pointer placement built in) so that the
# current version can be installed cleanly with ./install.sh.
#
# Keeps: clipboard history (~/.cache/clipboard-history@manouchehr/) and all
# extension settings. See docs/installation.md#migrating-from-the-previous-version
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

usage() {
    say "Usage: ./uninstall-previous-version.sh [--yes]"
    say "Removes the previous fork version (v4). Keeps clipboard history and settings."
    say "  -y, --yes   answer yes to every question"
}
parse_common_options "$@"

require_command gnome-extensions "It is part of GNOME Shell."

variant="$(installed_variant)"
case "$variant" in
    none)
        say "No installed copy found in $INSTALL_DIR. Nothing to remove." ;;
    current)
        say "The installed copy is already the current version. Nothing to remove."
        say "To reinstall it, run ./install.sh" ;;
    other)
        say "The installed copy is not the previous fork version (it looks like the"
        say "stock extension). It is left alone; ./install.sh will back it up and"
        say "replace it." ;;
    previous-fork)
        say "Found the previous fork version (metadata version $(metadata_version "$INSTALL_DIR/metadata.json"))"
        say "in $INSTALL_DIR"
        say "Clipboard history and settings will be kept."
        if confirm "Remove it?"; then
            gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
            rm -rf -- "$INSTALL_DIR"
            say "Removed."
        else
            say "Cancelled. Nothing was changed."
            exit 0
        fi ;;
esac

# The previous installer kept backups, and on failure staging folders, inside
# the extensions folder itself, where GNOME Shell logs an error for each one.
leftovers=()
while IFS= read -r -d '' dir; do
    leftovers+=("$dir")
done < <(find "$EXTENSIONS_DIR" -mindepth 1 -maxdepth 1 -type d \
    \( -name ".$UUID.backup.*" -o -name '.clipboard-history-stage.*' \) -print0 2>/dev/null)

if (( ${#leftovers[@]} > 0 )); then
    say
    say "Leftover folders from the previous installer:"
    printf '  %s\n' "${leftovers[@]}"
    if confirm "Delete them? (They only hold old copies of the extension code.)"; then
        rm -rf -- "${leftovers[@]}"
        say "Deleted."
    else
        say "Kept. You can delete them later; they are not used."
    fi
fi

say
say "Next: run ./install.sh, then log out and back in."
