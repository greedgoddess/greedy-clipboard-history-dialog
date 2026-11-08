/* prefs.js — preferences of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original preferences are unchanged, in upstream-prefs.js. This class
 * extends them and adds the "Cursor-Follow" and "About" groups.
 * See docs/cursor-follow.md#cursor-follow-preference
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {quickAccessAvailability} from './onePassword.js';

import UpstreamPreferences from './upstream-prefs.js';

export default class GreedyClipboardHistoryPreferences extends UpstreamPreferences {
    fillPreferencesWindow(window) {
        // The original may fill the window synchronously or asynchronously.
        const result = super.fillPreferencesWindow(window);
        const addGroups = () => {
            const page = this._addCursorFollowGroup(window);
            this._addAboutGroup(page);
        };
        if (typeof result?.then === 'function')
            return result.then(addGroups);
        addGroups();
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

        group.add(this._quickAccessRow(settings));

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
        return page;
    }

    /** [about:attribution]
     * Who made what: the original extension and its author, and this project,
     * with links and the versions of the installed build.
     * See docs/cursor-follow.md#about-attribution */
    _addAboutGroup(page) {
        const build = this._readBuildInfo();
        const group = new Adw.PreferencesGroup({
            title: 'About',
            description: 'Not affiliated with or endorsed by the author of Clipboard History.',
        });

        group.add(this._linkRow(
            'Clipboard History',
            `Original extension by Manouchehr Ghalevand · ${build.upstream_version_name ?? '?'} ` +
            `(release ${build.upstream_version ?? '?'}) · GPL-2.0-or-later`,
            'https://github.com/M-ghalevand/gnome-shell-extension-clipboard-history'));
        group.add(this._linkRow(
            'Clipboard History on extensions.gnome.org',
            'Where the original is published',
            'https://extensions.gnome.org/extension/10613/clipboard-history/'));
        group.add(this._linkRow(
            'Greedy Clipboard History Dialog',
            `Cursor-Follow and update notifications by greedgoddess · ${build.project_version ?? '?'} · ` +
            'GPL-2.0-or-later',
            'https://github.com/greedgoddess/greedy-clipboard-history-dialog'));

        page.add(group);
    }

    /** [quick-access:preference]
     * The 1Password Quick Access switch. It can be switched on only while
     * 1Password is installed and running; otherwise it says why, and
     * "Check again" looks once more. It can always be switched off.
     * See docs/quick-access.md#quick-access-preference */
    _quickAccessRow(settings) {
        const row = new Adw.SwitchRow({title: '1Password Quick Access', subtitle: 'Checking for 1Password…'});
        settings.bind('quick-access', row, 'active', Gio.SettingsBindFlags.DEFAULT);

        const checkButton = new Gtk.Button({label: 'Check again', valign: Gtk.Align.CENTER});
        row.add_suffix(checkButton);

        const update = async () => {
            checkButton.sensitive = false;
            const availability = await quickAccessAvailability();
            row.subtitle = availability.available
                ? 'Press the shortcut again while the panel is open to switch to Quick Access, in the panel’s place.'
                : availability.reason;
            row.sensitive = availability.available || settings.get_boolean('quick-access');
            checkButton.visible = !availability.available;
            checkButton.sensitive = true;
        };
        checkButton.connect('clicked', () => update().catch(logError));
        settings.connect('changed::quick-access', () => update().catch(logError));
        update().catch(logError);
        return row;
    }

    _linkRow(title, subtitle, uri) {
        const row = new Adw.ActionRow({title, subtitle, activatable: true, tooltip_text: uri});
        row.add_suffix(new Gtk.Image({icon_name: 'adw-external-link-symbolic'}));
        row.connect('activated', () => {
            new Gtk.UriLauncher({uri}).launch(row.get_root(), null, null);
        });
        return row;
    }

    _readBuildInfo() {
        try {
            const [, contents] = GLib.file_get_contents(GLib.build_filenamev([this.path, 'build-info.json']));
            return JSON.parse(new TextDecoder().decode(contents));
        } catch {
            return {};
        }
    }
}
