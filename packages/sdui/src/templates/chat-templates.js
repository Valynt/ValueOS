"use strict";
/**
 * Chat SDUI Templates Index
 *
 * Central export for all chat stage-specific SDUI templates.
 * Provides template selection logic based on lifecycle stage.
 *
 * Phase 3: SDUI Template System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_TEMPLATES = void 0;
exports.generateChatSDUIPage = generateChatSDUIPage;
exports.hasTemplateForStage = hasTemplateForStage;
exports.getAvailableStages = getAvailableStages;
const chat_opportunity_template_1 = require("./chat-opportunity-template");
const chat_target_template_1 = require("./chat-target-template");
const chat_realization_template_1 = require("./chat-realization-template");
const chat_expansion_template_1 = require("./chat-expansion-template");
/**
 * Template registry mapping lifecycle stages to generators
 */
exports.CHAT_TEMPLATES = {
    opportunity: chat_opportunity_template_1.generateOpportunityPage,
    target: chat_target_template_1.generateTargetPage,
    realization: chat_realization_template_1.generateRealizationPage,
    expansion: chat_expansion_template_1.generateExpansionPage,
};
/**
 * Generate SDUI page using stage-specific template
 *
 * @param stage Lifecycle stage
 * @param context Template context
 * @returns Generated SDUI page definition
 */
function generateChatSDUIPage(stage, context) {
    const generator = exports.CHAT_TEMPLATES[stage];
    if (!generator) {
        throw new Error(`No template found for stage: ${stage}`);
    }
    return generator(context);
}
/**
 * Check if template exists for stage
 */
function hasTemplateForStage(stage) {
    return stage in exports.CHAT_TEMPLATES;
}
/**
 * Get all available template stages
 */
function getAvailableStages() {
    return Object.keys(exports.CHAT_TEMPLATES);
}
//# sourceMappingURL=chat-templates.js.map