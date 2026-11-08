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

## Releasing

Release tags are signed (SSH signing; the key must be added on GitHub as a
signing key).

1. Update `VERSION` and `CHANGELOG.md`, commit, push, and wait for CI.
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

## Pull requests

- Keep the original code unchanged: changes belong in `feature/`, the
  patcher or the scripts.
- Tag new code sections and document them in `docs/`, like the existing
  `[cursor-follow:…]` sections.
- Include the output of `tests/run-tests.sh`, the GNOME Shell version, and,
  for changes to placement, the result of the testing checklist.
- Add a line to `CHANGELOG.md`.
