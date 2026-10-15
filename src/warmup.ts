import type { Impit } from "impit";
import type { RateLimiter } from "./rateLimiter.js";

/**
 * Landing page that seeds the session cookies the directions endpoint expects.
 *
 * Google answers it with a 302 chain (`maps.google.com/` -> `maps.google.com/maps`
 * -> `www.google.com/maps`) that issues `NID`, `AEC`, `SEARCH_SAMESITE` and the
 * short-lived `__Secure-STRP`. impit follows the chain and stores every
 * `Set-Cookie` in the client's cookie jar, which later requests then send.
 */
export const WARM_UP_URL = "https://maps.google.com/";

/**
 * Prime the cookie jar with a Google session before issuing route requests.
 *
 * The request goes through the limiter like any other and its body is drained so
 * the connection can be reused. A non-ok response means the preflight failed and
 * the route request would likely be rejected too, so it throws.
 *
 * @param client  The HTTP client whose cookie jar is being primed.
 * @param limiter Rate limiter gating when the request may start.
 * @throws {Error} If the landing page responds with a non-ok status.
 */
export async function warmUp(client: Impit, limiter: RateLimiter): Promise<void> {
    await limiter.acquire();
    const response = await client.fetch(WARM_UP_URL);
    if (!response.ok) {
        throw new Error(`Failed to warm up: ${response.status} ${response.statusText}`);
    }
    await response.text();
}
