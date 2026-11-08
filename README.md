# greedy-clipboard-history-dialog

![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)
![Status: personal build](https://img.shields.io/badge/status-personal%20build-orange)

**Clipboard History for GNOME Shell, built from the latest release with an option to open the panel at the mouse pointer.**

This project adds one setting to
[Clipboard History](https://extensions.gnome.org/extension/10613/clipboard-history/)
by Manouchehr Ghalevand: **Open at mouse pointer**, under **Placement** in
the extension preferences. With it on, the panel opens to the right of the
pointer with its bottom edge level with it, or to the left when there is no
room on the right. With it off, the panel opens below its icon.

The repository holds only the addition. `./build.sh` downloads the latest
release of Clipboard History from extensions.gnome.org and adds the setting
to it, without editing the original code; see
[how the build works](docs/cursor-follow.md#how-the-build-works).

- **Follows the original.** Each build uses the newest release, including
  its fixes and newly supported GNOME Shell versions.
- **Installed separately.** The build has its own ID
  (`greedy-clipboard-history-dialog@greedgoddess`), settings and clipboard
  history, so the original's updates never overwrite it.
- **Can break.** It relies on GNOME Shell internals and on how the original
  builds its panel button. The build checks for both and refuses or warns;
  at worst the panel opens below its icon. See
  [what can break](docs/cursor-follow.md#what-can-break-and-what-happens-then).
- **Personal use.** Used on Fedora 45 with GNOME Shell 51. Not for
  extensions.gnome.org.

The addition was written largely by an AI assistant (Claude, by Anthropic),
directed and tested by the author. It has had no independent review.

## Install

```bash
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
cd greedy-clipboard-history-dialog
./build.sh
./install.sh
```

Log out and back in, then check with `./verify.sh`. The first install
switches **Open at mouse pointer** on.

**Coming from Clipboard History or an earlier version of this project:** run
`./uninstall-previous-version.sh` before `./install.sh`. It copies your
clipboard history and settings, including the keyboard shortcut, then
removes the old extension.

**Update** (this project and the original): `./update.sh`, then log out and
back in. If the new build fails, the installed copy is left alone.

**Uninstall:** `./uninstall.sh`. Clipboard history and settings are kept;
`./uninstall.sh --purge` deletes them too.

## Build options

| Command | Builds from |
| --- | --- |
| `./build.sh` | Latest release for the running GNOME Shell, from extensions.gnome.org |
| `./build.sh --version 3` | Release 3 from extensions.gnome.org |
| `./build.sh --zip FILE` | A release zip already downloaded |
| `./build.sh --from-git [REF]` | The author's GitHub repository |

Each build writes `build/BUILD-INFO`: source, version, checksum, checks and
warnings. The previous build is kept in `build/previous/`.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No change after installing or updating | Log out and back in; GNOME Shell only loads extension code at login |
| Build stops: release does not support this GNOME Shell | Wait for a release that does, or `./build.sh --force` and test |
| Build stops for another reason | Keep the installed copy, or build an older release: `./build.sh --version N` |
| Build warns, or the panel opens below its icon | See [what can break](docs/cursor-follow.md#what-can-break-and-what-happens-then) |
| `install.sh` reports the old extension | Run `./uninstall-previous-version.sh` first |
| Two clipboard icons in the panel | The old extension is enabled again; run `./uninstall-previous-version.sh` |
| Anything else | `journalctl -f -o cat /usr/bin/gnome-shell` |

## License

GPL-2.0-or-later, like Clipboard History, © 2025 Manouchehr Ghalevand. Each
build includes the original's `LICENSE`.
