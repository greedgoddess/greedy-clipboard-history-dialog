# Clear unpinned entries at login

The original keeps the clipboard history across logouts and reboots. With
**Clear unpinned entries at login** on (Preferences → Cursor-Follow; off by
default), each login starts with only your pinned entries: everything else,
including the image files of removed entries, is deleted before the history
is loaded. Unlocking the screen does not count as a login.

The code is `feature/clearAtLogin.js`; each section starts with a tag:

```bash
grep -rn "\[clear-at-login:" feature/
```

<a id="clear-at-login-setting"></a>
<a id="clear-at-login-preference"></a>
## `clear-at-login:setting`, `clear-at-login:preference`

Boolean key `clear-at-login` in `feature/settings-keys.xml`, default `false`,
with the **Clear unpinned entries at login** switch in the preferences.

<a id="clear-at-login-session"></a>
## `clear-at-login:session`

GNOME stops and starts extensions not only at login but also when the screen
locks and unlocks, so "the extension starts" is not the same as "a login".
`isFirstStartOfSession()` tells them apart with a marker file in the user's
runtime folder (`/run/user/<uid>/greedy-clipboard-history-dialog@greedgoddess/`),
which exists while you are logged in and is removed at logout and reboot. The
marker is written at the first start of every session, whether the setting
is on or not, so switching the setting on never clears the history in the
middle of a session; it takes effect at the next login.

If you keep a session open elsewhere (another login of the same account), the
runtime folder stays, and the next login does not count as a new one.

<a id="clear-at-login-clear"></a>
<a id="clear-at-login-entry-point"></a>
## `clear-at-login:clear`, `clear-at-login:entry-point`

`feature/extension.js` calls `clearAtLogin()` at the very start of `enable()`,
before the original starts and loads the history. It reads the original's
history file, keeps the pinned entries, writes the file back, and deletes the
image files of the removed entries. The original's code is not changed. A
history file that is missing or not in the expected form is left untouched,
and any failure is logged without stopping the extension.

<a id="clear-at-login-keep-pinned"></a>
## `clear-at-login:keep-pinned`

`keepPinned()`: entries whose `pinned` is `true` stay. Image files are
deleted only for removed entries, and only inside the history's own `images`
folder, so a malformed history file cannot make it delete anything else.

## Testing

`tests/js/clearAtLogin.test.mjs`, on an in-memory file system: pinned entries
and their images stay, the rest goes; nothing is cleared again at screen
unlock; nothing is cleared with the setting off; missing or unexpected files
are left alone; images outside the history folder are never deleted.

By hand: switch it on, copy a few things, pin one, log out and back in. Only
the pinned entry is left. Lock and unlock the screen: nothing changes.
