/**
 * Academy Progress Tracker
 * 
 * Visual component showing progress through the 7 Pillars.
 * Displays completion status, locked/available state, and estimated time.
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Search,
  Calculator,
  FileCheck,
  BarChart3,
  Rocket,
  Settings,
  Lock,
  CheckCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { academyService } from '../../services/AcademyService';
import { PillarProgress, PILLARS, AcademyPillar } from '../../types/academy';

// ============================================================================
// Types
// ============================================================================

interface AcademyProgressTrackerProps {
  onPillarClick?: (pillar: AcademyPillar) => void;
  compact?: boolean;
}

// ============================================================================
// Icon Map
// ============================================================================

const PILLAR_ICONS: Record<AcademyPillar, React.ElementType> = {
  1: TrendingUp,
  2: Search,
  3: Calculator,
  4: FileCheck,
  5: BarChart3,
  6: Rocket,
  7: Settings,
};

// ============================================================================
// Component
// ============================================================================

export const AcademyProgressTracker: React.FC<AcademyProgressTrackerProps> = ({
  onPillarClick,
  compact = false,
}) => {
  const [progress, setProgress] = useState<PillarProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      const data = await academyService.getPillarProgress();
      setProgress(data);
      setLoading(false);
    };
    fetchProgress();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} className="h-16 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  const totalProgress = progress.reduce((sum, p) => sum + p.percentComplete, 0) / 7;

  return (
    <div className="space-y-4">
      {/* Overall Progress */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium">Academy Progress</span>
          <span className="text-[#39FF14] font-bold">{Math.round(totalProgress)}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#39FF14] transition-all duration-500"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* Pillars Grid */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {progress.map(pillarProgress => {
          const pillar = PILLARS[pillarProgress.pillar];
          const Icon = PILLAR_ICONS[pillarProgress.pillar];
          const isLocked = pillarProgress.status === 'locked';
          const isCompleted = pillarProgress.status === 'completed';

          return (
            <button
              key={pillarProgress.pillar}
              onClick={() => !isLocked && onPillarClick?.(pillarProgress.pillar)}
              disabled={isLocked}
              className={`
                w-full flex items-center gap-3 p-3 rounded-lg border transition-all
                ${isLocked
                  ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                  : isCompleted
                  ? 'bg-[#39FF14]/10 border-[#39FF14]/30 hover:border-[#39FF14]/50'
                  : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                }
              `}
            >
              {/* Icon */}
              <div
                className={`
                  w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                  ${isCompleted
                    ? 'bg-[#39FF14]/20'
                    : isLocked
                    ? 'bg-gray-800'
                    : 'bg-gray-700'
                  }
                `}
                style={{ color: isLocked ? '#6b7280' : pillar.color }}
              >
                {isLocked ? (
                  <Lock className="w-5 h-5" />
                ) : isCompleted ? (
                  <CheckCircle className="w-5 h-5 text-[#39FF14]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isLocked ? 'text-gray-500' : 'text-white'}`}>
                    Pillar {pillarProgress.pillar}: {pillar.name}
                  </span>
                </div>
                
                {!compact && (
                  <div className="flex items-center gap-3 mt-1">
                    {/* Progress bar */}
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${pillarProgress.percentComplete}%`,
                          backgroundColor: isCompleted ? '#39FF14' : pillar.color,
                        }}
                      />
                    </div>
                    
                    {/* Stats */}
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {pillarProgress.completedLessons}/{pillarProgress.totalLessons}
                    </span>
                  </div>
                )}
              </div>

              {/* Time remaining / Chevron */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isCompleted && !isLocked && pillarProgress.estimatedMinutesRemaining > 0 && (
                  <div className="flex items-center gap-1 text-gray-500 text-xs">
                    <Clock className="w-3 h-3" />
                    <span>{Math.ceil(pillarProgress.estimatedMinutesRemaining / 60)}h</span>
                  </div>
                )}
                {!isLocked && (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AcademyProgressTracker;
