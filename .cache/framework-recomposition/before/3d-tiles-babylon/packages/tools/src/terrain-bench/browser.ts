import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

/** Chrome or Chromium: the given path, `CHROME_PATH`, then the usual locations. */
export function findBrowser(path?: string): string {
    const candidates = [
        path,
        process.env.CHROME_PATH,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ];
    const found = candidates.find((candidate) => candidate && existsSync(candidate));
    if (!found) throw new Error("No browser found: pass --browser.");
    return found;
}

/** A minimal Chrome DevTools connection. */
export class Devtools {
    private nextId = 1;
    private readonly pending = new Map<number, { resolve: (value: never) => void; reject: (reason: Error) => void }>();
    public onEvent: ((message: { method: string; params: never; sessionId?: string }) => void) | undefined;

    private constructor(private readonly socket: WebSocket) {
        socket.onmessage = (event: MessageEvent) => {
            const message = JSON.parse(String(event.data));
            const waiting = this.pending.get(message.id);
            if (waiting) {
                this.pending.delete(message.id);
                if (message.error) waiting.reject(new Error(JSON.stringify(message.error)));
                else waiting.resolve(message.result as never);
            } else this.onEvent?.(message);
        };
    }

    public static async connect(url: string): Promise<Devtools> {
        const socket = new WebSocket(url);
        await new Promise((resolve, reject) => {
            socket.onopen = resolve;
            socket.onerror = reject;
        });
        return new Devtools(socket);
    }

    public send<T>(method: string, params: object = {}, sessionId?: string): Promise<T> {
        const id = this.nextId++;
        return new Promise<T>((resolve, reject) => {
            this.pending.set(id, { resolve: resolve as (value: never) => void, reject });
            this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
    }
}

export const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Starts a headless browser on the GPU of the machine.
 *
 * @param flags - More command line flags, such as those that enable WebGPU.
 */
export async function startBrowser(
    path: string,
    port: number,
    profile: string,
    flags: readonly string[] = [],
): Promise<{ devtools: Devtools; stop: () => void }> {
    const browser = spawn(
        path,
        [
            "--headless=new",
            `--remote-debugging-port=${port}`,
            `--user-data-dir=${profile}`,
            "--window-size=1200,860",
            "--force-device-scale-factor=1",
            "--use-angle=d3d11",
            "--ignore-gpu-blocklist",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
            "--no-first-run",
            ...flags,
            "about:blank",
        ],
        { stdio: "ignore" },
    );
    const stop = (): void => {
        try {
            if (process.platform === "win32") execSync(`taskkill /PID ${browser.pid} /T /F`, { stdio: "ignore" });
            else browser.kill();
        } catch {
            // Already gone.
        }
    };
    for (let attempt = 0; attempt < 50; attempt++) {
        await sleep(200);
        const version = await fetch(`http://127.0.0.1:${port}/json/version`)
            .then((response) => response.json() as Promise<{ webSocketDebuggerUrl: string }>)
            .catch(() => undefined);
        if (version) return { devtools: await Devtools.connect(version.webSocketDebuggerUrl), stop };
    }
    stop();
    throw new Error("The browser did not start.");
}

/** A page of the example, open in the browser. */
export interface IExamplePage {
    evaluate: <T>(expression: string) => Promise<T>;
    tileRequests: () => number;
    tileUrls: () => string[];
    screenshot: (file: string) => Promise<void>;
    /** The whole viewport, as PNG bytes. */
    capture: () => Promise<Buffer>;
    loadSeconds: number;
    close: () => Promise<void>;
}

/**
 * Opens a page and waits until its terrain has settled.
 *
 * @param probe - Script evaluated in the page once it settled.
 * @param warnings - Receives the warnings of the console, such as the WebGPU validation errors Babylon.js logs.
 */
export async function openPage(
    devtools: Devtools,
    url: string,
    probe: string | undefined,
    errors: string[],
    maxRequests: number,
    warnings?: string[],
): Promise<IExamplePage> {
    const { targetId } = await devtools.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await devtools.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    await devtools.send("Page.enable", {}, sessionId);
    await devtools.send("Runtime.enable", {}, sessionId);
    await devtools.send("Network.enable", {}, sessionId);
    // What leaves the page for its tile servers: everything but the application itself.
    const origin = new URL(url).origin;
    let tileRequests = 0;
    const tileUrls = new Set<string>();
    devtools.onEvent = (message) => {
        if (message.sessionId !== sessionId) return;
        const params = message.params as {
            exceptionDetails?: { text: string; exception?: { description?: string } };
            type?: string;
            args?: { value?: string; description?: string }[];
            request?: { url: string };
        };
        if (
            message.method === "Network.requestWillBeSent" &&
            params.request?.url.startsWith("http") &&
            !params.request.url.startsWith(origin)
        ) {
            tileRequests++;
            tileUrls.add(params.request.url);
            if (tileRequests === maxRequests) {
                errors.push(`Tile servers blocked after ${maxRequests} requests`);
                const hosts = new Set([...tileUrls].map((address) => new URL(address).host));
                void devtools.send("Network.setBlockedURLs", { urls: [...hosts].map((host) => `*://${host}/*`) }, sessionId);
            }
        }
        if (message.method === "Runtime.exceptionThrown")
            errors.push(String(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text).slice(0, 300));
        if (message.method === "Runtime.consoleAPICalled" && (params.type === "error" || params.type === "warning")) {
            const text = (params.args ?? [])
                .map((a) => a.value ?? a.description)
                .join(" ")
                .slice(0, 300);
            if (params.type === "error") errors.push(text);
            else warnings?.push(text);
        }
    };
    const opening = Date.now();
    await devtools.send("Page.navigate", { url }, sessionId);
    const evaluate = async <T>(expression: string): Promise<T> => {
        const result = await devtools.send<{ result: { value: T }; exceptionDetails?: unknown }>(
            "Runtime.evaluate",
            { expression, returnByValue: true, awaitPromise: true },
            sessionId,
        );
        if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 600));
        return result.result.value;
    };
    // A page that has not started loading also reads 0 pending: wait for selected tiles, and for it to last.
    let quietChecks = 0;
    for (let attempt = 0; attempt < 120 && quietChecks < 3; attempt++) {
        await sleep(500);
        const quiet = await evaluate<boolean>(
            `(() => {
                const text = document.getElementById('runtime-statistics')?.textContent ?? '';
                return !!window.__SPACEXR_EXAMPLE__ && Number((text.match(/Tiles (\\d+)\\//) ?? [])[1] ?? 0) > 0 && (text.match(/(\\d+) pending/) ?? [])[1] === '0';
            })()`,
        );
        quietChecks = quiet ? quietChecks + 1 : 0;
    }
    const loadSeconds = Math.round((Date.now() - opening) / 100) / 10;
    await sleep(1500);
    if (probe) await evaluate(probe);
    const capture = async (clip?: object): Promise<Buffer> => {
        const { data } = await devtools.send<{ data: string }>(
            "Page.captureScreenshot",
            { format: "png", ...(clip ? { clip } : {}) },
            sessionId,
        );
        return Buffer.from(data, "base64");
    };
    return {
        evaluate,
        tileRequests: () => tileRequests,
        tileUrls: () => [...tileUrls],
        screenshot: async (file: string) => writeFileSync(file, await capture({ x: 0, y: 230, width: 1180, height: 500, scale: 1 })),
        capture: () => capture(),
        loadSeconds,
        close: () => devtools.send("Target.closeTarget", { targetId }),
    };
}
