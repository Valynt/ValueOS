/**
 * OpportunityAnalysisPanel Component
 *
 * Displays opportunity analysis results from the business case generation.
 * Shows scores, insights, and recommendations.
 */

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface OpportunityScore {
  overall: number;
  fit: number;
  timing: number;
  budget: number;
  authority: number;
  need: number;
}

export interface OpportunityInsight {
  type: 'strength' | 'weakness' | 'opportunity' | 'threat';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface OpportunityAnalysis {
  score: OpportunityScore;
  insights: OpportunityInsight[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  winProbability: number;
}

export interface OpportunityAnalysisPanelProps {
  /** The analysis data to display */
  analysis: OpportunityAnalysis;
  /** Whether to show in compact mode */
  compact?: boolean;
}

const SCORE_COLORS = {
  high: 'text-green-600',
  medium: 'text-amber-600',
  low: 'text-red-600',
};

const INSIGHT_ICONS = {
  strength: CheckCircle2,
  weakness: AlertTriangle,
  opportunity: TrendingUp,
  threat: TrendingDown,
};

const INSIGHT_COLORS = {
  strength: 'bg-green-50 border-green-200 text-green-700',
  weakness: 'bg-red-50 border-red-200 text-red-700',
  opportunity: 'bg-blue-50 border-blue-200 text-blue-700',
  threat: 'bg-amber-50 border-amber-200 text-amber-700',
};

const IMPACT_BADGES = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-700',
};

function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Needs Work';
  return 'Poor';
}

export function OpportunityAnalysisPanel({
  analysis,
  compact = false,
}: OpportunityAnalysisPanelProps) {
  const overallLevel = getScoreLevel(analysis.score.overall);

  if (compact) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
              overallLevel === 'high' && 'bg-green-100 text-green-700',
              overallLevel === 'medium' && 'bg-amber-100 text-amber-700',
              overallLevel === 'low' && 'bg-red-100 text-red-700'
            )}>
              {analysis.score.overall}
            </div>
            <div>
              <p className="font-medium">Opportunity Score</p>
              <p className="text-sm text-muted-foreground">
                {getScoreLabel(analysis.score.overall)} - {analysis.winProbability}% win probability
              </p>
            </div>
          </div>
          <Badge className={cn(
            analysis.riskLevel === 'low' && 'bg-green-100 text-green-700',
            analysis.riskLevel === 'medium' && 'bg-amber-100 text-amber-700',
            analysis.riskLevel === 'high' && 'bg-red-100 text-red-700'
          )}>
            {analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1)} Risk
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Opportunity Analysis</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score Overview */}
        <div>
          <div className="flex items-center gap-4 mb-4">
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold',
              overallLevel === 'high' && 'bg-green-100 text-green-700',
              overallLevel === 'medium' && 'bg-amber-100 text-amber-700',
              overallLevel === 'low' && 'bg-red-100 text-red-700'
            )}>
              {analysis.score.overall}
            </div>
            <div>
              <p className="text-xl font-semibold">{getScoreLabel(analysis.score.overall)}</p>
              <p className="text-muted-foreground">
                {analysis.winProbability}% win probability
              </p>
              <Badge className={cn(
                'mt-1',
                analysis.riskLevel === 'low' && 'bg-green-100 text-green-700',
                analysis.riskLevel === 'medium' && 'bg-amber-100 text-amber-700',
                analysis.riskLevel === 'high' && 'bg-red-100 text-red-700'
              )}>
                {analysis.riskLevel.charAt(0).toUpperCase() + analysis.riskLevel.slice(1)} Risk
              </Badge>
            </div>
          </div>

          {/* BANT Scores */}
          <div className="space-y-3">
            <ScoreBar label="Budget" score={analysis.score.budget} icon={Zap} />
            <ScoreBar label="Authority" score={analysis.score.authority} icon={Shield} />
            <ScoreBar label="Need" score={analysis.score.need} icon={Target} />
            <ScoreBar label="Timing" score={analysis.score.timing} icon={Clock} />
            <ScoreBar label="Fit" score={analysis.score.fit} icon={CheckCircle2} />
          </div>
        </div>

        {/* Insights */}
        <div>
          <h4 className="text-sm font-medium mb-3">Key Insights</h4>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {analysis.insights.map((insight, index) => {
              const Icon = INSIGHT_ICONS[insight.type];
              return (
                <div
                  key={index}
                  className={cn(
                    'p-3 rounded-lg border',
                    INSIGHT_COLORS[insight.type]
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{insight.title}</p>
                        <Badge className={cn('text-xs', IMPACT_BADGES[insight.impact])}>
                          {insight.impact}
                        </Badge>
                      </div>
                      <p className="text-xs mt-1 opacity-80">{insight.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-medium mb-3">Recommendations</h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

interface ScoreBarProps {
  label: string;
  score: number;
  icon: React.ComponentType<{ className?: string }>;
}

function ScoreBar({ label, score, icon: Icon }: ScoreBarProps) {
  const level = getScoreLevel(score);

  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm">{label}</span>
          <span className={cn('text-sm font-medium', SCORE_COLORS[level])}>
            {score}%
          </span>
        </div>
        <Progress
          value={score}
          className={cn(
            'h-1.5',
            level === 'high' && '[&>div]:bg-green-500',
            level === 'medium' && '[&>div]:bg-amber-500',
            level === 'low' && '[&>div]:bg-red-500'
          )}
        />
      </div>
    </div>
  );
}
