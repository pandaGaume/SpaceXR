export class DebugTouchConsole {
    private container: HTMLDivElement;
    private touchMap = new Map<number, HTMLDivElement>();
    private logBox: HTMLDivElement;

    constructor() {
        this.container = document.createElement("div");
        this.container.style.pointerEvents = "none";
        this.container.style.position = "fixed";
        this.container.style.top = "0";
        this.container.style.left = "0";
        this.container.style.right = "0";
        this.container.style.bottom = "0";
        this.container.style.pointerEvents = "none";
        this.container.style.zIndex = "99999";
        document.body.appendChild(this.container);

        this.logBox = document.createElement("div");
        Object.assign(this.logBox.style, {
            position: "fixed",
            bottom: "0",
            left: "0",
            right: "0",
            maxHeight: "35vh",
            overflowY: "auto",
            background: "rgba(0,0,0,0.8)",
            color: "#0f0",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "4px",
            whiteSpace: "pre-wrap",
        });
        this.container.appendChild(this.logBox);

        this._hookConsole();
        this._hookPointerEvents();
    }

    public dispose(): void {
        this._unhookConsole();
        this.container.remove();
    }

    private _hookPointerEvents(): void {
        window.addEventListener("pointerdown", this._onDown, { passive: true });
        window.addEventListener("pointermove", this._onMove, { passive: true });
        window.addEventListener("pointerup", this._onUp, { passive: true });
        window.addEventListener("pointercancel", this._onCancel, { passive: true });
    }

    private _onDown = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        const dot = this._createOrGetDot(e.pointerId);
        this._updateDot(dot, e.clientX, e.clientY, `↓${e.pointerId}`);
    };

    private _onMove = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        const dot = this._createOrGetDot(e.pointerId);
        this._updateDot(dot, e.clientX, e.clientY, `${e.pointerId}`);
    };

    private _onUp = (e: PointerEvent) => {
        if (e.pointerType !== "touch") return;
        const dot = this._createOrGetDot(e.pointerId);
        this._updateDot(dot, e.clientX, e.clientY, `↑${e.pointerId}`);
        setTimeout(() => this._removeDot(e.pointerId), 500);
    };

    private _onCancel = (e: PointerEvent) => {
        this._removeDot(e.pointerId);
    };

    private _createOrGetDot(id: number): HTMLDivElement {
        if (this.touchMap.has(id)) return this.touchMap.get(id)!;

        const el = document.createElement("div");
        el.style.position = "fixed";
        el.style.width = "30px";
        el.style.height = "30px";
        el.style.borderRadius = "50%";
        el.style.background = "rgba(255,0,0,0.5)";
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.justifyContent = "center";
        el.style.color = "white";
        el.style.fontSize = "10px";
        el.style.pointerEvents = "none";
        el.style.transform = "translate(-50%, -50%)";
        this.container.appendChild(el);
        this.touchMap.set(id, el);
        return el;
    }

    private _updateDot(dot: HTMLDivElement, x: number, y: number, label: string) {
        dot.style.left = `${x}px`;
        dot.style.top = `${y}px`;
        dot.textContent = label;
    }

    private _removeDot(id: number) {
        const el = this.touchMap.get(id);
        if (el) {
            el.remove();
            this.touchMap.delete(id);
        }
    }

    private _hookConsole() {
        const original = {
            log: console.log,
            warn: console.warn,
            error: console.error,
        };

        const append = (prefix: string, ...args: any[]) => {
            const line = `[${prefix}] ` + args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ") + "\n";
            this.logBox.textContent += line;
            this.logBox.scrollTop = this.logBox.scrollHeight;
        };

        console.log = (...args) => {
            append("log", ...args);
            original.log(...args);
        };
        console.warn = (...args) => {
            append("warn", ...args);
            original.warn(...args);
        };
        console.error = (...args) => {
            append("error", ...args);
            original.error(...args);
        };

        (window as any).__debugConsoleRestore__ = () => {
            console.log = original.log;
            console.warn = original.warn;
            console.error = original.error;
        };
    }

    private _unhookConsole() {
        if ((window as any).__debugConsoleRestore__) {
            (window as any).__debugConsoleRestore__();
        }
    }
}
