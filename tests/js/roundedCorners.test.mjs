// roundedCorners.test.mjs — unit tests of the rounded corners for the Quick
// Access window, with a stand-in window and actor.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {cornerBounds, CornerRounder, CORNER_RADIUS} = await import('../../feature/roundedCorners.js');

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
    rounder.round(window);
    rounder.round(window);
    assert.equal(actor.effects.length, 1, 'not added twice');
    const [effect] = actor.effects;
    assert.deepEqual(effect.uniforms, {bounds: [0, 0, 550, 412], size: [550, 412], radius: [CORNER_RADIUS]});
    assert.equal(effect.snippets.length, 0, 'the shader is added when GNOME builds the pipeline');
    effect.vfunc_build_pipeline();
    assert.equal(effect.snippets.length, 1);
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
