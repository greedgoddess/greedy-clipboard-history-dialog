# greedy-clipboard-history-dialog

![License: GPL-2.0-or-later](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)
![Maintained for personal use](https://img.shields.io/badge/maintained-for%20personal%20use-orange)

**Clipboard History for GNOME Shell, with an option to open the panel at the mouse pointer.**

An independently maintained GNOME Shell extension based on
[Clipboard History](https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history)
by Manouchehr Ghalevand. It adds a **Cursor-Follow** section to the
preferences:

- **Open at mouse pointer:** the panel opens to the right of the pointer
  with its bottom edge level with it, or to the left when there is no room
  on the right.
- **Update notifications:** a notification when there is an update to
  install; see [update notifications](docs/update-notifications.md).

This repository contains the additions and the tooling to build and maintain
them against tested releases of Clipboard History; it does not keep a
modified copy of the original source. `./install.sh` downloads a tested
release and adds them without editing the original code; see
[how it works](docs/cursor-follow.md).

## Relationship with Clipboard History

- Built from releases of Clipboard History; all of its functionality is kept
  as released.
- The additions are maintained here, independently.
- Installed under its own ID (`greedy-clipboard-history-dialog@greedgoddess`),
  with its own settings and clipboard history; the two never share data.
- **Not affiliated with or endorsed by the original author.** Attribution and
  licensing: [NOTICE](NOTICE).

**Where to report problems:**

| Problem | Where |
| --- | --- |
| Open at mouse pointer, update notifications, building, installing, GNOME Shell compatibility | [This repository](https://github.com/greedgoddess/greedy-clipboard-history-dialog/issues) |
| History, search, pinning, emoji, pasting: anything that also happens with the original | [Clipboard History](https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history/issues) |
| Not sure | Here first; check whether the original shows the same problem |

Maintained for the author's own use and shared as is: issues are welcome,
fixes are best effort.

## Install

```bash
git clone git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
cd greedy-clipboard-history-dialog
./install.sh
```

`install.sh` builds first if needed. Log out and back in, then check with
`./verify.sh`. The first install switches both Cursor-Follow settings on;
the preferences can switch them off.

**From Clipboard History or an earlier version of this project:** run
`./uninstall-previous-version.sh` before `./install.sh`. It copies your
history and settings over, then removes the old extension.

**Update:** `./update.sh` (pulls this repository, builds the newest tested
release, installs), then log out and back in.

**Uninstall:** `./uninstall.sh` keeps history and settings; add `--purge`
to delete them too.

## Compatibility

### Tested releases

`./build.sh` builds the newest of these that supports the running GNOME
Shell, and refuses a download that differs from what was tested. A build of
any other release is marked untested, and `install.sh` asks before
installing it.

<!-- tested-releases:start -->
| Release | GNOME Shell (release) | Tested on | Date |
| --- | --- | --- | --- |
| 1.0 (3) | 46, 47, 48, 49, 50, 51 | GNOME Shell 51.1 | 2026-11-08 |
<!-- tested-releases:end -->

### Verified GNOME Shell versions

A release lists the GNOME Shell versions the *original* supports. This
project is verified only where marked here:

| GNOME Shell | Builds | Activates (smoke test) | Opens at pointer | Flips at screen edge |
| --- | --- | --- | --- | --- |
| 51 | yes | yes | yes, by hand | yes, by hand |
| 46–50 | not tested | not tested | not tested | not tested |

The smoke test needs GNOME and may fail on headless systems, such as the CI
container; "Activates" is checked on a GNOME desktop. The manual checks are
in [the testing checklist](docs/cursor-follow.md#testing).

## Versions

This project's version is in [`VERSION`](VERSION) and the
[changelog](CHANGELOG.md); releases are tagged `vX.Y.Z` on GitHub. The
installed extension shows both versions, for example
`1.0.2 (Clipboard History 1.0, release 3)`; `build/BUILD-INFO` and the
`build-info.json` inside each build record the full provenance.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md): developer machines
(`./install.sh --dev`), testing, and adding a tested release with
`./update-test-and-push.sh --push`. Security issues: [SECURITY.md](SECURITY.md).

The additions were written largely by an AI assistant (Claude, by
Anthropic), directed and tested by the author.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No change after installing or updating | Log out and back in |
| Build: no tested release for this GNOME Shell | Wait for one, or `./build.sh --latest` and test it |
| Build: release differs from the tested one | The download changed; a developer machine re-tests it with `./update-test-and-push.sh --force --push` |
| Build warns, or the panel opens below its icon | See [what can break](docs/cursor-follow.md#what-can-break-and-what-happens-then) |
| Two clipboard icons in the panel | The old extension is enabled again; run `./uninstall-previous-version.sh` |
| No update notifications | Check Preferences → Cursor-Follow, and the last check in `./verify.sh` |
| Anything else | `journalctl -f -o cat /usr/bin/gnome-shell` |

## License

GPL-2.0-or-later, like Clipboard History; see [NOTICE](NOTICE). Each build
includes the original's `LICENSE` and copyright notices unchanged.
