/* roundedCorners.js — rounded corners for the 1Password Quick Access window
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 *
 * Part of the optional 1Password integration. GNOME Shell draws every window
 * itself; this adds a small shader effect to the Quick Access window as GNOME
 * Shell draws it, which makes the pixels outside rounded corners transparent.
 * GNOME Shell 51 changed the shader API; both the old and the new one are
 * supported, and without either the corners simply stay square.
 * 1Password itself is not changed or asked for anything.
 * Explained in docs/quick-access.md#quick-access-rounded-corners
 */

// Generated with AI for personal use.
// Do NOT upload to extensions.gnome.org (EGO) unless you understand JavaScript
// and can maintain this code.

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';

// Same radius as GNOME's own windows.
export const CORNER_RADIUS = 12;

const DECLARATIONS = `
uniform vec4 bounds;   // the window's frame inside its actor: x1, y1, x2, y2
uniform vec2 size;     // the actor's size
uniform float radius;

float rounded_corner_alpha(vec2 p) {
    // Only the four corner squares of the frame are cut; everything else,
    // including anything outside the frame, is left as it is.
    if (p.x < bounds.x || p.y < bounds.y || p.x > bounds.z || p.y > bounds.w)
        return 1.0;
    vec2 inner = clamp(p, bounds.xy + radius, bounds.zw - radius);
    return clamp(radius - distance(p, inner) + 0.5, 0.0, 1.0);
}
`;
const CODE = 'cogl_color_out *= rounded_corner_alpha(cogl_tex_coord0_in.xy * size);';

/** [quick-access:corner-bounds]
 * Where the window's frame is inside its actor, which also covers invisible
 * borders: frame and buffer are the window's frame and buffer rectangles.
 * See docs/quick-access.md#quick-access-rounded-corners */
export function cornerBounds(frame, buffer) {
    const x1 = frame.x - buffer.x;
    const y1 = frame.y - buffer.y;
    return [x1, y1, x1 + frame.width, y1 + frame.height];
}

/** [quick-access:shader-api]
 * Which shader API this GNOME Shell offers: 'clutter-snippet' (GNOME 51 and
 * later: Clutter.ShaderEffect with a snippet), 'shell-glsl' (before 51:
 * Shell.GLSLEffect, removed in 51), or null (neither; corners stay square).
 * See docs/quick-access.md#quick-access-rounded-corners */
export function shaderApi(shell, clutter) {
    if (typeof clutter?.ShaderEffect?.prototype?.vfunc_get_static_snippet === 'function')
        return 'clutter-snippet';
    if (typeof shell?.GLSLEffect === 'function')
        return 'shell-glsl';
    return null;
}

// The effect class is created on first use, not when this file loads: a
// GNOME Shell without the expected API must not stop the 1Password
// integration from loading. null once it is known that there is no API.
let effectClass;

function getEffectClass() {
    if (effectClass !== undefined)
        return effectClass;
    const api = shaderApi(Shell, Clutter);
    const setUniforms = (effect, bounds, width, height) => {
        // By name on Clutter.ShaderEffect, by location on Shell.GLSLEffect.
        const at = name => api === 'shell-glsl' ? effect.get_uniform_location(name) : name;
        effect.set_uniform_float(at('bounds'), 4, bounds);
        effect.set_uniform_float(at('size'), 2, [width, height]);
        effect.set_uniform_float(at('radius'), 1, [CORNER_RADIUS]);
    };
    const update = function (window, actor) {
        setUniforms(this, cornerBounds(window.get_frame_rect(), window.get_buffer_rect()), actor.width, actor.height);
        this.queue_repaint();
    };

    if (api === 'clutter-snippet') {
        effectClass = GObject.registerClass(class GreedyRoundedCornersEffect extends Clutter.ShaderEffect {
            vfunc_get_static_snippet() {
                return Cogl.Snippet.new(Cogl.SnippetHook.FRAGMENT, DECLARATIONS, CODE);
            }
        });
    } else if (api === 'shell-glsl') {
        const hook = Shell.SnippetHook?.FRAGMENT ?? Cogl.SnippetHook.FRAGMENT;
        effectClass = GObject.registerClass(class GreedyRoundedCornersEffect extends Shell.GLSLEffect {
            vfunc_build_pipeline() {
                this.add_glsl_snippet(hook, DECLARATIONS, CODE, false);
            }
        });
    } else {
        effectClass = null;
        return null;
    }
    effectClass.prototype.update = update;
    return effectClass;
}

/** [quick-access:rounded-corners]
 * Rounds the corners of the given windows while they exist, and removes the
 * effect from all of them on destroy().
 * See docs/quick-access.md#quick-access-rounded-corners */
export class CornerRounder {
    constructor() {
        this._rounded = new Map();    // window actor -> {effect, ids}
    }

    /** Rounds the window's corners; returns false, and changes nothing, when
     * this GNOME Shell has no shader API for it. */
    round(window) {
        const actor = window.get_compositor_private();
        if (!actor || this._rounded.has(actor))
            return true;
        const Effect = getEffectClass();
        if (!Effect)
            return false;
        const effect = new Effect();
        actor.add_effect_with_name('greedy-rounded-corners', effect);
        const update = () => effect.update(window, actor);
        const ids = [
            [window, window.connect('size-changed', update)],
            [actor, actor.connect('notify::allocation', update)],
            [actor, actor.connect('destroy', () => this._rounded.delete(actor))],
        ];
        this._rounded.set(actor, {effect, ids});
        update();
        return true;
    }

    destroy() {
        for (const [actor, {effect, ids}] of this._rounded) {
            ids.forEach(([object, id]) => object.disconnect(id));
            actor.remove_effect(effect);
        }
        this._rounded.clear();
    }
}
