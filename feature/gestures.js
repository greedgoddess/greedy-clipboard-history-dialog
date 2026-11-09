/* gestures.js — open the panel with a three-finger tap or hold
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Optional (./install.sh --with-gestures). Two triggers, each with its own
 * switch: a three-finger tap on the touchscreen opens the panel at the center
 * of the three touches, unless an app on the blocklist is in focus (drawing
 * apps and the like); a three-finger hold on the touchpad opens it at the
 * pointer. The touches still reach the app underneath.
 * Explained section by section in docs/gestures.md.
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

// A tap: three fingers landing within this time of each other...
const TAP_LAND_MS = 150;
// ...all lifted within this time of the first landing...
const TAP_LIFT_MS = 400;
// ...none moving further than this (logical pixels).
const TAP_SLOP = 20;
// A hold: three fingers resting at least this long before lifting.
const HOLD_MIN_MS = 300;

/** [gestures:tap]
 * Recognises a three-finger tap from touch events, without GNOME: feed it
 * begin, update, end and cancel per touch; end() returns the center of the
 * three touches when they made a tap, otherwise null.
 * See docs/gestures.md#gestures-tap */
export class TapDetector {
    constructor() {
        this._reset();
    }

    _reset() {
        this._touches = new Map();    // id -> {x, y, startX, startY, ended}
        this._firstTime = null;
        this._failed = false;
    }

    begin(id, x, y, time) {
        if (this._firstTime === null)
            this._firstTime = time;
        if (this._touches.size >= 3 || time - this._firstTime > TAP_LAND_MS)
            this._failed = true;
        this._touches.set(id, {startX: x, startY: y, ended: false});
    }

    update(id, x, y) {
        const touch = this._touches.get(id);
        if (touch && Math.hypot(x - touch.startX, y - touch.startY) > TAP_SLOP)
            this._failed = true;
    }

    cancel(id) {
        this._failed = true;
        this.end(id, Infinity);
    }

    end(id, time) {
        const touch = this._touches.get(id);
        if (!touch)
            return null;
        touch.ended = true;
        if (time - this._firstTime > TAP_LIFT_MS)
            this._failed = true;
        if ([...this._touches.values()].some(t => !t.ended))
            return null;
        const touches = [...this._touches.values()];
        const tap = !this._failed && touches.length === 3;
        this._reset();
        if (!tap)
            return null;
        return {
            x: touches.reduce((sum, t) => sum + t.startX, 0) / 3,
            y: touches.reduce((sum, t) => sum + t.startY, 0) / 3,
        };
    }
}

/** [gestures:touch-id]
 * A stable key for one touch. GJS gives each event a new wrapper object for
 * the touch's sequence, so the object itself cannot be used as a key; its
 * slot number stays the same from the touch's begin to its end.
 * See docs/gestures.md#gestures-touch-id */
export function touchKey(sequence) {
    const slot = sequence?.get_slot?.();
    return typeof slot === 'number' ? `slot:${slot}` : String(sequence);
}

/** [gestures:hold]
 * A three-finger touchpad hold counts when it ended normally (not cancelled,
 * as when the fingers start moving into a swipe) after resting long enough.
 * See docs/gestures.md#gestures-hold */
export function holdCounts(fingers, beginTime, endTime, cancelled) {
    return fingers === 3 && !cancelled && beginTime !== null && endTime - beginTime >= HOLD_MIN_MS;
}

/** [gestures:blocklist]
 * True if the focused app is on the blocklist. Entries are app IDs (with or
 * without .desktop) or window classes, compared without regard to case;
 * ids are the focused window's app ID, window class and sandboxed app ID.
 * See docs/gestures.md#gestures-blocklist */
export function isBlocked(blocklist, ids) {
    const normal = value => String(value ?? '').toLowerCase().replace(/\.desktop$/, '');
    const wanted = new Set(blocklist.map(normal).filter(Boolean));
    return ids.some(id => wanted.has(normal(id)));
}

function focusedAppIds() {
    const window = global.display.focus_window;
    if (!window)
        return [];
    const app = Shell.WindowTracker.get_default().get_window_app(window);
    return [app?.get_id?.(), window.get_wm_class?.(), window.get_sandboxed_app_id?.(),
        window.get_gtk_application_id?.()].filter(Boolean);
}

// Watches the stage's events in the capture phase, as GNOME's own touch
// swipes do, so it sees touches on windows too; it never consumes them.
const GestureWatcher = GObject.registerClass(
class GreedyGestureWatcher extends Clutter.Action {
    _init(onEvent) {
        super._init();
        this._onEvent = onEvent;
    }

    vfunc_handle_event(event) {
        this._onEvent(event);
        return Clutter.EVENT_PROPAGATE;
    }
});

export class Gestures {
    /** [gestures:install]
     * openAt(point) opens the panel at a point; open() at the pointer.
     * See docs/gestures.md#gestures-install */
    constructor(settings, {openAt, open, isOpen, close}) {
        this._settings = settings;
        this._actions = {openAt, open, isOpen, close};
        this._tap = new TapDetector();
        this._holdBegin = null;
        this.active = typeof global.stage.add_action_full === 'function';
        if (!this.active) {
            console.warn('Gestures: this GNOME Shell offers no way to watch gestures; not active');
            return;
        }
        this._watcher = new GestureWatcher(event => {
            try {
                this._handle(event);
            } catch (error) {
                console.warn(`Gestures: ${error.message}`);
            }
        });
        global.stage.add_action_full('greedy-clipboard-gestures', Clutter.EventPhase.CAPTURE, this._watcher);
    }

    _toggleOrOpen(open) {
        if (this._actions.isOpen())
            this._actions.close();
        else
            open();
    }

    _handle(event) {
        const type = event.type();
        const T = Clutter.EventType;
        if (type === T.TOUCHPAD_HOLD) {
            this._handleHold(event);
            return;
        }
        if (![T.TOUCH_BEGIN, T.TOUCH_UPDATE, T.TOUCH_END, T.TOUCH_CANCEL].includes(type))
            return;
        if (!this._settings.get_boolean('gesture-touchscreen-tap'))
            return;
        const id = touchKey(event.get_event_sequence());
        const [x, y] = event.get_coords();
        const time = event.get_time();
        let center = null;
        if (type === T.TOUCH_BEGIN)
            this._tap.begin(id, x, y, time);
        else if (type === T.TOUCH_UPDATE)
            this._tap.update(id, x, y);
        else if (type === T.TOUCH_END)
            center = this._tap.end(id, time);
        else
            this._tap.cancel(id);

        if (center && !isBlocked(this._settings.get_strv('gesture-blocklist'), focusedAppIds()))
            this._toggleOrOpen(() => this._actions.openAt(center));
    }

    _handleHold(event) {
        if (!this._settings.get_boolean('gesture-touchpad-hold'))
            return;
        const phase = event.get_gesture_phase();
        const P = Clutter.TouchpadGesturePhase;
        if (phase === P.BEGIN) {
            this._holdBegin = event.get_touchpad_gesture_finger_count() === 3 ? event.get_time() : null;
        } else if (phase === P.END || phase === P.CANCEL) {
            const counts = holdCounts(3, this._holdBegin, event.get_time(), phase === P.CANCEL);
            this._holdBegin = null;
            if (counts)
                this._toggleOrOpen(() => this._actions.open());
        }
    }

    /** [gestures:cleanup]
     * See docs/gestures.md#gestures-cleanup */
    destroy() {
        if (this.active)
            global.stage.remove_action(this._watcher);
        this._watcher = null;
        this._settings = null;
    }
}
