"use strict";
/**
 * @valueos/agents - Public API
 *
 * Agent runtime and orchestration for ValueOS.
 *
 * ALLOWED CONSUMERS:
 * - packages/backend (to run agents)
 *
 * FORBIDDEN CONSUMERS:
 * - apps/* (frontend)
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Core agent definitions
__exportStar(require("./core/index.js"), exports);
// Multi-agent orchestration
__exportStar(require("./orchestration/index.js"), exports);
// Tool registry and interfaces
__exportStar(require("./tools/index.js"), exports);
// Evaluation and replay
__exportStar(require("./evaluation/index.js"), exports);
//# sourceMappingURL=index.js.map