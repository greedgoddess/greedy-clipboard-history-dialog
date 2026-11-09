/* features.js — which optional features this installation includes.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * install.sh rewrites this file in the installed copy. Each optional feature
 * is included only when asked for, and otherwise its files are left out:
 *   passwordManagers  ./install.sh --with-password-managers  (docs/password-managers.md)
 *   largeSpacing      ./install.sh --with-large-spacing      (docs/large-spacing.md)
 *   gestures          ./install.sh --with-gestures           (docs/gestures.md)
 */
export const FEATURES = {passwordManagers: false, largeSpacing: false, gestures: false};
