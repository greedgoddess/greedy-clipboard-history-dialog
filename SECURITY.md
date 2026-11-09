# Security

Please report security problems privately, using **Report a vulnerability**
on this repository's Security tab on GitHub, not as a public issue.
Responses are best effort.

Clipboard history is stored unencrypted in your cache folder; the
**Private history folder** setting (on by default) keeps that folder closed
to other user accounts, and **Clear unpinned entries at login** (off by
default) keeps it short. See docs/private-history.md and
docs/clear-at-login.md.

Relevant here in particular:

- `build.sh` and `scripts/` download and unpack releases from
  extensions.gnome.org or GitHub;
- `install.sh` and the other scripts change files in your home folder and
  GNOME settings;
- the extension contacts GitHub and extensions.gnome.org when update
  notifications are on (see docs/update-notifications.md);
- the optional password manager integration starts the password manager's
  own program and checks whether it runs with `pgrep` (see
  docs/password-managers.md).

Problems in Clipboard History itself belong to its author:
https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history
