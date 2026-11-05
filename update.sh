#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v git >/dev/null || { echo "Install git first: sudo dnf install git"; exit 1; }
git -C "$ROOT" pull --ff-only
"$ROOT/install.sh"
