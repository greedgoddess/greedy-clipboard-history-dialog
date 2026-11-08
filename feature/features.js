/* features.js — which optional features this installation includes.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * install.sh rewrites this file in the installed copy: the 1Password
 * integration is included only with ./install.sh --with-1password, and
 * otherwise its files are left out entirely.
 * See docs/quick-access.md#quick-access-install
 */
export const FEATURES = {quickAccess: false};
