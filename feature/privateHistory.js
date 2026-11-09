/* privateHistory.js — keep the clipboard history folder private
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original stores the history as plain files in the cache folder with
 * default permissions, which other local users can read if they can reach
 * the home folder. With the 'private-history' setting on (the default), the
 * history folder is restricted to the owner (mode 700) whenever the extension
 * starts and when the setting is switched on; switched off, it gets the usual
 * default (755) back. Only the folder's permissions change; the original's
 * code and files are untouched. Explained in docs/private-history.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/** [private-history:mode]
 * The folder's permissions: 700 (owner only) when private, 755 otherwise.
 * See docs/private-history.md#private-history-mode */
export function folderMode(isPrivate) {
    return isPrivate ? 0o700 : 0o755;
}

export class PrivateHistory {
    /** [private-history:apply]
     * The history folder is the one the original creates in the user's
     * cache folder, named after the extension's UUID.
     * See docs/private-history.md#private-history-apply */
    constructor(uuid, settings) {
        this._settings = settings;
        this._path = GLib.build_filenamev([GLib.get_user_cache_dir(), uuid]);
        this._settingsId = settings.connect('changed::private-history', () => this.apply());
        this.apply();
    }

    apply() {
        const folder = Gio.File.new_for_path(this._path);
        if (!folder.query_exists(null))
            return;
        try {
            folder.set_attribute_uint32('unix::mode', folderMode(this._settings.get_boolean('private-history')),
                Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        } catch (error) {
            console.warn(`Private history folder: could not set permissions: ${error.message}`);
        }
    }

    destroy() {
        this._settings.disconnect(this._settingsId);
        this._settings = null;
    }
}
