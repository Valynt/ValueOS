/**
 * Re-export ESOModule from StructuralTruthModule.
 *
 * The ESOModule class lives in StructuralTruthModule.ts.
 * This file exists so that `@mcp/ground-truth/modules/ESOModule`
 * resolves for consumers that import by class name.
 */
export { ESOModule } from "./StructuralTruthModule";
