/* privateHistory.js — keep the clipboard history folder private
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original stores the history as plain files in the cache folder with
 * default permissions, which other local users can read if they can reach
 * the home folder. With the 'private-history' setting on (the default), the
 * history folder is restricted to the owner (mode 700) whenever the extension
 * starts and when the setting is switched on. The permissions it had before
 * are remembered, and switching the setting off restores exactly those, so
 * that switching off never gives anyone more access than the folder had
 * before. Only the folder's permissions change; the original's code and files
 * are untouched. Explained in docs/private-history.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export const PRIVATE_MODE = 0o700;

/** [private-history:mode]
 * What to do with the folder, given the setting, its current permissions and
 * the permissions remembered from before it was first made private (-1 for
 * none). Returns {mode, remember}: the mode to set (null: leave it as it is)
 * and the mode to remember (null: keep what is remembered).
 * Private: 700, remembering the current mode the first time it changes.
 * Not private: the remembered mode, forgotten afterwards; with nothing
 * remembered, the folder is left as it is, so access never widens.
 * See docs/private-history.md#private-history-mode */
export function nextMode(isPrivate, currentMode, rememberedMode) {
    if (isPrivate) {
        if (currentMode === PRIVATE_MODE)
            return {mode: null, remember: null};
        return {mode: PRIVATE_MODE, remember: rememberedMode >= 0 ? null : currentMode};
    }
    if (rememberedMode >= 0)
        return {mode: rememberedMode, remember: -1};
    return {mode: null, remember: null};
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
            const info = folder.query_info('unix::mode', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            const current = info.get_attribute_uint32('unix::mode') & 0o777;
            const {mode, remember} = nextMode(this._settings.get_boolean('private-history'), current,
                this._settings.get_int('private-history-previous-mode'));
            if (remember !== null)
                this._settings.set_int('private-history-previous-mode', remember);
            if (mode !== null) {
                folder.set_attribute_uint32('unix::mode', mode,
                    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
            }
        } catch (error) {
            console.warn(`Private history folder: could not set permissions: ${error.message}`);
        }
    }

    destroy() {
        this._settings.disconnect(this._settingsId);
        this._settings = null;
    }
}
