/**
 * Fetch globals polyfill for test environments that lack them (vitest@3 / Node 18 without --experimental-fetch).
 * Must be imported BEFORE msw/node to ensure globals are set before @mswjs/interceptors initialises.
 *
 * Listed first in vitest.config.ts setupFiles so it runs before setup.ts.
 */

import { fetch, Headers, Request, Response, ReadableStream } from "undici";

if (typeof globalThis.Response === "undefined") {
  globalThis.Response = Response as unknown as typeof globalThis.Response;
}
if (typeof globalThis.Request === "undefined") {
  globalThis.Request = Request as unknown as typeof globalThis.Request;
}
if (typeof globalThis.Headers === "undefined") {
  globalThis.Headers = Headers as unknown as typeof globalThis.Headers;
}
if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
}
if (typeof globalThis.ReadableStream === "undefined") {
  globalThis.ReadableStream = ReadableStream as unknown as typeof globalThis.ReadableStream;
}
