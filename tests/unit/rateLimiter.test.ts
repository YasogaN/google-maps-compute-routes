import { afterEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../src/rateLimiter.js";

describe("RateLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a non-finite rate", () => {
    expect(() => new RateLimiter(Number.POSITIVE_INFINITY)).toThrow(/Invalid requests per second/);
    expect(() => new RateLimiter(Number.NaN)).toThrow(/Invalid requests per second/);
  });

  it("rejects a non-positive rate", () => {
    expect(() => new RateLimiter(0)).toThrow(/Invalid requests per second/);
    expect(() => new RateLimiter(-1)).toThrow(/Invalid requests per second/);
  });

  it("lets the first request through immediately", async () => {
    const limiter = new RateLimiter(1);

    await expect(limiter.acquire()).resolves.toBeUndefined();
  });

  it("spaces requests by the configured interval in call order", async () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(2);
    const started: number[] = [];

    const first = limiter.acquire().then(() => started.push(1));
    const second = limiter.acquire().then(() => started.push(2));
    const third = limiter.acquire().then(() => started.push(3));

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual([1]);

    await vi.advanceTimersByTimeAsync(500);
    expect(started).toEqual([1, 2]);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([first, second, third]);
    expect(started).toEqual([1, 2, 3]);
  });
});
