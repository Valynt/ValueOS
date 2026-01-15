/**
 * Knowledge Gain Analytics
 * Measures learning improvement through pre/post assessments
 */
/**
 * Calculate knowledge gain metrics from quiz results
 */
export function calculateKnowledgeGain(preScore, postScore, timeSpent) {
    if (timeSpent === void 0) { timeSpent = 0; }
    var knowledgeGain = postScore - (preScore || 0);
    var maxPossibleGain = preScore ? 100 - preScore : 100;
    var normalizedGain = maxPossibleGain > 0 ? (knowledgeGain / maxPossibleGain) * 100 : 0;
    var learningEfficiency = timeSpent > 0 ? knowledgeGain / (timeSpent / 60) : 0; // gain per hour
    return {
        knowledgeGain: knowledgeGain,
        normalizedGain: normalizedGain,
        learningEfficiency: learningEfficiency,
    };
}
/**
 * Analyze knowledge gain patterns from quiz results
 */
export function analyzeKnowledgeGain(quizResults, userRoles, pillarNames) {
    // Group results by user and pillar for pre/post analysis
    var userPillarResults = new Map();
    quizResults.forEach(function (result) {
        var key = "".concat(result.userId, "-").concat(result.pillarId);
        if (!userPillarResults.has(key)) {
            userPillarResults.set(key, []);
        }
        userPillarResults.get(key).push(result);
    });
    // Calculate knowledge gain for each user-pillar combination
    var knowledgeGains = [];
    userPillarResults.forEach(function (results, key) {
        var _a = key.split('-').map(Number), userId = _a[0], pillarId = _a[1];
        var sortedResults = results.sort(function (a, b) {
            return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
        });
        // For now, assume first attempt is pre-assessment, last is post
        // In a real implementation, you'd have explicit pre/post flags
        if (sortedResults.length >= 2) {
            var preAssessment = sortedResults[0];
            var postAssessment = sortedResults[sortedResults.length - 1];
            var _b = calculateKnowledgeGain(preAssessment.score, postAssessment.score, postAssessment.timeSpent || 0), knowledgeGain = _b.knowledgeGain, normalizedGain_1 = _b.normalizedGain, learningEfficiency = _b.learningEfficiency;
            knowledgeGains.push({
                userId: userId,
                pillarId: pillarId,
                preAssessmentScore: preAssessment.score,
                postAssessmentScore: postAssessment.score,
                knowledgeGain: knowledgeGain,
                normalizedGain: normalizedGain_1,
                learningEfficiency: learningEfficiency,
                timeSpent: postAssessment.timeSpent || 0,
                assessmentDate: new Date(postAssessment.completedAt),
            });
        }
        else if (sortedResults.length === 1) {
            // Single assessment - treat as post-assessment only
            var postAssessment = sortedResults[0];
            var _c = calculateKnowledgeGain(undefined, postAssessment.score, postAssessment.timeSpent || 0), knowledgeGain = _c.knowledgeGain, normalizedGain_2 = _c.normalizedGain, learningEfficiency = _c.learningEfficiency;
            knowledgeGains.push({
                userId: userId,
                pillarId: pillarId,
                postAssessmentScore: postAssessment.score,
                knowledgeGain: knowledgeGain,
                normalizedGain: normalizedGain_2,
                learningEfficiency: learningEfficiency,
                timeSpent: postAssessment.timeSpent || 0,
                assessmentDate: new Date(postAssessment.completedAt),
            });
        }
    });
    // Calculate overall metrics
    var totalAssessments = knowledgeGains.length;
    var averageGain = totalAssessments > 0
        ? knowledgeGains.reduce(function (sum, kg) { return sum + kg.knowledgeGain; }, 0) / totalAssessments
        : 0;
    var normalizedGain = totalAssessments > 0
        ? knowledgeGains.reduce(function (sum, kg) { return sum + kg.normalizedGain; }, 0) / totalAssessments
        : 0;
    var highPerformers = knowledgeGains.filter(function (kg) { return kg.knowledgeGain > 20; }).length;
    var lowPerformers = knowledgeGains.filter(function (kg) { return kg.knowledgeGain < 5; }).length;
    // Group by pillar
    var pillarGroups = new Map();
    knowledgeGains.forEach(function (kg) {
        if (!pillarGroups.has(kg.pillarId)) {
            pillarGroups.set(kg.pillarId, []);
        }
        pillarGroups.get(kg.pillarId).push(kg);
    });
    var byPillar = Array.from(pillarGroups.entries()).map(function (_a) {
        var pillarId = _a[0], gains = _a[1];
        var avgPreScore = gains
            .filter(function (g) { return g.preAssessmentScore !== undefined; })
            .reduce(function (sum, g) { return sum + (g.preAssessmentScore || 0); }, 0) / gains.filter(function (g) { return g.preAssessmentScore !== undefined; }).length || 0;
        var avgPostScore = gains.reduce(function (sum, g) { return sum + g.postAssessmentScore; }, 0) / gains.length;
        var avgGain = gains.reduce(function (sum, g) { return sum + g.knowledgeGain; }, 0) / gains.length;
        var normGain = gains.reduce(function (sum, g) { return sum + g.normalizedGain; }, 0) / gains.length;
        return {
            pillarId: pillarId,
            pillarName: pillarNames.get(pillarId) || "Pillar ".concat(pillarId),
            averagePreScore: Math.round(avgPreScore),
            averagePostScore: Math.round(avgPostScore),
            averageGain: Math.round(avgGain),
            normalizedGain: Math.round(normGain),
            totalAssessments: gains.length,
            highPerformers: gains.filter(function (g) { return g.knowledgeGain > 20; }).length,
            lowPerformers: gains.filter(function (g) { return g.knowledgeGain < 5; }).length,
        };
    });
    // Group by role
    var roleGroups = new Map();
    knowledgeGains.forEach(function (kg) {
        var role = userRoles.get(kg.userId) || 'Unknown';
        if (!roleGroups.has(role)) {
            roleGroups.set(role, []);
        }
        roleGroups.get(role).push(kg);
    });
    var byRole = Array.from(roleGroups.entries()).map(function (_a) {
        var role = _a[0], gains = _a[1];
        var avgGain = gains.reduce(function (sum, g) { return sum + g.knowledgeGain; }, 0) / gains.length;
        var normGain = gains.reduce(function (sum, g) { return sum + g.normalizedGain; }, 0) / gains.length;
        var avgTimeSpent = gains.reduce(function (sum, g) { return sum + g.timeSpent; }, 0) / gains.length;
        var learningEfficiency = avgTimeSpent > 0 ? avgGain / (avgTimeSpent / 60) : 0;
        return {
            role: role,
            averageGain: Math.round(avgGain),
            normalizedGain: Math.round(normGain),
            totalUsers: gains.length,
            averageTimeSpent: Math.round(avgTimeSpent),
            learningEfficiency: Math.round(learningEfficiency * 100) / 100,
        };
    });
    // Calculate monthly trends
    var monthlyData = new Map();
    knowledgeGains.forEach(function (kg) {
        var month = kg.assessmentDate.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData.has(month)) {
            monthlyData.set(month, { totalGain: 0, count: 0 });
        }
        var data = monthlyData.get(month);
        data.totalGain += kg.knowledgeGain;
        data.count += 1;
    });
    var trends = {
        monthly: Array.from(monthlyData.entries())
            .sort(function (_a, _b) {
            var a = _a[0];
            var b = _b[0];
            return a.localeCompare(b);
        })
            .map(function (_a) {
            var month = _a[0], data = _a[1];
            return ({
                month: month,
                averageGain: Math.round(data.totalGain / data.count),
                totalAssessments: data.count,
            });
        }),
    };
    return {
        overall: {
            totalAssessments: totalAssessments,
            averageGain: Math.round(averageGain),
            normalizedGain: Math.round(normalizedGain),
            highPerformers: highPerformers,
            lowPerformers: lowPerformers,
        },
        byPillar: byPillar,
        byRole: byRole,
        trends: trends,
    };
}
/**
 * Generate insights from knowledge gain data
 */
export function generateKnowledgeGainInsights(report) {
    var insights = [];
    // Overall insights
    if (report.overall.averageGain > 15) {
        insights.push("\uD83C\uDF89 Excellent learning outcomes with an average knowledge gain of ".concat(report.overall.averageGain, " points"));
    }
    else if (report.overall.averageGain > 10) {
        insights.push("\uD83D\uDC4D Good learning progress with an average gain of ".concat(report.overall.averageGain, " points"));
    }
    else {
        insights.push("\uD83D\uDCC8 Learning gains of ".concat(report.overall.averageGain, " points indicate room for improvement in content effectiveness"));
    }
    // High performers
    var highPerformerRate = report.overall.totalAssessments > 0
        ? (report.overall.highPerformers / report.overall.totalAssessments) * 100
        : 0;
    if (highPerformerRate > 30) {
        insights.push("\u2B50 ".concat(Math.round(highPerformerRate), "% of learners are high performers (gain >20 points)"));
    }
    // Pillar-specific insights
    var topPillar = report.byPillar.reduce(function (best, current) {
        return current.averageGain > best.averageGain ? current : best;
    }, report.byPillar[0]);
    if (topPillar) {
        insights.push("\uD83C\uDFC6 ".concat(topPillar.pillarName, " shows the highest learning gains (").concat(topPillar.averageGain, " points)"));
    }
    // Role-specific insights
    var topRole = report.byRole.reduce(function (best, current) {
        return current.averageGain > best.averageGain ? current : best;
    }, report.byRole[0]);
    if (topRole) {
        insights.push("\uD83C\uDFAF ".concat(topRole.role, " role shows strongest learning outcomes (").concat(topRole.averageGain, " points)"));
    }
    // Time-based insights
    var recentTrend = report.trends.monthly.slice(-2);
    if (recentTrend.length === 2) {
        var older = recentTrend[0], newer = recentTrend[1];
        var change = newer.averageGain - older.averageGain;
        if (change > 5) {
            insights.push("\uD83D\uDCCA Learning effectiveness is improving (+".concat(change, " points in recent months)"));
        }
        else if (change < -5) {
            insights.push("\u26A0\uFE0F Learning effectiveness has declined (".concat(change, " points in recent months)"));
        }
    }
    return insights;
}
