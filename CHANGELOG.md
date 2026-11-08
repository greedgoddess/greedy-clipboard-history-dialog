# Changelog

Versions of this project. The Clipboard History release each build is based
on is listed in the README under "Tested releases".

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
