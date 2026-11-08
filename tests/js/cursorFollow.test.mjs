// cursorFollow.test.mjs — unit tests of feature/cursorFollow.js with a fake
// BoxPointer. Run: node --import ./tests/js/register.mjs --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const {CursorFollow} = await import('../../feature/cursorFollow.js');

const TOP = 0, LEFT = 3;
globalThis.global = {get_pointer: () => [400, 300]};

function fakeBoxPointer() {
    const handlers = {};
    const box = {
        _userArrowSide: TOP, _arrowSide: TOP, calls: [],
        setPosition(actor, alignment) { this.calls.push({actor, alignment}); },
        connect(signal, handler) { handlers[signal] = handler; return 1; },
        disconnect() {},
        emitDestroy() { handlers.destroy?.(); },
    };
    box.originalSetPosition = box.setPosition;
    return box;
}
const settings = on => ({get_boolean: () => on});

test('setting off: the original is called with the original arguments', () => {
    const box = fakeBoxPointer();
    const hook = new CursorFollow({_boxPointer: box}, settings(false));
    box.setPosition('icon', 0.5);
    assert.deepEqual(box.calls, [{actor: 'icon', alignment: 0.5}]);
    assert.equal(box._userArrowSide, TOP);
    hook.destroy();
});

test('setting on: points at the anchor at the pointer, from the left, bottom-aligned', () => {
    const box = fakeBoxPointer();
    const hook = new CursorFollow({_boxPointer: box}, settings(true));
    box.setPosition('icon', 0.5);
    const [call] = box.calls;
    assert.notEqual(call.actor, 'icon');
    assert.deepEqual([call.actor.x, call.actor.y], [400, 300]);
    assert.equal(call.alignment, 1.0);
    assert.equal(box._userArrowSide, LEFT);
    hook.destroy();
});

test('cleanup restores the original method, the arrow side and removes the anchor', () => {
    const box = fakeBoxPointer();
    const hook = new CursorFollow({_boxPointer: box}, settings(true));
    box.setPosition('icon', 0.5);
    hook.destroy();
    assert.equal(box.setPosition, box.originalSetPosition);
    assert.equal(box._userArrowSide, TOP);
    assert.equal(globalThis.__uiGroup.size, 0);
});

test('cleanup keeps a wrapper another extension added later, which then passes through', () => {
    const box = fakeBoxPointer();
    const hook = new CursorFollow({_boxPointer: box}, settings(true));
    const ours = box.setPosition;
    const theirs = (actor, alignment) => ours(actor, alignment);
    box.setPosition = theirs;
    hook.destroy();
    assert.equal(box.setPosition, theirs);
    box.setPosition('icon', 0.5);
    assert.deepEqual(box.calls.at(-1), {actor: 'icon', alignment: 0.5});
});

test('no usable BoxPointer: inactive, nothing changed', () => {
    const hook = new CursorFollow({}, settings(true));
    assert.equal(hook.active, false);
    hook.destroy();
});

test('BoxPointer destroyed first: cleanup does not touch it', () => {
    const box = fakeBoxPointer();
    const hook = new CursorFollow({_boxPointer: box}, settings(true));
    box.emitDestroy();
    assert.equal(hook.active, false);
    box._userArrowSide = 'untouched';
    hook.destroy();
    assert.equal(box._userArrowSide, 'untouched');
});

test('switching the setting off between two opens restores panel placement at once', () => {
    const box = fakeBoxPointer();
    let on = true;
    const hook = new CursorFollow({_boxPointer: box}, {get_boolean: () => on});
    box.setPosition('icon', 0.5);
    assert.equal(box._userArrowSide, LEFT);
    on = false;
    box.setPosition('icon', 0.5);
    assert.deepEqual(box.calls.at(-1), {actor: 'icon', alignment: 0.5});
    assert.equal(box._userArrowSide, TOP);
    assert.equal(box._arrowSide, TOP);
    hook.destroy();
});
