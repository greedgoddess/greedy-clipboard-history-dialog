/* onePassword.js — finding 1Password and checking that it is running
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Shared by the extension and its preferences (which run in different
 * processes), so it uses only GLib and Gio.
 * Explained in docs/quick-access.md#quick-access-detection
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

Gio._promisify(Gio.Subprocess.prototype, 'wait_check_async');

const FLATPAK_ID = 'com.onepassword.OnePassword';

/** [quick-access:detection]
 * The command that opens 1Password Quick Access, or null if 1Password is not
 * installed. Looks on PATH, in /opt/1Password, and for the Flatpak.
 * See docs/quick-access.md#quick-access-detection */
export function findQuickAccessCommand() {
    const inPath = GLib.find_program_in_path('1password');
    if (inPath)
        return [inPath, '--quick-access'];

    const opt = '/opt/1Password/1password';
    if (GLib.file_test(opt, GLib.FileTest.IS_EXECUTABLE))
        return [opt, '--quick-access'];

    const flatpak = GLib.find_program_in_path('flatpak');
    const flatpakDirs = [
        `/var/lib/flatpak/app/${FLATPAK_ID}`,
        GLib.build_filenamev([GLib.get_user_data_dir(), 'flatpak', 'app', FLATPAK_ID]),
    ];
    if (flatpak && flatpakDirs.some(dir => GLib.file_test(dir, GLib.FileTest.IS_DIR)))
        return [flatpak, 'run', FLATPAK_ID, '--quick-access'];

    return null;
}

/** True if a 1Password process is running, false if not, null if that
 * cannot be found out (pgrep missing). Quick Access only opens while the
 * 1Password app runs, usually in the background. */
export async function isOnePasswordRunning(cancellable = null) {
    if (!GLib.find_program_in_path('pgrep'))
        return null;
    const process = Gio.Subprocess.new(['pgrep', '-x', '1password'],
        Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
    try {
        await process.wait_check_async(cancellable);
        return true;
    } catch {
        return false; // pgrep exits with 1 when nothing matches
    }
}

/** Whether Quick Access can be used now, and if not, why. */
export async function quickAccessAvailability(cancellable = null) {
    const command = findQuickAccessCommand();
    if (!command)
        return {available: false, reason: '1Password is not installed.'};
    const running = await isOnePasswordRunning(cancellable);
    if (running === null)
        return {available: false, reason: 'Cannot check whether 1Password is running (pgrep is missing).'};
    if (!running)
        return {available: false, reason: '1Password is installed but not running. Start it, then check again.'};
    return {available: true, command};
}
