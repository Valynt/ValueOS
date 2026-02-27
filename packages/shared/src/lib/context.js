"use strict";
/**
 * Request Context Storage
 *
 * Uses AsyncLocalStorage to maintain request-scoped context (requestId, tenantId, etc.)
 * across the call stack.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeContext = initializeContext;
exports.runWithContext = runWithContext;
exports.getContext = getContext;
let storage = null;
/**
 * Initialize the context storage (Node.js only)
 */
async function initializeContext() {
    if (typeof window === 'undefined') {
        try {
            const { AsyncLocalStorage } = await Promise.resolve().then(() => __importStar(require('async_hooks')));
            storage = new AsyncLocalStorage();
        }
        catch (err) {
            // We can't log here because of circular dependency with logger
            // console.warn('Failed to initialize AsyncLocalStorage', err);
        }
    }
}
/**
 * Run a function within a context
 */
function runWithContext(context, fn) {
    if (storage) {
        return storage.run(context, fn);
    }
    return fn();
}
/**
 * Get the current context
 */
function getContext() {
    if (storage) {
        return storage.getStore();
    }
    return undefined;
}
//# sourceMappingURL=context.js.map