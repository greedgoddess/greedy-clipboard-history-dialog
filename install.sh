#!/usr/bin/env bash
set -euo pipefail

UUID="clipboard-history@manouchehr"
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$ROOT/src"
EXT_PARENT="$HOME/.local/share/gnome-shell/extensions"
DEST="$EXT_PARENT/$UUID"
mkdir -p "$EXT_PARENT"
STAGE="$(mktemp -d "$EXT_PARENT/.clipboard-history-stage.XXXXXX")"
BACKUP=""

cleanup() {
  [[ -n "${STAGE:-}" && -d "$STAGE" ]] && rm -rf "$STAGE"
}
trap cleanup EXIT

command -v gnome-extensions >/dev/null || {
  echo "ERROR: gnome-extensions command not found." >&2
  exit 1
}
command -v glib-compile-schemas >/dev/null || {
  echo "ERROR: glib-compile-schemas not found. Install Fedora package: glib2" >&2
  exit 1
}

for file in extension.js metadata.json prefs.js stylesheet.css; do
  [[ -f "$SOURCE/$file" ]] || {
    echo "ERROR: Missing $SOURCE/$file" >&2
    exit 1
  }
done

python3 - "$SOURCE/metadata.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1], encoding="utf-8"))
if m.get("uuid") != "clipboard-history@manouchehr":
    raise SystemExit("ERROR: metadata.json UUID does not match install directory.")
PY

grep -Fq 'boxPointer._userArrowSide = St.Side.LEFT;' "$SOURCE/extension.js" || {
  echo "ERROR: Personal cursor-positioning patch is missing." >&2
  exit 1
}
grep -Fq 'boxPointer._arrowAlignment = 1.0;' "$SOURCE/extension.js" || {
  echo "ERROR: Bottom alignment patch is missing." >&2
  exit 1
}
if grep -q '^THIS_IS_NOT_VALID_JAVASCRIPT;$' "$SOURCE/extension.js"; then
  echo "ERROR: Test syntax-error line found in source." >&2
  exit 1
fi

# Disable the existing instance before replacing its files.
gnome-extensions disable "$UUID" >/dev/null 2>&1 || true

cp -a "$SOURCE/." "$STAGE/"
if [[ -d "$STAGE/schemas" ]]; then
  glib-compile-schemas "$STAGE/schemas"
fi

# Keep a rollback copy of any existing installation.
if [[ -d "$DEST" ]]; then
  BACKUP="$EXT_PARENT/.${UUID}.backup.$(date +%Y%m%d-%H%M%S)"
  mv "$DEST" "$BACKUP"
fi

mv "$STAGE" "$DEST"
STAGE=""

if ! gnome-extensions enable "$UUID"; then
  echo "ERROR: GNOME could not enable the fork; attempting rollback." >&2
  rm -rf "$DEST"
  if [[ -n "$BACKUP" && -d "$BACKUP" ]]; then
    mv "$BACKUP" "$DEST"
    gnome-extensions enable "$UUID" >/dev/null 2>&1 || true
  fi
  exit 1
fi

if ! gnome-extensions info "$UUID" | grep -q 'State: ACTIVE'; then
  echo "ERROR: Extension did not reach ACTIVE state; attempting rollback." >&2
  gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
  rm -rf "$DEST"
  if [[ -n "$BACKUP" && -d "$BACKUP" ]]; then
    mv "$BACKUP" "$DEST"
    gnome-extensions enable "$UUID" >/dev/null 2>&1 || true
  fi
  exit 1
fi

echo
echo "Installed: $UUID"
gnome-extensions info "$UUID" | tail -5
if [[ -n "$BACKUP" ]]; then
  echo
  echo "Previous installation backup retained at:"
  echo "  $BACKUP"
fi
echo
echo "Your existing clipboard history/cache is not deleted."
echo "If the extension does not reflect the new code under Wayland,"
echo "log out of GNOME and log back in."
