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
        // A minimal actor tree for touch mode: children, style classes, heights.
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
            has_style_class_name(name) { return (this.style_class ?? '').split(' ').includes(name); }
            set_height(height) { this.height = height; }
            get_preferred_height() { return [0, this.natural ?? 30]; }
            connect(signal, handler) { (this.handlers[signal] ??= []).push(handler); return signal + this.handlers[signal].length; }
            disconnect() {}
            emit(signal, ...args) { (this.handlers[signal] ?? []).forEach(h => h(this, ...args)); }
            destroy() { this.destroyed = true; this.parent?.remove_child(this); }  // As Clutter does
        }
        class Button extends Actor {}
        class Icon extends Actor {}
        class BoxLayout extends Actor {}
        const theme = {loaded: [], load_stylesheet(f) { this.loaded.push(f); }, unload_stylesheet(f) { this.loaded = this.loaded.filter(x => x !== f); }};
        globalThis.__theme = theme;
        const ThemeContext = {get_for_stage: () => ({get_theme: () => theme})};
        export default {Widget, Actor, Button, Icon, BoxLayout, ThemeContext, Side: {TOP: 0, RIGHT: 1, BOTTOM: 2, LEFT: 3}};`,
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
            FileTest: {IS_EXECUTABLE: 1, IS_DIR: 2},
            find_program_in_path: name => globalThis.__programs[name] ?? null,
            file_test: path => Boolean(globalThis.__files[path]),
            get_user_data_dir: () => '/home/user/.local/share',
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
        class ThemedIcon { constructor(props) { Object.assign(this, props); } }
        export default {
            _promisify() {},
            Cancellable,
            Subprocess,
            ThemedIcon,
            DesktopAppInfo: {new: () => null},
            SubprocessFlags: {NONE: 0, STDOUT_SILENCE: 1, STDERR_SILENCE: 2},
            IOErrorEnum: {CANCELLED: 19},
            File: {new_for_path: () => ({
                load_contents_async: async () => [new TextEncoder().encode(JSON.stringify(globalThis.__buildInfo))],
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
