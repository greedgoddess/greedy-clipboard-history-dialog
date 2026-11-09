// gestures.test.mjs — unit tests of the gestures: recognising a three-finger
// tap, when a touchpad hold counts, and the blocklist.
// Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {TapDetector, holdCounts, isBlocked} = await import('../../feature/gestures.js');

function tap(touches, {liftAt = 120, moveBy = 0} = {}) {
    const detector = new TapDetector();
    touches.forEach(([id, x, y, t]) => detector.begin(id, x, y, t));
    if (moveBy)
        detector.update(touches[0][0], touches[0][1] + moveBy, touches[0][2]);
    let result = null;
    touches.forEach(([id], i) => { result = detector.end(id, liftAt + i * 10) ?? result; });
    return result;
}

const three = [['a', 100, 100, 0], ['b', 200, 100, 30], ['c', 150, 190, 60]];

test('tap: three fingers landing together and lifting quickly; anchor at their center', () => {
    assert.deepEqual(tap(three), {x: 150, y: 130});
});

test('tap: not with two or four fingers', () => {
    assert.equal(tap(three.slice(0, 2)), null);
    assert.equal(tap([...three, ['d', 300, 300, 70]]), null);
});

test('tap: not when the fingers land too far apart in time, or rest too long', () => {
    assert.equal(tap([['a', 100, 100, 0], ['b', 200, 100, 30], ['c', 150, 190, 400]], {liftAt: 450}), null);
    assert.equal(tap(three, {liftAt: 900}), null);
});

test('tap: not when a finger moves (a swipe)', () => {
    assert.equal(tap(three, {moveBy: 60}), null);
});

test('tap: a cancelled touch spoils it; the next tap works again', () => {
    const detector = new TapDetector();
    three.forEach(([id, x, y, t]) => detector.begin(id, x, y, t));
    detector.cancel('a');
    assert.equal(detector.end('b', 100), null);
    assert.equal(detector.end('c', 110), null);
    assert.deepEqual(tap(three), {x: 150, y: 130});
});

test('hold: three fingers resting long enough and lifting normally', () => {
    assert.equal(holdCounts(3, 1000, 1400, false), true);
    assert.equal(holdCounts(3, 1000, 1100, false), false, 'too short');
    assert.equal(holdCounts(3, 1000, 1400, true), false, 'cancelled, for example into a swipe');
    assert.equal(holdCounts(2, 1000, 1400, false), false);
    assert.equal(holdCounts(3, null, 1400, false), false, 'began with another finger count');
});

test('blocklist: app IDs with or without .desktop and window classes, without regard to case', () => {
    const list = ['org.kde.krita', 'gimp', 'com.github.flxzt.rnote'];
    assert.equal(isBlocked(list, ['org.kde.krita.desktop']), true);
    assert.equal(isBlocked(list, ['org.gimp.GIMP.desktop', 'Gimp']), true, 'by window class');
    assert.equal(isBlocked(list, ['com.github.flxzt.rnote']), true, 'sandboxed app ID');
    assert.equal(isBlocked(list, ['org.gnome.TextEditor.desktop', 'gnome-text-editor']), false);
    assert.equal(isBlocked([], ['org.kde.krita.desktop']), false);
    assert.equal(isBlocked(list, []), false, 'nothing in focus');
});
