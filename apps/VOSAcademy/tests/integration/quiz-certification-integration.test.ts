import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { appRouter } from '../../src/data/routers/index';
import type { Context } from '../../src/data/_core/trpc';

/**
 * Integration tests for quiz and certification flow
 * Tests the complete journey from taking a quiz to earning a certification
 */

// Mock data
const mockPillar = {
  id: 1,
  pillarNumber: 1,
  title: 'Value Language',
  description: 'Learn the language of value',
  targetMaturityLevel: 1,
  duration: '2 hours',
  content: {
    overview: 'Test overview',
    learningObjectives: ['Objective 1'],
    keyTakeaways: ['Takeaway 1'],
    resources: [],
  },
  createdAt: new Date(),
};

const mockQuizQuestions = [
  {
    id: 1,
    pillarId: 1,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'technical',
    questionText: 'What is value?',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
      { id: 'c', text: 'Option C' },
    ],
    correctAnswer: 'b',
    points: 4,
    explanation: 'Explanation here',
    difficultyLevel: 'intermediate',
    createdAt: new Date(),
  },
  {
    id: 2,
    pillarId: 1,
    questionNumber: 2,
    questionType: 'multiple_choice',
    category: 'crossFunctional',
    questionText: 'How to communicate value?',
    options: [
      { id: 'a', text: 'Option A' },
      { id: 'b', text: 'Option B' },
    ],
    correctAnswer: 'a',
    points: 4,
    explanation: 'Explanation here',
    difficultyLevel: 'intermediate',
    createdAt: new Date(),
  },
];

// Mock database
vi.mock('../../src/data/db', () => ({
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  getPillarById: vi.fn(async (id: number) => {
    if (id === 1) return mockPillar;
    return null;
  }),
  getQuizQuestionsByPillar: vi.fn(async (pillarId: number) => {
    if (pillarId === 1) return mockQuizQuestions;
    return [];
  }),
  getUserQuizResults: vi.fn(async () => []),
  createQuizResult: vi.fn(async () => {}),
  getUserSimulationAttempts: vi.fn(async () => []),
  hasCertification: vi.fn(async () => false),
  createCertification: vi.fn(async () => {}),
  upsertProgress: vi.fn(async () => {}),
  getUserCertifications: vi.fn(async () => []),
}));

describe('Quiz and Certification Integration Tests', () => {
  let mockContext: Context;
  let mockUser: any;

  beforeEach(() => {
    mockUser = {
      id: 'user-uuid-123',
      openId: 'test-user-123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      vosRole: 'Sales',
      maturityLevel: 1,
      createdAt: new Date(),
      lastSignedIn: new Date(),
    };

    mockContext = {
      req: { headers: {} },
      res: { setHeader: vi.fn() },
      user: mockUser,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Quiz Flow', () => {
    it('should retrieve quiz questions for a pillar', async () => {
      const caller = appRouter.createCaller(mockContext);
      const questions = await caller.quiz.getQuestions({ pillarId: 1 });

      expect(Array.isArray(questions)).toBe(true);
      expect(questions).toHaveLength(2);
      expect(questions[0].questionText).toBe('What is value?');
    });

    it('should submit quiz with passing score', async () => {
      const caller = appRouter.createCaller(mockContext);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [
          {
            questionId: 1,
            selectedAnswer: 'b',
            isCorrect: true,
            pointsEarned: 4,
          },
          {
            questionId: 2,
            selectedAnswer: 'a',
            isCorrect: true,
            pointsEarned: 4,
          },
        ],
        score: 100,
        categoryScores: {
          technical: 100,
          crossFunctional: 100,
        },
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(true);
      expect(result.attemptNumber).toBe(1);
    });

    it('should submit quiz with failing score', async () => {
      const caller = appRouter.createCaller(mockContext);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [
          {
            questionId: 1,
            selectedAnswer: 'a',
            isCorrect: false,
            pointsEarned: 0,
          },
          {
            questionId: 2,
            selectedAnswer: 'b',
            isCorrect: false,
            pointsEarned: 0,
          },
        ],
        score: 50,
        categoryScores: {
          technical: 50,
          crossFunctional: 50,
        },
      });

      expect(result.success).toBe(true);
      expect(result.passed).toBe(false);
    });

    it('should provide feedback based on score', async () => {
      const caller = appRouter.createCaller(mockContext);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [
          {
            questionId: 1,
            selectedAnswer: 'b',
            isCorrect: true,
            pointsEarned: 4,
          },
        ],
        score: 85,
        categoryScores: {
          technical: 85,
        },
      });

      expect(result.feedback).toBeDefined();
      expect(result.feedback.overall).toBeDefined();
      expect(result.feedback.nextSteps).toBeDefined();
    });
  });

  describe('Certification Flow', () => {
    it('should award certification on passing quiz', async () => {
      const { createCertification } = await import('../../src/data/db');
      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [
          {
            questionId: 1,
            selectedAnswer: 'b',
            isCorrect: true,
            pointsEarned: 4,
          },
          {
            questionId: 2,
            selectedAnswer: 'a',
            isCorrect: true,
            pointsEarned: 4,
          },
        ],
        score: 90,
        categoryScores: {
          technical: 90,
          crossFunctional: 90,
        },
      });

      // Verify certification was created
      expect(createCertification).toHaveBeenCalled();
    });

    it('should not award certification on failing quiz', async () => {
      const { createCertification } = await import('../../src/data/db');
      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [
          {
            questionId: 1,
            selectedAnswer: 'a',
            isCorrect: false,
            pointsEarned: 0,
          },
        ],
        score: 60,
        categoryScores: {
          technical: 60,
        },
      });

      // Verify certification was NOT created
      expect(createCertification).not.toHaveBeenCalled();
    });

    it('should calculate certification tier based on score', async () => {
      const { createCertification } = await import('../../src/data/db');
      const caller = appRouter.createCaller(mockContext);

      // Gold tier (95+)
      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 96,
        categoryScores: {},
      });

      expect(createCertification).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: 'gold',
        })
      );
    });

    it('should not duplicate certifications', async () => {
      const { hasCertification, createCertification } = await import('../../src/data/db');
      
      // Mock that user already has certification
      (hasCertification as any).mockResolvedValueOnce(true);

      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 90,
        categoryScores: {},
      });

      // Should check for existing certification
      expect(hasCertification).toHaveBeenCalled();
      // Should not create duplicate
      expect(createCertification).not.toHaveBeenCalled();
    });
  });

  describe('Progress Tracking', () => {
    it('should update progress on quiz completion', async () => {
      const { upsertProgress } = await import('../../src/data/db');
      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 85,
        categoryScores: {},
      });

      // Verify progress was updated
      expect(upsertProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          pillarId: 1,
          status: 'completed',
          completionPercentage: 100,
        })
      );
    });

    it('should mark pillar as completed on passing', async () => {
      const { upsertProgress } = await import('../../src/data/db');
      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 90,
        categoryScores: {},
      });

      expect(upsertProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        })
      );
    });
  });

  describe('Retake Logic', () => {
    it('should track attempt number', async () => {
      const { getUserQuizResults } = await import('../../src/data/db');
      
      // Mock previous attempts
      (getUserQuizResults as any).mockResolvedValueOnce([
        { attemptNumber: 1, score: 70, passed: false },
        { attemptNumber: 2, score: 75, passed: false },
      ]);

      const caller = appRouter.createCaller(mockContext);

      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 85,
        categoryScores: {},
      });

      expect(result.attemptNumber).toBe(3);
    });

    it('should allow multiple attempts', async () => {
      const caller = appRouter.createCaller(mockContext);

      // First attempt - fail
      const attempt1 = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 70,
        categoryScores: {},
      });

      expect(attempt1.passed).toBe(false);

      // Second attempt - pass
      const attempt2 = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 85,
        categoryScores: {},
      });

      expect(attempt2.passed).toBe(true);
    });
  });

  describe('40/30/30 Rubric', () => {
    it('should calculate final score using rubric', async () => {
      const { createCertification } = await import('../../src/data/db');
      const { getUserSimulationAttempts } = await import('../../src/data/db');

      // Mock simulation attempts
      (getUserSimulationAttempts as any).mockResolvedValueOnce([
        { overallScore: 90 },
      ]);

      const caller = appRouter.createCaller(mockContext);

      await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 85, // Quiz score (40%)
        categoryScores: {
          technical: 85,
          crossFunctional: 85,
        },
      });

      // Verify certification score uses rubric
      // 40% quiz + 30% simulation + 30% role tasks
      expect(createCertification).toHaveBeenCalledWith(
        expect.objectContaining({
          score: expect.any(Number),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pillar ID', async () => {
      const caller = appRouter.createCaller(mockContext);

      await expect(
        caller.quiz.getQuestions({ pillarId: 999 })
      ).resolves.toEqual([]);
    });

    it('should handle missing user role', async () => {
      mockContext.user = { ...mockUser, vosRole: undefined };
      const caller = appRouter.createCaller(mockContext);

      // Should still submit quiz but not award certification
      const result = await caller.quiz.submitQuiz({
        pillarId: 1,
        answers: [],
        score: 90,
        categoryScores: {},
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Certificate Retrieval', () => {
    it('should retrieve user certifications', async () => {
      const { getUserCertifications } = await import('../../src/data/db');
      
      (getUserCertifications as any).mockResolvedValueOnce([
        {
          id: 1,
          userId: mockUser.id,
          badgeName: 'Value Language - Sales Certified',
          pillarId: 1,
          vosRole: 'Sales',
          tier: 'gold',
          score: 95,
          awardedAt: new Date(),
        },
      ]);

      const caller = appRouter.createCaller(mockContext);
      const certs = await caller.certifications.getUserCertifications();

      expect(Array.isArray(certs)).toBe(true);
      expect(certs).toHaveLength(1);
      expect(certs[0].tier).toBe('gold');
    });
  });
});
