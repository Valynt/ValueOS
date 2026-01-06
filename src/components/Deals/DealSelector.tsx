/**
 * Deal Selector Component
 * 
 * Lists all value cases (deals) with search, filter, and status indicators.
 * Primary navigation for sales reps to access their deals.
 */

import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type ValueCase, valueCaseService } from '@/services/ValueCaseService';
import { logger } from '@/lib/logger';
import { AlertCircle, CheckCircle2, Clock, Plus, Search, TrendingUp } from 'lucide-react';
import type { LifecycleStage } from '@/types/vos';

interface DealSelectorProps {
  onSelectDeal: (dealId: string) => void;
  onCreateDeal: () => void;
  selectedDealId?: string;
}

const stageLabels: Record<LifecycleStage, string> = {
  opportunity: 'Discovery',
  target: 'Modeling',
  realization: 'Realization',
  expansion: 'Expansion'
};

const stageColors: Record<LifecycleStage, string> = {
  opportunity: 'bg-blue-100 text-blue-700',
  target: 'bg-purple-100 text-purple-700',
  realization: 'bg-green-100 text-green-700',
  expansion: 'bg-orange-100 text-orange-700'
};

const statusIcons = {
  'in-progress': Clock,
  'completed': CheckCircle2,
  'paused': AlertCircle
};

const statusColors = {
  'in-progress': 'text-blue-600',
  'completed': 'text-green-600',
  'paused': 'text-yellow-600'
};

export function DealSelector({ onSelectDeal, onCreateDeal, selectedDealId }: DealSelectorProps) {
  const [deals, setDeals] = useState<ValueCase[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<ValueCase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  useEffect(() => {
    loadDeals();
  }, []);

  useEffect(() => {
    filterDeals();
  }, [searchQuery, deals]);

  const loadDeals = async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedDeals = await valueCaseService.getValueCases();
      setDeals(loadedDeals);
    } catch (err) {
      logger.error('Failed to load deals', err as Error);
      setError('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const filterDeals = () => {
    if (!searchQuery.trim()) {
      setFilteredDeals(deals);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = deals.filter(deal =>
      deal.name.toLowerCase().includes(query) ||
      deal.company.toLowerCase().includes(query) ||
      deal.description?.toLowerCase().includes(query)
    );
    setFilteredDeals(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading deals...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
          <Button onClick={loadDeals} variant="outline" size="sm" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Deals</h2>
          <p className="text-sm text-muted-foreground">
            {deals.length} {deals.length === 1 ? 'deal' : 'deals'} in pipeline
          </p>
        </div>
        <Button onClick={onCreateDeal}>
          <Plus className="w-4 h-4 mr-2" />
          New Deal
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search deals by company or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Deal List */}
      <div className="space-y-2">
        {filteredDeals.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-2">
              {searchQuery ? 'No deals match your search' : 'No deals yet'}
            </p>
            {!searchQuery && (
              <Button onClick={onCreateDeal} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create your first deal
              </Button>
            )}
          </div>
        ) : (
          filteredDeals.map((deal) => {
            const StatusIcon = statusIcons[deal.status];
            const isSelected = deal.id === selectedDealId;

            return (
              <button
                key={deal.id}
                onClick={() => onSelectDeal(deal.id)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{deal.company}</h3>
                      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColors[deal.status]}`} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {deal.name}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={stageColors[deal.stage]} variant="secondary">
                        {stageLabels[deal.stage]}
                      </Badge>
                      {deal.quality_score !== undefined && (
                        <Badge variant="outline" className="text-xs">
                          Quality: {Math.round(deal.quality_score * 100)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground flex-shrink-0">
                    <p>Updated</p>
                    <p>{new Date(deal.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
