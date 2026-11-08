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
        export default {
            _promisify() {},
            Cancellable,
            Subprocess,
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
