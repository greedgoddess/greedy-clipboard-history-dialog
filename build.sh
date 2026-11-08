#!/usr/bin/env bash
# build.sh — builds Greedy Clipboard History Dialog in build/ from a release of
# the original Clipboard History extension.
#
# By default it uses the newest release listed in tested-releases.json for
# the running GNOME Shell, and checks that the download matches what was
# tested. The original code is not edited: this project's files extend it
# (see scripts/patch_release.py and docs/cursor-follow.md#how-the-build-works).
# A new build replaces build/ only when every step succeeded; the previous
# build is kept in build/previous/.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

UPSTREAM_GIT_URL="https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history.git"
UPSTREAM="$ROOT/scripts/upstream.py"

usage() {
    cat <<USAGE
Usage: ./build.sh [options]
Builds the extension in build/ from a release of Clipboard History.

Release (default: the newest tested release for the running GNOME Shell,
see tested-releases.json):
  --latest           newest release on extensions.gnome.org, tested or not
  --version N        release N from extensions.gnome.org
  --zip FILE         a release zip already downloaded
  --from-git [REF]   the author's GitHub repository, default branch or REF

  --force            build even if the release does not list the running
                     GNOME Shell version
  -h, --help         show this help
USAGE
}

SOURCE=tested
PIN_VERSION=""
ZIP_FILE=""
GIT_REF=""
FORCE=0
while (( $# > 0 )); do
    case "$1" in
        --latest) SOURCE=latest; shift ;;
        --version) SOURCE=version; PIN_VERSION="${2:?--version needs a number}"; shift 2 ;;
        --zip) SOURCE=zip; ZIP_FILE="${2:?--zip needs a file}"; shift 2 ;;
        --from-git)
            SOURCE=git
            if [[ -n "${2:-}" && "$2" != -* ]]; then GIT_REF="$2"; shift; fi
            shift ;;
        --force) FORCE=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) fail "Unknown option: $1 (try --help)" ;;
    esac
done

require_command python3 "Install it with: sudo dnf install python3"
require_command zip "Install it with: sudo dnf install zip"
require_command glib-compile-schemas "Install it with: sudo dnf install glib2"

SHELL_MAJOR="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"

# A previous run interrupted while swapping in its build left build/ in
# .build.new/previous/; put it back first.
if [[ ! -d "$ROOT/build" && -d "$ROOT/.build.new/previous" ]]; then
    mv -- "$ROOT/.build.new/previous" "$ROOT/build"
    warn "Restored build/ after an interrupted build."
fi
rm -rf -- "$ROOT/.build.new"

WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
mkdir -p "$WORK/release"

# ---- 1. Get the release -----------------------------------------------------

EXPECTED_HASH=""
case "$SOURCE" in
    tested)
        read -r PIN_VERSION EXPECTED_HASH < <(python3 "$UPSTREAM" tested --shell "${SHELL_MAJOR:-}") \
            || fail "No tested release for GNOME Shell ${SHELL_MAJOR:-?} in tested-releases.json. Use --latest to build an untested one."
        ;;
    latest)
        say "Looking up the latest release on extensions.gnome.org…"
        PIN_VERSION="$(python3 "$UPSTREAM" latest --shell "${SHELL_MAJOR:-}")" ;;
esac

case "$SOURCE" in
    zip)
        [[ -f "$ZIP_FILE" ]] || fail "No such file: $ZIP_FILE"
        cp -- "$ZIP_FILE" "$WORK/release.zip"
        SOURCE_DESC="zip file $(basename -- "$ZIP_FILE")"
        SOURCE_URL="file://$(realpath -- "$ZIP_FILE")" ;;
    git)
        require_command git "Install it with: sudo dnf install git"
        say "Cloning $UPSTREAM_GIT_URL${GIT_REF:+ at $GIT_REF}…"
        git clone -q --depth 1 ${GIT_REF:+--branch "$GIT_REF"} "$UPSTREAM_GIT_URL" "$WORK/clone" \
            || fail "Could not clone the author's repository."
        meta="$(grep -rl --include=metadata.json "\"$LEGACY_UUID\"" "$WORK/clone" | head -n1 || true)"
        [[ -n "$meta" ]] || fail "No metadata.json for $LEGACY_UUID in the repository."
        (cd "$(dirname -- "$meta")" && zip -qr "$WORK/release.zip" . -x '.git/*')
        SOURCE_DESC="GitHub, $(git -C "$WORK/clone" rev-parse --abbrev-ref HEAD) at $(git -C "$WORK/clone" rev-parse --short HEAD)"
        SOURCE_URL="$UPSTREAM_GIT_URL@$(git -C "$WORK/clone" rev-parse HEAD)" ;;
    *)
        say "Downloading release $PIN_VERSION…"
        python3 "$UPSTREAM" download "$PIN_VERSION" "$WORK/release.zip"
        SOURCE_DESC="extensions.gnome.org, release $PIN_VERSION"
        SOURCE_URL="https://extensions.gnome.org/extension-data/${LEGACY_UUID//@/}.v$PIN_VERSION.shell-extension.zip" ;;
esac

CONTENT_HASH="$(python3 "$UPSTREAM" content-hash "$WORK/release.zip")"
if [[ -n "$EXPECTED_HASH" && "$CONTENT_HASH" != "$EXPECTED_HASH" ]]; then
    fail "Release $PIN_VERSION differs from the tested one (content hash $CONTENT_HASH, expected $EXPECTED_HASH)."
fi
if [[ -z "$EXPECTED_HASH" ]] && grep -q "\"$CONTENT_HASH\"" "$ROOT/tested-releases.json" 2>/dev/null; then
    EXPECTED_HASH="$CONTENT_HASH"
fi
TESTED=$([[ -n "$EXPECTED_HASH" ]] && echo true || echo false)
python3 "$UPSTREAM" extract "$WORK/release.zip" "$WORK/release"

# ---- 2. Patch it ---------------------------------------------------------------

say "Adding Open at mouse pointer…"
python3 "$ROOT/scripts/patch_release.py" "$WORK/release" "$WORK/$UUID" \
    "$ROOT/feature" "$WORK/report.json"
glib-compile-schemas --strict "$WORK/$UUID/schemas" \
    || fail "The settings schema does not compile."

# ---- 3. Checks --------------------------------------------------------------------

mapfile -t WARNINGS < <(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["warnings"]))' "$WORK/report.json" | sed '/^$/d')
SHELL_VERSIONS="$(python3 -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))["shell_versions"]))' "$WORK/report.json")"

if [[ -n "$SHELL_MAJOR" ]] && ! grep -qw -- "$SHELL_MAJOR" <<<"$SHELL_VERSIONS"; then
    message="The release supports GNOME Shell $SHELL_VERSIONS, not $SHELL_MAJOR; GNOME would not enable it."
    (( FORCE == 1 )) || fail "$message Use --force to build anyway (and add $SHELL_MAJOR to metadata.json yourself)."
    WARNINGS+=("$message")
fi

# Structural compatibility: the GNOME Shell internals Open at mouse pointer
# relies on, looked up in the running GNOME Shell's own code. Finding them
# does not prove they behave as before; see docs/cursor-follow.md.
shell_lib="$(ls /usr/lib64/gnome-shell/libshell-*.so /usr/lib/gnome-shell/libshell-*.so 2>/dev/null | head -n1 || true)"
if [[ -n "$shell_lib" ]] && command -v gresource >/dev/null; then
    boxpointer="$(gresource extract "$shell_lib" /org/gnome/shell/ui/boxpointer.js 2>/dev/null || true)"
    popupmenu="$(gresource extract "$shell_lib" /org/gnome/shell/ui/popupMenu.js 2>/dev/null || true)"
    if [[ -n "$boxpointer" ]]; then
        for field in _userArrowSide _arrowSide setPosition; do
            grep -q "$field" <<<"$boxpointer" \
                || WARNINGS+=("GNOME Shell's BoxPointer has no $field; Open at mouse pointer will probably not work.")
        done
        grep -q '_boxPointer' <<<"$popupmenu" \
            || WARNINGS+=("GNOME Shell's PopupMenu has no _boxPointer; Open at mouse pointer will be inactive.")
        INTERNALS_CHECK="checked in $shell_lib"
    else
        INTERNALS_CHECK="skipped (boxpointer.js not found in $shell_lib)"
    fi
else
    INTERNALS_CHECK="skipped (GNOME Shell library or gresource not found)"
fi

# ---- 4. Provenance ---------------------------------------------------------------

# build-info.json is the machine-readable record of this build, shipped inside
# it (the update notifications read it too); BUILD-INFO is the same for people.
printf '%s\n' "${WARNINGS[@]+"${WARNINGS[@]}"}" > "$WORK/warnings.txt"
B_PROJECT_VERSION="$(cat "$ROOT/VERSION")" \
B_FEATURE_COMMIT="$(git -C "$ROOT" log -1 --format=%H -- feature 2>/dev/null || true)" \
B_CHECKOUT_COMMIT="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || true)" \
B_SOURCE="$SOURCE_DESC" B_SOURCE_URL="$SOURCE_URL" B_CONTENT_HASH="$CONTENT_HASH" \
B_TESTED="$TESTED" B_INTERNALS="$INTERNALS_CHECK" \
B_SHELL="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)*' | head -n1 || true)" \
python3 - "$WORK/report.json" "$WORK/warnings.txt" > "$WORK/$UUID/build-info.json" <<'PY'
import datetime, json, os, sys
report = json.load(open(sys.argv[1]))
env = os.environ
print(json.dumps({
    'project': 'greedy-clipboard-history-dialog',
    'project_version': env['B_PROJECT_VERSION'].strip(),
    'project_url': 'https://github.com/greedgoddess/greedy-clipboard-history-dialog',
    'feature_commit': env['B_FEATURE_COMMIT'],
    'checkout_commit': env['B_CHECKOUT_COMMIT'],
    'upstream_project': 'Clipboard History by Manouchehr Ghalevand',
    'upstream_url': 'https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history',
    'upstream_version': report['upstream_version'],
    'upstream_version_name': report['upstream_version_name'],
    'upstream_shell_versions': report['shell_versions'],
    'source': env['B_SOURCE'],
    'source_url': env['B_SOURCE_URL'],
    'content_sha256': env['B_CONTENT_HASH'],
    'tested_release': env['B_TESTED'] == 'true',
    'built_at': datetime.datetime.now().astimezone().isoformat(timespec='seconds'),
    'built_on_gnome_shell': env['B_SHELL'],
    'internals_check': env['B_INTERNALS'],
    'warnings': [w for w in open(sys.argv[2]).read().splitlines() if w],
}, indent=2))
PY

python3 - "$WORK/$UUID/build-info.json" > "$WORK/BUILD-INFO" <<'PY'
import json, sys
b = json.load(open(sys.argv[1]))
rows = [
    ('Built', b['built_at']),
    ('Project', f"{b['project']} {b['project_version']}, feature commit {b['feature_commit'][:7] or 'unknown'}"),
    ('Original', f"{b['upstream_project']}, {b['upstream_version_name']} ({b['upstream_version']})"),
    ('Source', f"{b['source']} <{b['source_url']}>"),
    ('Content SHA-256', b['content_sha256']),
    ('Tested release', 'yes' if b['tested_release'] else 'NO - not in tested-releases.json; install.sh asks before installing it'),
    ('GNOME Shell', f"built on {b['built_on_gnome_shell'] or 'unknown'}; release supports {' '.join(b['upstream_shell_versions'])}"),
    ('Internals check', b['internals_check']),
]
for label, value in rows:
    print(f'{label + ":":17} {value}')
print('Warnings:' + ('' if b['warnings'] else '         none'))
for w in b['warnings']:
    print(f'  - {w}')
PY

# ---- 5. Put the build in place ---------------------------------------------------

# The new build is assembled completely in .build.new/, next to build/, and
# then swapped in by two directory renames: build/ becomes .build.new/previous/,
# and .build.new/ becomes build/. A run interrupted between the two renames is
# undone by the next run (see the start of this section) or by the trap below.
BUILD_DIR="$ROOT/build"
NEXT_DIR="$ROOT/.build.new"
rm -rf -- "$NEXT_DIR"
mkdir -p "$NEXT_DIR"
mv -- "$WORK/$UUID" "$NEXT_DIR/$UUID"
mv -- "$WORK/BUILD-INFO" "$NEXT_DIR/BUILD-INFO"
mv -- "$WORK/release.zip" "$NEXT_DIR/release.zip"   # Kept for the tests
cp -- "$WORK/report.json" "$NEXT_DIR/report.json"

trap 'rm -rf -- "$WORK"; if [[ ! -d "$BUILD_DIR" && -d "$NEXT_DIR/previous" ]]; then mv -- "$NEXT_DIR/previous" "$BUILD_DIR"; fi' EXIT
if [[ -d "$BUILD_DIR" ]]; then
    mv -- "$BUILD_DIR" "$NEXT_DIR/previous"
    rm -rf -- "$NEXT_DIR/previous/previous"
fi
mv -- "$NEXT_DIR" "$BUILD_DIR"

say
cat "$BUILD_DIR/BUILD-INFO"
say
say "Built in build/$UUID. Install it with ./install.sh"
