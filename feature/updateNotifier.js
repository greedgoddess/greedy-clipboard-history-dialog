/* updateNotifier.js — update notifications for Greedy Clipboard History Dialog
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Once a day, when 'update-notifications' is on, checks for an update and
 * shows a GNOME notification, once per update:
 *  - developer mode: a Clipboard History release that is not in this
 *    project's tested-releases.json yet (run ./update-test-and-push.sh);
 *  - otherwise: a newer tested release or newer feature code in this
 *    project's GitHub repository than the installed build (run ./update.sh).
 * Explained section by section in docs/update-notifications.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');
Gio._promisify(Gio.File.prototype, 'load_contents_async');

const REPOSITORY = 'greedgoddess/greedy-clipboard-history-dialog';
const TESTED_RELEASES_URL = `https://raw.githubusercontent.com/${REPOSITORY}/main/tested-releases.json`;
const FEATURE_COMMITS_URL = `https://api.github.com/repos/${REPOSITORY}/commits?path=feature&per_page=1`;
const ORIGINAL_INFO_URL =
    'https://extensions.gnome.org/extension-info/?uuid=clipboard-history%40manouchehr&shell_version=';

const CHECK_INTERVAL_SECONDS = 24 * 60 * 60;
const FIRST_CHECK_DELAY_SECONDS = 2 * 60;

export class UpdateNotifier {
    constructor(extension, settings) {
        this._extension = extension;
        this._settings = settings;
        this._shellMajor = Config.PACKAGE_VERSION.split('.')[0];
        this._session = new Soup.Session({timeout: 30, user_agent: 'greedy-clipboard-history-dialog'});
        this._cancellable = new Gio.Cancellable();
        this._timeoutId = 0;

        this._settingsId = settings.connect('changed::update-notifications', () => this._schedule());
        this._schedule();
    }

    /** [update-notify:schedule]
     * Plans the next check: a day after the last one, stored in the settings
     * because every screen lock disables and re-enables the extension, but
     * never sooner than two minutes after enabling.
     * See docs/update-notifications.md#update-notify-schedule */
    _schedule() {
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        if (!this._settings.get_boolean('update-notifications'))
            return;

        const sinceLastCheck = GLib.get_real_time() / 1e6 - this._settings.get_int64('update-last-check');
        const delay = Math.max(FIRST_CHECK_DELAY_SECONDS, Math.ceil(CHECK_INTERVAL_SECONDS - sinceLastCheck));
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_LOW, delay, () => {
            this._timeoutId = 0;
            this._check().finally(() => {
                if (!this._cancellable.is_cancelled())
                    this._schedule();
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    async _check() {
        this._settings.set_int64('update-last-check', Math.floor(GLib.get_real_time() / 1e6));
        try {
            const tested = await this._newestTestedRelease();
            if (this._settings.get_boolean('developer-mode'))
                await this._checkOriginal(tested);
            else
                await this._checkRepository(tested);
        } catch (error) {
            // Offline, or a site not answering: try again at the next check.
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                console.log(`${this._extension.uuid}: update check skipped: ${error.message}`);
        }
    }

    /** [update-notify:developer-check]
     * Developer mode: is there a Clipboard History release for this GNOME
     * Shell that is newer than the newest tested one?
     * See docs/update-notifications.md#update-notify-developer-check */
    async _checkOriginal(tested) {
        const info = await this._fetchJson(ORIGINAL_INFO_URL + this._shellMajor);
        const latest = info.shell_version_map?.[this._shellMajor]?.version ?? info.version;
        if (latest && (!tested || latest > tested.version)) {
            this._notifyOnce(`release:${latest}`,
                `Clipboard History release ${latest} is out`,
                `Run ./update-test-and-push.sh in ${this._checkoutPath()} to build, test and publish it.`);
        }
    }

    /** [update-notify:user-check]
     * Otherwise: does this project's repository have a newer tested release,
     * or newer feature code, than the build that is installed?
     * See docs/update-notifications.md#update-notify-user-check */
    async _checkRepository(tested) {
        const installed = await this._installedBuild();
        const [latestFeatureCommit] = await this._fetchJson(FEATURE_COMMITS_URL);
        const newRelease = tested && tested.version > installed.upstream_version;
        const newFeature = latestFeatureCommit && installed.feature_commit &&
            latestFeatureCommit.sha !== installed.feature_commit;
        if (newRelease || newFeature) {
            this._notifyOnce(`update:${tested?.version}:${latestFeatureCommit?.sha}`,
                'Greedy Clipboard History has an update',
                `Run ./update.sh in ${this._checkoutPath()}, then log out and back in.`);
        }
    }

    async _newestTestedRelease() {
        const releases = await this._fetchJson(TESTED_RELEASES_URL);
        const usable = releases.filter(r => r.shell_versions.includes(this._shellMajor));
        return usable.sort((a, b) => b.version - a.version)[0] ?? null;
    }

    /** [update-notify:build-info]
     * What build.sh recorded about the installed build.
     * See docs/update-notifications.md#update-notify-build-info */
    async _installedBuild() {
        const file = Gio.File.new_for_path(GLib.build_filenamev([this._extension.path, 'build-info.json']));
        const [contents] = await file.load_contents_async(this._cancellable);
        return JSON.parse(new TextDecoder().decode(contents));
    }

    async _fetchJson(url) {
        const message = Soup.Message.new('GET', url);
        const bytes = await this._session.send_and_read_async(message, GLib.PRIORITY_LOW, this._cancellable);
        if (message.get_status() !== Soup.Status.OK)
            throw new Error(`${url} answered ${message.get_status()}`);
        return JSON.parse(new TextDecoder().decode(bytes.get_data()));
    }

    /** [update-notify:notify-once]
     * Shows the notification unless this exact update was notified before.
     * See docs/update-notifications.md#update-notify-notify-once */
    _notifyOnce(key, title, body) {
        if (this._settings.get_string('update-notified') === key)
            return;
        this._settings.set_string('update-notified', key);
        Main.notify(title, body);
    }

    _checkoutPath() {
        return this._settings.get_string('checkout-path') || 'your checkout';
    }

    /** [update-notify:cleanup]
     * Stops the timer and any request in progress.
     * See docs/update-notifications.md#update-notify-cleanup */
    destroy() {
        this._cancellable.cancel();
        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this._settings.disconnect(this._settingsId);
        this._session.abort();
        this._session = null;
        this._settings = null;
        this._extension = null;
    }
}
