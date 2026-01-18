/**
 * DealSelector Component
 *
 * Displays a list of Value Cases for selection.
 * Used when no deal is currently selected in the DealsView.
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Clock,
  TrendingUp,
  Loader2,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { valueCaseService, type ValueCase } from '@/services/ValueCaseService';
import type { LifecycleStage } from '@/types/vos';

export interface DealSelectorProps {
  /** Callback when a deal is selected */
  onSelectDeal: (dealId: string) => void;
  /** Callback when user wants to create a new deal */
  onCreateDeal: () => void;
  /** Currently selected deal ID (for highlighting) */
  selectedDealId?: string;
}

const STAGE_COLORS: Record<LifecycleStage, string> = {
  opportunity: 'bg-blue-100 text-blue-700',
  target: 'bg-purple-100 text-purple-700',
  realization: 'bg-amber-100 text-amber-700',
  expansion: 'bg-green-100 text-green-700',
};

const STAGE_LABELS: Record<LifecycleStage, string> = {
  opportunity: 'Discovery',
  target: 'Modeling',
  realization: 'Realization',
  expansion: 'Expansion',
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function DealSelector({
  onSelectDeal,
  onCreateDeal,
  selectedDealId,
}: DealSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [valueCases, setValueCases] = useState<ValueCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadValueCases();
  }, []);

  const loadValueCases = async () => {
    setIsLoading(true);
    try {
      const cases = await valueCaseService.getValueCases();
      setValueCases(cases);
    } catch (error) {
      console.error('Failed to load value cases:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCases = valueCases.filter((vc) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      vc.name.toLowerCase().includes(query) ||
      vc.company.toLowerCase().includes(query)
    );
  });

  // Group cases by status
  const recentCases = filteredCases
    .filter((vc) => vc.status === 'in-progress')
    .slice(0, 5);
  const completedCases = filteredCases.filter((vc) => vc.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Value Cases</h1>
          <p className="text-muted-foreground">
            Select a case to continue or create a new one
          </p>
        </div>
        <Button onClick={onCreateDeal}>
          <Plus className="w-4 h-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search cases by name or company..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCases.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Value Cases Found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'No cases match your search. Try a different term.'
              : 'Get started by creating your first value case.'}
          </p>
          <Button onClick={onCreateDeal}>
            <Plus className="w-4 h-4 mr-2" />
            Create Value Case
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Recent / In Progress */}
          {recentCases.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity
              </h2>
              <div className="grid gap-3">
                {recentCases.map((vc) => (
                  <CaseCard
                    key={vc.id}
                    valueCase={vc}
                    isSelected={vc.id === selectedDealId}
                    onClick={() => onSelectDeal(vc.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All Cases */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              All Cases ({filteredCases.length})
            </h2>
            <ScrollArea className="h-[400px]">
              <div className="grid gap-3 pr-4">
                {filteredCases.map((vc) => (
                  <CaseCard
                    key={vc.id}
                    valueCase={vc}
                    isSelected={vc.id === selectedDealId}
                    onClick={() => onSelectDeal(vc.id)}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

interface CaseCardProps {
  valueCase: ValueCase;
  isSelected: boolean;
  onClick: () => void;
}

function CaseCard({ valueCase, isSelected, onClick }: CaseCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-lg border text-left transition-all',
        'hover:bg-accent hover:border-accent-foreground/20',
        isSelected
          ? 'bg-accent border-primary ring-1 ring-primary'
          : 'bg-card border-border'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{valueCase.name}</span>
            <Badge className={cn('text-xs', STAGE_COLORS[valueCase.stage])}>
              {STAGE_LABELS[valueCase.stage]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {valueCase.company}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeDate(valueCase.updated_at)}
            </span>
          </div>
        </div>
        {valueCase.quality_score !== undefined && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Quality</p>
            <p className={cn(
              'text-sm font-medium',
              valueCase.quality_score >= 80 ? 'text-green-600' :
              valueCase.quality_score >= 60 ? 'text-amber-600' : 'text-red-600'
            )}>
              {valueCase.quality_score}%
            </p>
          </div>
        )}
      </div>
      {valueCase.description && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {valueCase.description}
        </p>
      )}
    </button>
  );
}
