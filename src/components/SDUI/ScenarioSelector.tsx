/**
 * ScenarioSelector Component
 * 
 * Template/scenario selection interface for value cases.
 * Features preview images, complexity badges, and AI recommendations.
 */

import React, { useState, useMemo } from 'react';
import { 
  Check, 
  ChevronRight, 
  Sparkles, 
  TrendingUp,
  Building2,
  Layers,
  Star,
  Clock,
  Zap,
  Target,
  BarChart3,
  Users,
  Shield,
  Search,
  Grid,
  List,
  ExternalLink
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type ScenarioIcon = 'trending' | 'building' | 'layers' | 'star' | 'zap' | 'target' | 'chart' | 'users' | 'shield';
export type Complexity = 'simple' | 'medium' | 'complex';
export type ViewMode = 'grid' | 'list';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category?: string;
  icon?: ScenarioIcon;
  previewImage?: string;
  aiRecommended?: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
  estimatedTime?: string;
  estimatedValue?: string;
  complexity?: Complexity;
  tags?: string[];
  useCases?: string[];
  prerequisites?: string[];
  metadata?: Record<string, any>;
}

export interface ScenarioCategory {
  id: string;
  label: string;
  count?: number;
}

export interface ScenarioSelectorProps {
  title?: string;
  description?: string;
  scenarios: Scenario[];
  categories?: ScenarioCategory[];
  selectedId?: string;
  multiSelect?: boolean;
  selectedIds?: string[];
  showAIRecommendations?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  showViewToggle?: boolean;
  defaultView?: ViewMode;
  onSelect: (scenario: Scenario) => void;
  onMultiSelect?: (scenarios: Scenario[]) => void;
  onPreview?: (scenario: Scenario) => void;
  columns?: 1 | 2 | 3 | 4;
  maxHeight?: string;
  className?: string;
}

// ============================================================================
// Icon Map
// ============================================================================

const IconMap: Record<ScenarioIcon, React.ElementType> = {
  trending: TrendingUp,
  building: Building2,
  layers: Layers,
  star: Star,
  zap: Zap,
  target: Target,
  chart: BarChart3,
  users: Users,
  shield: Shield,
};

// ============================================================================
// Complexity Badge
// ============================================================================

const ComplexityBadge: React.FC<{ complexity: Complexity }> = ({ complexity }) => {
  const config = {
    simple: { 
      color: 'bg-green-500/10 text-green-400 border-green-500/20', 
      label: 'Simple',
      dots: 1
    },
    medium: { 
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', 
      label: 'Medium',
      dots: 2
    },
    complex: { 
      color: 'bg-red-500/10 text-red-400 border-red-500/20', 
      label: 'Complex',
      dots: 3
    },
  };

  const { color, label, dots } = config[complexity];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}>
      <span className="flex gap-0.5">
        {[...Array(3)].map((_, i) => (
          <span 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full ${i < dots ? 'bg-current' : 'bg-current/20'}`} 
          />
        ))}
      </span>
      {label}
    </span>
  );
};

// ============================================================================
// AI Recommendation Badge
// ============================================================================

const AIRecommendationBadge: React.FC<{ confidence: number; reasoning?: string }> = ({ confidence, reasoning }) => (
  <div className="absolute -top-2 -right-2 z-10">
    <div className="group relative">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#39FF14] rounded-full text-[#121212] text-[10px] font-bold shadow-lg shadow-[#39FF14]/20">
        <Sparkles className="w-3 h-3" />
        AI Pick {Math.round(confidence * 100)}%
      </div>
      {reasoning && (
        <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-[#1A1A1A] border border-[#444444] rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20">
          <p className="text-gray-400 text-[11px]">{reasoning}</p>
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// Scenario Card (Grid View)
// ============================================================================

interface ScenarioCardProps {
  scenario: Scenario;
  selected: boolean;
  showAI: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, selected, showAI, onSelect, onPreview }) => {
  const Icon = scenario.icon ? IconMap[scenario.icon] : Layers;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex flex-col text-left rounded-lg border overflow-hidden transition-all group
        ${selected 
          ? 'bg-[#39FF14]/5 border-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.1)]' 
          : 'bg-[#1A1A1A] border-[#444444] hover:border-[#555555] hover:bg-[#252525]'
        }
      `}
    >
      {/* AI Badge */}
      {scenario.aiRecommended && showAI && scenario.aiConfidence && (
        <AIRecommendationBadge confidence={scenario.aiConfidence} reasoning={scenario.aiReasoning} />
      )}

      {/* Preview Image */}
      {scenario.previewImage && (
        <div className="relative h-32 bg-[#252525] overflow-hidden">
          <img 
            src={scenario.previewImage} 
            alt={scenario.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] to-transparent" />
          {onPreview && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPreview(); }}
              className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            ${selected ? 'bg-[#39FF14] text-[#121212]' : 'bg-[#333333] text-gray-400 group-hover:text-white'}
            transition-colors
          `}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate transition-colors ${selected ? 'text-[#39FF14]' : 'text-white'}`}>
              {scenario.title}
            </h3>
            {scenario.category && (
              <p className="text-gray-500 text-xs truncate">{scenario.category}</p>
            )}
          </div>
          {selected && (
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#39FF14] flex items-center justify-center">
              <Check className="w-4 h-4 text-[#121212]" />
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
          {scenario.description}
        </p>

        {/* Meta Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {scenario.complexity && <ComplexityBadge complexity={scenario.complexity} />}
          {scenario.estimatedTime && (
            <span className="inline-flex items-center gap-1 text-gray-500 text-[11px]">
              <Clock className="w-3 h-3" />
              {scenario.estimatedTime}
            </span>
          )}
          {scenario.estimatedValue && (
            <span className="inline-flex items-center gap-1 text-[#39FF14] text-[11px] font-medium">
              <TrendingUp className="w-3 h-3" />
              {scenario.estimatedValue}
            </span>
          )}
        </div>

        {/* Tags */}
        {scenario.tags && scenario.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[#333333]">
            {scenario.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-2 py-0.5 bg-[#333333] rounded text-gray-500 text-[10px]">
                {tag}
              </span>
            ))}
            {scenario.tags.length > 3 && (
              <span className="text-gray-600 text-[10px]">+{scenario.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* Hover Action */}
      {!selected && (
        <div className="absolute bottom-4 right-4 flex items-center gap-1 text-[#39FF14] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Select <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </button>
  );
};

// ============================================================================
// Scenario Row (List View)
// ============================================================================

const ScenarioRow: React.FC<ScenarioCardProps> = ({ scenario, selected, showAI, onSelect, onPreview: _onPreview }) => {
  const Icon = scenario.icon ? IconMap[scenario.icon] : Layers;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative flex items-center gap-4 p-4 rounded-lg border transition-all group w-full text-left
        ${selected 
          ? 'bg-[#39FF14]/5 border-[#39FF14]' 
          : 'bg-[#1A1A1A] border-[#444444] hover:border-[#555555] hover:bg-[#252525]'
        }
      `}
    >
      {/* Icon or Image */}
      {scenario.previewImage ? (
        <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-[#252525]">
          <img src={scenario.previewImage} alt={scenario.title} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${selected ? 'bg-[#39FF14] text-[#121212]' : 'bg-[#333333] text-gray-400'}`}>
          <Icon className="w-6 h-6" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-semibold ${selected ? 'text-[#39FF14]' : 'text-white'}`}>
            {scenario.title}
          </h3>
          {scenario.aiRecommended && showAI && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#39FF14]/20 rounded text-[#39FF14] text-[10px] font-medium">
              <Sparkles className="w-3 h-3" />
              AI Pick
            </span>
          )}
        </div>
        <p className="text-gray-400 text-sm truncate">{scenario.description}</p>
        <div className="flex items-center gap-3 mt-2">
          {scenario.complexity && <ComplexityBadge complexity={scenario.complexity} />}
          {scenario.estimatedTime && (
            <span className="text-gray-500 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />{scenario.estimatedTime}
            </span>
          )}
          {scenario.category && (
            <span className="text-gray-500 text-xs">{scenario.category}</span>
          )}
        </div>
      </div>

      {/* Selection indicator */}
      <div className="flex-shrink-0">
        {selected ? (
          <div className="w-6 h-6 rounded-full bg-[#39FF14] flex items-center justify-center">
            <Check className="w-4 h-4 text-[#121212]" />
          </div>
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-[#39FF14] transition-colors" />
        )}
      </div>
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  title,
  description,
  scenarios,
  categories,
  selectedId,
  multiSelect = false,
  selectedIds = [],
  showAIRecommendations = true,
  showSearch = true,
  showFilters = true,
  showViewToggle = true,
  defaultView = 'grid',
  onSelect,
  onMultiSelect,
  onPreview,
  columns = 2,
  maxHeight,
  className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(
    new Set(multiSelect ? selectedIds : selectedId ? [selectedId] : [])
  );

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    let result = [...scenarios];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query) ||
        s.tags?.some(t => t.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter(s => s.category === selectedCategory);
    }

    // Sort: AI recommended first
    if (showAIRecommendations) {
      result.sort((a, b) => {
        if (a.aiRecommended && !b.aiRecommended) return -1;
        if (!a.aiRecommended && b.aiRecommended) return 1;
        return 0;
      });
    }

    return result;
  }, [scenarios, searchQuery, selectedCategory, showAIRecommendations]);

  // Derive categories if not provided
  const derivedCategories = useMemo(() => {
    if (categories) return categories;
    const cats = new Map<string, number>();
    scenarios.forEach(s => {
      if (s.category) {
        cats.set(s.category, (cats.get(s.category) || 0) + 1);
      }
    });
    return Array.from(cats.entries()).map(([id, count]) => ({ id, label: id, count }));
  }, [categories, scenarios]);

  // Handle selection
  const handleSelect = (scenario: Scenario) => {
    if (multiSelect) {
      const newSelected = new Set(internalSelectedIds);
      if (newSelected.has(scenario.id)) {
        newSelected.delete(scenario.id);
      } else {
        newSelected.add(scenario.id);
      }
      setInternalSelectedIds(newSelected);
      onMultiSelect?.(scenarios.filter(s => newSelected.has(s.id)));
    } else {
      setInternalSelectedIds(new Set([scenario.id]));
      onSelect(scenario);
    }
  };

  const isSelected = (id: string) => internalSelectedIds.has(id);

  const gridCols: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={`bg-[#333333] border border-[#444444] rounded-lg ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-[#444444]">
        {(title || description) && (
          <div className="mb-4">
            {title && <h2 className="text-white text-lg font-semibold mb-1">{title}</h2>}
            {description && <p className="text-gray-400 text-sm">{description}</p>}
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenarios..."
                className="w-full pl-10 pr-4 py-2 bg-[#1A1A1A] border border-[#444444] rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#39FF14]"
              />
            </div>
          )}

          <div className="flex gap-2">
            {showFilters && derivedCategories.length > 0 && (
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="px-3 py-2 bg-[#1A1A1A] border border-[#444444] rounded-md text-white text-sm focus:outline-none focus:border-[#39FF14]"
              >
                <option value="">All Categories</option>
                {derivedCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} {cat.count && `(${cat.count})`}
                  </option>
                ))}
              </select>
            )}

            {showViewToggle && (
              <div className="flex border border-[#444444] rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-[#39FF14] text-[#121212]' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'} transition-colors`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-[#39FF14] text-[#121212]' : 'bg-[#1A1A1A] text-gray-400 hover:text-white'} transition-colors`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scenarios */}
      <div 
        className="p-6 overflow-y-auto"
        style={{ maxHeight: maxHeight || 'auto' }}
      >
        {filteredScenarios.length === 0 ? (
          <div className="text-center py-12">
            <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No scenarios found</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-[#39FF14] text-sm hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={`grid gap-4 ${gridCols[columns]}`}>
            {filteredScenarios.map(scenario => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                selected={isSelected(scenario.id)}
                showAI={showAIRecommendations}
                onSelect={() => handleSelect(scenario)}
                onPreview={onPreview ? () => onPreview(scenario) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredScenarios.map(scenario => (
              <ScenarioRow
                key={scenario.id}
                scenario={scenario}
                selected={isSelected(scenario.id)}
                showAI={showAIRecommendations}
                onSelect={() => handleSelect(scenario)}
                onPreview={onPreview ? () => onPreview(scenario) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Multi-select Footer */}
      {multiSelect && internalSelectedIds.size > 0 && (
        <div className="p-4 border-t border-[#444444] flex items-center justify-between bg-[#1A1A1A]">
          <span className="text-gray-400 text-sm">
            {internalSelectedIds.size} scenario{internalSelectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={() => {
              setInternalSelectedIds(new Set());
              onMultiSelect?.([]);
            }}
            className="text-gray-500 text-sm hover:text-white transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
};

export default ScenarioSelector;
