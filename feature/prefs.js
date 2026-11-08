/* prefs.js — preferences of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original preferences are unchanged, in upstream-prefs.js. This class
 * extends them and adds the "Cursor-Follow" group.
 * See docs/cursor-follow.md#cursor-follow-preference
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import UpstreamPreferences from './upstream-prefs.js';

export default class GreedyClipboardHistoryPreferences extends UpstreamPreferences {
    fillPreferencesWindow(window) {
        // The original may fill the window synchronously or asynchronously.
        const result = super.fillPreferencesWindow(window);
        if (typeof result?.then === 'function')
            return result.then(() => this._addCursorFollowGroup(window));
        this._addCursorFollowGroup(window);
        return result;
    }

    /** [cursor-follow:preference]
     * Adds the "Cursor-Follow" group, with "Open at mouse pointer" and the
     * update notifications, to the page the original shows first, or to a
     * page of its own if there is none.
     * See docs/cursor-follow.md#cursor-follow-preference */
    _addCursorFollowGroup(window) {
        const settings = this.getSettings();
        window._cursorFollowSettings = settings; // Keep alive with the window

        const group = new Adw.PreferencesGroup({title: 'Cursor-Follow'});

        const cursorFollowRow = new Adw.SwitchRow({
            title: 'Open at mouse pointer',
            subtitle: 'Opens the panel next to the pointer instead of below the panel icon.',
        });
        settings.bind('cursor-follow', cursorFollowRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(cursorFollowRow);

        // [update-notify:preference]
        // See docs/update-notifications.md#update-notify-preference
        const developer = settings.get_boolean('developer-mode');
        const notificationsRow = new Adw.SwitchRow({
            title: 'Update notifications',
            subtitle: developer
                ? 'Developer machine: notifies once a day at most when Clipboard History publishes a release that is not tested yet.'
                : 'Notifies once a day at most when this build has an update on GitHub.',
        });
        settings.bind('update-notifications', notificationsRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(notificationsRow);

        let page = window.visible_page;
        if (!page) {
            page = new Adw.PreferencesPage({title: 'Cursor-Follow', icon_name: 'input-mouse-symbolic'});
            window.add(page);
        }
        page.add(group);
    }
}
