export type AttributionListener = (attributions: readonly string[]) => void;

/**
 * Tracks the copyright sources of the content currently presented, as required by data providers such as Google.
 * Sources are ordered by the number of presented contents that cite them, then alphabetically.
 */
export class CopyrightAttributions {
    private readonly entries = new Map<string, readonly string[]>();
    private readonly listeners = new Set<AttributionListener>();
    private ordered: readonly string[] = [];

    /** Ordered attributions of the presented content. */
    public get current(): readonly string[] {
        return this.ordered;
    }

    /** Calls the listener with the current attributions, then on every change. Returns the unsubscribe function. */
    public subscribe(listener: AttributionListener): () => void {
        this.listeners.add(listener);
        listener(this.ordered);
        return () => this.listeners.delete(listener);
    }

    public attach(contentId: string, copyrights: readonly string[]): void {
        this.entries.set(contentId, copyrights);
        this.publish();
    }

    public detach(contentId: string): void {
        if (this.entries.delete(contentId)) this.publish();
    }

    public clear(): void {
        this.entries.clear();
        this.publish();
    }

    private publish(): void {
        const counts = new Map<string, number>();
        for (const entries of this.entries.values()) {
            for (const entry of entries) counts.set(entry, (counts.get(entry) ?? 0) + 1);
        }
        const ordered = [...counts.entries()]
            .sort(([left, leftCount], [right, rightCount]) => rightCount - leftCount || left.localeCompare(right))
            .map(([entry]) => entry);
        if (ordered.length === this.ordered.length && ordered.every((entry, index) => entry === this.ordered[index])) return;
        this.ordered = ordered;
        for (const listener of this.listeners) listener(ordered);
    }
}
