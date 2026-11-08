# Maintenance

How this repository is managed: Git over SSH, how the fork relates to the
stock extension, and how to follow new stock releases.

## Contents

- [SSH access](#ssh-access)
- [Committing and pushing](#committing-and-pushing)
- [Comparing with the stock release](#comparing-with-the-stock-release)
- [Following a new stock release](#following-a-new-stock-release)
- [Version numbers](#version-numbers)
- [Preparing the upstream patch](#preparing-the-upstream-patch)

## SSH access

The repository is accessed over SSH only. Check that the key works:

```bash
ssh -T git@github.com
```

It should greet you by your GitHub user name. A checkout should use the SSH
remote:

```bash
git remote -v
# origin  git@github.com:greedgoddess/greedy-clipboard-history-dialog.git (fetch)
# origin  git@github.com:greedgoddess/greedy-clipboard-history-dialog.git (push)
```

To switch an HTTPS checkout to SSH:

```bash
git remote set-url origin git@github.com:greedgoddess/greedy-clipboard-history-dialog.git
```

On a machine without a key, create one and add the public half at
<https://github.com/settings/ssh/new>:

```bash
ssh-keygen -t ed25519 -C "$(hostname)"
cat ~/.ssh/id_ed25519.pub
```

## Committing and pushing

```bash
git status
git add -A
git commit -m "Short description of the change"
git push
```

Other machines then pick the change up with `./update.sh`.

## Comparing with the stock release

The fork must differ from the stock release only as listed in the
[README](../README.md#how-this-fork-differs-from-the-stock-release). To check,
download the stock release from extensions.gnome.org and compare:

```bash
curl -L -o /tmp/stock.zip https://extensions.gnome.org/review/download/77441.shell-extension.zip
rm -rf /tmp/stock && mkdir -p /tmp/stock/src && unzip -oq /tmp/stock.zip -d /tmp/stock/src
diff -r /tmp/stock/src src
```

`77441` is the review number of release 1.0 (3). For another release, open
the extension's page on extensions.gnome.org, find the release's review page,
and use its number.

Expected output: the tagged cursor-follow sections in `extension.js`,
`prefs.js` and the schema, and the name, version and formatting of
`metadata.json`.

## Following a new stock release

When the original author publishes a new release:

1. Download it and unpack it as above, into `/tmp/stock/src`.
2. Apply the cursor-follow patch to it:

   ```bash
   cd /tmp/stock
   git init -q && git add -A && git commit -qm stock
   git apply --3way ~/Projects/greedy-clipboard-history-dialog/upstream-patches/0001-add-option-to-open-panel-at-mouse-pointer.patch
   ```

   The patch also adds `docs/cursor-follow.md`, which the stock zip does not
   contain; that is expected. If the patch does not apply, use
   [cursor-follow.md](cursor-follow.md) as the guide to place each tagged
   section by hand.
3. Copy the result from `/tmp/stock/src/` into `src/`, keeping the fork's `metadata.json` but
   taking over any new `shell-version` entries, and raise its `version`; see
   [Version numbers](#version-numbers).
4. Run the [comparison](#comparing-with-the-stock-release) again against the
   new release, test with the checklist in
   [cursor-follow.md](cursor-follow.md#testing), then commit and push.

If the author has merged the feature, the fork is no longer needed: uninstall
it with `./uninstall.sh` (history and settings are kept) and install the
stock extension from extensions.gnome.org.

## Version numbers

`version` in `src/metadata.json` must be **higher than the stock release it is
based on**. GNOME's update check offers a stock release as an update when its
number is higher than the installed one, and accepting would replace the
fork.

| Fork version | Based on | Change |
| --- | --- | --- |
| 4 | 1.0 (3) | Pointer placement built in |
| 5 | 1.0 (3) | Pointer placement as the optional Open at mouse pointer setting |

## Preparing the upstream patch

See [upstream-patches/README.md](../upstream-patches/README.md).
