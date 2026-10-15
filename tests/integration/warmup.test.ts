import { describe, expect, it, vi } from "vitest";
import { WARM_UP_URL, warmUp } from "../../src/warmup.js";

describe("warmUp", () => {
  it("requests the landing page after acquiring a limiter slot", async () => {
    const order: string[] = [];
    const limiter = {
      acquire: vi.fn(async () => {
        order.push("acquire");
      }),
    };
    const client = {
      fetch: vi.fn(async (url: string) => {
        order.push(`fetch:${url}`);
        return { ok: true, status: 200, statusText: "OK", text: async () => "<html></html>" };
      }),
    };

    await warmUp(client as never, limiter as never);

    expect(order).toEqual(["acquire", `fetch:${WARM_UP_URL}`]);
  });

  it("throws when the landing page is not ok", async () => {
    const limiter = { acquire: vi.fn(async () => undefined) };
    const client = {
      fetch: vi.fn(async () => ({ ok: false, status: 429, statusText: "Too Many Requests", text: async () => "" })),
    };

    await expect(warmUp(client as never, limiter as never)).rejects.toThrow(/Failed to warm up: 429/);
  });

  it("sends the navigation headers, not the fetch ones", async () => {
    const limiter = { acquire: vi.fn(async () => undefined) };
    const client = {
      fetch: vi.fn(async (_url: string, _init?: unknown) => ({ ok: true, status: 200, statusText: "OK", text: async () => "<html></html>" })),
    };

    await warmUp(client as never, limiter as never);

    const init = client.fetch.mock.calls[0]![1] as { headers: Record<string, string> };
    expect(init.headers["Sec-Fetch-Dest"]).toBe("document");
    expect(init.headers["Sec-Fetch-Mode"]).toBe("navigate");
    expect(init.headers["Sec-Fetch-Site"]).toBe("none");
    expect(init.headers).not.toHaveProperty("Referer");
  });
});
