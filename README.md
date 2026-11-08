# greedy-clipboard-history-dialog

![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)
![Status: personal build](https://img.shields.io/badge/status-personal%20build-orange)

**Clipboard History for GNOME Shell, with an option to open the panel at the mouse pointer.**

This project adds a **Cursor-Follow** section to the preferences of
[Clipboard History](https://extensions.gnome.org/extension/10613/clipboard-history/)
by Manouchehr Ghalevand:

- **Open at mouse pointer:** the panel opens to the right of the pointer
  with its bottom edge level with it, or to the left when there is no room
  on the right.
- **Update notifications:** a notification when there is an update to
  install; see [update notifications](docs/update-notifications.md).

The repository holds only the addition. `./build.sh` downloads a tested
release of Clipboard History and adds the setting without editing the
original code; see [how it works](docs/cursor-follow.md).

- **Installed separately**, with its own ID
  (`greedy-clipboard-history-dialog@greedgoddess`), settings and clipboard
  history. Updates of the original never overwrite it.
- **Can break** when GNOME Shell or the original changes. Builds check for
  this, and at worst the panel opens below its icon. See
  [what can break](docs/cursor-follow.md#what-can-break-and-what-happens-then).
- **Personal use**, on Fedora 45 with GNOME Shell 51. Not for
  extensions.gnome.org.

The addition was written largely by an AI assistant (Claude, by Anthropic),
directed and tested by the author. It has had no independent review.

## Install

```bash
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
cd greedy-clipboard-history-dialog
./install.sh
```

`install.sh` builds first if needed. Log out and back in, then check with
`./verify.sh`. The first install switches both Cursor-Follow settings on.

**Developer machine:** `./install.sh --dev` installs the same build, lets
[`./update-test-and-push.sh`](#development) run, and makes the update
notifications watch Clipboard History releases instead of this repository.
`./install.sh --user` switches back; without either flag, a machine keeps
its mode.

**From Clipboard History or an earlier version of this project:** run
`./uninstall-previous-version.sh` before `./install.sh`. It copies your
history and settings over, then removes the old extension.

**Update:** `./update.sh` (pulls this repository, builds the newest tested
release, installs), then log out and back in.

**Uninstall:** `./uninstall.sh` keeps history and settings; add `--purge`
to delete them too.

## Tested releases

`./build.sh` builds the newest of these that supports the running GNOME
Shell, and refuses a download that differs from what was tested.

<!-- tested-releases:start -->
| Release | GNOME Shell (release) | Tested on | Date |
| --- | --- | --- | --- |
| 1.0 (3) | 46, 47, 48, 49, 50, 51 | GNOME Shell 51.1 | 2026-11-08 |
<!-- tested-releases:end -->

Other sources: `--latest` (newest release, untested), `--version N`,
`--zip FILE`, `--from-git [REF]`. Each build is described in
`build/BUILD-INFO`; the previous one is kept in `build/previous/`.

## Development

Needs a developer machine (`./install.sh --dev`).

**New release of Clipboard History:** `./update-test-and-push.sh` builds the
newest release, runs the tests, and if they pass, adds it to the table above
and pushes over SSH. Nothing is committed if anything fails.

**Tests:** `tests/run-tests.sh` checks the build against its release
(original code unchanged, identity, settings schema, build warnings), then
loads it in a headless GNOME Shell and checks that it becomes active
without errors and that Open at mouse pointer hooks in.

**Release notifications:** on a developer machine, the extension's update
notifications report each new Clipboard History release that is not tested
yet.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No change after installing or updating | Log out and back in |
| `update-test-and-push.sh`: machine set up for users | `./install.sh --dev` |
| No update notifications | Check Preferences → Cursor-Follow, and the last check in `./verify.sh` |
| Build: no tested release for this GNOME Shell | Run `./update-test-and-push.sh`, or build untested with `./build.sh --latest` |
| Build: release differs from the tested one | The download changed; run `./update-test-and-push.sh --force` to test it again |
| Build warns, or the panel opens below its icon | See [what can break](docs/cursor-follow.md#what-can-break-and-what-happens-then) |
| Smoke test cannot start GNOME Shell | `tests/smoke-test.sh` shows the log; `--no-smoke-test` runs the static checks only, without pushing |
| Two clipboard icons in the panel | The old extension is enabled again; run `./uninstall-previous-version.sh` |
| Anything else | `journalctl -f -o cat /usr/bin/gnome-shell` |

## License

GPL-2.0-or-later, like Clipboard History, © 2025 Manouchehr Ghalevand. Each
build includes the original's `LICENSE`.
