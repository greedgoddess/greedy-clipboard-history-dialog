/* prefs.js — preferences of Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * The original preferences are unchanged, in upstream-prefs.js. This class
 * extends them and adds the "Cursor-Follow", "Password managers" (when that
 * integration is installed) and "About" groups.
 * See docs/cursor-follow.md#cursor-follow-preference
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {FEATURES} from './features.js';

import UpstreamPreferences from './upstream-prefs.js';

export default class GreedyClipboardHistoryPreferences extends UpstreamPreferences {
    fillPreferencesWindow(window) {
        // The original may fill the window synchronously or asynchronously.
        const result = super.fillPreferencesWindow(window);
        const addGroups = async () => {
            const page = this._addCursorFollowGroup(window);
            // Loaded only when installed: without the integration its files
            // are not there.
            const passwordManagers = FEATURES.passwordManagers ? await import('./passwordManagers.js') : null;
            if (passwordManagers)
                this._addPasswordManagerGroup(page, passwordManagers);
            this._addAboutGroup(page, passwordManagers);
        };
        if (typeof result?.then === 'function')
            return result.then(addGroups);
        return addGroups();
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

        // [hover-preview:preference] See docs/hover-preview.md#hover-preview-setting
        const hoverRow = new Adw.SwitchRow({
            title: 'Preview on hover',
            subtitle: 'Shows up to 512 characters of a text entry while the pointer rests on it.',
        });
        settings.bind('hover-preview', hoverRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(hoverRow);

        // [large-spacing:preference] Only when installed with --with-large-spacing.
        // See docs/large-spacing.md#large-spacing-preference
        if (FEATURES.largeSpacing) {
            const spacingRow = new Adw.SwitchRow({
                title: 'Large spacing',
                subtitle: 'A compact fixed-size panel with icon tabs, icon buttons instead of the menu entries at the bottom, and rounded corners matching the password manager windows.',
            });
            settings.bind('large-spacing', spacingRow, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(spacingRow);
        }

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
    _addAboutGroup(page, passwordManagers) {
        const build = this._readBuildInfo();
        const providers = passwordManagers?.PROVIDERS ?? [];
        const group = new Adw.PreferencesGroup({
            title: 'About',
            description: providers.length
                ? `Not affiliated with or endorsed by the author of Clipboard History, or by ${
                    providers.map(p => p.name).join(', ')}.`
                : 'Not affiliated with or endorsed by the author of Clipboard History.',
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

        // [password-manager:about] Only when the password manager integration
        // is installed: each supported password manager, with links.
        // See docs/password-managers.md#password-manager-about
        for (const provider of providers) {
            group.add(this._linkRow(
                provider.name,
                `Third-party password manager by ${provider.vendor}; ${provider.thanks}`,
                provider.links.home));
            group.add(this._linkRow(
                `${provider.name} for Linux`,
                `Installing ${provider.name} on Linux`,
                provider.links.linux));
        }

        page.add(group);
    }

    /** [password-manager:preference]
     * The "Password managers" group: one switch per supported password
     * manager (any number may be on), and the drop-down for which one the
     * second press of the shortcut opens. A switch can be turned on only
     * while its app is installed and running; otherwise it says why, and
     * "Check again" looks once more. It can always be turned off.
     * See docs/password-managers.md#password-manager-preference */
    _addPasswordManagerGroup(page, {PROVIDERS, availability}) {
        const settings = this.getSettings();
        const group = new Adw.PreferencesGroup({
            title: 'Password managers',
            description: `Open a password manager's search window from the clipboard panel. ` +
                `Supported for now: ${PROVIDERS.map(p => p.name).join(', ')}.`,
        });

        const enabled = () => settings.get_strv('password-managers');
        const setEnabled = (id, on) => {
            const ids = enabled().filter(other => other !== id);
            settings.set_strv('password-managers', on ? [...ids, id] : ids);
        };

        for (const provider of PROVIDERS) {
            const row = new Adw.SwitchRow({title: provider.name, subtitle: `Checking for ${provider.name}…`});
            const checkButton = new Gtk.Button({label: 'Check again', valign: Gtk.Align.CENTER});
            row.add_suffix(checkButton);
            let updating = false;
            const update = async () => {
                updating = true;
                row.active = enabled().includes(provider.id);
                updating = false;
                checkButton.sensitive = false;
                const status = await availability(provider);
                row.subtitle = status.available
                    ? `Its ${provider.windowName} can be opened from the panel.`
                    : status.reason;
                row.sensitive = status.available || enabled().includes(provider.id);
                checkButton.visible = !status.available;
                checkButton.sensitive = true;
            };
            row.connect('notify::active', () => {
                if (!updating)
                    setEnabled(provider.id, row.active);
            });
            checkButton.connect('clicked', () => update().catch(logError));
            settings.connect('changed::password-managers', () => update().catch(logError));
            update().catch(logError);
            group.add(row);
        }

        // [password-manager:shortcut-preference] Which enabled password
        // manager the second press of the shortcut opens, or none.
        const shortcutRow = new Adw.ComboRow({
            title: 'Second shortcut press opens',
            subtitle: 'Pressing the shortcut again while the panel is open.',
        });
        let choices = [];
        let filling = false;
        const fill = () => {
            filling = true;
            const providers = PROVIDERS.filter(provider => enabled().includes(provider.id));
            choices = ['', ...providers.map(provider => provider.id)];
            shortcutRow.model = Gtk.StringList.new(
                ['Nothing (closes the panel)', ...providers.map(p => `${p.name} ${p.windowName}`)]);
            const current = choices.indexOf(settings.get_string('shortcut-password-manager'));
            shortcutRow.selected = current >= 0 ? current : 0;
            filling = false;
        };
        shortcutRow.connect('notify::selected', () => {
            if (!filling)
                settings.set_string('shortcut-password-manager', choices[shortcutRow.selected] ?? '');
        });
        settings.connect('changed::password-managers', fill);
        settings.connect('changed::shortcut-password-manager', fill);
        fill();
        group.add(shortcutRow);

        page._passwordManagerSettings = settings;    // Keep alive with the page
        page.add(group);
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
