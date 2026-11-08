# scripts/common.sh — settings and helpers shared by the scripts in the
# repository root. Sourced, not run.

# This extension's own identity. It is independent of the original Clipboard
# History extension: separate UUID, settings and clipboard history folder.
UUID="greedy-clipboard-history-dialog@greedgoddess"
SETTINGS_PATH="/org/gnome/shell/extensions/greedy-clipboard-history-dialog/"
CURSOR_FOLLOW_KEY="${SETTINGS_PATH}cursor-follow"

# The original extension, and earlier versions of this fork, which used the
# original's identity. uninstall-previous-version.sh migrates from these.
LEGACY_UUID="clipboard-history@manouchehr"
LEGACY_SETTINGS_PATH="/org/gnome/shell/extensions/clipboard-history/"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"

EXTENSIONS_DIR="$DATA_HOME/gnome-shell/extensions"
INSTALL_DIR="$EXTENSIONS_DIR/$UUID"
LEGACY_INSTALL_DIR="$EXTENSIONS_DIR/$LEGACY_UUID"

HISTORY_DIR="$CACHE_HOME/$UUID"
BUILT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/build/$UUID"
LEGACY_HISTORY_DIR="$CACHE_HOME/$LEGACY_UUID"

# Working space for the installer, outside the extensions folder: GNOME Shell
# scans every folder in there and logs an error for each one whose name is
# not the UUID in its metadata.json.
WORK_DIR="$DATA_HOME/greedy-clipboard-history-dialog"
BACKUP_DIR="$WORK_DIR/backup"

say() { printf '%s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_command() {
    command -v "$1" >/dev/null || fail "'$1' was not found. $2"
}

# Asks a yes/no question; the answer defaults to no. With ASSUME_YES=1 (set
# by --yes) every question is answered yes without asking.
confirm() {
    [[ "${ASSUME_YES:-0}" == 1 ]] && return 0
    local answer=""
    read -r -p "$1 [y/N] " answer || return 1
    [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

# True if GNOME Shell knows an extension with the legacy UUID, wherever it is
# installed (user folder or system-wide), or if its folder exists.
legacy_present() {
    [[ -d "$LEGACY_INSTALL_DIR" ]] && return 0
    gnome-extensions info "$LEGACY_UUID" >/dev/null 2>&1
}

# True if the legacy extension is in GNOME's list of enabled extensions.
legacy_enabled() {
    gsettings get org.gnome.shell enabled-extensions 2>/dev/null | grep -Fq "'$LEGACY_UUID'"
}

# Prints the "version" field of a metadata.json, or "?".
metadata_version() {
    python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("version","?"))' "$1" 2>/dev/null || say "?"
}

# Parses the options common to all scripts. Unknown options are an error.
parse_common_options() {
    ASSUME_YES=0
    for arg in "$@"; do
        case "$arg" in
            -y|--yes) ASSUME_YES=1 ;;
            -h|--help) usage; exit 0 ;;
            *) fail "Unknown option: $arg (try --help)" ;;
        esac
    done
}
