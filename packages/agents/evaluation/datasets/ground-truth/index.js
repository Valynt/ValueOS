"use strict";
/**
 * Ground Truth Datasets
 *
 * Complete value case scenarios with all artifacts needed to validate
 * the end-to-end HypothesisLoop pipeline. Each scenario includes:
 * - Hypotheses, evidence, value trees, narratives, objections
 * - Confidence scores and provenance records
 * - Expected saga state transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUND_TRUTH_SCENARIOS = exports.healthcareRevenueCycleScenario = exports.manufacturingYieldScenario = exports.saassDsoReductionScenario = void 0;
var saas_dso_reduction_js_1 = require("./saas-dso-reduction.js");
Object.defineProperty(exports, "saassDsoReductionScenario", { enumerable: true, get: function () { return saas_dso_reduction_js_1.saassDsoReductionScenario; } });
var manufacturing_yield_js_1 = require("./manufacturing-yield.js");
Object.defineProperty(exports, "manufacturingYieldScenario", { enumerable: true, get: function () { return manufacturing_yield_js_1.manufacturingYieldScenario; } });
var healthcare_revenue_cycle_js_1 = require("./healthcare-revenue-cycle.js");
Object.defineProperty(exports, "healthcareRevenueCycleScenario", { enumerable: true, get: function () { return healthcare_revenue_cycle_js_1.healthcareRevenueCycleScenario; } });
const saas_dso_reduction_js_2 = require("./saas-dso-reduction.js");
const manufacturing_yield_js_2 = require("./manufacturing-yield.js");
const healthcare_revenue_cycle_js_2 = require("./healthcare-revenue-cycle.js");
/** All ground truth scenarios indexed by ID */
exports.GROUND_TRUTH_SCENARIOS = {
    [saas_dso_reduction_js_2.saassDsoReductionScenario.meta.id]: saas_dso_reduction_js_2.saassDsoReductionScenario,
    [manufacturing_yield_js_2.manufacturingYieldScenario.meta.id]: manufacturing_yield_js_2.manufacturingYieldScenario,
    [healthcare_revenue_cycle_js_2.healthcareRevenueCycleScenario.meta.id]: healthcare_revenue_cycle_js_2.healthcareRevenueCycleScenario,
};
//# sourceMappingURL=index.js.map