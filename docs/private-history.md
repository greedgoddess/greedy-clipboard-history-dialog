# Private history folder

The original stores the clipboard history unencrypted, as files in
`~/.cache/greedy-clipboard-history-dialog@greedgoddess/`, with default
permissions: other user accounts on the same computer can read them if they
can reach your home folder. On Fedora your home folder is closed to them, but
not every system is set up that way.

With **Private history folder** on (Preferences → Cursor-Follow; **on by
default**), the extension restricts that folder to your user account
(permissions `700`) whenever it starts and when you switch the setting on.
The permissions the folder had before are remembered, and switching the
setting off restores exactly those, never a fixed default, so it never gives
anyone more access than the folder had before. Only the
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

`nextMode()` decides, from the setting, the folder's current permissions, and
the permissions remembered in `private-history-previous-mode` (`-1`: none):

- **On:** the folder gets `700` (read, write and open for you only). The
  first time this changes the folder, its permissions until then are
  remembered.
- **Off:** the remembered permissions are restored and forgotten. With
  nothing remembered (the folder was already `700`, for example under a
  restrictive umask), the folder is left as it is.

A fixed default such as `755` is never assumed: it could be more permissive
than the folder ever was. Restricting the folder is enough to protect what is
in it: files inside a folder others cannot open are out of their reach,
whatever their own permissions.

## Testing

`tests/js/privateHistory.test.mjs` covers the decision, remembering and
restoring the previous permissions, a folder that was already private, a
restrictive previous mode that must not widen, and a missing folder. By hand:

```bash
./verify.sh    # "Private history folder: On; folder permissions: drwx------"
```

Switch the setting off in the preferences and run `./verify.sh` again: the
folder shows the permissions it had before, typically `drwxr-xr-x`.
