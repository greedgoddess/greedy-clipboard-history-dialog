# Private history folder

The original stores the clipboard history unencrypted, as files in
`~/.cache/greedy-clipboard-history-dialog@greedgoddess/`, with default
permissions: other user accounts on the same computer can read them if they
can reach your home folder. On Fedora your home folder is closed to them, but
not every system is set up that way.

With **Private history folder** on (Preferences → Cursor-Follow; **on by
default**), the extension restricts that folder to your user account
(permissions `700`) whenever it starts and when you switch the setting on.
Switching it off gives the folder the usual default (`755`) back. Only the
folder's permissions change: the original's code and files are untouched, and
the history stays unencrypted on disk. `./verify.sh` shows the setting and the
folder's current permissions.

The code is `feature/privateHistory.js`; each section starts with a tag:

```bash
grep -rn "\[private-history:" feature/
```

<a id="private-history-setting"></a>
<a id="private-history-preference"></a>
## `private-history:setting`, `private-history:preference`

Boolean key `private-history` in `feature/settings-keys.xml`, default `true`,
with the **Private history folder** switch in the preferences.

<a id="private-history-apply"></a>
<a id="private-history-entry-point"></a>
## `private-history:apply`, `private-history:entry-point`

`feature/extension.js` creates `PrivateHistory` before the original starts,
so an existing folder is private before the original loads the history from
it, and applies it once more right after, for a folder the original has just
created for the first time. It applies again whenever the setting changes. A
missing folder is left alone, and a failure is logged without affecting the
rest of the extension. Symbolic links are not followed.

<a id="private-history-mode"></a>
## `private-history:mode`

`folderMode()`: `700` (read, write and open for you only) when private, `755`
(the usual default) otherwise. Restricting the folder is enough: files inside
a folder others cannot open are out of their reach, whatever their own
permissions.

## Testing

`tests/js/privateHistory.test.mjs` covers both modes, switching off and on,
and a missing folder. By hand:

```bash
./verify.sh    # "Private history folder: On; folder permissions: drwx------"
```

Switch the setting off in the preferences and run `./verify.sh` again: the
folder shows `drwxr-xr-x`.
