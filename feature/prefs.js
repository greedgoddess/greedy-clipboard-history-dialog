/* prefs.js — preferences of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original preferences are unchanged, in upstream-prefs.js. This class
 * extends them and adds the "Placement" group.
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
            return result.then(() => this._addPlacementGroup(window));
        this._addPlacementGroup(window);
        return result;
    }

    /** [cursor-follow:preference]
     * Adds "Placement → Open at mouse pointer" to the page the original
     * shows first, or to a page of its own if there is none.
     * See docs/cursor-follow.md#cursor-follow-preference */
    _addPlacementGroup(window) {
        const settings = this.getSettings();
        window._cursorFollowSettings = settings; // Keep alive with the window

        const row = new Adw.SwitchRow({
            title: 'Open at mouse pointer',
            subtitle: 'Opens the panel next to the pointer instead of below the panel icon.',
        });
        settings.bind('cursor-follow', row, 'active', Gio.SettingsBindFlags.DEFAULT);

        const group = new Adw.PreferencesGroup({title: 'Placement'});
        group.add(row);

        let page = window.visible_page;
        if (!page) {
            page = new Adw.PreferencesPage({title: 'Placement', icon_name: 'input-mouse-symbolic'});
            window.add(page);
        }
        page.add(group);
    }
}
