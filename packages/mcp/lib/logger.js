/**
 * MCP Logger - Stub implementation
 * TODO: Replace with structured logging library (pino, winston)
 */
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
export const logger = createLogger("mcp");
export default logger;
//# sourceMappingURL=logger.js.map