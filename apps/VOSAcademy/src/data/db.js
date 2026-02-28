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
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

import { certifications, maturityAssessments, pillars, progress, quizQuestions, quizResults, resources, simulationAttempts, simulationScenarios, users, } from "../drizzle/schema";

import { ENV } from './_core/env';
var _db = null;
// Lazily create the drizzle instance so local tooling can run without a DB.
export function getDb() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!_db && process.env.DATABASE_URL) {
                try {
                    _db = drizzle(process.env.DATABASE_URL);
                }
                catch (error) {
                    console.warn("[Database] Failed to connect:", error);
                    _db = null;
                }
            }
            return [2 /*return*/, _db];
        });
    });
}
// ============================================================================
// User Management
// ============================================================================
export function upsertUser(user) {
    return __awaiter(this, void 0, void 0, function () {
        var db, values_1, updateSet_1, textFields, assignNullable, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!user.openId) {
                        throw new Error("User openId is required for upsert");
                    }
                    return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot upsert user: database not available");
                        return [2 /*return*/];
                    }
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    values_1 = {
                        openId: user.openId,
                    };
                    updateSet_1 = {};
                    textFields = ["name", "email", "loginMethod"];
                    assignNullable = function (field) {
                        var value = user[field];
                        if (value === undefined)
                            return;
                        var normalized = value !== null && value !== void 0 ? value : null;
                        values_1[field] = normalized;
                        updateSet_1[field] = normalized;
                    };
                    textFields.forEach(assignNullable);
                    if (user.lastSignedIn !== undefined) {
                        values_1.lastSignedIn = user.lastSignedIn;
                        updateSet_1.lastSignedIn = user.lastSignedIn;
                    }
                    if (user.role !== undefined) {
                        values_1.role = user.role;
                        updateSet_1.role = user.role;
                    }
                    else if (user.openId === ENV.ownerOpenId) {
                        values_1.role = 'admin';
                        updateSet_1.role = 'admin';
                    }
                    if (user.vosRole !== undefined) {
                        values_1.vosRole = user.vosRole;
                        updateSet_1.vosRole = user.vosRole;
                    }
                    if (user.maturityLevel !== undefined) {
                        values_1.maturityLevel = user.maturityLevel;
                        updateSet_1.maturityLevel = user.maturityLevel;
                    }
                    if (!values_1.lastSignedIn) {
                        values_1.lastSignedIn = new Date();
                    }
                    if (Object.keys(updateSet_1).length === 0) {
                        updateSet_1.lastSignedIn = new Date();
                    }
                    return [4 /*yield*/, db.insert(users).values(values_1).onDuplicateKeyUpdate({
                            set: updateSet_1,
                        })];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error("[Database] Failed to upsert user:", error_1);
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
export function getUserByOpenId(openId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot get user: database not available");
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, db.select().from(users).where(eq(users.openId, openId)).limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0 ? result[0] : undefined];
            }
        });
    });
}
export function getUserById(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db.select().from(users).where(eq(users.id, userId)).limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0 ? result[0] : undefined];
            }
        });
    });
}
export function updateUserVosRole(userId, vosRole) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.update(users).set({ vosRole: vosRole }).where(eq(users.id, userId))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function updateUserMaturityLevel(userId, level) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.update(users).set({ maturityLevel: level }).where(eq(users.id, userId))];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Pillars
// ============================================================================
export function getAllPillars() {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(pillars).orderBy(pillars.pillarNumber)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getPillarById(pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db.select().from(pillars).where(eq(pillars.id, pillarId)).limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0 ? result[0] : undefined];
            }
        });
    });
}
export function getPillarByNumber(pillarNumber) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db.select().from(pillars).where(eq(pillars.pillarNumber, pillarNumber)).limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0 ? result[0] : undefined];
            }
        });
    });
}
export function createPillar(pillar) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(pillars).values(pillar)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Progress Tracking
// ============================================================================
export function getUserProgress(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(progress).where(eq(progress.userId, userId))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getUserPillarProgress(userId, pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db
                            .select()
                            .from(progress)
                            .where(and(eq(progress.userId, userId), eq(progress.pillarId, pillarId)))
                            .limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0 ? result[0] : undefined];
            }
        });
    });
}
export function upsertProgress(progressData) {
    return __awaiter(this, void 0, void 0, function () {
        var db, existing;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, getUserPillarProgress(progressData.userId, progressData.pillarId)];
                case 2:
                    existing = _a.sent();
                    if (!existing) return [3 /*break*/, 4];
                    return [4 /*yield*/, db
                            .update(progress)
                            .set({
                            status: progressData.status,
                            completionPercentage: progressData.completionPercentage,
                            lastAccessed: new Date(),
                            completedAt: progressData.completedAt,
                        })
                            .where(eq(progress.id, existing.id))];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, db.insert(progress).values(progressData)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Quiz Questions
// ============================================================================
export function getQuizQuestionsByPillar(pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db
                            .select()
                            .from(quizQuestions)
                            .where(eq(quizQuestions.pillarId, pillarId))
                            .orderBy(quizQuestions.questionNumber)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function createQuizQuestion(question) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(quizQuestions).values(question)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function createQuizQuestions(questions) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(quizQuestions).values(questions)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Quiz Results
// ============================================================================
export function getUserQuizResults(userId, pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, conditions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    conditions = pillarId
                        ? and(eq(quizResults.userId, userId), eq(quizResults.pillarId, pillarId))
                        : eq(quizResults.userId, userId);
                    return [4 /*yield*/, db.select().from(quizResults).where(conditions).orderBy(desc(quizResults.completedAt))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getLatestQuizResult(userId, pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db
                            .select()
                            .from(quizResults)
                            .where(and(eq(quizResults.userId, userId), eq(quizResults.pillarId, pillarId)))
                            .orderBy(desc(quizResults.completedAt))
                            .limit(1)];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results.length > 0 ? results[0] : undefined];
            }
        });
    });
}
export function createQuizResult(result) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(quizResults).values(result)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Certifications
// ============================================================================
export function getUserCertifications(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(certifications).where(eq(certifications.userId, userId)).orderBy(desc(certifications.awardedAt))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function createCertification(cert) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(certifications).values(cert)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function hasCertification(userId, pillarId, vosRole) {
    return __awaiter(this, void 0, void 0, function () {
        var db, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, false];
                    return [4 /*yield*/, db
                            .select()
                            .from(certifications)
                            .where(and(eq(certifications.userId, userId), eq(certifications.pillarId, pillarId), eq(certifications.vosRole, vosRole)))
                            .limit(1)];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0];
            }
        });
    });
}
// ============================================================================
// Maturity Assessments
// ============================================================================
export function getUserMaturityAssessments(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db
                            .select()
                            .from(maturityAssessments)
                            .where(eq(maturityAssessments.userId, userId))
                            .orderBy(desc(maturityAssessments.assessedAt))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getLatestMaturityAssessment(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, db
                            .select()
                            .from(maturityAssessments)
                            .where(eq(maturityAssessments.userId, userId))
                            .orderBy(desc(maturityAssessments.assessedAt))
                            .limit(1)];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results.length > 0 ? results[0] : undefined];
            }
        });
    });
}
export function createMaturityAssessment(assessment) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(maturityAssessments).values(assessment)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Resources
// ============================================================================
export function getAllResources() {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(resources)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getResourcesByPillar(pillarId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(resources).where(eq(resources.pillarId, pillarId))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getResourcesByRole(vosRole) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, db.select().from(resources).where(eq(resources.vosRole, vosRole))];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function createResource(resource) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db)
                        return [2 /*return*/];
                    return [4 /*yield*/, db.insert(resources).values(resource)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// ============================================================================
// Simulation Management
// ============================================================================
export function createSimulationScenario(scenario) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot create simulation scenario: database not available");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, db.insert(simulationScenarios).values(scenario)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function getAllSimulationScenarios() {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot get simulation scenarios: database not available");
                        return [2 /*return*/, []];
                    }
                    return [4 /*yield*/, db.select().from(simulationScenarios)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getSimulationScenarioById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var db, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot get simulation scenario: database not available");
                        return [2 /*return*/, undefined];
                    }
                    return [4 /*yield*/, db
                            .select()
                            .from(simulationScenarios)
                            .where(eq(simulationScenarios.id, id))
                            .limit(1)];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results[0]];
            }
        });
    });
}
export function createSimulationAttempt(attempt) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot create simulation attempt: database not available");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, db.insert(simulationAttempts).values(attempt)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
export function getUserSimulationAttempts(userId, scenarioId) {
    return __awaiter(this, void 0, void 0, function () {
        var db;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot get simulation attempts: database not available");
                        return [2 /*return*/, []];
                    }
                    if (!scenarioId) return [3 /*break*/, 3];
                    return [4 /*yield*/, db
                            .select()
                            .from(simulationAttempts)
                            .where(and(eq(simulationAttempts.userId, userId), eq(simulationAttempts.scenarioId, scenarioId)))
                            .orderBy(desc(simulationAttempts.completedAt))];
                case 2: return [2 /*return*/, _a.sent()];
                case 3: return [4 /*yield*/, db
                        .select()
                        .from(simulationAttempts)
                        .where(eq(simulationAttempts.userId, userId))
                        .orderBy(desc(simulationAttempts.completedAt))];
                case 4: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
export function getSimulationAttemptCount(userId, scenarioId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, results;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getDb()];
                case 1:
                    db = _a.sent();
                    if (!db) {
                        console.warn("[Database] Cannot count simulation attempts: database not available");
                        return [2 /*return*/, 0];
                    }
                    return [4 /*yield*/, db
                            .select()
                            .from(simulationAttempts)
                            .where(and(eq(simulationAttempts.userId, userId), eq(simulationAttempts.scenarioId, scenarioId)))];
                case 2:
                    results = _a.sent();
                    return [2 /*return*/, results.length];
            }
        });
    });
}
