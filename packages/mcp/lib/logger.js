"use strict";
/**
 * MCP Logger - Stub implementation
 * TODO: Replace with structured logging library (pino, winston)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const createLogger = (name) => ({
    info: (message, context) => {
        console.info(`[${name}] ${message}`, context || "");
    },
    warn: (message, context) => {
        console.warn(`[${name}] ${message}`, context || "");
    },
    error: (message, context) => {
        console.error(`[${name}] ${message}`, context || "");
    },
    debug: (message, context) => {
        if (process.env.DEBUG) {
            console.debug(`[${name}] ${message}`, context || "");
        }
    },
});
exports.logger = createLogger("mcp");
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map