/* passwordManagers.js — the supported password managers, and finding them
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Part of the optional password manager integration. Each supported password
 * manager is one entry in PROVIDERS: how to find it, how to open its search
 * window, and how to recognise that window. 1Password is the only one for
 * now; another is added by adding an entry, nothing else.
 * Shared by the extension and its preferences (which run in different
 * processes), so it uses only GLib and Gio.
 * Explained in docs/password-managers.md#password-manager-providers
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'wait_check_async');

/** [password-manager:providers]
 * One entry per supported password manager.
 * See docs/password-managers.md#password-manager-providers */
export const PROVIDERS = [
    {
        id: '1password',
        name: '1Password',
        windowName: 'Quick Access',               // What its search window is called
        vendor: 'AgileBits',
        // Where its program can be; the first one found is used.
        executables: ['1password'],               // On PATH
        paths: ['/opt/1Password/1password'],
        flatpakId: 'com.onepassword.OnePassword',
        openArgs: ['--quick-access'],             // Opens the search window; documented for Wayland
        processName: '1password',                 // Its running app, for pgrep -x
        windowClass: /1password|onepassword/i,    // Its windows' class (XWayland) or app ID (Wayland)
        desktopIds: ['1password.desktop', 'com.onepassword.OnePassword.desktop'],
        links: {
            home: 'https://1password.com/',
            linux: 'https://support.1password.com/install-linux/',
            shortcuts: 'https://support.1password.com/keyboard-shortcuts/?linux',
        },
        thanks: 'thanks for a native Linux app',
    },
];

export function providerById(id) {
    return PROVIDERS.find(provider => provider.id === id) ?? null;
}

/** [password-manager:detection]
 * The command that opens the provider's search window, or null if it is not
 * installed: on PATH, at one of its paths, or as its Flatpak.
 * See docs/password-managers.md#password-manager-detection */
export function findCommand(provider) {
    for (const name of provider.executables ?? []) {
        const path = GLib.find_program_in_path(name);
        if (path)
            return [path, ...provider.openArgs];
    }
    for (const path of provider.paths ?? []) {
        if (GLib.file_test(path, GLib.FileTest.IS_EXECUTABLE))
            return [path, ...provider.openArgs];
    }
    const flatpak = GLib.find_program_in_path('flatpak');
    if (flatpak && provider.flatpakId) {
        const dirs = [
            `/var/lib/flatpak/app/${provider.flatpakId}`,
            GLib.build_filenamev([GLib.get_user_data_dir(), 'flatpak', 'app', provider.flatpakId]),
        ];
        if (dirs.some(dir => GLib.file_test(dir, GLib.FileTest.IS_DIR)))
            return [flatpak, 'run', provider.flatpakId, ...provider.openArgs];
    }
    return null;
}

/** True if the provider's app is running, false if not, null if that cannot
 * be found out (pgrep missing). Its search window only opens while it runs. */
export async function isRunning(provider, cancellable = null) {
    if (!GLib.find_program_in_path('pgrep'))
        return null;
    const process = Gio.Subprocess.new(['pgrep', '-x', provider.processName],
        Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
    try {
        await process.wait_check_async(cancellable);
        return true;
    } catch {
        return false; // pgrep exits with 1 when nothing matches
    }
}

/** Whether the provider can be used now, and if not, why. */
export async function availability(provider, cancellable = null) {
    const command = findCommand(provider);
    if (!command)
        return {available: false, reason: `${provider.name} is not installed.`};
    const running = await isRunning(provider, cancellable);
    if (running === null)
        return {available: false, reason: `Cannot check whether ${provider.name} is running (pgrep is missing).`};
    if (!running) {
        return {available: false,
            reason: `${provider.name} is installed but not running. Start it, then check again.`};
    }
    return {available: true, command};
}

/** True for a window of the provider's app. */
export function isProviderWindow(provider, wmClass) {
    return provider.windowClass.test(wmClass ?? '');
}
