/**
 * Academy Service
 * 
 * Client-side service for the VOS Academy portal.
 * Handles progress tracking, certifications, and resource access.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  AcademyPillar,
  AcademyModule,
  AcademyLesson,
  UserProgress,
  PillarProgress,
  CertificationProgress,
  CertificationLevel,
  LeaderboardEntry,
  ResourceArtifact,
  PILLARS,
} from '../types/academy';

// ============================================================================
// Types
// ============================================================================

interface ProgressUpdate {
  lessonId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  score?: number;
  timeSpentSeconds?: number;
}

// ============================================================================
// Academy Service
// ============================================================================

class AcademyService {
  /**
   * Get all modules for a pillar
   */
  async getModulesByPillar(pillar: AcademyPillar): Promise<AcademyModule[]> {
    try {
      const { data, error } = await supabase
        .from('academy_modules')
        .select(`
          id,
          pillar,
          title,
          description,
          display_order,
          estimated_minutes,
          academy_lessons (
            id,
            title,
            description,
            content_type,
            display_order,
            estimated_minutes,
            sdui_components,
            prerequisites,
            tracks,
            lab_config,
            quiz_config
          )
        `)
        .eq('pillar', pillar.toString())
        .order('display_order');

      if (error) throw error;

      return (data || []).map(m => ({
        id: m.id,
        pillar: parseInt(m.pillar) as AcademyPillar,
        title: m.title,
        description: m.description,
        order: m.display_order,
        estimatedMinutes: m.estimated_minutes,
        lessons: (m.academy_lessons || []).map((l: any) => ({
          id: l.id,
          moduleId: m.id,
          title: l.title,
          description: l.description,
          contentType: l.content_type,
          order: l.display_order,
          estimatedMinutes: l.estimated_minutes,
          sduiComponents: l.sdui_components || [],
          prerequisites: l.prerequisites || [],
          tracks: l.tracks || [],
          labConfig: l.lab_config,
          quizConfig: l.quiz_config,
        })),
      }));
    } catch (error) {
      logger.error('Failed to fetch modules', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get a single lesson by ID
   */
  async getLesson(lessonId: string): Promise<AcademyLesson | null> {
    try {
      const { data, error } = await supabase
        .from('academy_lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        moduleId: data.module_id,
        title: data.title,
        description: data.description,
        contentType: data.content_type,
        order: data.display_order,
        estimatedMinutes: data.estimated_minutes,
        sduiComponents: data.sdui_components || [],
        prerequisites: data.prerequisites || [],
        tracks: data.tracks || [],
        labConfig: data.lab_config,
        quizConfig: data.quiz_config,
      };
    } catch (error) {
      logger.error('Failed to fetch lesson', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Get user progress for all lessons
   */
  async getUserProgress(userId: string): Promise<UserProgress[]> {
    try {
      const { data, error } = await supabase
        .from('academy_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      return (data || []).map(p => ({
        userId: p.user_id,
        lessonId: p.lesson_id,
        status: p.status,
        startedAt: p.started_at ? new Date(p.started_at) : undefined,
        completedAt: p.completed_at ? new Date(p.completed_at) : undefined,
        score: p.score,
        attempts: p.attempts,
        timeSpentSeconds: p.time_spent_seconds,
      }));
    } catch (error) {
      logger.error('Failed to fetch user progress', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Update progress for a lesson
   */
  async updateProgress(update: ProgressUpdate): Promise<UserProgress | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('update_lesson_progress', {
        p_user_id: user.id,
        p_lesson_id: update.lessonId,
        p_status: update.status,
        p_score: update.score || null,
        p_time_spent: update.timeSpentSeconds || 0,
      });

      if (error) throw error;

      return data;
    } catch (error) {
      logger.error('Failed to update progress', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Get pillar progress summary for current user
   */
  async getPillarProgress(): Promise<PillarProgress[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return this.getDefaultPillarProgress();

      const { data, error } = await supabase
        .from('user_pillar_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Merge with pillar definitions
      const progressMap = new Map(
        (data || []).map(p => [parseInt(p.pillar), p])
      );

      return Object.values(PILLARS).map(pillar => {
        const progress = progressMap.get(pillar.id);
        const prerequisites = pillar.prerequisites;
        const prereqsMet = prerequisites.every(p => {
          const prereqProgress = progressMap.get(p);
          return prereqProgress && prereqProgress.percent_complete >= 100;
        });

        return {
          pillar: pillar.id,
          totalLessons: progress?.total_lessons || 0,
          completedLessons: progress?.completed_lessons || 0,
          percentComplete: progress?.percent_complete || 0,
          status: progress?.percent_complete >= 100
            ? 'completed'
            : progress?.completed_lessons > 0
            ? 'in_progress'
            : prereqsMet
            ? 'available'
            : 'locked',
          estimatedMinutesRemaining: progress?.minutes_remaining || pillar.estimatedHours * 60,
        };
      });
    } catch (error) {
      logger.error('Failed to fetch pillar progress', error instanceof Error ? error : undefined);
      return this.getDefaultPillarProgress();
    }
  }

  /**
   * Get certification progress for current user
   */
  async getCertificationProgress(): Promise<CertificationProgress[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: certs, error: certError } = await supabase
        .from('academy_certifications')
        .select('*')
        .eq('user_id', user.id);

      if (certError) throw certError;

      const levels: CertificationLevel[] = ['practitioner', 'professional', 'architect'];
      const earnedCerts = new Map(
        (certs || []).map(c => [c.level, c])
      );

      // Check eligibility for each level
      const progress: CertificationProgress[] = [];
      
      for (const level of levels) {
        const earned = earnedCerts.get(level);
        
        const { data: eligible } = await supabase.rpc('check_certification_eligibility', {
          p_user_id: user.id,
          p_level: level,
        });

        progress.push({
          level,
          requirements: this.getCertificationRequirements(level),
          percentComplete: earned ? 100 : eligible ? 100 : 0,
          earnedAt: earned?.earned_at ? new Date(earned.earned_at) : undefined,
        });
      }

      return progress;
    } catch (error) {
      logger.error('Failed to fetch certification progress', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get the value leaderboard
   */
  async getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
    try {
      const { data, error } = await supabase
        .from('value_leaderboard')
        .select('*')
        .order('rank')
        .limit(limit);

      if (error) throw error;

      return (data || []).map(entry => ({
        userId: entry.user_id,
        userName: entry.user_name || 'Anonymous',
        avatarUrl: entry.avatar_url,
        certificationLevel: entry.highest_certification,
        totalValueRealized: parseFloat(entry.total_value_realized) || 0,
        rank: entry.rank,
        valueCasesCompleted: entry.value_cases_completed,
      }));
    } catch (error) {
      logger.error('Failed to fetch leaderboard', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get resource artifacts by lifecycle stage
   */
  async getResourcesByStage(stage: string): Promise<ResourceArtifact[]> {
    try {
      const { data, error } = await supabase
        .from('resource_artifacts')
        .select('*')
        .eq('lifecycle_stage', stage)
        .eq('deprecated', false)
        .order('name');

      if (error) throw error;

      return (data || []).map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        lifecycleStage: r.lifecycle_stage,
        type: r.artifact_type,
        fileUrl: r.file_url,
        version: r.version,
        deprecated: r.deprecated,
        replacedBy: r.replaced_by,
        linkedPillars: r.linked_pillars || [],
        linkedLessons: [],
        governanceRequired: r.governance_required,
        integrityAgentValidated: r.integrity_validated,
      }));
    } catch (error) {
      logger.error('Failed to fetch resources', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Track resource download
   */
  async trackDownload(resourceId: string): Promise<void> {
    try {
      await supabase.rpc('increment_download_count', { resource_id: resourceId });
    } catch (error) {
      logger.warn('Failed to track download', { resourceId });
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getDefaultPillarProgress(): PillarProgress[] {
    return Object.values(PILLARS).map(pillar => ({
      pillar: pillar.id,
      totalLessons: 0,
      completedLessons: 0,
      percentComplete: 0,
      status: pillar.prerequisites.length === 0 ? 'available' : 'locked',
      estimatedMinutesRemaining: pillar.estimatedHours * 60,
    }));
  }

  private getCertificationRequirements(level: CertificationLevel) {
    switch (level) {
      case 'practitioner':
        return [
          { id: 'p1', description: 'Complete Pillars 1-4', type: 'pillar_complete' as const, completed: false },
          { id: 'p2', description: 'Pass knowledge assessment', type: 'quiz_pass' as const, completed: false },
        ];
      case 'professional':
        return [
          { id: 'pr1', description: 'Complete role track', type: 'pillar_complete' as const, completed: false },
          { id: 'pr2', description: 'Submit verified Value Commit', type: 'value_commit' as const, completed: false },
        ];
      case 'architect':
        return [
          { id: 'a1', description: 'Complete all 7 pillars', type: 'pillar_complete' as const, completed: false },
          { id: 'a2', description: 'Capstone project approved', type: 'lab_complete' as const, completed: false },
          { id: 'a3', description: 'Peer review completed', type: 'peer_review' as const, completed: false },
        ];
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const academyService = new AcademyService();
