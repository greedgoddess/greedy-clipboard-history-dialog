# Contributing

This project is maintained for the author's own use. Issues and pull requests
are welcome; responses are best effort.

## Developer machine

```bash
./install.sh --dev
```

Same build as a user machine, plus: `./update-test-and-push.sh` may run, and
the update notifications watch Clipboard History releases. GitHub is
accessed over SSH.

## Building and testing

```bash
./build.sh                 # newest tested release; see ./build.sh --help
tests/run-tests.sh         # unit tests, build checks, headless smoke test
```

`tests/run-tests.sh --unit-only` needs no build; `--no-smoke-test` skips the
headless GNOME Shell. The smoke test needs GNOME Shell and may fail on
headless systems, where GNOME Shell may not start; run it on a GNOME
desktop. CI does not run the smoke test: it needs a real GNOME session, so it runs
on a GNOME desktop only. CI runs everything else. The cursor-follow unit tests need Node.js
(`sudo dnf install nodejs`).

Automated tests cannot see where the panel opens. Before recording a new
GNOME Shell version as verified in the README, go through the
[testing checklist](docs/cursor-follow.md#testing) by hand.

## Adding a tested release

```bash
./update-test-and-push.sh          # build, test, record and commit locally
./update-test-and-push.sh --push   # the same, then publish it
```

Builds the newest Clipboard History release, runs all tests, and only if
they pass, records the release in `tested-releases.json` (with the evidence:
which tests ran) and the README, and commits. Publishing needs `--push`,
works only from `main`, and never without the smoke test.

<a id="manual-checks"></a>
### Manual checks

Some things only a person at a GNOME desktop can check: whether the panel
opens at the pointer, whether 1Password Quick Access lines up, whether the
hover preview looks right. So `--push` asks, after the automated tests have
passed, for the result of each manual checklist:

| Checklist | Where |
| --- | --- |
| Open at mouse pointer | [docs/cursor-follow.md](docs/cursor-follow.md#testing) |
| Private history folder | [docs/private-history.md](docs/private-history.md#testing) |
| Clear unpinned entries at login | [docs/clear-at-login.md](docs/clear-at-login.md#testing) |
| Hover preview | [docs/hover-preview.md](docs/hover-preview.md#testing) |
| Large spacing | [docs/large-spacing.md](docs/large-spacing.md#testing) |
| Password managers (1Password) | [docs/password-managers.md](docs/password-managers.md#testing) |

Answer `y` if you went through it and it passed, `n` if you did not check it
this time, or `f` if it failed. A failure stops the push with nothing
recorded. The answers are stored with the test record in
`tested-releases.json` (`manual_checks`, and a line in `evidence`), and the
README's tested-releases table shows them, for example "6 of 6 passed" or
"4 of 6 passed (not checked: …)". `--push` needs a terminal for this; records
from before this existed show "not recorded".

Do the checklists on the build being recorded: install it first
(`./build.sh && ./install.sh`, then log out and back in).

## Scope: companion, not fork

This project fixes its own code: its features, installer, build and patch
scripts, and tests. It does not change the original's clipboard capture,
history storage or pasting; considerations about those are documented in
[docs/upstream-considerations.md](docs/upstream-considerations.md) and
reviewed whenever a new release of the original is tested.

## Releasing

Release tags are signed (SSH signing; the key must be added on GitHub as a
signing key).

1. Update `VERSION` and `CHANGELOG.md`, commit, and record the test with
   `./update-test-and-push.sh --push`, answering the
   [manual checks](#manual-checks); wait for CI.
2. Create a signed tag, check its signature, and push it:

   ```bash
   git tag -s vX.Y.Z -m "Greedy Clipboard History Dialog X.Y.Z"
   git tag -v vX.Y.Z
   git push origin vX.Y.Z
   ```

   `git tag -v` needs `gpg.ssh.allowedSignersFile` set; GitHub shows the
   tag as **Verified** once it is pushed.
3. Create the GitHub release from that tag, with the changelog section as
   notes.

## Screenshots

`docs/images/` holds the screenshots used in the README and the docs, taken
on GNOME Shell 51. Replace them when a change alters what they show, and keep
them free of personal data (use example clipboard entries). They are shown centred, small, and
in rows of a common size: panels 150 px wide, the panel with a hover preview
460 px wide, other screenshots side by side at 230 px high. Store them at
about twice that size (sharp on high-resolution screens): PNG for plain panels, JPEG (quality 90)
for screenshots with a wallpaper gradient, which PNG compresses poorly.

## Pull requests

- Keep the original code unchanged: changes belong in `feature/`, the
  patcher or the scripts.
- Tag new code sections and document them in `docs/`, like the existing
  `[cursor-follow:…]` sections.
- Include the output of `tests/run-tests.sh`, the GNOME Shell version, and,
  for changes to placement, the result of the testing checklist.
- Add a line to `CHANGELOG.md`.
