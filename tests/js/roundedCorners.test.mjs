// roundedCorners.test.mjs — unit tests of the rounded corners for the Quick
// Access window, with a stand-in window and actor.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// Importing must work on GNOME Shell 51, which has no Shell.GLSLEffect (the
// stand-ins mirror 51); this failed once and took the 1Password integration down.
const {cornerBounds, shaderApi, CornerRounder, CORNER_RADIUS, PANEL_CORNER_RADIUS} =
    await import('../../feature/roundedCorners.js');

test('shader API: Clutter snippet on 51, Shell.GLSLEffect before, none otherwise', () => {
    class ShaderEffect51 { set_uniform_float() {} }
    Object.defineProperty(ShaderEffect51.prototype, 'vfunc_get_static_snippet', {
        get() { throw new Error('Virtual function not implemented'); },
    });
    const clutter51 = {ShaderEffect: ShaderEffect51};
    const clutterOld = {ShaderEffect: class { set_uniform_value() {} }};
    const shellOld = {GLSLEffect: class {}};
    assert.equal(shaderApi({}, clutter51), 'clutter-snippet');
    assert.equal(shaderApi(shellOld, clutter51), 'clutter-snippet');
    assert.equal(shaderApi(shellOld, clutterOld), 'shell-glsl');
    assert.equal(shaderApi({}, clutterOld), null);
    assert.equal(shaderApi(undefined, undefined), null);
});

test('bounds: the frame inside the actor, which may include invisible borders', () => {
    assert.deepEqual(cornerBounds({x: 110, y: 220, width: 550, height: 412}, {x: 100, y: 200, width: 570, height: 452}),
        [10, 20, 560, 432]);
    assert.deepEqual(cornerBounds({x: 0, y: 0, width: 550, height: 412}, {x: 0, y: 0, width: 550, height: 412}),
        [0, 0, 550, 412]);
});

function fakeWindow() {
    const handlers = {};
    const connect = (target, signal, handler) => { (target.handlers[signal] ??= []).push(handler); return signal; };
    const actor = {width: 550, height: 412, effects: [], handlers: {},
        add_effect_with_name(name, effect) { this.effects.push(effect); },
        remove_effect(effect) { this.effects = this.effects.filter(e => e !== effect); },
        connect(signal, handler) { return connect(this, signal, handler); }, disconnect() {}};
    const window = {handlers,
        get_compositor_private: () => actor,
        get_frame_rect: () => ({x: 0, y: 0, width: 550, height: 412}),
        get_buffer_rect: () => ({x: 0, y: 0, width: 550, height: 412}),
        connect(signal, handler) { return connect(this, signal, handler); }, disconnect() {}};
    return {window, actor};
}

test('rounding adds one effect with the frame, size and radius, and destroy removes it', () => {
    const {window, actor} = fakeWindow();
    const rounder = new CornerRounder();
    assert.equal(rounder.round(window), true);
    rounder.round(window);
    assert.equal(actor.effects.length, 1, 'not added twice');
    const [effect] = actor.effects;
    assert.deepEqual(effect.uniforms, {bounds: [0, 0, 550, 412], size: [550, 412], radius: [CORNER_RADIUS]});
    const snippet = effect.vfunc_get_static_snippet();
    assert.match(snippet.declarations, /rounded_corner_alpha/);
    assert.match(snippet.post, /cogl_color_out \*= rounded_corner_alpha/);
    rounder.destroy();
    assert.equal(actor.effects.length, 0);
});

test('the effect follows size changes', () => {
    const {window, actor} = fakeWindow();
    const rounder = new CornerRounder();
    rounder.round(window);
    actor.width = 600;
    window.handlers['size-changed'].forEach(h => h());
    assert.deepEqual(actor.effects[0].uniforms.size, [600, 412]);
    rounder.destroy();
});

test('the panel radius in largeSpacing.css matches PANEL_CORNER_RADIUS, on both boxes', async () => {
    const {readFile} = await import('node:fs/promises');
    const css = await readFile(new URL('../../feature/largeSpacing.css', import.meta.url), 'utf8');
    const [, outer] = css.match(/-arrow-border-radius:\s*(\d+)px/);
    const [, inner] = css.match(/\.popup-menu-content\.greedy-large-spacing\s*\{\s*border-radius:\s*(\d+)px/);
    assert.equal(Number(outer), PANEL_CORNER_RADIUS);
    assert.equal(Number(inner), PANEL_CORNER_RADIUS);
});

test('Quick Access gets a slightly larger radius than the panel, so both look the same', () => {
    assert.ok(CORNER_RADIUS > PANEL_CORNER_RADIUS && CORNER_RADIUS - PANEL_CORNER_RADIUS <= 5);
});
