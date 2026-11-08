#!/usr/bin/env bash
# build.sh — downloads the latest release of the original Clipboard History
# extension and turns it into Greedy Clipboard History Dialog, in build/.
#
# The original code is not edited: this project's files extend it (see
# scripts/patch_release.py and docs/cursor-follow.md#how-the-build-works).
# A new build replaces build/ only when every step succeeded; the previous
# build is kept in build/previous/.
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/common.sh
source "$ROOT/scripts/common.sh"

UPSTREAM_GIT_URL="https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history.git"
EGO="https://extensions.gnome.org"

usage() {
    cat <<USAGE
Usage: ./build.sh [options]
Builds the extension in build/ from a release of Clipboard History.

Where the release comes from (default: the latest release on
extensions.gnome.org for the running GNOME Shell version):
  --version N        release N from extensions.gnome.org (e.g. 3)
  --zip FILE         a release zip already downloaded
  --from-git [REF]   the author's GitHub repository, default branch or REF

  --force            build even if the release does not list the running
                     GNOME Shell version
  -h, --help         show this help
USAGE
}

SOURCE=ego
PIN_VERSION=""
ZIP_FILE=""
GIT_REF=""
FORCE=0
while (( $# > 0 )); do
    case "$1" in
        --version) PIN_VERSION="${2:?--version needs a number}"; shift 2 ;;
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
require_command unzip "Install it with: sudo dnf install unzip"
require_command glib-compile-schemas "Install it with: sudo dnf install glib2"

SHELL_MAJOR="$(gnome-shell --version 2>/dev/null | grep -oE '[0-9]+' | head -n1 || true)"

WORK="$(mktemp -d)"
trap 'rm -rf -- "$WORK"' EXIT
mkdir -p "$WORK/release"

# ---- 1. Get the release -----------------------------------------------------

case "$SOURCE" in
    zip)
        [[ -f "$ZIP_FILE" ]] || fail "No such file: $ZIP_FILE"
        cp -- "$ZIP_FILE" "$WORK/release.zip"
        SOURCE_DESC="zip file $(basename -- "$ZIP_FILE")" ;;
    ego)
        require_command curl "Install it with: sudo dnf install curl"
        version="$PIN_VERSION"
        if [[ -z "$version" ]]; then
            say "Looking up the latest release on extensions.gnome.org…"
            info="$(curl -fsSL "$EGO/extension-info/?uuid=$LEGACY_UUID&shell_version=${SHELL_MAJOR:-0}")" \
                || fail "Could not reach extensions.gnome.org. Try again later, or use --zip or --from-git."
            # The newest release that lists the running GNOME Shell version,
            # or the newest release overall.
            version="$(python3 -c '
import json, sys
info = json.loads(sys.argv[1]); major = sys.argv[2]
versions = info.get("shell_version_map", {})
if major in versions:
    print(versions[major]["version"])
elif versions:
    print(max(v["version"] for v in versions.values()))
else:
    print(info.get("version", ""))
' "$info" "${SHELL_MAJOR:-0}")"
            [[ -n "$version" ]] || fail "extensions.gnome.org did not report a release."
        fi
        say "Downloading release $version…"
        curl -fsSL -o "$WORK/release.zip" \
            "$EGO/extension-data/${LEGACY_UUID//@/}.v$version.shell-extension.zip" \
            || fail "Could not download release $version."
        SOURCE_DESC="extensions.gnome.org, release $version" ;;
    git)
        require_command git "Install it with: sudo dnf install git"
        say "Cloning $UPSTREAM_GIT_URL${GIT_REF:+ at $GIT_REF}…"
        git clone -q --depth 1 ${GIT_REF:+--branch "$GIT_REF"} "$UPSTREAM_GIT_URL" "$WORK/clone" \
            || fail "Could not clone the author's repository."
        SOURCE_DESC="GitHub, $(git -C "$WORK/clone" rev-parse --abbrev-ref HEAD) at $(git -C "$WORK/clone" rev-parse --short HEAD)" ;;
esac

if [[ -f "$WORK/release.zip" ]]; then
    unzip -q "$WORK/release.zip" -d "$WORK/release"
    RELEASE_SHA256="$(sha256sum "$WORK/release.zip" | cut -d' ' -f1)"
else
    # The extension's folder is the one whose metadata.json has the UUID.
    meta="$(grep -rl --include=metadata.json "\"$LEGACY_UUID\"" "$WORK/clone" | head -n1 || true)"
    [[ -n "$meta" ]] || fail "No metadata.json for $LEGACY_UUID in the repository."
    cp -a -- "$(dirname -- "$meta")/." "$WORK/release/"
    RELEASE_SHA256="(git checkout)"
fi

# ---- 2. Patch it ---------------------------------------------------------------

say "Adding Open at mouse pointer…"
python3 "$ROOT/scripts/patch_release.py" "$WORK/release" "$WORK/$UUID" \
    "$ROOT/feature" "$WORK/report.json"
glib-compile-schemas --strict "$WORK/$UUID/schemas" \
    || fail "The settings schema does not compile."

# ---- 3. Checks --------------------------------------------------------------------

mapfile -t WARNINGS < <(python3 -c 'import json,sys; print("\n".join(json.load(open(sys.argv[1]))["warnings"]))' "$WORK/report.json" | sed '/^$/d')
SHELL_VERSIONS="$(python3 -c 'import json,sys; print(" ".join(json.load(open(sys.argv[1]))["shell_versions"]))' "$WORK/report.json")"
UPSTREAM_VERSION="$(python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); print(str(r["upstream_version_name"]) + " (" + str(r["upstream_version"]) + ")")' "$WORK/report.json")"

if [[ -n "$SHELL_MAJOR" ]] && ! grep -qw -- "$SHELL_MAJOR" <<<"$SHELL_VERSIONS"; then
    message="The release supports GNOME Shell $SHELL_VERSIONS, not $SHELL_MAJOR; GNOME would not enable it."
    (( FORCE == 1 )) || fail "$message Use --force to build anyway (and add $SHELL_MAJOR to metadata.json yourself)."
    WARNINGS+=("$message")
fi

# The GNOME Shell internals Open at mouse pointer relies on, checked in the
# running GNOME Shell's own code where it can be found.
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

# ---- 4. Put the build in place ---------------------------------------------------

{
    echo "Built:            $(date -Iseconds)"
    echo "Source:           $SOURCE_DESC"
    echo "Original version: $UPSTREAM_VERSION"
    echo "Release SHA-256:  $RELEASE_SHA256"
    echo "GNOME Shell:      running ${SHELL_MAJOR:-unknown}; release supports $SHELL_VERSIONS"
    echo "Internals check:  $INTERNALS_CHECK"
    echo "Feature commit:   $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    if (( ${#WARNINGS[@]} > 0 )); then
        echo "Warnings:"
        printf '  - %s\n' "${WARNINGS[@]}"
    else
        echo "Warnings:         none"
    fi
} > "$WORK/BUILD-INFO"

BUILD_DIR="$ROOT/build"
mkdir -p "$BUILD_DIR"
rm -rf -- "$BUILD_DIR/previous"
if [[ -d "$BUILD_DIR/$UUID" ]]; then
    mkdir -p "$BUILD_DIR/previous"
    mv -- "$BUILD_DIR/$UUID" "$BUILD_DIR/BUILD-INFO" "$BUILD_DIR/previous/" 2>/dev/null || true
fi
mv -- "$WORK/$UUID" "$BUILD_DIR/$UUID"
mv -- "$WORK/BUILD-INFO" "$BUILD_DIR/BUILD-INFO"

say
cat "$BUILD_DIR/BUILD-INFO"
say
say "Built in build/$UUID. Install it with ./install.sh"
