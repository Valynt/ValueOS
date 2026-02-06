/**
 * @valueos/backend - Public API
 *
 * Backend should be consumed through HTTP as primary boundary.
 * This entrypoint exists for controlled platform-level composition.
 */

export { app, default, server, wss } from "./src/server.js";
