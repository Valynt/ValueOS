export declare const appRouter: import("@trpc/server").TRPCBuiltRouter<{
    ctx: {
        req: import("http").IncomingMessage;
        res: import("http").ServerResponse<import("http").IncomingMessage>;
        user: null;
    };
    meta: object;
    errorShape: import("@trpc/server").TRPCDefaultErrorShape;
    transformer: false;
}, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
    system: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        health: any;
        version: any;
    }>>;
    auth: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        me: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: null;
            meta: object;
        }>;
        logout: import("@trpc/server").TRPCMutationProcedure<{
            input: void;
            output: {
                readonly success: true;
            };
            meta: object;
        }>;
    }>>;
    ai: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        chat: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                messages: {
                    role: "system" | "user" | "assistant";
                    content: string;
                }[];
            };
            output: {
                content: string;
            };
            meta: object;
        }>;
        roiNarrative: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                businessCase: string;
                benefits: string[];
                costs: {
                    implementation: number;
                    licensing?: number | undefined;
                    training?: number | undefined;
                };
                timeframe: "1year" | "2years" | "3years";
                audience: "executive" | "finance" | "technical";
            };
            output: {
                narrative: string;
                financials: {
                    totalCosts: number;
                    totalBenefits: number;
                    roi: string;
                };
            };
            meta: object;
        }>;
        valueCase: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                costs: {
                    implementation: number;
                    licensing?: number | undefined;
                    training?: number | undefined;
                };
                audience: "executive" | "finance" | "technical";
                pillarId: number;
                outcomes: string[];
                capabilities: string[];
                kpis: {
                    name: string;
                    timeframe: string;
                    baseline: number;
                    target: number;
                }[];
            };
            output: {
                valueCase: string;
                summary: {
                    pillarTitle: any;
                    totalOutcomes: number;
                    totalCapabilities: number;
                    totalKPIs: number;
                    estimatedCosts: number;
                    estimatedBenefits: number;
                    roi: string;
                };
            };
            meta: object;
        }>;
    }>>;
    user: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        updateVosRole: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                vosRole: "Sales" | "CS" | "Marketing" | "Product" | "Executive" | "VE";
            };
            output: {
                success: boolean;
            };
            meta: object;
        }>;
        updateMaturityLevel: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                level: number;
            };
            output: {
                success: boolean;
            };
            meta: object;
        }>;
    }>>;
    pillars: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        list: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                description: string;
                content: {
                    overview: string;
                    learningObjectives: string[];
                    keyTakeaways: string[];
                    resources: any[];
                } | null;
                id: number;
                pillarNumber: number;
                title: string;
                targetMaturityLevel: number | null;
                duration: string | null;
                createdAt: Date;
            }[];
            meta: object;
        }>;
        getById: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                id: number;
            };
            output: {
                description: string;
                content: {
                    overview: string;
                    learningObjectives: string[];
                    keyTakeaways: string[];
                    resources: any[];
                } | null;
                id: number;
                pillarNumber: number;
                title: string;
                targetMaturityLevel: number | null;
                duration: string | null;
                createdAt: Date;
            } | undefined;
            meta: object;
        }>;
        getByNumber: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarNumber: number;
            };
            output: {
                description: string;
                content: {
                    overview: string;
                    learningObjectives: string[];
                    keyTakeaways: string[];
                    resources: any[];
                } | null;
                id: number;
                pillarNumber: number;
                title: string;
                targetMaturityLevel: number | null;
                duration: string | null;
                createdAt: Date;
            } | undefined;
            meta: object;
        }>;
    }>>;
    progress: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getUserProgress: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                status: string;
                pillarId: number;
                id: number;
                completionPercentage: number | null;
                completedAt: Date | null;
                userId: number;
                lastAccessed: Date | null;
            }[];
            meta: object;
        }>;
        getPillarProgress: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarId: number;
            };
            output: {
                status: string;
                pillarId: number;
                id: number;
                completionPercentage: number | null;
                completedAt: Date | null;
                userId: number;
                lastAccessed: Date | null;
            } | undefined;
            meta: object;
        }>;
        updateProgress: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                status: "not_started" | "in_progress" | "completed";
                pillarId: number;
                completionPercentage: number;
                completedAt?: Date | undefined;
            };
            output: {
                success: boolean;
            };
            meta: object;
        }>;
    }>>;
    quiz: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getQuestions: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarId: number;
            };
            output: {
                options: {
                    id: string;
                    text: string;
                }[] | null;
                pillarId: number;
                id: number;
                createdAt: Date;
                questionNumber: number;
                questionType: string;
                category: string | null;
                questionText: string;
                correctAnswer: string;
                points: number | null;
                explanation: string | null;
                difficultyLevel: string | null;
            }[];
            meta: object;
        }>;
        submitQuiz: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                pillarId: number;
                answers: {
                    questionId: number;
                    selectedAnswer: string;
                    isCorrect: boolean;
                    pointsEarned: number;
                }[];
                score: number;
                categoryScores?: Record<string, number> | undefined;
            };
            output: {
                success: boolean;
                passed: boolean;
                feedback: {
                    overall: string;
                    strengths: string[];
                    improvements: string[];
                    nextSteps: string[];
                };
                attemptNumber: number;
            };
            meta: object;
        }>;
        getResults: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarId?: number | undefined;
            };
            output: {
                pillarId: number;
                id: number;
                completedAt: Date;
                userId: number;
                answers: {
                    questionId: number;
                    selectedAnswer: string;
                    isCorrect: boolean;
                    pointsEarned: number;
                }[] | null;
                score: number;
                categoryScores: Record<string, number> | null;
                passed: number | null;
                feedback: string | null;
                attemptNumber: number | null;
            }[];
            meta: object;
        }>;
    }>>;
    certifications: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        list: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                pillarId: number;
                vosRole: string;
                id: number;
                userId: number;
                score: number | null;
                badgeName: string;
                tier: string | null;
                awardedAt: Date;
            }[];
            meta: object;
        }>;
        getUserCertifications: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                id: number;
                pillarNumber: number;
                pillarTitle: string;
                tier: "bronze" | "silver" | "gold";
                score: number;
                earnedAt: Date;
                expiresAt: null;
            }[];
            meta: object;
        }>;
        generateCertificate: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                certificationId: number;
                format?: "pdf" | "png" | undefined;
            };
            output: {
                certificateData: {
                    userName: string;
                    pillarTitle: string;
                    vosRole: string;
                    tier: "bronze" | "silver" | "gold";
                    score: number;
                    awardedAt: Date;
                    certificateId: string;
                };
                certificateBlob: string;
                downloadUrl: string;
            };
            meta: object;
        }>;
    }>>;
    maturity: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        getAssessments: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                level: number;
                id: number;
                userId: number;
                assessmentData: {
                    selfAssessment: number;
                    quizAverage: number;
                    pillarsCompleted: number;
                    behaviorIndicators: string[];
                    recommendations: string[];
                } | null;
                assessedAt: Date;
            }[];
            meta: object;
        }>;
        createAssessment: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                level: number;
                assessmentData: {
                    selfAssessment: number;
                    quizAverage: number;
                    pillarsCompleted: number;
                    behaviorIndicators: string[];
                    recommendations: string[];
                };
            };
            output: {
                success: boolean;
            };
            meta: object;
        }>;
    }>>;
    resources: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        list: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                pillarId: number | null;
                vosRole: string | null;
                id: number;
                title: string;
                createdAt: Date;
                resourceType: string;
                fileUrl: string;
            }[];
            meta: object;
        }>;
        getByPillar: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarId: number;
            };
            output: {
                pillarId: number | null;
                vosRole: string | null;
                id: number;
                title: string;
                createdAt: Date;
                resourceType: string;
                fileUrl: string;
            }[];
            meta: object;
        }>;
        getByRole: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                vosRole: string;
            };
            output: {
                pillarId: number | null;
                vosRole: string | null;
                id: number;
                title: string;
                createdAt: Date;
                resourceType: string;
                fileUrl: string;
            }[];
            meta: object;
        }>;
    }>>;
    analytics: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        userStats: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                role?: string | undefined;
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                totalUsers: number;
                activeUsers: number;
                newUsersThisMonth: number;
                averageMaturityLevel: number;
            } | null;
            meta: object;
        }>;
        quizStats: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                pillarId?: number | undefined;
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                totalQuizzes: number;
                averageScore: number;
                passRate: number;
                completionRate: number;
                pillarBreakdown: {
                    pillarId: number;
                    pillarName: any;
                    attempts: number;
                    averageScore: number;
                    passRate: number;
                }[];
            } | null;
            meta: object;
        }>;
        certificationStats: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                totalCertifications: number;
                bronzeCount: any;
                silverCount: any;
                goldCount: any;
                roleBreakdown: {
                    role: string;
                    count: any;
                }[];
            } | null;
            meta: object;
        }>;
        simulationStats: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                totalAttempts: number;
                averageScore: number;
                completionRate: number;
                scenarioBreakdown: {
                    scenarioId: number;
                    scenarioName: string;
                    attempts: any;
                    averageScore: number;
                }[];
            } | null;
            meta: object;
        }>;
        leaderboard: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                limit?: number | undefined;
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                userId: number;
                userName: string;
                totalScore: number;
                certifications: number;
                maturityLevel: number;
                lastActive: Date;
            }[];
            meta: object;
        }>;
        knowledgeGain: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                dateRange?: "7d" | "30d" | "90d" | "all" | undefined;
            };
            output: {
                report: import("../lib/knowledge-gain").KnowledgeGainReport;
                insights: string[];
            } | null;
            meta: object;
        }>;
    }>>;
    simulations: import("@trpc/server").TRPCBuiltRouter<{
        ctx: {
            req: import("http").IncomingMessage;
            res: import("http").ServerResponse<import("http").IncomingMessage>;
            user: null;
        };
        meta: object;
        errorShape: import("@trpc/server").TRPCDefaultErrorShape;
        transformer: false;
    }, import("@trpc/server").TRPCDecorateCreateRouterOptions<{
        list: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                type: string;
                description: string;
                vosRole: string | null;
                id: number;
                title: string;
                createdAt: Date;
                difficulty: string | null;
                scenarioData: {
                    context: string;
                    customerProfile: Record<string, any>;
                    objectives: string[];
                    steps: Array<{
                        stepNumber: number;
                        title: string;
                        instruction: string;
                        promptType: string;
                        expectedElements?: string[];
                    }>;
                } | null;
            }[];
            meta: object;
        }>;
        getById: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                id: number;
            };
            output: {
                type: string;
                description: string;
                vosRole: string | null;
                id: number;
                title: string;
                createdAt: Date;
                difficulty: string | null;
                scenarioData: {
                    context: string;
                    customerProfile: Record<string, any>;
                    objectives: string[];
                    steps: Array<{
                        stepNumber: number;
                        title: string;
                        instruction: string;
                        promptType: string;
                        expectedElements?: string[];
                    }>;
                } | null;
            } | undefined;
            meta: object;
        }>;
        getAttempts: import("@trpc/server").TRPCQueryProcedure<{
            input: {
                scenarioId?: number | undefined;
            };
            output: {
                id: number;
                completedAt: Date;
                userId: number;
                categoryScores: {
                    technical: number;
                    crossFunctional: number;
                    aiAugmentation: number;
                } | null;
                passed: number | null;
                feedback: string | null;
                attemptNumber: number;
                scenarioId: number;
                responsesData: {
                    stepNumber: number;
                    userResponse: string;
                    aiFeedback: string;
                    score: number;
                    strengths: string[];
                    improvements: string[];
                }[] | null;
                overallScore: number;
                timeSpent: number | null;
            }[];
            meta: object;
        }>;
        getAnalytics: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: {
                overview: {
                    totalAttempts: number;
                    avgScore: number;
                    bestScore: number;
                    completionRate: number;
                };
                categoryAverages: {
                    technical: number;
                    crossFunctional: number;
                    aiAugmentation: number;
                };
                scenarioStats: {
                    scenarioId: number;
                    scenarioTitle: string;
                    scenarioType: string;
                    attemptCount: number;
                    avgScore: number;
                    bestScore: number;
                    lastAttempt: Date | null;
                }[];
                scoreTrend: {
                    attemptId: number;
                    scenarioTitle: string;
                    score: number;
                    completedAt: Date;
                    passed: number | null;
                }[];
                recentAttempts: {
                    id: number;
                    scenarioTitle: string;
                    scenarioType: string;
                    attemptNumber: number;
                    overallScore: number;
                    categoryScores: {
                        technical: number;
                        crossFunctional: number;
                        aiAugmentation: number;
                    } | null;
                    passed: number | null;
                    timeSpent: number | null;
                    completedAt: Date;
                }[];
            };
            meta: object;
        }>;
        evaluateResponse: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                scenarioId: number;
                stepNumber: number;
                userResponse: string;
            };
            output: {
                score: any;
                categoryBreakdown: any;
                strengths: any;
                improvements: any;
                feedback: any;
            };
            meta: object;
        }>;
        submitAttempt: import("@trpc/server").TRPCMutationProcedure<{
            input: {
                scenarioId: number;
                responsesData: {
                    score: number;
                    stepNumber: number;
                    userResponse: string;
                    aiFeedback: string;
                    strengths: string[];
                    improvements: string[];
                }[];
                timeSpent: number;
            };
            output: {
                success: boolean;
                passed: boolean;
                overallScore: number;
                categoryScores: {
                    technical: number;
                    crossFunctional: number;
                    aiAugmentation: number;
                };
                feedback: string;
                attemptNumber: number;
            };
            meta: object;
        }>;
        getRecommendations: import("@trpc/server").TRPCQueryProcedure<{
            input: void;
            output: any;
            meta: object;
        }>;
    }>>;
}>>;
export type AppRouter = typeof appRouter;
