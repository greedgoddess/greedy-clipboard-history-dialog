// gnome-stubs.mjs — lets Node load this project's GNOME Shell modules for unit
// tests: gi:// and resource:/// imports resolve to the small stand-ins below.
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('gi://') || specifier.startsWith('resource:///'))
        return {url: `stub:${specifier}`, shortCircuit: true};
    return nextResolve(specifier, context);
}

const STUBS = {
    'gi://St': `
        class Widget {
            constructor(props) { Object.assign(this, props); this.x = 0; this.y = 0; this.destroyed = false; }
            set_position(x, y) { this.x = x; this.y = y; }
            destroy() { this.destroyed = true; globalThis.__uiGroup.delete(this); }
        }
        export default {Widget, Side: {TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3}};`,
    'resource:///org/gnome/shell/ui/main.js': `
        globalThis.__uiGroup = new Set();
        export const uiGroup = {add_child: actor => globalThis.__uiGroup.add(actor)};`,
};

export async function load(url, context, nextLoad) {
    if (url.startsWith('stub:'))
        return {format: 'module', source: STUBS[url.slice(5)] ?? 'export default {};', shortCircuit: true};
    return nextLoad(url, context);
}
