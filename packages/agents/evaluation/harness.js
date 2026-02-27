"use strict";
/**
 * Agent Evaluation Harness
 *
 * Runs agent evaluation cases and produces structured results.
 * Supports two modes:
 * - Mock mode: uses deterministic mock responses for unit testing
 * - Live mode: calls actual agents and validates output structure/constraints
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOpportunityResponse = validateOpportunityResponse;
exports.validateFinancialModelingResponse = validateFinancialModelingResponse;
exports.validateGroundtruthResponse = validateGroundtruthResponse;
exports.validateNarrativeResponse = validateNarrativeResponse;
exports.validateRedTeamResponse = validateRedTeamResponse;
exports.runEvalChecks = runEvalChecks;
exports.summarizeResults = summarizeResults;
// ============================================================================
// Validation Helpers
// ============================================================================
function checkMinCount(actual, min, label) {
    return {
        name: `${label} count >= ${min}`,
        passed: actual >= min,
        expected: `>= ${min}`,
        actual: String(actual),
    };
}
function checkMaxCount(actual, max, label) {
    return {
        name: `${label} count <= ${max}`,
        passed: actual <= max,
        expected: `<= ${max}`,
        actual: String(actual),
    };
}
function checkMinConfidence(items, min) {
    const topConfidence = Math.max(...items.map((i) => i.confidence));
    return {
        name: `Top confidence >= ${min}`,
        passed: topConfidence >= min,
        expected: `>= ${min}`,
        actual: String(topConfidence),
    };
}
function checkKeywords(text, keywords, label) {
    const lowerText = text.toLowerCase();
    const missing = keywords.filter((kw) => !lowerText.includes(kw.toLowerCase()));
    return {
        name: `${label} mentions required keywords`,
        passed: missing.length === 0,
        expected: keywords.join(', '),
        actual: missing.length === 0 ? 'all present' : `missing: ${missing.join(', ')}`,
    };
}
function checkCategories(items, required, label) {
    const categories = new Set(items.map((i) => i.category.toLowerCase()));
    const missing = required.filter((cat) => !Array.from(categories).some((c) => c.includes(cat.toLowerCase())));
    return {
        name: `${label} includes required categories`,
        passed: missing.length === 0,
        expected: required.join(', '),
        actual: missing.length === 0 ? 'all present' : `missing: ${missing.join(', ')}`,
    };
}
function checkMinLength(text, min, label) {
    return {
        name: `${label} length >= ${min}`,
        passed: text.length >= min,
        expected: `>= ${min} chars`,
        actual: `${text.length} chars`,
    };
}
// ============================================================================
// Agent-Specific Validators
// ============================================================================
function validateOpportunityResponse(evalCase, response) {
    const checks = [];
    const { expectations } = evalCase;
    checks.push(checkMinCount(response.opportunities.length, expectations.minOpportunities, 'Opportunities'));
    if (expectations.maxOpportunities !== undefined) {
        checks.push(checkMaxCount(response.opportunities.length, expectations.maxOpportunities, 'Opportunities'));
    }
    if (expectations.minConfidence !== undefined) {
        checks.push(checkMinConfidence(response.opportunities, expectations.minConfidence));
    }
    if (expectations.requiredCategories) {
        checks.push(checkCategories(response.opportunities, expectations.requiredCategories, 'Opportunities'));
    }
    if (expectations.mustMentionKeywords) {
        const allText = response.opportunities.map((o) => `${o.title} ${o.description}`).join(' ') + ' ' + response.analysis;
        checks.push(checkKeywords(allText, expectations.mustMentionKeywords, 'Response'));
    }
    if (expectations.analysisMinLength !== undefined) {
        checks.push(checkMinLength(response.analysis, expectations.analysisMinLength, 'Analysis'));
    }
    return checks;
}
function validateFinancialModelingResponse(evalCase, response) {
    const checks = [];
    const { expectations } = evalCase;
    checks.push(checkMinCount(response.financial_models.length, expectations.minModels, 'Models'));
    if (expectations.minConfidence !== undefined) {
        checks.push(checkMinConfidence(response.financial_models, expectations.minConfidence));
    }
    if (expectations.mustMentionKeywords) {
        const allText = response.financial_models.map((m) => `${m.title} ${m.description}`).join(' ') + ' ' + response.analysis;
        checks.push(checkKeywords(allText, expectations.mustMentionKeywords, 'Response'));
    }
    if (expectations.requiresFormula) {
        const hasFormulas = response.financial_models.every((m) => m.description.includes('Formula') || m.description.includes('=') || m.description.includes('*'));
        checks.push({
            name: 'All models include formulas',
            passed: hasFormulas,
            expected: 'formula in each model description',
            actual: hasFormulas ? 'all have formulas' : 'some missing formulas',
        });
    }
    return checks;
}
function validateGroundtruthResponse(evalCase, response) {
    const checks = [];
    const { expectations } = evalCase;
    checks.push(checkMinCount(response.groundtruths.length, expectations.minGroundtruths, 'Groundtruths'));
    if (expectations.minTopConfidence !== undefined) {
        checks.push(checkMinConfidence(response.groundtruths, expectations.minTopConfidence));
    }
    if (expectations.requiredCategories) {
        checks.push(checkCategories(response.groundtruths, expectations.requiredCategories, 'Groundtruths'));
    }
    if (expectations.mustMentionKeywords) {
        const allText = response.groundtruths.map((g) => `${g.title} ${g.description}`).join(' ') + ' ' + response.analysis;
        checks.push(checkKeywords(allText, expectations.mustMentionKeywords, 'Response'));
    }
    return checks;
}
function validateNarrativeResponse(evalCase, response) {
    const checks = [];
    const { expectations } = evalCase;
    checks.push(checkMinCount(response.narratives.length, expectations.minNarratives, 'Narratives'));
    checks.push(checkMinLength(response.analysis, expectations.analysisMinLength, 'Analysis'));
    if (expectations.mustMentionKeywords) {
        const allText = response.narratives.map((n) => `${n.title} ${n.description}`).join(' ') + ' ' + response.analysis;
        checks.push(checkKeywords(allText, expectations.mustMentionKeywords, 'Response'));
    }
    if (expectations.requiresDollarAmounts) {
        const allText = response.narratives.map((n) => n.description).join(' ');
        const hasDollars = /\$[\d,.]+[MKB]?/.test(allText);
        checks.push({
            name: 'Narratives include dollar amounts',
            passed: hasDollars,
            expected: 'dollar amounts in narrative descriptions',
            actual: hasDollars ? 'present' : 'missing',
        });
    }
    return checks;
}
function validateRedTeamResponse(evalCase, response) {
    const checks = [];
    const { expectations } = evalCase;
    checks.push(checkMinCount(response.objections.length, expectations.minObjections, 'Objections'));
    if (expectations.maxObjections !== undefined) {
        checks.push(checkMaxCount(response.objections.length, expectations.maxObjections, 'Objections'));
    }
    const hasCritical = response.objections.some((o) => o.severity === 'critical');
    checks.push({
        name: `Critical objections ${expectations.expectsCritical ? 'expected' : 'not expected'}`,
        passed: hasCritical === expectations.expectsCritical,
        expected: expectations.expectsCritical ? 'has critical' : 'no critical',
        actual: hasCritical ? 'has critical' : 'no critical',
    });
    if (expectations.requiredCategories) {
        const categories = new Set(response.objections.map((o) => o.category));
        const missing = expectations.requiredCategories.filter((c) => !categories.has(c));
        checks.push({
            name: 'Required objection categories present',
            passed: missing.length === 0,
            expected: expectations.requiredCategories.join(', '),
            actual: missing.length === 0 ? 'all present' : `missing: ${missing.join(', ')}`,
        });
    }
    if (expectations.targetComponents) {
        const targeted = new Set(response.objections.map((o) => o.targetComponent));
        const missing = expectations.targetComponents.filter((c) => !targeted.has(c));
        checks.push({
            name: 'Expected components targeted',
            passed: missing.length === 0,
            expected: expectations.targetComponents.join(', '),
            actual: missing.length === 0 ? 'all targeted' : `missing: ${missing.join(', ')}`,
        });
    }
    // hasCritical consistency check
    checks.push({
        name: 'hasCritical flag matches objections',
        passed: response.hasCritical === hasCritical,
        expected: String(hasCritical),
        actual: String(response.hasCritical),
    });
    return checks;
}
// ============================================================================
// Harness Runner
// ============================================================================
function runEvalChecks(caseId, caseName, agentType, checks, startTime) {
    return {
        caseId,
        caseName,
        agentType,
        passed: checks.every((c) => c.passed),
        checks,
        durationMs: Date.now() - startTime,
    };
}
function summarizeResults(results) {
    const passed = results.filter((r) => r.passed).length;
    return {
        totalCases: results.length,
        passed,
        failed: results.length - passed,
        passRate: results.length > 0 ? passed / results.length : 0,
        results,
        timestamp: new Date().toISOString(),
    };
}
//# sourceMappingURL=harness.js.map