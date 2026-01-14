/**
 * SDUI Skeleton Loader
 *
 * Provides skeleton loading states for partial streams and SDUI rendering.
 * Critical for handling temporal failures and providing graceful degradation.
 *
 * Responsibilities:
 * - Stage-specific skeleton layouts
 * - Progress indication for streaming
 * - Graceful degradation for partial data
 * - Performance optimization
 */

import React from 'react';

// ============================================================================
// Types
// ============================================================================

export interface SDUISkeletonLoaderProps {
  stage: string;
  progress?: number;
  streamingStage?: string;
  message?: string;
  className?: string;
}

export interface SkeletonConfig {
  sections: SkeletonSection[];
  loadingMessage?: string;
  progressIndicators?: boolean;
  animated?: boolean;
}

export interface SkeletonSection {
  type: 'text' | 'metric' | 'card' | 'chart' | 'table' | 'button' | 'image';
  className?: string;
  lines?: number;
  width?: string;
  height?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

// ============================================================================
// Stage-Specific Skeleton Configurations
// ============================================================================

const SKELETON_CONFIGS: Record<string, SkeletonConfig> = {
  opportunity: {
    sections: [
      { type: 'text', lines: 3, width: '100%', height: '1rem', variant: 'detailed' },
      { type: 'card', className: 'mb-4' },
      { type: 'metric', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
    ],
    loadingMessage: 'Analyzing opportunity and identifying value drivers...',
    progressIndicators: true,
    animated: true,
  },

  target: {
    sections: [
      { type: 'text', lines: 2, width: '80%', height: '1rem', variant: 'default' },
      { type: 'metric', className: 'grid grid-cols-2 gap-4 mb-6' },
      { type: 'table', className: 'mb-6' },
      { type: 'chart', className: 'mb-4' },
      { type: 'text', lines: 4, width: '100%', height: '0.875rem', variant: 'compact' },
    ],
    loadingMessage: 'Building ROI models and quantifying business impact...',
    progressIndicators: true,
    animated: true,
  },

  realization: {
    sections: [
      { type: 'text', lines: 2, width: '70%', height: '1rem', variant: 'default' },
      { type: 'table', className: 'mb-6' },
      { type: 'chart', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
    ],
    loadingMessage: 'Tracking actual results against targets and documenting achieved value...',
    progressIndicators: true,
    animated: true,
  },

  expansion: {
    sections: [
      { type: 'text', lines: 3, width: '90%', height: '1rem', variant: 'detailed' },
      { type: 'card', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
      { type: 'button', className: 'mb-4' },
    ],
    loadingMessage: 'Identifying upsell opportunities and additional value that can be realized...',
    progressIndicators: true,
    animated: true,
  },

  default: {
    sections: [
      { type: 'text', lines: 3, width: '100%', height: '1rem' },
      { type: 'card', className: 'mb-4' },
      { type: 'card', className: 'mb-4' },
    ],
    loadingMessage: 'Processing your request...',
    progressIndicators: false,
    animated: true,
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const SDUISkeletonLoader: React.FC<SDUISkeletonLoaderProps> = ({
  stage,
  progress = 0,
  streamingStage,
  message,
  className = '',
}) => {
  const config = SKELETON_CONFIGS[stage] || SKELETON_CONFIGS.default;
  const displayMessage = message || config.loadingMessage;

  return (
    <div className={`sdui-skeleton-loader ${className}`}>
      {/* Progress Header */}
      {config.progressIndicators && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-gray-700">
                {streamingStage || 'Processing...'}
              </span>
            </div>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading Message */}
      {displayMessage && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse" />
            <p className="text-sm text-blue-700">{displayMessage}</p>
          </div>
        </div>
      )}

      {/* Skeleton Sections */}
      <div className="space-y-4">
        {config.sections.map((section, index) => (
          <SkeletonSection key={index} section={section} animated={config.animated} />
        ))}
      </div>

      {/* Streaming Indicator */}
      {streamingStage && (
        <div className="mt-6 flex items-center justify-center space-x-2 text-sm text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Live streaming in progress...</span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Skeleton Section Components
// ============================================================================

interface SkeletonSectionProps {
  section: SkeletonSection;
  animated?: boolean;
}

const SkeletonSection: React.FC<SkeletonSectionProps> = ({ section, animated = true }) => {
  const animationClass = animated ? 'animate-pulse' : '';
  const baseClasses = 'bg-gray-200 rounded';

  switch (section.type) {
    case 'text':
      return (
        <div className={`space-y-2 ${section.className}`}>
          {Array.from({ length: section.lines || 3 }).map((_, index) => (
            <div
              key={index}
              className={`${baseClasses} ${animationClass}`}
              style={{
                width: section.width || '100%',
                height: section.height || '1rem',
              }}
            />
          ))}
        </div>
      );

    case 'metric':
      return (
        <div className={`${section.className} ${animationClass}`}>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="bg-white p-4 border border-gray-200 rounded-lg">
                <div className={`${baseClasses} h-4 w-3/4 mb-2`} />
                <div className={`${baseClasses} h-8 w-1/2`} />
              </div>
            ))}
          </div>
        </div>
      );

    case 'card':
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div className="p-6">
            <div className={`${baseClasses} h-6 w-3/4 mb-4`} />
            <div className={`${baseClasses} h-4 w-full mb-2`} />
            <div className={`${baseClasses} h-4 w-5/6 mb-4`} />
            <div className="flex space-x-2">
              <div className={`${baseClasses} h-8 w-20 rounded`} />
              <div className={`${baseClasses} h-8 w-20 rounded ml-auto`} />
            </div>
          </div>
        </div>
      );

    case 'chart':
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div className="p-6">
            <div className="flex items-end space-x-2 h-32">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className={`${baseClasses} flex-1`}
                  style={{
                    height: `${Math.random() * 100}%`,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className={`${baseClasses} h-3 w-8`} />
              ))}
            </div>
          </div>
        </div>
      );

    case 'table':
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div className="p-6">
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 mb-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className={`${baseClasses} h-4`} />
              ))}
            </div>
            {/* Table Rows */}
            {Array.from({ length: 5 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-4 gap-4 mb-2">
                {Array.from({ length: 4 }).map((_, colIndex) => (
                  <div key={colIndex} className={`${baseClasses} h-3`} />
                ))}
              </div>
            ))}
          </div>
        </div>
      );

    case 'button':
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div className="px-4 py-2">
            <div className={`${baseClasses} h-4 w-16 mx-auto`} />
          </div>
        </div>
      );

    case 'image':
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div
            style={{
              width: section.width || '100%',
              height: section.height || '200px',
            }}
          />
        </div>
      );

    default:
      return (
        <div className={`${baseClasses} ${animationClass} ${section.className}`}>
          <div
            style={{
              width: section.width || '100%',
              height: section.height || '100px',
            }}
          />
        </div>
      );
  }
};

// ============================================================================
// Specialized Skeleton Components
// ============================================================================

export const StreamingSkeletonLoader: React.FC<{
  stage: string;
  streamingUpdate?: {
    stage: string;
    message: string;
    progress?: number;
  };
}> = ({ stage, streamingUpdate }) => {
  return (
    <SDUISkeletonLoader
      stage={stage}
      progress={streamingUpdate?.progress || 0}
      streamingStage={streamingUpdate?.stage}
      message={streamingUpdate?.message}
    />
  );
};

export const ErrorSkeletonLoader: React.FC<{
  stage: string;
  error: string;
  onRetry?: () => void;
}> = ({ stage, error, onRetry }) => {
  return (
    <div className="sdui-error-skeleton">
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded-full" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>

      <SDUISkeletonLoader stage={stage} />

      {onRetry && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export const PartialStreamSkeletonLoader: React.FC<{
  stage: string;
  completedSections: any[];
  totalSections: number;
  streamingUpdate?: {
    stage: string;
    message: string;
    progress?: number;
  };
}> = ({ stage, completedSections, totalSections, streamingUpdate }) => {
  const progress = (completedSections.length / totalSections) * 100;

  return (
    <div className="partial-stream-skeleton">
      {/* Completed Content */}
      <div className="mb-6">
        {completedSections.length > 0 && (
          <div className="text-sm text-green-600 mb-2">
            {completedSections.length} of {totalSections} sections loaded
          </div>
        )}
      </div>

      {/* Streaming Skeleton */}
      <SDUISkeletonLoader
        stage={stage}
        progress={progress}
        streamingStage={streamingUpdate?.stage}
        message={streamingUpdate?.message}
      />
    </div>
  );
};

// ============================================================================
// Utility Functions
// ============================================================================

export const getSkeletonConfig = (stage: string): SkeletonConfig => {
  return SKELETON_CONFIGS[stage] || SKELETON_CONFIGS.default;
};

export const createCustomSkeleton = (config: SkeletonConfig): SkeletonConfig => {
  return {
    ...SKELETON_CONFIGS.default,
    ...config,
  };
};

export const StreamingStageMessages: Record<string, string> = {
  analyzing: 'Understanding your request and gathering context...',
  processing: 'Consulting AI agents and analyzing data...',
  generating: 'Generating insights and recommendations...',
  rendering: 'Rendering results and visualizations...',
  complete: 'Analysis complete!',
};

export default SDUISkeletonLoader;
