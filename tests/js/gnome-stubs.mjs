// gnome-stubs.mjs — lets Node load this project's GNOME Shell modules for unit
// tests: gi:// and resource:/// imports resolve to the small stand-ins below.
export async function resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('gi://') || specifier.startsWith('resource:///'))
        return {url: `stub:${specifier}`, shortCircuit: true};
    return nextResolve(specifier, context);
}

const STUBS = {
    'gi://St': `
        // A minimal actor tree: children, style classes, heights.
        class Actor {
            constructor(props = {}) {
                Object.assign(this, props);
                this.children = []; this.height = -1; this.visible = props.visible ?? true; this.handlers = {};
                this.destroyed = false;
            }
            add_child(child) { this.children.push(child); child.parent = this; }
            insert_child_at_index(child, index) { this.children.splice(index, 0, child); child.parent = this; }
            remove_child(child) { this.children = this.children.filter(c => c !== child); child.parent = null; }
            get_children() { return [...this.children]; }
            get_parent() { return this.parent ?? null; }
            has_style_class_name(name) { return (this.style_class ?? '').split(' ').includes(name); }
            add_style_class_name(name) { this.style_class = [this.style_class, name].filter(Boolean).join(' '); }
            remove_style_class_name(name) {
                this.style_class = (this.style_class ?? '').split(' ').filter(c => c && c !== name).join(' ');
            }
            set_height(height) { this.height = height; }
            add_effect_with_name(name, effect) { (this.effects ??= {})[name] = effect; }
            get_effect(name) { return this.effects?.[name] ?? null; }
            remove_effect_by_name(name) { if (this.effects) delete this.effects[name]; }
            get_preferred_height() { return [0, this.natural ?? 30]; }
            connect(signal, handler) { (this.handlers[signal] ??= []).push(handler); return signal + this.handlers[signal].length; }
            disconnect() {}
            emit(signal, ...args) { (this.handlers[signal] ?? []).forEach(h => h(this, ...args)); }
            destroy() { this.destroyed = true; this.parent?.remove_child(this); }  // As Clutter does
        }
        // St.Widget: an actor that can also be placed and is taken out of
        // Main.uiGroup when destroyed.
        class Widget extends Actor {
            constructor(props = {}) { super(props); this.x = 0; this.y = 0; }
            set_position(x, y) { this.x = x; this.y = y; }
            destroy() { super.destroy(); globalThis.__uiGroup?.delete(this); }
        }
        // St.Button: setting label replaces the child with a label, as St does.
        class Button extends Actor {
            set_child(child) { this.child = child; }
            get label() { return this._label; }
            set label(text) { this._label = text; this.child = {text}; }
        }
        class Icon extends Actor {}
        class BoxLayout extends Actor {}
        const theme = {loaded: [], load_stylesheet(f) { this.loaded.push(f); }, unload_stylesheet(f) { this.loaded = this.loaded.filter(x => x !== f); }};
        globalThis.__theme = theme;
        const ThemeContext = {get_for_stage: () => ({get_theme: () => theme})};
        export default {Widget, Actor, Button, Icon, BoxLayout, ThemeContext, Side: {TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3}};`,
    'gi://GObject': `
        export default {registerClass: (meta, klass) => klass ?? meta};`,
    'gi://Cogl': `
        export default {
            SnippetHook: {FRAGMENT: 1},
            Snippet: {new: (hook, declarations, post) => ({hook, declarations, post})},
        };`,
    // As in GNOME Shell 51: no Shell.GLSLEffect.
    'gi://Shell': `
        // AppSystem knows the apps in globalThis.__apps: {desktopId: icon}.
        const AppSystem = {get_default: () => ({
            lookup_app: id => (globalThis.__apps?.[id] ? {get_icon: () => globalThis.__apps[id]} : null),
        })};
        export default {AppSystem, ActionMode: {NORMAL: 1, OVERVIEW: 2, POPUP: 4}};`,
    // As in GNOME Shell 51: Clutter.ShaderEffect with a static snippet and
    // uniforms set by name; records what it is given, so tests can check it.
    'gi://Clutter': `
        class ShaderEffect {
            constructor() { this.uniforms = {}; }
            set_uniform_float(name, components, value) { this.uniforms[name] = value; }
            queue_repaint() {}
        }
        // As GJS does on GNOME 51: looking up the unimplemented virtual
        // function on ShaderEffect itself throws.
        Object.defineProperty(ShaderEffect.prototype, 'vfunc_get_static_snippet', {
            configurable: true,
            get() {
                throw new Error("Virtual function not implemented: Class ClutterShaderEffect doesn't implement get_static_snippet");
            },
        });
        class BinLayout {}
        class DesaturateEffect { constructor(props) { Object.assign(this, props); } }
        export default {
            ShaderEffect, BinLayout, DesaturateEffect,
            ActorAlign: {FILL: 0, START: 1, CENTER: 2, END: 3},
            EventType: {MOTION: 3, LEAVE: 5, SCROLL: 9, BUTTON_PRESS: 6},
            PickMode: {REACTIVE: 1},
            EVENT_PROPAGATE: false,
        };`,
    'gi://Pango': `
        export default {WrapMode: {WORD_CHAR: 2}, EllipsizeMode: {NONE: 0, END: 3}};`,
    'resource:///org/gnome/shell/ui/popupMenu.js': `
        import St from 'gi://St';
        export class PopupBaseMenuItem extends St.Actor {}`,
    'resource:///org/gnome/shell/ui/main.js': `
        globalThis.__uiGroup = new Set();
        globalThis.__notifications = [];
        export const uiGroup = {add_child: actor => globalThis.__uiGroup.add(actor)};
        export const notify = (title, body) => globalThis.__notifications.push({title, body});`,
    'resource:///org/gnome/shell/misc/config.js': `
        export const PACKAGE_VERSION = '51.1';`,
    // Timers run only when a test calls globalThis.__runTimers().
    'gi://GLib': `
        const timers = new Map();
        let nextId = 1;
        globalThis.__runTimers = () => {
            const due = [...timers.entries()];
            timers.clear();
            for (const [, callback] of due) callback();
            return due.length;
        };
        globalThis.__timerDelays = () => [...timers.keys()].map(id => globalThis.__delays[id]);
        globalThis.__delays = {};
        globalThis.__programs = {};
        globalThis.__files = {};
        export default {
            PRIORITY_LOW: 300, PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
            FileTest: {IS_EXECUTABLE: 1, IS_DIR: 2, EXISTS: 4},
            find_program_in_path: name => globalThis.__programs[name] ?? null,
            // __files: paths that exist; __fs: an in-memory file system with
            // contents, for clearing the history at login.
            file_test: path => Boolean(globalThis.__files[path]) || path in (globalThis.__fs ?? {}),
            get_user_runtime_dir: () => '/run/user/1000',
            mkdir_with_parents: () => 0,
            file_set_contents: (path, text) => { globalThis.__fs[path] = String(text); return true; },
            file_get_contents: path => [true, new TextEncoder().encode(globalThis.__fs[path])],
            unlink: path => { delete globalThis.__fs[path]; return 0; },
            get_user_data_dir: () => '/home/user/.local/share',
            get_user_cache_dir: () => '/home/user/.cache',
            timeout_add_seconds(priority, seconds, callback) {
                const id = nextId++; timers.set(id, callback); globalThis.__delays[id] = seconds; return id;
            },
            source_remove(id) { timers.delete(id); },
            get_real_time: () => globalThis.__now * 1e6,
            build_filenamev: parts => parts.join('/'),
        };`,
    'gi://Gio': `
        class Cancellable {
            constructor() { this.cancelled = false; }
            cancel() { this.cancelled = true; }
            is_cancelled() { return this.cancelled; }
        }
        // Subprocess: pgrep "finds" 1Password when globalThis.__running is true.
        class Subprocess {
            static new(argv) { return new Subprocess(argv); }
            constructor(argv) { this.argv = argv; }
            async wait_check_async() {
                if (this.argv[0] === 'pgrep' && !globalThis.__running)
                    throw new Error('exit status 1');
                return true;
            }
        }
        class ThemedIcon {
            constructor(props) { Object.assign(this, props); }
            static new_from_names(names) { return new ThemedIcon({names}); }
        }
        export default {
            _promisify() {},
            Cancellable,
            Subprocess,
            ThemedIcon,
            DesktopAppInfo: {new: () => null},
            SubprocessFlags: {NONE: 0, STDOUT_SILENCE: 1, STDERR_SILENCE: 2},
            IOErrorEnum: {CANCELLED: 19},
            FileQueryInfoFlags: {NOFOLLOW_SYMLINKS: 1},
            // Files: build-info.json for the update notifier; folders with a
            // mode in globalThis.__modes for the private history folder.
            File: {new_for_path: path => ({
                load_contents_async: async () => [new TextEncoder().encode(JSON.stringify(globalThis.__buildInfo))],
                query_exists: () => path in (globalThis.__modes ?? {}),
                set_attribute_uint32: (name, value) => { globalThis.__modes[path] = value; },
            })},
        };`,
    // Requests wait until the test answers them with globalThis.__answer(urlPart, json).
    'gi://Soup?version=3.0': `
        globalThis.__pending = [];
        globalThis.__answer = (urlPart, json, status = 200) => {
            const index = globalThis.__pending.findIndex(r => r.message.url.includes(urlPart));
            const [request] = globalThis.__pending.splice(index, 1);
            request.message.status = status;
            request.finish(json);
        };
        class Session {
            send_and_read_async(message, priority, cancellable) {
                return new Promise((resolve, reject) => {
                    globalThis.__pending.push({message, finish: json => {
                        if (cancellable.is_cancelled())
                            reject(Object.assign(new Error('cancelled'), {matches: () => true}));
                        else
                            resolve({get_data: () => new TextEncoder().encode(JSON.stringify(json))});
                    }});
                });
            }
            abort() {}
        }
        export default {
            Session,
            Message: {new: (method, url) => ({url, status: 0, get_status() { return this.status; }})},
            Status: {OK: 200},
        };`,
};

export async function load(url, context, nextLoad) {
    if (url.startsWith('stub:'))
        return {format: 'module', source: STUBS[url.slice(5)] ?? 'export default {};', shortCircuit: true};
    return nextLoad(url, context);
}
