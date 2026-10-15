import { Impit } from "impit";
import { CookieJar } from "tough-cookie";
import type { HTTPClient } from "./types.js";

/**
 * User-Agent matching impit's latest impersonated fingerprint, `chrome151`.
 *
 * impit's bare `chrome` alias still resolves to Chrome 124, so the profile is
 * pinned explicitly and the UA is kept in sync with it rather than a stale
 * hand-rolled version.
 */
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

/**
 * Create an HTTP client configured with optional proxy and cookies for scraping.
 *
 * @param options          - Client configuration.
 * @param options.proxy    - Optional proxy settings.
 * @returns A configured `Impit` HTTP client instance.
 */
export function createClient({ proxy }: HTTPClient): Impit {
    return new Impit({
        cookieJar: new CookieJar(),
        browser: "chrome151",
        headers: {
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.google.com/maps/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        },
        ...(proxy && proxy.url && { proxyUrl: proxy.url, ignoreTlsErrors: proxy.tls ?? false })
    });
}
