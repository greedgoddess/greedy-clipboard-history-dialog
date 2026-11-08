# scripts/common.sh — settings and helpers shared by the scripts in the
# repository root. Sourced, not run. See docs/installation.md.

# The extension keeps the stock extension's UUID on purpose, so that its
# settings and clipboard history carry over. See README.md, "Why the UUID is
# unchanged".
UUID="clipboard-history@manouchehr"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
CACHE_HOME="${XDG_CACHE_HOME:-$HOME/.cache}"

EXTENSIONS_DIR="$DATA_HOME/gnome-shell/extensions"
INSTALL_DIR="$EXTENSIONS_DIR/$UUID"

# Working space for the installer. It lives outside the extensions folder:
# GNOME Shell scans every folder in there and logs an error for each one
# whose name is not the UUID in its metadata.json.
WORK_DIR="$DATA_HOME/greedy-clipboard-history-dialog"
BACKUP_DIR="$WORK_DIR/backup"

HISTORY_DIR="$CACHE_HOME/$UUID"
SETTINGS_PATH="/org/gnome/shell/extensions/clipboard-history/"
CURSOR_FOLLOW_KEY="${SETTINGS_PATH}cursor-follow"

# Markers used to tell installed versions apart:
#  - this version tags its cursor-follow code with [cursor-follow:...];
#  - the previous fork version (metadata version 4) had the code built in,
#    without a setting, around a field named _cursorAnchor.
CURRENT_VERSION_MARKER="[cursor-follow:positioning]"
PREVIOUS_VERSION_MARKER="_cursorAnchor"

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

# Prints which variant of the extension is installed in INSTALL_DIR:
#   none          nothing installed
#   current       this version (cursor-follow as a setting)
#   previous-fork the previous fork version (cursor-follow built in)
#   other         anything else, normally the stock extension
installed_variant() {
    local js="$INSTALL_DIR/extension.js"
    if [[ ! -f "$js" ]]; then
        say none
    elif grep -Fq "$CURRENT_VERSION_MARKER" "$js"; then
        say current
    elif grep -Fq "$PREVIOUS_VERSION_MARKER" "$js"; then
        say previous-fork
    else
        say other
    fi
}

# Prints the "version" field of an installed or source metadata.json.
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
