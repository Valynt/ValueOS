/**
 * Academy Types
 * 
 * Type definitions for the VOS Academy & Resources Portal.
 * Supports the 7 Pillars curriculum, role tracks, and certification system.
 */

// ============================================================================
// Core Enums
// ============================================================================

export type AcademyPillar = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RoleTrack = 
  | 'value_engineer'    // Deep modeling, ROI mastery
  | 'account_executive' // Discovery, storytelling
  | 'customer_success'  // Realization, QBRs
  | 'developer'         // Platform operations, API
  | 'leadership';       // Governance, portfolio

export type ContentType = 
  | 'video'
  | 'article'
  | 'lab'
  | 'quiz'
  | 'exercise'
  | 'template';

export type CertificationLevel = 
  | 'practitioner'  // Complete core pillars + knowledge check
  | 'professional'  // Role track + 1 verified Value Commit
  | 'architect';    // Capstone + peer review

// ============================================================================
// Pillar Definitions
// ============================================================================

export interface PillarDefinition {
  id: AcademyPillar;
  name: string;
  description: string;
  icon: string;
  color: string;
  agent?: 'discovery' | 'kpi' | 'integrity' | 'realization';
  estimatedHours: number;
  prerequisites: AcademyPillar[];
}

export const PILLARS: Record<AcademyPillar, PillarDefinition> = {
  1: {
    id: 1,
    name: 'Outcome Economics',
    description: 'The Value Triad: Revenue, Cost, Risk. Understanding multipliers and levers.',
    icon: 'TrendingUp',
    color: '#39FF14',
    estimatedHours: 4,
    prerequisites: [],
  },
  2: {
    id: 2,
    name: 'Discovery & Diagnosis',
    description: 'Root cause analysis, persona mapping, problem qualification.',
    icon: 'Search',
    color: '#00D4FF',
    agent: 'discovery',
    estimatedHours: 6,
    prerequisites: [1],
  },
  3: {
    id: 3,
    name: 'Quantification & Modeling',
    description: 'KPI identification, baseline capture, sensitivity analysis.',
    icon: 'Calculator',
    color: '#FF6B35',
    agent: 'kpi',
    estimatedHours: 8,
    prerequisites: [1, 2],
  },
  4: {
    id: 4,
    name: 'Value Commit Creation',
    description: 'Building the central VOS artifact, cross-functional sign-off.',
    icon: 'FileCheck',
    color: '#9D4EDD',
    agent: 'integrity',
    estimatedHours: 6,
    prerequisites: [3],
  },
  5: {
    id: 5,
    name: 'Realization Management',
    description: 'Variance tracking, dashboarding, gap closure.',
    icon: 'BarChart3',
    color: '#10B981',
    agent: 'realization',
    estimatedHours: 5,
    prerequisites: [4],
  },
  6: {
    id: 6,
    name: 'Expansion Strategy',
    description: 'Portfolio value management, renewal narratives.',
    icon: 'Rocket',
    color: '#F59E0B',
    estimatedHours: 4,
    prerequisites: [5],
  },
  7: {
    id: 7,
    name: 'Platform Operations',
    description: 'Hands-on VOS platform mastery, API and SDUI configuration.',
    icon: 'Settings',
    color: '#6366F1',
    estimatedHours: 6,
    prerequisites: [1],
  },
};

// ============================================================================
// Lesson & Module Types
// ============================================================================

export interface AcademyModule {
  id: string;
  pillar: AcademyPillar;
  title: string;
  description: string;
  order: number;
  lessons: AcademyLesson[];
  estimatedMinutes: number;
}

export interface AcademyLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  contentType: ContentType;
  order: number;
  estimatedMinutes: number;
  sduiComponents: string[]; // Component IDs from SDUI registry
  prerequisites?: string[]; // Lesson IDs
  tracks?: RoleTrack[]; // If specified, only visible to these tracks
  labConfig?: LabConfiguration;
  quizConfig?: QuizConfiguration;
}

export interface LabConfiguration {
  agentType: 'discovery' | 'kpi' | 'integrity' | 'realization';
  scenario: string;
  systemPrompt: string;
  successCriteria: LabSuccessCriterion[];
  maxAttempts: number;
  timeoutMinutes: number;
}

export interface LabSuccessCriterion {
  id: string;
  description: string;
  evaluationType: 'keyword' | 'llm_judge' | 'manual';
  weight: number;
}

export interface QuizConfiguration {
  passingScore: number; // 0-100
  questions: QuizQuestion[];
  shuffleQuestions: boolean;
  showFeedback: boolean;
  maxAttempts: number;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple_choice' | 'true_false' | 'drag_drop' | 'fill_blank';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  points: number;
}

// ============================================================================
// Progress Tracking
// ============================================================================

export interface UserProgress {
  userId: string;
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
  score?: number; // For quizzes/labs
  attempts: number;
  timeSpentSeconds: number;
}

export interface PillarProgress {
  pillar: AcademyPillar;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  estimatedMinutesRemaining: number;
}

export interface CertificationProgress {
  level: CertificationLevel;
  requirements: CertificationRequirement[];
  percentComplete: number;
  earnedAt?: Date;
}

export interface CertificationRequirement {
  id: string;
  description: string;
  type: 'pillar_complete' | 'quiz_pass' | 'lab_complete' | 'value_commit' | 'peer_review';
  targetId?: string; // Pillar ID, quiz ID, etc.
  completed: boolean;
  completedAt?: Date;
}

// ============================================================================
// Value Ledger (Gamification)
// ============================================================================

export interface ValueLedgerEntry {
  userId: string;
  valueCaseId: string;
  valueRealized: number; // Dollar amount
  verifiedAt: Date;
  verifiedBy: 'realization_agent' | 'manual';
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  certificationLevel: CertificationLevel | null;
  totalValueRealized: number;
  rank: number;
  valueCasesCompleted: number;
}

// ============================================================================
// Contextual Injection
// ============================================================================

export interface ContextualTrigger {
  id: string;
  elementSelector: string; // CSS selector or element ID
  triggerType: 'dwell' | 'error' | 'help_click';
  dwellTimeMs?: number; // For dwell triggers
  errorCode?: string; // For error triggers
  injectContent: {
    type: 'lesson' | 'resource' | 'tip';
    contentId: string;
    position: 'sidebar' | 'modal' | 'tooltip';
  };
  priority: number;
  enabled: boolean;
}

// ============================================================================
// Resource Library
// ============================================================================

export type LifecycleStageResource = 
  | 'opportunity'
  | 'alignment'
  | 'realization'
  | 'expansion';

export interface ResourceArtifact {
  id: string;
  name: string;
  description: string;
  lifecycleStage: LifecycleStageResource;
  type: 'template' | 'calculator' | 'deck' | 'guide' | 'script';
  fileUrl: string;
  version: string;
  deprecated: boolean;
  replacedBy?: string; // ID of newer version
  linkedPillars: AcademyPillar[];
  linkedLessons: string[];
  governanceRequired: boolean;
  integrityAgentValidated: boolean;
}

// ============================================================================
// SDUI Academy Components (extend existing SDUI schema)
// ============================================================================

export interface AcademyVideoBlock {
  type: 'academy_video';
  id: string;
  videoUrl: string;
  thumbnailUrl?: string;
  duration: number;
  transcript?: string;
  chapters?: VideoChapter[];
}

export interface VideoChapter {
  title: string;
  startTime: number;
}

export interface AcademyLabBlock {
  type: 'academy_lab';
  id: string;
  title: string;
  description: string;
  labConfig: LabConfiguration;
}

export interface AcademyQuizBlock {
  type: 'academy_quiz';
  id: string;
  title: string;
  quizConfig: QuizConfiguration;
}

export interface AcademyProgressBlock {
  type: 'academy_progress';
  id: string;
  pillarId?: AcademyPillar;
  showCertifications: boolean;
}

export interface AcademyResourceCard {
  type: 'academy_resource';
  id: string;
  resourceId: string;
  showDownload: boolean;
  showPreview: boolean;
}

export type AcademySDUIComponent =
  | AcademyVideoBlock
  | AcademyLabBlock
  | AcademyQuizBlock
  | AcademyProgressBlock
  | AcademyResourceCard;
