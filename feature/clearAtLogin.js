/* clearAtLogin.js — clear unpinned history entries at login
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * With the 'clear-at-login' setting on, the first time the extension starts
 * in a login session, everything in the history except pinned entries is
 * removed, before the original loads the history. GNOME also restarts
 * extensions on every screen unlock; that does not count as a login. The
 * original's code is untouched: this edits its history file before it reads
 * it. Explained in docs/clear-at-login.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import GLib from 'gi://GLib';

/** [clear-at-login:keep-pinned]
 * Which entries stay (the pinned ones) and which image files go: only
 * images of removed entries, and only inside the history's images folder.
 * See docs/clear-at-login.md#clear-at-login-keep-pinned */
export function keepPinned(entries, imagesDir) {
    const kept = entries.filter(entry => entry?.pinned === true);
    const removedImages = entries
        .filter(entry => entry?.pinned !== true && typeof entry?.imagePath === 'string' &&
            entry.imagePath.startsWith(`${imagesDir}/`) && !entry.imagePath.includes('/../'))
        .map(entry => entry.imagePath);
    return {kept, removedImages};
}

/** [clear-at-login:session]
 * True only for the first start in a login session. The marker lives in the
 * user's runtime folder (/run/user/<uid>), which exists for as long as the
 * user is logged in and is removed at logout and reboot. It is written on
 * every first start, whether the setting is on or not, so that switching the
 * setting on later never clears the history in the middle of a session.
 * See docs/clear-at-login.md#clear-at-login-session */
export function isFirstStartOfSession(uuid) {
    const folder = GLib.build_filenamev([GLib.get_user_runtime_dir(), uuid]);
    const marker = GLib.build_filenamev([folder, 'session-started']);
    if (GLib.file_test(marker, GLib.FileTest.EXISTS))
        return false;
    GLib.mkdir_with_parents(folder, 0o700);
    GLib.file_set_contents(marker, '');
    return true;
}

/** [clear-at-login:clear]
 * Runs before the original starts. Returns true if entries were removed.
 * A history file that cannot be read as expected is left untouched.
 * See docs/clear-at-login.md#clear-at-login-clear */
export function clearAtLogin(uuid, settings) {
    if (!isFirstStartOfSession(uuid) || !settings.get_boolean('clear-at-login'))
        return false;
    const cacheDir = GLib.build_filenamev([GLib.get_user_cache_dir(), uuid]);
    const indexPath = GLib.build_filenamev([cacheDir, 'history.json']);
    if (!GLib.file_test(indexPath, GLib.FileTest.EXISTS))
        return false;

    const [, contents] = GLib.file_get_contents(indexPath);
    const entries = JSON.parse(new TextDecoder().decode(contents));
    if (!Array.isArray(entries))
        return false;
    const {kept, removedImages} = keepPinned(entries, GLib.build_filenamev([cacheDir, 'images']));
    if (kept.length === entries.length)
        return false;
    GLib.file_set_contents(indexPath, JSON.stringify(kept));
    for (const path of removedImages)
        GLib.unlink(path);
    return true;
}
