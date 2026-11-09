# Changelog

Versions of this project. The Clipboard History release each build is based
on is listed in the README under "Tested releases".

## 1.4.0 — 2026-11-09

- Gestures, optional and not installed by default
  (`./install.sh --with-gestures`; then Preferences → Keyboard Shortcut and Gestures): a
  three-finger tap on the touchscreen opens the panel at the center of the
  fingers, a three-finger hold on the touchpad opens it at the pointer. Each
  has its own switch, off by default. The tap does nothing while an app on an
  editable blocklist is in focus (drawing and note apps to start with).
- Preferences: **Second shortcut press opens** sits directly under the
  keyboard shortcut, and the gestures join the same group (**Keyboard
  Shortcut and Gestures**, in the shortcut's original place).
- Tests: every tag in the code must have its entry in the docs (checked in
  CI).

## 1.3.2 — 2026-11-09

- Private history folder: switching it off restores the permissions the
  folder had before it was made private, instead of a fixed 755, which could
  be more permissive. With nothing to restore, the folder is left as it is.
- Docs: the appendix about the original states more precisely what it cleans
  up when disabled, and that the history-path point is a local
  data-integrity concern, not a remote attack.

## 1.3.1 — 2026-11-09

- The private history folder is applied before the original loads the
  history, not only after.
- Password managers: handlers on windows that appear while waiting for the
  search window are removed when the wait ends.
- Docs: an appendix of considerations about the original's code,
  documented rather than patched
  ([docs/upstream-considerations.md](docs/upstream-considerations.md)), and
  the project's scope as a companion, not a fork, in CONTRIBUTING.md.

## 1.3.0 — 2026-11-09

- Private history folder (Preferences → Cursor-Follow, on by default): the
  folder that stores the clipboard history is restricted to your user
  account (permissions 700). The original stores the history unencrypted
  with default permissions.
- Clear unpinned entries at login (Preferences → Cursor-Follow, off by
  default): each login starts with only the pinned entries; unlocking the
  screen does not count as a login.
- `verify.sh` shows both new settings.
- `update-test-and-push.sh --push` asks for the result of each manual
  checklist (passed, not checked, failed) and records it with the test; the
  README's tested-releases table shows it. A failure stops the push.
- Docs: screenshots of the panel, its tabs, the hover preview, the
  preferences and 1Password Quick Access, in the README and the docs.

## 1.2.0 — 2026-11-09

Tested on GNOME Shell 51.1 (Fedora 45) with Clipboard History 1.0 (release
3): unit tests, build checks and smoke test, plus the manual checklists for
large spacing, the password manager integration and the hover preview.

- Large spacing, optional and not installed by default
  (`./install.sh --with-large-spacing`; then Preferences → Cursor-Follow):
  a compact panel with one fixed size on every tab, icons instead of names
  in the tab bar, compact entries, emoji lined up from the left, and icon
  buttons instead of the menu entries at the bottom: one per enabled password
  manager, settings, and clear. The buttons trigger the original entries.
  Rounded corners on the panel (15 px) and, with the password manager
  integration, on the search window (18 px, which looks the same), drawn by
  GNOME Shell without changing the password manager (GNOME Shell 51's
  Clutter.ShaderEffect, or Shell.GLSLEffect on older versions). All sizes
  are fixed in largeSpacing.css. (Called touch mode during development; an
  earlier choice carries over.)
- The 1Password integration becomes the password manager integration
  (`./install.sh --with-password-managers`; `--with-1password` still works),
  with 1Password as the only supported password manager for now. Any number
  of password managers can be enabled; a drop-down chooses which one the
  second shortcut press opens, or none. In Large spacing, each enabled
  password manager has a button, greyed out with a red dot while its app is
  not running (still clickable). An earlier 1Password setup carries over.
- Preview on hover (Preferences → Cursor-Follow, off by default): up to 512
  characters of a text entry in an overlay next to the panel, with the
  original layout and with Large spacing.
- `verify.sh` no longer reports a different build when optional features
  are installed, and shows the message line of warnings, not only their
  stack trace.

## 1.1.0 — 2026-11-08

Tested on GNOME Shell 51.1 (Fedora 45) with Clipboard History 1.0 (release
3): unit tests, build checks and smoke test, plus the manual checklists for
pointer placement and for 1Password Quick Access.

- 1Password Quick Access, optional and not installed by default
  (`./install.sh --with-1password`; then Preferences → Cursor-Follow):
  pressing the shortcut again while the panel is open switches to Quick
  Access, placed like the panel: bottom-left corner at the pointer, or to
  the left of it when there is no room on the right. Can only be switched on
  while 1Password is installed and running. Without the flag, none of its
  code is installed. With it, About links to 1Password.
- CI no longer runs the smoke test: it needs a real GNOME session, which a
  container does not have. It runs on a GNOME desktop, where
  `update-test-and-push.sh` requires it.
- CI: actions updated to versions running on Node.js 24; jobs pinned to
  Ubuntu 24.04.
- Docs: signed release tags; HTTPS cloning; what CI verifies and what is
  verified on a GNOME desktop.

## 1.0.2 — 2026-11-08

- Switching update notifications off now stops a check that is already
  running; it can no longer notify afterwards.
- `update-test-and-push.sh` commits locally by default; publishing needs
  `--push`, only from `main`, and only with the full test suite. Test
  records list which tests ran.
- Tests for the update notifier (switching off mid-check, notify once,
  user and developer checks, unexpected answers).
- CI: the smoke-test job checks the GNOME Shell internals. The smoke test
  needs GNOME and may fail on headless systems such as the CI container;
  this is now stated in its output and the documentation.
- Python caches are ignored by Git, so running the tests no longer blocks
  `update-test-and-push.sh`.

## 1.0.1 — 2026-11-08

- Builds are swapped in by directory renames, so a failed or interrupted
  build always leaves the previous one in place.
- Migration copies the history into a temporary folder first, so an
  interrupted migration leaves nothing half-copied.
- The patcher handles schema files with several schemas, comments containing
  `</schema>`, and any attribute order, quoting and spacing.
- Update checks skip, instead of failing, on unexpected answers from GitHub
  or extensions.gnome.org.
- `verify.sh` shows the time of the last update check correctly.
- Tests: build swap, migration and uninstall (the original extension's files,
  history and settings are never touched), more patcher and hook cases.
- Smoke test reports "could not run" separately from extension failures; CI
  fixes (ShellCheck directive, system D-Bus for the container smoke test).

## 1.0.0 — 2026-11-08

- Open at mouse pointer (Preferences → Cursor-Follow).
- Update notifications: user machines watch this repository, developer
  machines watch Clipboard History releases.
- About section in the preferences, with attribution and links.
- Builds from tested Clipboard History releases without editing the original
  code; own UUID, settings and clipboard history.
- Safe unpacking of downloaded releases; provenance recorded in each build.
- Installer: user and developer mode, builds when needed, asks before
  installing an untested build, restores the previous copy if interrupted.
- Tests: patcher and installer unit tests, cursor-follow unit tests, build
  checks, headless GNOME Shell smoke test, continuous integration.
