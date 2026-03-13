export type AcademyPillar = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface AcademyLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  contentType: string;
  order: number;
  estimatedMinutes: number;
  sduiComponents: Record<string, unknown>[];
  prerequisites: string[];
  tracks: string[];
  labConfig?: Record<string, unknown>;
  quizConfig?: Record<string, unknown>;
}

export interface AcademyModule {
  id: string;
  pillar: AcademyPillar;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  lessons: AcademyLesson[];
}

export type CertificationLevel = 'practitioner' | 'professional' | 'architect';

export interface CertificationRequirements {
    id: string;
    description: string;
    type: 'pillar_complete' | 'quiz_pass' | 'value_commit' | 'lab_complete' | 'peer_review';
    completed: boolean;
}

export interface CertificationProgress {
  level: CertificationLevel;
  requirements: CertificationRequirements[];
  percentComplete: number;
  earnedAt?: Date;
}

export interface UserProgress {
  userId: string;
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  startedAt?: Date;
  completedAt?: Date;
  score?: number;
  attempts?: number;
  timeSpentSeconds?: number;
}

export interface PillarProgress {
  pillar: AcademyPillar;
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  estimatedMinutesRemaining: number;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  certificationLevel?: string;
  totalValueRealized: number;
  rank: number;
  valueCasesCompleted: number;
}

export interface ResourceArtifact {
  id: string;
  name: string;
  description: string;
  lifecycleStage: string;
  type: string;
  fileUrl: string;
  version: string;
  deprecated: boolean;
  replacedBy?: string;
  linkedPillars: string[];
  linkedLessons: string[];
  governanceRequired: boolean;
  integrityAgentValidated: boolean;
}

export const PILLARS: Record<AcademyPillar, { id: AcademyPillar; estimatedHours: number; prerequisites: AcademyPillar[] }> = {
  1: { id: 1, estimatedHours: 10, prerequisites: [] },
  2: { id: 2, estimatedHours: 10, prerequisites: [1] },
  3: { id: 3, estimatedHours: 10, prerequisites: [2] },
  4: { id: 4, estimatedHours: 10, prerequisites: [3] },
  5: { id: 5, estimatedHours: 10, prerequisites: [4] },
  6: { id: 6, estimatedHours: 10, prerequisites: [5] },
  7: { id: 7, estimatedHours: 10, prerequisites: [6] },
};