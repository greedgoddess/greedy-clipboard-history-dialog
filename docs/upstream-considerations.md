# Appendix: inherited considerations from Clipboard History

This project is a companion to
[Clipboard History](https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history)
by Manouchehr Ghalevand, not a fork: it builds from the original's releases
without changing their code. The original's clipboard capture, history
storage and pasting are used as they are.

A review of the original, release **1.0 (3)** from extensions.gnome.org
(content SHA-256 `6e182e0dcfe7dcd15489e7760ed98ccda627ccf55c5b02f1fa933f1efb06a466`,
as recorded in `tested-releases.json`), found the points below. They are
design and reliability considerations of the original, documented here for
transparency; they are not defects of this project, and this project does not
patch them. Addressing them would mean maintaining a divergent copy of the
original's core. Where they matter, they belong with the original's author.

The review also found what is reassuring: the original makes no network
requests, starts no programs, runs no dynamically loaded code, does not log
clipboard contents, and is not active on the lock screen. When disabled, it
cancels its tracked asynchronous storage operations and pending paste timers
and disconnects its primary signal handlers; not every asynchronous clipboard
callback is tracked explicitly.

| # | Area | Consideration | Effect |
| --- | --- | --- | --- |
| 1 | Loading the history | The history file's records are not checked individually; image paths and IDs from the file are used as they are. | A damaged or deliberately edited history file could make it read or delete files outside its folder. This is a local data-integrity and file-boundary concern, not a remote attack: the file is in your own cache folder, so changing it already requires access to your account. The original should still not trust its contents blindly. |
| 2 | Saving the history | Saves are not queued; two quick saves can finish in the wrong order. | Rarely, an older state of the history can overwrite a newer one. |
| 3 | Starting up | Something copied while the history is still loading can be replaced by the loaded history. | A copy made in the first moment after login can be missing from the list. |
| 4 | Pasting an image | If a stored image cannot be read, the paste still happens. | Whatever is on the clipboard at that moment is pasted instead. |
| 5 | Pinned entries | Pinned entries have no limit. | The history can grow without bound if you pin a lot. |
| 6 | Size limits | Copied text and images have no size limit. | A very large copy is stored whole and rewritten with every change, using memory and disk. |
| 7 | Storage | The history is stored unencrypted; deleting an entry does not securely erase it. | What you copied can stay readable or recoverable on disk. |
| 8 | Auto-paste | Ctrl+V is sent 250 ms after you pick an entry. | If the focus changes in that moment, it pastes into another window. |
| 9 | Password filtering | Sensitive content is skipped only when the copying app marks it with the `x-kde-passwordManagerHint` type. | Passwords from apps that do not mark them are recorded like anything else. |

## What this project adds around them

Without changing the original, some of its own features reduce the effect of
these points:

- [Private history folder](private-history.md) (on by default) keeps the
  history folder closed to other user accounts (point 7).
- [Clear unpinned entries at login](clear-at-login.md) keeps the history
  short (points 5 and 7, for unpinned entries).
- Turning off **Save copied images** in the original's own settings avoids
  points 1 and 4 for images.

For your own use: if you copy passwords from an app that does not mark them
(point 9), delete those entries afterwards, or check whether your password
manager offers to mark its copies.

## Keeping this current

When a new release of the original is tested (`./update-test-and-push.sh`),
this appendix is reviewed against it, and points it resolves are removed.
