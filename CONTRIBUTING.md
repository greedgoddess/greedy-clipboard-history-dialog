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
headless GNOME Shell. The cursor-follow unit tests need Node.js
(`sudo dnf install nodejs`).

Automated tests cannot see where the panel opens. Before recording a new
GNOME Shell version as verified in the README, go through the
[testing checklist](docs/cursor-follow.md#testing) by hand.

## Adding a tested release

```bash
./update-test-and-push.sh
```

Builds the newest Clipboard History release, runs all tests, and only if
they pass, records the release in `tested-releases.json` and the README,
then commits and pushes.

## Pull requests

- Keep the original code unchanged: changes belong in `feature/`, the
  patcher or the scripts.
- Tag new code sections and document them in `docs/`, like the existing
  `[cursor-follow:…]` sections.
- Include the output of `tests/run-tests.sh`, the GNOME Shell version, and,
  for changes to placement, the result of the testing checklist.
- Add a line to `CHANGELOG.md`.
