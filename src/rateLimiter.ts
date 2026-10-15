/**
 * Space requests out so that no more than a configured number are started each
 * second.
 *
 * Acquisitions are granted in call order, each one at least
 * `1000 / requestsPerSecond` milliseconds after the previous one. This keeps a
 * burst of concurrent requests (such as the matrix fan-out) from hitting the
 * endpoint all at once and tripping its anti-bot rate limiting.
 */
export class RateLimiter {
    readonly #intervalMs: number;
    #nextStart = 0;
    #queue: Promise<void> = Promise.resolve();

    /**
     * @param requestsPerSecond Maximum number of requests to start per second.
     * @throws {Error} If the rate is not a positive, finite number.
     */
    constructor(requestsPerSecond: number) {
        if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
            throw new Error(`Invalid requests per second: ${requestsPerSecond}`);
        }
        this.#intervalMs = 1000 / requestsPerSecond;
    }

    /**
     * Wait for the next request slot.
     *
     * @returns A promise that resolves once the caller may start its request.
     */
    acquire(): Promise<void> {
        const slot = this.#queue.then(() => this.#waitForSlot());
        this.#queue = slot;
        return slot;
    }

    async #waitForSlot(): Promise<void> {
        const wait = this.#nextStart - Date.now();
        if (wait > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, wait));
        }
        this.#nextStart = Date.now() + this.#intervalMs;
    }
}
