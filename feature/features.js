/* features.js — which optional features this installation includes.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * install.sh rewrites this file in the installed copy. Each optional feature
 * is included only when asked for, and otherwise its files are left out:
 *   quickAccess  ./install.sh --with-1password   (docs/quick-access.md)
 *   touchMode    ./install.sh --with-touch-mode  (docs/touch-mode.md)
 */
export const FEATURES = {quickAccess: false, touchMode: false};
