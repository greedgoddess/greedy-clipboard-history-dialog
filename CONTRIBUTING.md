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
desktop. In CI, the smoke-test job may fail for that reason without failing
the whole run. The cursor-follow unit tests need Node.js
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

1. Update `VERSION` and `CHANGELOG.md`, commit, push, and wait for CI.
2. Tag and push the tag: `git tag -a vX.Y.Z -m "…" && git push origin vX.Y.Z`.
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
