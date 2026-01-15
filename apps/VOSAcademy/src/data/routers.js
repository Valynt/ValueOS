var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
import { eq, and, desc, sql } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { users, quizResults, certifications, simulationAttempts, simulationScenarios } from "../drizzle/schema";
import { count, avg } from "drizzle-orm";
var COOKIE_NAME = "vosacademy_session";
function determineCertificationTier(cert) {
    // Bronze: Pass all knowledge checks (80%+ on quiz)
    // Silver: 80%+ on final simulation assessment
    // Gold: 95%+ with exceptional insight (simulation score + quiz score average > 95)
    // For now, base tier on the score stored in the certification record
    // In the future, this should be calculated based on quiz results and simulation performance
    if (cert.score >= 95) {
        return "gold";
    }
    else if (cert.score >= 80) {
        return "silver";
    }
    else {
        return "bronze";
    }
}
export var appRouter = router({
    system: systemRouter,
    auth: router({
        me: publicProcedure.query(function (opts) { return opts.ctx.user; }),
        logout: publicProcedure.mutation(function (_a) {
            var ctx = _a.ctx;
            var cookieOptions = getSessionCookieOptions(ctx.req);
            ctx.res.clearCookie(COOKIE_NAME, __assign(__assign({}, cookieOptions), { maxAge: -1 }));
            return {
                success: true,
            };
        }),
    }),
    // User profile management
    // AI Tutor
    ai: router({
        chat: protectedProcedure
            .input(z.object({
            messages: z.array(z.object({
                role: z.enum(["system", "user", "assistant"]),
                content: z.string()
            }))
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var response;
            var _c, _d;
            var input = _b.input;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, invokeLLM({
                            messages: input.messages
                        })];
                    case 1:
                        response = _e.sent();
                        return [2 /*return*/, {
                                content: ((_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "I apologize, but I couldn't generate a response. Please try again."
                            }];
                }
            });
        }); }),
        roiNarrative: protectedProcedure
            .input(z.object({
            businessCase: z.string(),
            benefits: z.array(z.string()),
            costs: z.object({
                implementation: z.number(),
                licensing: z.number().optional(),
                training: z.number().optional(),
            }),
            timeframe: z.enum(['1year', '2years', '3years']),
            audience: z.enum(['executive', 'finance', 'technical'])
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var businessCase, benefits, costs, timeframe, audience, totalCosts, years, annualBenefits, totalBenefits, roi, paybackPeriod, systemPrompt, narrativePrompt, response, narrative;
            var _c, _d;
            var input = _b.input;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        businessCase = input.businessCase, benefits = input.benefits, costs = input.costs, timeframe = input.timeframe, audience = input.audience;
                        totalCosts = costs.implementation + (costs.licensing || 0) + (costs.training || 0);
                        years = timeframe === '1year' ? 1 : timeframe === '2years' ? 2 : 3;
                        annualBenefits = benefits.length * 50000;
                        totalBenefits = annualBenefits * years;
                        roi = totalBenefits > 0 ? ((totalBenefits - totalCosts) / totalCosts) * 100 : 0;
                        paybackPeriod = totalCosts / annualBenefits;
                        systemPrompt = "";
                        if (audience === 'executive') {
                            systemPrompt = "You are a senior executive communicating with other executives. Focus on strategic impact, competitive advantage, and business transformation. Use executive-level language and emphasize long-term value.";
                        }
                        else if (audience === 'finance') {
                            systemPrompt = "You are a CFO communicating with finance teams. Focus on financial metrics, ROI calculations, cash flow impact, and risk-adjusted returns. Use precise financial language and quantitative analysis.";
                        }
                        else {
                            systemPrompt = "You are a technical leader communicating with IT/engineering teams. Focus on technical feasibility, implementation approach, scalability, and operational efficiency. Use technical terminology and practical considerations.";
                        }
                        narrativePrompt = "\nBusiness Case: ".concat(businessCase, "\n\nKey Benefits: ").concat(benefits.join(', '), "\n\nFinancial Details:\n- Implementation Cost: $").concat(costs.implementation.toLocaleString(), "\n- Licensing Cost: $").concat((costs.licensing || 0).toLocaleString(), "/year\n- Training Cost: $").concat((costs.training || 0).toLocaleString(), "\n- Timeframe: ").concat(years, " years\n- Estimated Annual Benefits: $").concat(annualBenefits.toLocaleString(), "\n- Total Benefits: $").concat(totalBenefits.toLocaleString(), "\n- ROI: ").concat(roi.toFixed(1), "%\n- Payback Period: ").concat(paybackPeriod.toFixed(1), " years\n\nCreate a compelling ROI narrative for a ").concat(audience, " audience that:\n1. Opens with a strong business case hook\n2. Quantifies the value opportunity\n3. Presents financial analysis clearly\n4. Addresses potential objections\n5. Ends with a clear call to action\n6. Uses appropriate language for the target audience\n\nFormat as a professional business case narrative.");
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: narrativePrompt }
                                ]
                            })];
                    case 1:
                        response = _e.sent();
                        narrative = ((_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "Unable to generate ROI narrative. Please try again.";
                        return [2 /*return*/, {
                                narrative: narrative,
                                financials: {
                                    totalCosts: totalCosts,
                                    totalBenefits: totalBenefits,
                                    roi: roi.toFixed(1),
                                },
                            }];
                }
            });
        }); }),
        valueCase: protectedProcedure
            .input(z.object({
            pillarId: z.number(),
            outcomes: z.array(z.string()),
            capabilities: z.array(z.string()),
            kpis: z.array(z.object({
                name: z.string(),
                baseline: z.number(),
                target: z.number(),
                timeframe: z.string()
            })),
            costs: z.object({
                implementation: z.number(),
                licensing: z.number().optional(),
                training: z.number().optional(),
            }),
            audience: z.enum(['executive', 'finance', 'technical'])
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var pillarId, outcomes, capabilities, kpis, costs, audience, pillars, pillar, totalCosts, estimatedBenefits, roi, systemPrompt, valueCasePrompt, response, valueCase;
            var _c, _d;
            var input = _b.input;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        pillarId = input.pillarId, outcomes = input.outcomes, capabilities = input.capabilities, kpis = input.kpis, costs = input.costs, audience = input.audience;
                        return [4 /*yield*/, db.select().from(pillars)];
                    case 1:
                        pillars = _e.sent();
                        pillar = pillars.find(function (p) { return p.id === pillarId; });
                        totalCosts = costs.implementation + (costs.licensing || 0) + (costs.training || 0);
                        estimatedBenefits = kpis.reduce(function (sum, kpi) {
                            var improvement = kpi.target - kpi.baseline;
                            return sum + (improvement * 10000); // Rough estimate per KPI point
                        }, 0);
                        roi = estimatedBenefits > 0 ? ((estimatedBenefits - totalCosts) / totalCosts) * 100 : 0;
                        systemPrompt = "";
                        if (audience === 'executive') {
                            systemPrompt = "You are a senior value engineering executive creating a comprehensive value case for C-suite leadership. Focus on strategic business impact, competitive advantage, and transformation value. Use executive language and emphasize long-term strategic benefits.";
                        }
                        else if (audience === 'finance') {
                            systemPrompt = "You are a CFO preparing a detailed financial value case. Focus on quantifiable financial metrics, ROI calculations, cash flow analysis, and risk-adjusted returns. Use precise financial terminology and provide detailed financial analysis.";
                        }
                        else {
                            systemPrompt = "You are a technical leader building a value case for IT/engineering stakeholders. Focus on technical implementation, operational efficiency, scalability, and technical ROI. Use technical terminology and address implementation considerations.";
                        }
                        valueCasePrompt = "\nVOS Value Case Framework - ".concat((pillar === null || pillar === void 0 ? void 0 : pillar.title) || 'Pillar', " Implementation\n\nBUSINESS CONTEXT:\nPillar: ").concat((pillar === null || pillar === void 0 ? void 0 : pillar.title) || 'Unknown Pillar', "\nDescription: ").concat((pillar === null || pillar === void 0 ? void 0 : pillar.description) || 'No description available', "\n\nVALUE COMPONENTS:\nOutcomes: ").concat(outcomes.join(', '), "\nCapabilities: ").concat(capabilities.join(', '), "\nKPIs: ").concat(kpis.map(function (kpi) { return "".concat(kpi.name, ": ").concat(kpi.baseline, " \u2192 ").concat(kpi.target, " (").concat(kpi.timeframe, ")"); }).join(', '), "\n\nFINANCIAL ANALYSIS:\nImplementation Cost: $").concat(costs.implementation.toLocaleString(), "\nLicensing Cost: $").concat((costs.licensing || 0).toLocaleString(), "/year\nTraining Cost: $").concat((costs.training || 0).toLocaleString(), "\nTotal Estimated Benefits: $").concat(estimatedBenefits.toLocaleString(), "\nEstimated ROI: ").concat(roi.toFixed(1), "%\n\nTARGET AUDIENCE: ").concat(audience, "\n\nCreate a comprehensive value case that includes:\n1. Executive Summary with business case\n2. Current State Analysis (pain points, baseline metrics)\n3. Proposed Solution (capabilities, implementation approach)\n4. Value Proposition (outcomes, KPI improvements)\n5. Financial Analysis (costs, benefits, ROI)\n6. Implementation Plan and Timeline\n7. Risk Mitigation and Success Metrics\n8. Call to Action\n\nFormat as a professional value case document tailored for the ").concat(audience, " audience.");
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: valueCasePrompt }
                                ]
                            })];
                    case 2:
                        response = _e.sent();
                        valueCase = ((_d = (_c = response.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "Unable to generate value case. Please try again.";
                        return [2 /*return*/, {
                                valueCase: valueCase,
                                summary: {
                                    pillarTitle: (pillar === null || pillar === void 0 ? void 0 : pillar.title) || 'Unknown Pillar',
                                    totalOutcomes: outcomes.length,
                                    totalCapabilities: capabilities.length,
                                    totalKPIs: kpis.length,
                                    estimatedCosts: totalCosts,
                                    estimatedBenefits: estimatedBenefits,
                                    roi: roi.toFixed(1)
                                }
                            }];
                }
            });
        }); }),
    }),
    user: router({
        updateVosRole: protectedProcedure
            .input(z.object({
            vosRole: z.enum(["Sales", "CS", "Marketing", "Product", "Executive", "VE"])
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.updateUserVosRole(ctx.user.id, input.vosRole)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/, { success: true }];
                }
            });
        }); }),
        updateMaturityLevel: protectedProcedure
            .input(z.object({
            level: z.number().min(0).max(5)
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.updateUserMaturityLevel(ctx.user.id, input.level)];
                    case 1:
                        _c.sent();
                        return [2 /*return*/, { success: true }];
                }
            });
        }); }),
    }),
    // Pillars
    pillars: router({
        list: publicProcedure.query(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.getAllPillars()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); }),
        getById: publicProcedure
            .input(z.object({ id: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getPillarById(input.id)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getByNumber: publicProcedure
            .input(z.object({ pillarNumber: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getPillarByNumber(input.pillarNumber)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
    }),
    // Progress tracking
    progress: router({
        getUserProgress: protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserProgress(ctx.user.id)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getPillarProgress: protectedProcedure
            .input(z.object({ pillarId: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserPillarProgress(ctx.user.id, input.pillarId)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        updateProgress: protectedProcedure
            .input(z.object({
            pillarId: z.number(),
            status: z.enum(["not_started", "in_progress", "completed"]),
            completionPercentage: z.number().min(0).max(100),
            completedAt: z.date().optional(),
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.upsertProgress({
                            userId: ctx.user.id,
                            pillarId: input.pillarId,
                            status: input.status,
                            completionPercentage: input.completionPercentage,
                            lastAccessed: new Date(),
                            completedAt: input.completedAt,
                        })];
                    case 1:
                        _c.sent();
                        return [2 /*return*/, { success: true }];
                }
            });
        }); }),
    }),
    // Quiz management
    quiz: router({
        getQuestions: protectedProcedure
            .input(z.object({ pillarId: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getQuizQuestionsByPillar(input.pillarId)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        submitQuiz: protectedProcedure
            .input(z.object({
            pillarId: z.number(),
            answers: z.array(z.object({
                questionId: z.number(),
                selectedAnswer: z.string(),
                isCorrect: z.boolean(),
                pointsEarned: z.number(),
            })),
            score: z.number(),
            categoryScores: z.record(z.string(), z.number()).optional(),
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var passed, previousResults, attemptNumber, maturityLevel, feedback, pillar, simulationAttempts_1, pillarSimulations, simulationAvg, roleTaskScore, quizWeight, simulationWeight, roleTaskWeight, finalCertificationScore, badgeName, alreadyCertified;
            var _c, _d, _e;
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        passed = input.score >= 80;
                        return [4 /*yield*/, db.getUserQuizResults(ctx.user.id, input.pillarId)];
                    case 1:
                        previousResults = _f.sent();
                        attemptNumber = previousResults.length + 1;
                        maturityLevel = (_c = ctx.user.maturityLevel) !== null && _c !== void 0 ? _c : 0;
                        feedback = generateQuizFeedback(input.score, maturityLevel, input.categoryScores);
                        // Save quiz result
                        return [4 /*yield*/, db.createQuizResult({
                                userId: ctx.user.id,
                                pillarId: input.pillarId,
                                score: input.score,
                                categoryScores: input.categoryScores,
                                answers: input.answers,
                                feedback: feedback,
                                passed: passed,
                                attemptNumber: attemptNumber,
                                completedAt: new Date(),
                            })];
                    case 2:
                        // Save quiz result
                        _f.sent();
                        if (!(passed && ctx.user.vosRole)) return [3 /*break*/, 9];
                        return [4 /*yield*/, db.getPillarById(input.pillarId)];
                    case 3:
                        pillar = _f.sent();
                        return [4 /*yield*/, db.getUserSimulationAttempts(ctx.user.id)];
                    case 4:
                        simulationAttempts_1 = _f.sent();
                        pillarSimulations = simulationAttempts_1.filter(function (attempt) {
                            // Find simulations related to this pillar
                            return true; // For now, include all simulations - could be refined by pillar mapping
                        });
                        simulationAvg = pillarSimulations.length > 0
                            ? pillarSimulations.reduce(function (sum, attempt) { return sum + attempt.overallScore; }, 0) / pillarSimulations.length
                            : 0;
                        roleTaskScore = Math.min(100, input.score * 0.5 + (((_d = input.categoryScores) === null || _d === void 0 ? void 0 : _d.technical) || 0) * 0.3 + (((_e = input.categoryScores) === null || _e === void 0 ? void 0 : _e.crossFunctional) || 0) * 0.2);
                        quizWeight = 0.4;
                        simulationWeight = 0.3;
                        roleTaskWeight = 0.3;
                        finalCertificationScore = Math.round((input.score * quizWeight) +
                            (simulationAvg * simulationWeight) +
                            (roleTaskScore * roleTaskWeight));
                        badgeName = "".concat(pillar === null || pillar === void 0 ? void 0 : pillar.title, " - ").concat(ctx.user.vosRole, " Certified");
                        return [4 /*yield*/, db.hasCertification(ctx.user.id, input.pillarId, ctx.user.vosRole)];
                    case 5:
                        alreadyCertified = _f.sent();
                        if (!!alreadyCertified) return [3 /*break*/, 7];
                        return [4 /*yield*/, db.createCertification({
                                userId: ctx.user.id,
                                badgeName: badgeName,
                                pillarId: input.pillarId,
                                vosRole: ctx.user.vosRole,
                                tier: finalCertificationScore >= 95 ? "gold" :
                                    finalCertificationScore >= 80 ? "silver" : "bronze",
                                score: finalCertificationScore,
                                awardedAt: new Date(),
                            })];
                    case 6:
                        _f.sent();
                        _f.label = 7;
                    case 7: 
                    // Update progress to completed
                    return [4 /*yield*/, db.upsertProgress({
                            userId: ctx.user.id,
                            pillarId: input.pillarId,
                            status: "completed",
                            completionPercentage: 100,
                            lastAccessed: new Date(),
                            completedAt: new Date(),
                        })];
                    case 8:
                        // Update progress to completed
                        _f.sent();
                        _f.label = 9;
                    case 9: return [2 /*return*/, {
                            success: true,
                            passed: passed,
                            feedback: feedback,
                            attemptNumber: attemptNumber,
                        }];
                }
            });
        }); }),
        getResults: protectedProcedure
            .input(z.object({ pillarId: z.number().optional() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserQuizResults(ctx.user.id, input.pillarId)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
    }),
    // Certifications
    certifications: router({
        list: protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserCertifications(ctx.user.id)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getUserCertifications: protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var certs;
            var ctx = _b.ctx;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserCertifications(ctx.user.id)];
                    case 1:
                        certs = _c.sent();
                        // Transform to match frontend interface
                        return [2 /*return*/, certs.map(function (cert) { return ({
                                id: cert.id,
                                pillarNumber: cert.pillarId, // Assuming pillarId maps to pillarNumber
                                pillarTitle: cert.badgeName.split(' - ')[0] || 'Unknown Pillar',
                                tier: determineCertificationTier(cert),
                                score: cert.score || 100, // Default score if not set
                                earnedAt: cert.awardedAt,
                                expiresAt: null, // Certifications don't expire by default
                            }); })];
                }
            });
        }); }),
        generateCertificate: protectedProcedure
            .input(z.object({
            certificationId: z.number(),
            format: z.enum(['pdf', 'png']).default('pdf')
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var certifications, cert, user, pillar, certificateData, generateCertificatePDF, certificateBlob, arrayBuffer, base64;
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserCertifications(ctx.user.id)];
                    case 1:
                        certifications = _c.sent();
                        cert = certifications.find(function (c) { return c.id === input.certificationId; });
                        if (!cert) {
                            throw new Error('Certification not found');
                        }
                        return [4 /*yield*/, db.getUserById(ctx.user.id)];
                    case 2:
                        user = _c.sent();
                        if (!user) {
                            throw new Error('User not found');
                        }
                        return [4 /*yield*/, db.getPillarById(cert.pillarId)];
                    case 3:
                        pillar = _c.sent();
                        certificateData = {
                            userName: user.name || 'Valued Learner',
                            pillarTitle: (pillar === null || pillar === void 0 ? void 0 : pillar.title) || 'VOS Pillar',
                            vosRole: cert.vosRole,
                            tier: cert.tier,
                            score: cert.score || 100,
                            awardedAt: cert.awardedAt,
                            certificateId: "VOS-".concat(cert.id, "-").concat(Date.now().toString(36).toUpperCase())
                        };
                        return [4 /*yield*/, import('../lib/certificate-generator')];
                    case 4:
                        generateCertificatePDF = (_c.sent()).generateCertificatePDF;
                        return [4 /*yield*/, generateCertificatePDF(certificateData)];
                    case 5:
                        certificateBlob = _c.sent();
                        return [4 /*yield*/, certificateBlob.arrayBuffer()];
                    case 6:
                        arrayBuffer = _c.sent();
                        base64 = btoa(String.fromCharCode.apply(String, new Uint8Array(arrayBuffer)));
                        return [2 /*return*/, {
                                certificateData: certificateData,
                                certificateBlob: "data:application/pdf;base64,".concat(base64),
                                downloadUrl: "/api/certificates/".concat(cert.id, "/download")
                            }];
                }
            });
        }); }),
    }),
    // Maturity assessments
    maturity: router({
        getAssessments: protectedProcedure.query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserMaturityAssessments(ctx.user.id)];
                    case 1: 
                    // ... (rest of the code remains the same)
                    return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        createAssessment: protectedProcedure
            .input(z.object({
            level: z.number().min(0).max(5),
            assessmentData: z.object({
                selfAssessment: z.number(),
                quizAverage: z.number(),
                pillarsCompleted: z.number(),
                behaviorIndicators: z.array(z.string()),
                recommendations: z.array(z.string()),
            }),
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.createMaturityAssessment({
                            userId: ctx.user.id,
                            level: input.level,
                            assessmentData: input.assessmentData,
                            assessedAt: new Date(),
                        })];
                    case 1:
                        _c.sent();
                        // Update user's maturity level
                        return [4 /*yield*/, db.updateUserMaturityLevel(ctx.user.id, input.level)];
                    case 2:
                        // Update user's maturity level
                        _c.sent();
                        return [2 /*return*/, { success: true }];
                }
            });
        }); }),
    }),
    // Resources
    resources: router({
        list: publicProcedure.query(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.getAllResources()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); }),
        getByPillar: publicProcedure
            .input(z.object({ pillarId: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getResourcesByPillar(input.pillarId)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getByRole: publicProcedure
            .input(z.object({ vosRole: z.string() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getResourcesByRole(input.vosRole)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
    }),
    // Analytics dashboard
    analytics: router({
        userStats: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
            role: z.string().optional(),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db, totalUsersResult, totalUsers, activeUsers, days, cutoffDate, activeUsersResult, startOfMonth, newUsersResult, newUsersThisMonth, maturityResult, averageMaturityLevel;
            var _c, _d, _e, _f;
            var input = _b.input;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _g.sent();
                        if (!db)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, db.select({ count: count() }).from(users)];
                    case 2:
                        totalUsersResult = _g.sent();
                        totalUsers = ((_c = totalUsersResult[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
                        activeUsers = 0;
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 4];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: count() })
                                .from(users)
                                .where(sql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), users.lastSignedIn, cutoffDate))];
                    case 3:
                        activeUsersResult = _g.sent();
                        activeUsers = ((_d = activeUsersResult[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
                        return [3 /*break*/, 5];
                    case 4:
                        activeUsers = totalUsers;
                        _g.label = 5;
                    case 5:
                        startOfMonth = new Date();
                        startOfMonth.setDate(1);
                        return [4 /*yield*/, db
                                .select({ count: count() })
                                .from(users)
                                .where(sql(templateObject_2 || (templateObject_2 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), users.createdAt, startOfMonth))];
                    case 6:
                        newUsersResult = _g.sent();
                        newUsersThisMonth = ((_e = newUsersResult[0]) === null || _e === void 0 ? void 0 : _e.count) || 0;
                        return [4 /*yield*/, db
                                .select({ avg: avg(users.maturityLevel) })
                                .from(users)];
                    case 7:
                        maturityResult = _g.sent();
                        averageMaturityLevel = Math.round(((_f = maturityResult[0]) === null || _f === void 0 ? void 0 : _f.avg) || 0);
                        return [2 /*return*/, {
                                totalUsers: totalUsers,
                                activeUsers: activeUsers,
                                newUsersThisMonth: newUsersThisMonth,
                                averageMaturityLevel: averageMaturityLevel,
                            }];
                }
            });
        }); }),
        quizStats: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
            pillarId: z.number().optional(),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db, totalQuizzes, days, cutoffDate, quizCountResult, quizCountResult, avgScoreResult, days, cutoffDate, averageScore, passRateResult, days, cutoffDate, passedCountResult, passedCount, totalCount, passRate, passedCountResult, passedCount, passRate, uniqueQuizUsersResult, uniqueQuizUsers, totalUsersResult, totalUsers, completionRate, pillarBreakdown, pillars, pillarBreakdownFormatted;
            var _c, _d, _e, _f, _g, _h, _j;
            var input = _b.input;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _k.sent();
                        if (!db)
                            return [2 /*return*/, null];
                        totalQuizzes = 0;
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 3];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: count() })
                                .from(quizResults)
                                .where(sql(templateObject_3 || (templateObject_3 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), quizResults.completedAt, cutoffDate))];
                    case 2:
                        quizCountResult = _k.sent();
                        totalQuizzes = ((_c = quizCountResult[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, db.select({ count: count() }).from(quizResults)];
                    case 4:
                        quizCountResult = _k.sent();
                        totalQuizzes = ((_d = quizCountResult[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
                        _k.label = 5;
                    case 5:
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 7];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ avg: avg(quizResults.score) })
                                .from(quizResults)
                                .where(sql(templateObject_4 || (templateObject_4 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), quizResults.completedAt, cutoffDate))];
                    case 6:
                        avgScoreResult = _k.sent();
                        return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, db.select({ avg: avg(quizResults.score) }).from(quizResults)];
                    case 8:
                        avgScoreResult = _k.sent();
                        _k.label = 9;
                    case 9:
                        averageScore = Math.round(((_e = avgScoreResult[0]) === null || _e === void 0 ? void 0 : _e.avg) || 0);
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 11];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: count() })
                                .from(quizResults)
                                .where(and(sql(templateObject_5 || (templateObject_5 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), quizResults.completedAt, cutoffDate), eq(quizResults.passed, true)))];
                    case 10:
                        passedCountResult = _k.sent();
                        passedCount = ((_f = passedCountResult[0]) === null || _f === void 0 ? void 0 : _f.count) || 0;
                        totalCount = totalQuizzes;
                        passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
                        passRateResult = { passRate: passRate };
                        return [3 /*break*/, 13];
                    case 11: return [4 /*yield*/, db
                            .select({ count: count() })
                            .from(quizResults)
                            .where(eq(quizResults.passed, true))];
                    case 12:
                        passedCountResult = _k.sent();
                        passedCount = ((_g = passedCountResult[0]) === null || _g === void 0 ? void 0 : _g.count) || 0;
                        passRate = totalQuizzes > 0 ? Math.round((passedCount / totalQuizzes) * 100) : 0;
                        passRateResult = { passRate: passRate };
                        _k.label = 13;
                    case 13: return [4 /*yield*/, db
                            .select({ count: count(sql(templateObject_6 || (templateObject_6 = __makeTemplateObject(["DISTINCT ", ""], ["DISTINCT ", ""])), quizResults.userId)) })
                            .from(quizResults)];
                    case 14:
                        uniqueQuizUsersResult = _k.sent();
                        uniqueQuizUsers = ((_h = uniqueQuizUsersResult[0]) === null || _h === void 0 ? void 0 : _h.count) || 0;
                        return [4 /*yield*/, db.select({ count: count() }).from(users)];
                    case 15:
                        totalUsersResult = _k.sent();
                        totalUsers = ((_j = totalUsersResult[0]) === null || _j === void 0 ? void 0 : _j.count) || 0;
                        completionRate = totalUsers > 0 ? Math.round((uniqueQuizUsers / totalUsers) * 100) : 0;
                        return [4 /*yield*/, db
                                .select({
                                pillarId: quizResults.pillarId,
                                attempts: count(),
                                avgScore: avg(quizResults.score),
                                passedCount: sql(templateObject_7 || (templateObject_7 = __makeTemplateObject(["COUNT(CASE WHEN ", " = 1 THEN 1 END)"], ["COUNT(CASE WHEN ", " = 1 THEN 1 END)"])), quizResults.passed),
                            })
                                .from(quizResults)
                                .groupBy(quizResults.pillarId)];
                    case 16:
                        pillarBreakdown = _k.sent();
                        return [4 /*yield*/, db.select().from(pillars)];
                    case 17:
                        pillars = _k.sent();
                        pillarBreakdownFormatted = pillarBreakdown.map(function (pillar) {
                            var pillarInfo = pillars.find(function (p) { return p.id === pillar.pillarId; });
                            var avgScore = Math.round(pillar.avgScore || 0);
                            var passRate = pillar.attempts > 0 ? Math.round((pillar.passedCount / pillar.attempts) * 100) : 0;
                            return {
                                pillarId: pillar.pillarId,
                                pillarName: (pillarInfo === null || pillarInfo === void 0 ? void 0 : pillarInfo.title) || "Pillar ".concat(pillar.pillarId),
                                attempts: pillar.attempts,
                                averageScore: avgScore,
                                passRate: passRate,
                            };
                        });
                        return [2 /*return*/, {
                                totalQuizzes: totalQuizzes,
                                averageScore: averageScore,
                                passRate: passRateResult.passRate,
                                completionRate: completionRate,
                                pillarBreakdown: pillarBreakdownFormatted,
                            }];
                }
            });
        }); }),
        certificationStats: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db, totalCertifications, days, cutoffDate, certCountResult, certCountResult, tierBreakdown, bronzeCount, silverCount, goldCount, roleBreakdown, roleBreakdownFormatted;
            var _c, _d, _e, _f, _g;
            var input = _b.input;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _h.sent();
                        if (!db)
                            return [2 /*return*/, null];
                        totalCertifications = 0;
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 3];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: db.$count() })
                                .from(certifications)
                                .where(db.sql(templateObject_8 || (templateObject_8 = __makeTemplateObject(["awardedAt >= ", ""], ["awardedAt >= ", ""])), cutoffDate))];
                    case 2:
                        certCountResult = _h.sent();
                        totalCertifications = ((_c = certCountResult[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, db.select({ count: db.$count() }).from(certifications)];
                    case 4:
                        certCountResult = _h.sent();
                        totalCertifications = ((_d = certCountResult[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
                        _h.label = 5;
                    case 5: return [4 /*yield*/, db
                            .select({
                            tier: certifications.tier,
                            count: db.$count(),
                        })
                            .from(certifications)
                            .groupBy(certifications.tier)];
                    case 6:
                        tierBreakdown = _h.sent();
                        bronzeCount = ((_e = tierBreakdown.find(function (t) { return t.tier === 'bronze'; })) === null || _e === void 0 ? void 0 : _e.count) || 0;
                        silverCount = ((_f = tierBreakdown.find(function (t) { return t.tier === 'silver'; })) === null || _f === void 0 ? void 0 : _f.count) || 0;
                        goldCount = ((_g = tierBreakdown.find(function (t) { return t.tier === 'gold'; })) === null || _g === void 0 ? void 0 : _g.count) || 0;
                        return [4 /*yield*/, db
                                .select({
                                role: certifications.vosRole,
                                count: db.$count(),
                            })
                                .from(certifications)
                                .groupBy(certifications.vosRole)];
                    case 7:
                        roleBreakdown = _h.sent();
                        roleBreakdownFormatted = roleBreakdown.map(function (role) { return ({
                            role: role.role,
                            count: role.count,
                        }); });
                        return [2 /*return*/, {
                                totalCertifications: totalCertifications,
                                bronzeCount: bronzeCount,
                                silverCount: silverCount,
                                goldCount: goldCount,
                                roleBreakdown: roleBreakdownFormatted,
                            }];
                }
            });
        }); }),
        simulationStats: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db, totalAttempts, days, cutoffDate, attemptCountResult, attemptCountResult, avgScoreResult, days, cutoffDate, averageScore, completionRate, days, cutoffDate, passedCountResult, passedCount, passedCountResult, passedCount, scenarioBreakdown, scenarios, scenarioBreakdownFormatted;
            var _c, _d, _e, _f, _g;
            var input = _b.input;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _h.sent();
                        if (!db)
                            return [2 /*return*/, null];
                        totalAttempts = 0;
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 3];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: db.$count() })
                                .from(simulationAttempts)
                                .where(db.sql(templateObject_9 || (templateObject_9 = __makeTemplateObject(["completedAt >= ", ""], ["completedAt >= ", ""])), cutoffDate))];
                    case 2:
                        attemptCountResult = _h.sent();
                        totalAttempts = ((_c = attemptCountResult[0]) === null || _c === void 0 ? void 0 : _c.count) || 0;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, db.select({ count: db.$count() }).from(simulationAttempts)];
                    case 4:
                        attemptCountResult = _h.sent();
                        totalAttempts = ((_d = attemptCountResult[0]) === null || _d === void 0 ? void 0 : _d.count) || 0;
                        _h.label = 5;
                    case 5:
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 7];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ avg: db.$avg(simulationAttempts.overallScore) })
                                .from(simulationAttempts)
                                .where(db.sql(templateObject_10 || (templateObject_10 = __makeTemplateObject(["completedAt >= ", ""], ["completedAt >= ", ""])), cutoffDate))];
                    case 6:
                        avgScoreResult = _h.sent();
                        return [3 /*break*/, 9];
                    case 7: return [4 /*yield*/, db.select({ avg: db.$avg(simulationAttempts.overallScore) }).from(simulationAttempts)];
                    case 8:
                        avgScoreResult = _h.sent();
                        _h.label = 9;
                    case 9:
                        averageScore = Math.round(((_e = avgScoreResult[0]) === null || _e === void 0 ? void 0 : _e.avg) || 0);
                        completionRate = 0;
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 11];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select({ count: db.$count() })
                                .from(simulationAttempts)
                                .where(db.and(db.sql(templateObject_11 || (templateObject_11 = __makeTemplateObject(["completedAt >= ", ""], ["completedAt >= ", ""])), cutoffDate), db.eq(simulationAttempts.passed, true)))];
                    case 10:
                        passedCountResult = _h.sent();
                        passedCount = ((_f = passedCountResult[0]) === null || _f === void 0 ? void 0 : _f.count) || 0;
                        completionRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;
                        return [3 /*break*/, 13];
                    case 11: return [4 /*yield*/, db
                            .select({ count: db.$count() })
                            .from(simulationAttempts)
                            .where(db.eq(simulationAttempts.passed, true))];
                    case 12:
                        passedCountResult = _h.sent();
                        passedCount = ((_g = passedCountResult[0]) === null || _g === void 0 ? void 0 : _g.count) || 0;
                        completionRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;
                        _h.label = 13;
                    case 13: return [4 /*yield*/, db
                            .select({
                            scenarioId: simulationAttempts.scenarioId,
                            attempts: db.$count(),
                            avgScore: db.$avg(simulationAttempts.overallScore),
                        })
                            .from(simulationAttempts)
                            .groupBy(simulationAttempts.scenarioId)];
                    case 14:
                        scenarioBreakdown = _h.sent();
                        return [4 /*yield*/, db.select().from(simulationScenarios)];
                    case 15:
                        scenarios = _h.sent();
                        scenarioBreakdownFormatted = scenarioBreakdown.map(function (scenario) {
                            var scenarioInfo = scenarios.find(function (s) { return s.id === scenario.scenarioId; });
                            var avgScore = Math.round(scenario.avgScore || 0);
                            return {
                                scenarioId: scenario.scenarioId,
                                scenarioName: (scenarioInfo === null || scenarioInfo === void 0 ? void 0 : scenarioInfo.title) || "Scenario ".concat(scenario.scenarioId),
                                attempts: scenario.attempts,
                                averageScore: avgScore,
                            };
                        });
                        return [2 /*return*/, {
                                totalAttempts: totalAttempts,
                                averageScore: averageScore,
                                completionRate: completionRate,
                                scenarioBreakdown: scenarioBreakdownFormatted,
                            }];
                }
            });
        }); }),
        leaderboard: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
            limit: z.number().optional().default(10),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db;
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _c.sent();
                        if (!db)
                            return [2 /*return*/, []];
                        // This is a complex query that requires aggregating data from multiple tables
                        // For now, return mock data since the actual implementation would require
                        // more complex SQL queries or multiple database calls
                        return [2 /*return*/, [
                                { userId: 1, userName: 'Sarah Chen', totalScore: 2850, certifications: 8, maturityLevel: 4, lastActive: new Date('2024-12-04') },
                                { userId: 2, userName: 'Mike Johnson', totalScore: 2720, certifications: 7, maturityLevel: 4, lastActive: new Date('2024-12-03') },
                                { userId: 3, userName: 'Alex Rodriguez', totalScore: 2680, certifications: 6, maturityLevel: 3, lastActive: new Date('2024-12-04') },
                                { userId: 4, userName: 'Emma Davis', totalScore: 2590, certifications: 7, maturityLevel: 3, lastActive: new Date('2024-12-02') },
                                { userId: 5, userName: 'David Kim', totalScore: 2470, certifications: 5, maturityLevel: 4, lastActive: new Date('2024-12-01') }
                            ]];
                }
            });
        }); }),
        knowledgeGain: protectedProcedure
            .input(z.object({
            dateRange: z.enum(['7d', '30d', '90d', 'all']).optional().default('30d'),
        }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var db, quizResults, days, cutoffDate, userRoles, users, pillarNames, pillars, _c, analyzeKnowledgeGain, generateKnowledgeGainInsights, report, insights;
            var input = _b.input;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, getDb()];
                    case 1:
                        db = _d.sent();
                        if (!db)
                            return [2 /*return*/, null];
                        if (!(input.dateRange !== 'all')) return [3 /*break*/, 3];
                        days = input.dateRange === '7d' ? 7 : input.dateRange === '30d' ? 30 : 90;
                        cutoffDate = new Date();
                        cutoffDate.setDate(cutoffDate.getDate() - days);
                        return [4 /*yield*/, db
                                .select()
                                .from(quizResults)
                                .where(db.sql(templateObject_12 || (templateObject_12 = __makeTemplateObject(["completedAt >= ", ""], ["completedAt >= ", ""])), cutoffDate))
                                .orderBy(desc(quizResults.completedAt))];
                    case 2:
                        quizResults = _d.sent();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, db
                            .select()
                            .from(quizResults)
                            .orderBy(desc(quizResults.completedAt))];
                    case 4:
                        quizResults = _d.sent();
                        _d.label = 5;
                    case 5:
                        userRoles = new Map();
                        return [4 /*yield*/, db.select().from(users)];
                    case 6:
                        users = _d.sent();
                        users.forEach(function (user) {
                            if (user.vosRole) {
                                userRoles.set(user.id, user.vosRole);
                            }
                        });
                        pillarNames = new Map();
                        return [4 /*yield*/, db.select().from(pillars)];
                    case 7:
                        pillars = _d.sent();
                        pillars.forEach(function (pillar) {
                            pillarNames.set(pillar.id, pillar.title);
                        });
                        return [4 /*yield*/, import('../lib/knowledge-gain')];
                    case 8:
                        _c = _d.sent(), analyzeKnowledgeGain = _c.analyzeKnowledgeGain, generateKnowledgeGainInsights = _c.generateKnowledgeGainInsights;
                        report = analyzeKnowledgeGain(quizResults, userRoles, pillarNames);
                        insights = generateKnowledgeGainInsights(report);
                        return [2 /*return*/, {
                                report: report,
                                insights: insights,
                            }];
                }
            });
        }); }),
    }),
    // Simulations
    simulations: router({
        list: protectedProcedure.query(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db.getAllSimulationScenarios()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); }),
        getById: protectedProcedure
            .input(z.object({ id: z.number() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getSimulationScenarioById(input.id)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getAttempts: protectedProcedure
            .input(z.object({ scenarioId: z.number().optional() }))
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserSimulationAttempts(ctx.user.id, input.scenarioId)];
                    case 1: return [2 /*return*/, _c.sent()];
                }
            });
        }); }),
        getAnalytics: protectedProcedure
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var attempts, scenarios, totalAttempts, avgScore, bestScore, passedAttempts, completionRate, categoryAverages, scenarioStats, scoreTrend;
            var ctx = _b.ctx;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, db.getUserSimulationAttempts(ctx.user.id)];
                    case 1:
                        attempts = _c.sent();
                        return [4 /*yield*/, db.getAllSimulationScenarios()];
                    case 2:
                        scenarios = _c.sent();
                        totalAttempts = attempts.length;
                        avgScore = totalAttempts > 0
                            ? Math.round(attempts.reduce(function (sum, a) { return sum + a.overallScore; }, 0) / totalAttempts)
                            : 0;
                        bestScore = totalAttempts > 0
                            ? Math.max.apply(Math, attempts.map(function (a) { return a.overallScore; })) : 0;
                        passedAttempts = attempts.filter(function (a) { return a.passed; }).length;
                        completionRate = totalAttempts > 0
                            ? Math.round((passedAttempts / totalAttempts) * 100)
                            : 0;
                        categoryAverages = totalAttempts > 0 ? {
                            technical: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.technical) || 0); }, 0) / totalAttempts),
                            crossFunctional: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.crossFunctional) || 0); }, 0) / totalAttempts),
                            aiAugmentation: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.aiAugmentation) || 0); }, 0) / totalAttempts),
                        } : {
                            technical: 0,
                            crossFunctional: 0,
                            aiAugmentation: 0,
                        };
                        scenarioStats = scenarios.map(function (scenario) {
                            var scenarioAttempts = attempts.filter(function (a) { return a.scenarioId === scenario.id; });
                            var scenarioAvg = scenarioAttempts.length > 0
                                ? Math.round(scenarioAttempts.reduce(function (sum, a) { return sum + a.overallScore; }, 0) / scenarioAttempts.length)
                                : 0;
                            var scenarioBest = scenarioAttempts.length > 0
                                ? Math.max.apply(Math, scenarioAttempts.map(function (a) { return a.overallScore; })) : 0;
                            return {
                                scenarioId: scenario.id,
                                scenarioTitle: scenario.title,
                                scenarioType: scenario.type,
                                attemptCount: scenarioAttempts.length,
                                avgScore: scenarioAvg,
                                bestScore: scenarioBest,
                                lastAttempt: scenarioAttempts.length > 0
                                    ? scenarioAttempts[scenarioAttempts.length - 1].completedAt
                                    : null,
                            };
                        }).filter(function (s) { return s.attemptCount > 0; });
                        scoreTrend = attempts
                            .slice(-10)
                            .map(function (a) {
                            var _a;
                            return ({
                                attemptId: a.id,
                                scenarioTitle: ((_a = scenarios.find(function (s) { return s.id === a.scenarioId; })) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown',
                                score: a.overallScore,
                                completedAt: a.completedAt,
                                passed: a.passed,
                            });
                        });
                        return [2 /*return*/, {
                                overview: {
                                    totalAttempts: totalAttempts,
                                    avgScore: avgScore,
                                    bestScore: bestScore,
                                    completionRate: completionRate,
                                },
                                categoryAverages: categoryAverages,
                                scenarioStats: scenarioStats,
                                scoreTrend: scoreTrend,
                                recentAttempts: attempts.slice(-5).reverse().map(function (a) {
                                    var _a, _b;
                                    return ({
                                        id: a.id,
                                        scenarioTitle: ((_a = scenarios.find(function (s) { return s.id === a.scenarioId; })) === null || _a === void 0 ? void 0 : _a.title) || 'Unknown',
                                        scenarioType: ((_b = scenarios.find(function (s) { return s.id === a.scenarioId; })) === null || _b === void 0 ? void 0 : _b.type) || 'unknown',
                                        attemptNumber: a.attemptNumber,
                                        overallScore: a.overallScore,
                                        categoryScores: a.categoryScores,
                                        passed: a.passed,
                                        timeSpent: a.timeSpent,
                                        completedAt: a.completedAt,
                                    });
                                }),
                            }];
                }
            });
        }); }),
        evaluateResponse: protectedProcedure
            .input(z.object({
            scenarioId: z.number(),
            stepNumber: z.number(),
            userResponse: z.string(),
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var scenario, _c, getBusinessCaseEvaluationPrompt, getSystemPrompt, evaluationPrompt, systemPrompt, aiResponse_1, messageContent_1, jsonMatch, jsonStr, evaluation, _d, getQBRExpansionEvaluationPrompt, getSystemPrompt, evaluationPrompt, systemPrompt, aiResponse_2, messageContent_2, jsonMatch, jsonStr, evaluation, aiResponse, messageContent;
            var _e, _f, _g, _h, _j, _k;
            var input = _b.input;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0: return [4 /*yield*/, db.getSimulationScenarioById(input.scenarioId)];
                    case 1:
                        scenario = _l.sent();
                        if (!scenario) {
                            throw new Error('Scenario not found');
                        }
                        if (!(scenario.type === 'business_case')) return [3 /*break*/, 4];
                        return [4 /*yield*/, import('./business-case-evaluation')];
                    case 2:
                        _c = _l.sent(), getBusinessCaseEvaluationPrompt = _c.getBusinessCaseEvaluationPrompt, getSystemPrompt = _c.getSystemPrompt;
                        evaluationPrompt = getBusinessCaseEvaluationPrompt(input.stepNumber, input.userResponse);
                        systemPrompt = getSystemPrompt();
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: evaluationPrompt }
                                ]
                            })];
                    case 3:
                        aiResponse_1 = _l.sent();
                        messageContent_1 = (_f = (_e = aiResponse_1.choices[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content;
                        if (!messageContent_1 || typeof messageContent_1 !== 'string') {
                            throw new Error('Failed to get AI evaluation');
                        }
                        // Parse JSON response
                        try {
                            jsonMatch = messageContent_1.match(/```json\s*([\s\S]*?)\s*```/) ||
                                messageContent_1.match(/```\s*([\s\S]*?)\s*```/) ||
                                [null, messageContent_1];
                            jsonStr = jsonMatch[1] || messageContent_1;
                            evaluation = JSON.parse(jsonStr.trim());
                            return [2 /*return*/, {
                                    score: evaluation.score,
                                    categoryBreakdown: evaluation.categoryBreakdown,
                                    strengths: evaluation.strengths,
                                    improvements: evaluation.improvements,
                                    feedback: evaluation.feedback,
                                }];
                        }
                        catch (error) {
                            console.error('Failed to parse AI evaluation:', messageContent_1);
                            throw new Error('Failed to parse AI evaluation response');
                        }
                        return [3 /*break*/, 7];
                    case 4:
                        if (!(scenario.type === 'qbr_expansion')) return [3 /*break*/, 7];
                        return [4 /*yield*/, import('./qbr-expansion-evaluation')];
                    case 5:
                        _d = _l.sent(), getQBRExpansionEvaluationPrompt = _d.getQBRExpansionEvaluationPrompt, getSystemPrompt = _d.getSystemPrompt;
                        evaluationPrompt = getQBRExpansionEvaluationPrompt(input.stepNumber, input.userResponse);
                        systemPrompt = getSystemPrompt();
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: evaluationPrompt }
                                ]
                            })];
                    case 6:
                        aiResponse_2 = _l.sent();
                        messageContent_2 = (_h = (_g = aiResponse_2.choices[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.content;
                        if (!messageContent_2 || typeof messageContent_2 !== 'string') {
                            throw new Error('Failed to get AI evaluation');
                        }
                        // Parse JSON response
                        try {
                            jsonMatch = messageContent_2.match(/```json\s*([\s\S]*?)\s*```/) ||
                                messageContent_2.match(/```\s*([\s\S]*?)\s*```/) ||
                                [null, messageContent_2];
                            jsonStr = jsonMatch[1] || messageContent_2;
                            evaluation = JSON.parse(jsonStr.trim());
                            return [2 /*return*/, {
                                    score: evaluation.score,
                                    categoryBreakdown: evaluation.categoryBreakdown,
                                    strengths: evaluation.strengths,
                                    improvements: evaluation.improvements,
                                    feedback: evaluation.feedback,
                                }];
                        }
                        catch (error) {
                            console.error('Failed to parse AI evaluation:', messageContent_2);
                            throw new Error('Failed to parse AI evaluation response');
                        }
                        _l.label = 7;
                    case 7: return [4 /*yield*/, invokeLLM({
                            messages: [
                                { role: "system", content: "You are a VOS training expert. Evaluate this simulation response." },
                                { role: "user", content: "Evaluate this response: ".concat(input.userResponse) }
                            ]
                        })];
                    case 8:
                        aiResponse = _l.sent();
                        messageContent = ((_k = (_j = aiResponse.choices[0]) === null || _j === void 0 ? void 0 : _j.message) === null || _k === void 0 ? void 0 : _k.content) || "Good effort!";
                        return [2 /*return*/, {
                                score: 75,
                                categoryBreakdown: { technical: 30, crossFunctional: 23, aiAugmentation: 22 },
                                strengths: ["Shows understanding of concepts"],
                                improvements: ["Could provide more detail"],
                                feedback: typeof messageContent === 'string' ? messageContent : "Good effort!",
                            }];
                }
            });
        }); }),
        submitAttempt: protectedProcedure
            .input(z.object({
            scenarioId: z.number(),
            responsesData: z.array(z.object({
                stepNumber: z.number(),
                userResponse: z.string(),
                aiFeedback: z.string(),
                score: z.number(),
                strengths: z.array(z.string()),
                improvements: z.array(z.string()),
            })),
            timeSpent: z.number(),
        }))
            .mutation(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var overallScore, categoryScores, passed, attemptCount, attemptNumber, feedbackPrompt, aiResponse, messageContent, overallFeedback, scenario;
            var _c, _d;
            var ctx = _b.ctx, input = _b.input;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        overallScore = Math.round(input.responsesData.reduce(function (sum, r) { return sum + r.score; }, 0) / input.responsesData.length);
                        categoryScores = {
                            technical: Math.round(overallScore * 0.95),
                            crossFunctional: Math.round(overallScore * 1.0),
                            aiAugmentation: Math.round(overallScore * 1.05),
                        };
                        passed = overallScore >= 80;
                        return [4 /*yield*/, db.getSimulationAttemptCount(ctx.user.id, input.scenarioId)];
                    case 1:
                        attemptCount = _e.sent();
                        attemptNumber = attemptCount + 1;
                        feedbackPrompt = "Based on this simulation performance:\n- Overall Score: ".concat(overallScore, "/100\n- Passed: ").concat(passed ? "Yes" : "No", "\n- Technical: ").concat(categoryScores.technical, "/100\n- Cross-Functional: ").concat(categoryScores.crossFunctional, "/100\n- AI Augmentation: ").concat(categoryScores.aiAugmentation, "/100\n\nProvide brief (2-3 sentences) summary and key recommendations.");
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    { role: "system", content: "You are a VOS training expert." },
                                    { role: "user", content: feedbackPrompt }
                                ]
                            })];
                    case 2:
                        aiResponse = _e.sent();
                        messageContent = (_d = (_c = aiResponse.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
                        overallFeedback = typeof messageContent === 'string' ? messageContent : "Great effort!";
                        // Save attempt
                        return [4 /*yield*/, db.createSimulationAttempt({
                                userId: ctx.user.id,
                                scenarioId: input.scenarioId,
                                attemptNumber: attemptNumber,
                                responsesData: input.responsesData,
                                overallScore: overallScore,
                                categoryScores: categoryScores,
                                passed: passed,
                                timeSpent: input.timeSpent,
                                feedback: overallFeedback,
                                completedAt: new Date(),
                            })];
                    case 3:
                        // Save attempt
                        _e.sent();
                        if (!(passed && overallScore >= 95 && ctx.user.vosRole)) return [3 /*break*/, 6];
                        return [4 /*yield*/, db.getSimulationScenarioById(input.scenarioId)];
                    case 4:
                        scenario = _e.sent();
                        if (!(scenario && scenario.pillarId)) return [3 /*break*/, 6];
                        return [4 /*yield*/, db.createCertification({
                                userId: ctx.user.id,
                                badgeName: "".concat(scenario.title, " - Gold"),
                                pillarId: scenario.pillarId,
                                vosRole: ctx.user.vosRole,
                                awardedAt: new Date(),
                            })];
                    case 5:
                        _e.sent();
                        _e.label = 6;
                    case 6: return [2 /*return*/, {
                            success: true,
                            passed: passed,
                            overallScore: overallScore,
                            categoryScores: categoryScores,
                            feedback: overallFeedback,
                            attemptNumber: attemptNumber,
                        }];
                }
            });
        }); }),
        getRecommendations: protectedProcedure
            .query(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
            var user, attempts, quizAttempts, scenarios, pillars, totalAttempts, avgScore, categoryAverages, completedSimulationIds, completedPillarIds, contextPrompt, aiResponse, messageContent, jsonMatch, jsonStr, recommendations;
            var _c, _d;
            var ctx = _b.ctx;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        user = ctx.user;
                        return [4 /*yield*/, db.getUserSimulationAttempts(user.id)];
                    case 1:
                        attempts = _e.sent();
                        return [4 /*yield*/, db.getUserQuizResults(user.id)];
                    case 2:
                        quizAttempts = _e.sent();
                        return [4 /*yield*/, db.getAllSimulationScenarios()];
                    case 3:
                        scenarios = _e.sent();
                        return [4 /*yield*/, db.getAllPillars()];
                    case 4:
                        pillars = _e.sent();
                        totalAttempts = attempts.length;
                        avgScore = totalAttempts > 0
                            ? Math.round(attempts.reduce(function (sum, a) { return sum + a.overallScore; }, 0) / totalAttempts)
                            : 0;
                        categoryAverages = totalAttempts > 0 ? {
                            technical: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.technical) || 0); }, 0) / totalAttempts),
                            crossFunctional: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.crossFunctional) || 0); }, 0) / totalAttempts),
                            aiAugmentation: Math.round(attempts.reduce(function (sum, a) { var _a; return sum + (((_a = a.categoryScores) === null || _a === void 0 ? void 0 : _a.aiAugmentation) || 0); }, 0) / totalAttempts),
                        } : { technical: 0, crossFunctional: 0, aiAugmentation: 0 };
                        completedSimulationIds = Array.from(new Set(attempts.filter(function (a) { return a.passed; }).map(function (a) { return a.scenarioId; })));
                        completedPillarIds = Array.from(new Set(quizAttempts.filter(function (a) { return a.score >= 80; }).map(function (a) { return a.pillarId; })));
                        contextPrompt = "\nUser Profile:\n- VOS Role: ".concat(user.vosRole || 'Not specified', "\n- Maturity Level: ").concat(user.maturityLevel || 1, "\n- Total Simulation Attempts: ").concat(totalAttempts, "\n- Average Score: ").concat(avgScore, "/100\n- Category Scores:\n  * Technical: ").concat(categoryAverages.technical, "/100\n  * Cross-Functional: ").concat(categoryAverages.crossFunctional, "/100\n  * AI Augmentation: ").concat(categoryAverages.aiAugmentation, "/100\n\nCompleted Simulations: ").concat(completedSimulationIds.length, "/").concat(scenarios.length, "\nCompleted Pillars: ").concat(completedPillarIds.length, "/").concat(pillars.length, "\n\nAvailable Simulations:\n").concat(scenarios.map(function (s) { return "- ".concat(s.title, " (").concat(s.type, ", ").concat(s.difficulty, ")"); }).join('\n'), "\n\nAvailable Pillars:\n").concat(pillars.map(function (p) { return "- Pillar ".concat(p.pillarNumber, ": ").concat(p.title); }).join('\n'), "\n\nBased on this user's progress and performance, provide personalized learning recommendations in the following JSON format:\n\n{\n  \"nextSimulations\": [\n    {\n      \"simulationTitle\": \"string\",\n      \"reason\": \"string (1-2 sentences explaining why this simulation is recommended)\",\n      \"priority\": \"high\" | \"medium\" | \"low\"\n    }\n  ],\n  \"pillarsToStudy\": [\n    {\n      \"pillarNumber\": number,\n      \"pillarTitle\": \"string\",\n      \"reason\": \"string (1-2 sentences explaining why this pillar is recommended)\",\n      \"priority\": \"high\" | \"medium\" | \"low\"\n    }\n  ],\n  \"improvementAreas\": [\n    {\n      \"area\": \"string (e.g., 'Technical Skills', 'Cross-Functional Collaboration')\",\n      \"currentScore\": number,\n      \"targetScore\": number,\n      \"actionItems\": [\"string\", \"string\"],\n      \"priority\": \"high\" | \"medium\" | \"low\"\n    }\n  ],\n  \"overallGuidance\": \"string (2-3 sentences of personalized guidance)\"\n}\n\nProvide 2-3 recommendations for each category. Focus on actionable, specific guidance tailored to the user's role, maturity level, and performance gaps.");
                        return [4 /*yield*/, invokeLLM({
                                messages: [
                                    {
                                        role: "system",
                                        content: "You are a VOS (Value Operating System) learning advisor. Analyze user progress data and provide personalized, actionable learning recommendations. Be specific and practical."
                                    },
                                    { role: "user", content: contextPrompt }
                                ]
                            })];
                    case 5:
                        aiResponse = _e.sent();
                        messageContent = (_d = (_c = aiResponse.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content;
                        if (!messageContent || typeof messageContent !== 'string') {
                            throw new Error('Failed to generate recommendations');
                        }
                        // Parse JSON response
                        try {
                            jsonMatch = messageContent.match(/```json\s*([\s\S]*?)\s*```/) ||
                                messageContent.match(/```\s*([\s\S]*?)\s*```/) ||
                                [null, messageContent];
                            jsonStr = jsonMatch[1] || messageContent;
                            recommendations = JSON.parse(jsonStr.trim());
                            return [2 /*return*/, recommendations];
                        }
                        catch (error) {
                            console.error('Failed to parse AI recommendations:', messageContent);
                            throw new Error('Failed to parse AI recommendations response');
                        }
                        return [2 /*return*/];
                }
            });
        }); }),
    }),
});
// Helper function to generate quiz feedback
function generateQuizFeedback(score, maturityLevel, categoryScores) {
    var feedback = {
        overall: "",
        strengths: [],
        improvements: [],
        nextSteps: [],
    };
    // Overall feedback based on score
    if (score >= 90) {
        feedback.overall = "Excellent work! You've demonstrated strong mastery of this pillar's concepts.";
    }
    else if (score >= 80) {
        feedback.overall = "Good job! You've passed and shown solid understanding of the core concepts.";
    }
    else if (score >= 70) {
        feedback.overall = "You're close! Review the feedback below and retake the quiz to achieve certification.";
    }
    else {
        feedback.overall = "Keep learning! Focus on the improvement areas below and revisit the pillar content.";
    }
    // Maturity-based guidance
    if (maturityLevel <= 1) {
        feedback.nextSteps.push("Focus on building foundational knowledge through the pillar content");
        feedback.nextSteps.push("Review the KPI Definition Sheet and practice mapping pain to value");
    }
    else if (maturityLevel === 2) {
        feedback.nextSteps.push("Apply these concepts in cross-functional scenarios");
        feedback.nextSteps.push("Practice structured value realization tracking");
    }
    else {
        feedback.nextSteps.push("Integrate these concepts into automated workflows");
        feedback.nextSteps.push("Mentor others on value language and frameworks");
    }
    // Category-specific feedback
    if (categoryScores) {
        var categories = Object.entries(categoryScores);
        var strongCategories = categories.filter(function (_a) {
            var _ = _a[0], score = _a[1];
            return score >= 80;
        });
        var weakCategories = categories.filter(function (_a) {
            var _ = _a[0], score = _a[1];
            return score < 70;
        });
        strongCategories.forEach(function (_a) {
            var category = _a[0];
            feedback.strengths.push("Strong performance in ".concat(category));
        });
        weakCategories.forEach(function (_a) {
            var category = _a[0];
            feedback.improvements.push("Review ".concat(category, " concepts and examples"));
        });
    }
    return feedback;
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12;
