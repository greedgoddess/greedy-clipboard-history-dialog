# Update notifications

When **Update notifications** is on (Preferences → Cursor-Follow), the
extension checks once a day for an update and shows a GNOME notification,
once per update. What it watches depends on the machine's mode, set by
`./install.sh` (`--dev` or `--user`):

| Mode | Watches | Notifies when | Then run |
| --- | --- | --- | --- |
| user | this project's repository on GitHub | it has a newer tested release, or newer `feature/` code, than the installed build | `./update.sh` |
| dev | Clipboard History on extensions.gnome.org | it has a release for this GNOME Shell that is not in `tested-releases.json` | `./update-test-and-push.sh --push` |

When the setting is off, no request is made at all, and switching it off
stops a check that is already running. When it is on, a check
runs at most once a day and makes these requests:

| Mode | Requests (HTTPS GET) |
| --- | --- |
| user | `raw.githubusercontent.com/greedgoddess/greedy-clipboard-history-dialog/main/tested-releases.json`, and `api.github.com/repos/greedgoddess/greedy-clipboard-history-dialog/commits?path=feature&per_page=1` |
| dev | the same `tested-releases.json`, and `extensions.gnome.org/extension-info/?uuid=clipboard-history@manouchehr&shell_version=N` |

The requests contain no identifier of the installation or the user, and no
clipboard content. Like any web request, they reveal the usual connection
details to those servers: your IP address, the time, and request headers,
with the user agent `greedy-clipboard-history-dialog` and, for
extensions.gnome.org, your GNOME Shell major version `N`. When a site is
unreachable, or answers with something unexpected, the check is skipped
until the next day. To stop all requests,
switch off **Update notifications** in Preferences → Cursor-Follow.

The code is `feature/updateNotifier.js`; each section starts with a tag:

```bash
grep -rn "\[update-notify:" feature/
```

<a id="update-notify-settings"></a>
## `update-notify:settings`

Keys in `feature/settings-keys.xml`: `update-notifications` (on/off, default
off; `install.sh` switches it on at the first install), `developer-mode` and
`checkout-path` (written by `install.sh` on every install; the path is shown
in the notification), and `update-last-check` and `update-notified`
(bookkeeping, see below).

<a id="update-notify-schedule"></a>
## `update-notify:schedule`

The next check is due a day after `update-last-check`, but never sooner than
two minutes after the extension starts. Keeping the time in the settings
matters because GNOME disables and re-enables extensions on every screen
lock. Switching the setting off stops the timer; switching it on plans the
next check.

<a id="update-notify-toggle"></a>
## `update-notify:toggle`

Each check uses its own cancellable. Switching the setting off cancels it, so
any request still running is abandoned and the check ends without
notifying; switching it on again plans a new check with a fresh one.

<a id="update-notify-developer-check"></a>
## `update-notify:developer-check`

Asks extensions.gnome.org for the newest Clipboard History release for the
running GNOME Shell version, and compares it with the newest release in the
repository's `tested-releases.json` on GitHub.

<a id="update-notify-user-check"></a>
## `update-notify:user-check`

Reads `tested-releases.json` and the newest commit that changed `feature/`
from GitHub, and compares them with the installed
[build information](#update-notify-build-info). Commits that change only
documentation or scripts do not cause a notification.

<a id="update-notify-build-info"></a>
## `update-notify:build-info`

`build.sh` writes `build-info.json` into each build: the original's release
number, the release's content hash, and the newest commit that changed
`feature/` in the checkout it was built from.

<a id="update-notify-notify-once"></a>
## `update-notify:notify-once`

Each update has a key (for example `release:4`). The notification is shown
only if the key differs from `update-notified`, which then stores it, and
only if the check was not cancelled and the setting is still on at that
moment.

<a id="update-notify-preference"></a>
## `update-notify:preference`

The **Update notifications** switch in the Cursor-Follow group of the
preferences, bound to `update-notifications`. Its subtitle says what the
machine watches.

<a id="update-notify-cleanup"></a>
## `update-notify:cleanup`

On `disable()`: cancels the running check, removes the timer and
disconnects from the settings; a check that was running ends silently.

The behaviour above is covered by `tests/js/updateNotifier.test.mjs`.
