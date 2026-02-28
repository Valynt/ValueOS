/**
 * TemplatesPage
 * 
 * Manage value case templates - view, create, edit, delete.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Check,
  Copy,
  DollarSign,
  Edit2,
  Filter,
  MoreVertical,
  Plus,
  Search,
  Shield,
  Star,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_TEMPLATES } from '@/features/templates/defaultTemplates';
import type { TemplateCategory, ValueCaseTemplate } from '@/features/templates/types';

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: React.ComponentType<any>; color: string }> = {
  general: { label: 'General', icon: BarChart3, color: 'bg-slate-100 text-slate-600' },
  saas: { label: 'SaaS', icon: Zap, color: 'bg-purple-100 text-purple-600' },
  infrastructure: { label: 'Infrastructure', icon: DollarSign, color: 'bg-blue-100 text-blue-600' },
  security: { label: 'Security', icon: Shield, color: 'bg-amber-100 text-amber-600' },
  productivity: { label: 'Productivity', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-600' },
  custom: { label: 'Custom', icon: Star, color: 'bg-pink-100 text-pink-600' },
};

export function TemplatesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [templates, setTemplates] = useState<ValueCaseTemplate[]>(DEFAULT_TEMPLATES);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = 
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = 
        selectedCategory === 'all' || template.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  // Group by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, ValueCaseTemplate[]> = {};
    
    filteredTemplates.forEach(template => {
      const category = template.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(template);
    });
    
    return groups;
  }, [filteredTemplates]);

  const handleUseTemplate = (templateId: string) => {
    navigate(`/app/cases/new?template=${templateId}`);
  };

  const handleDuplicateTemplate = (template: ValueCaseTemplate) => {
    const newTemplate: ValueCaseTemplate = {
      ...template,
      id: `custom_${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      isCustom: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates([...templates, newTemplate]);
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(templates.filter(t => t.id !== templateId));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Case Templates</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pre-built value case structures for common scenarios
            </p>
          </div>
          <button
            onClick={() => navigate('/app/templates/new')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={18} />
            Create Template
          </button>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as TemplateCategory | 'all')}
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {Object.entries(groupedTemplates).length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">No templates found</h3>
            <p className="text-sm text-slate-500">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => {
              const config = CATEGORY_CONFIG[category as TemplateCategory];
              const Icon = config?.icon || BarChart3;
              
              return (
                <section key={category}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={cn("p-1.5 rounded-lg", config?.color || 'bg-slate-100')}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-800">
                      {config?.label || category}
                    </h2>
                    <span className="text-sm text-slate-400">
                      ({categoryTemplates.length})
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        onUse={() => handleUseTemplate(template.id)}
                        onDuplicate={() => handleDuplicateTemplate(template)}
                        onDelete={() => handleDeleteTemplate(template.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: ValueCaseTemplate;
  onUse: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function TemplateCard({ template, onUse, onDuplicate, onDelete }: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900">{template.name}</h3>
              {template.isDefault && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                  DEFAULT
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">
              {template.description}
            </p>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <MoreVertical size={16} className="text-slate-400" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)} 
                />
                <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                  <button
                    onClick={() => { onDuplicate(); setShowMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy size={14} />
                    Duplicate
                  </button>
                  {template.isCustom && (
                    <>
                      <button
                        onClick={() => setShowMenu(false)}
                        className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => { onDelete(); setShowMenu(false); }}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Preview */}
      <div className="p-4 bg-slate-50">
        <div className="text-xs font-medium text-slate-500 mb-2">KEY METRICS</div>
        <div className="flex flex-wrap gap-1.5">
          {template.primaryMetrics.slice(0, 4).map((metricId) => {
            const metric = template.metrics.find(m => m.id === metricId);
            if (!metric) return null;
            
            return (
              <span
                key={metricId}
                className="px-2 py-1 text-xs font-medium bg-white border border-slate-200 rounded-md text-slate-600"
              >
                {metric.name}
              </span>
            );
          })}
          {template.primaryMetrics.length > 4 && (
            <span className="px-2 py-1 text-xs text-slate-400">
              +{template.primaryMetrics.length - 4} more
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {template.metrics.length} metrics · {template.valueDrivers.length} drivers
        </div>
        <button
          onClick={onUse}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
        >
          <Check size={14} />
          Use Template
        </button>
      </div>
    </div>
  );
}

export default TemplatesPage;
