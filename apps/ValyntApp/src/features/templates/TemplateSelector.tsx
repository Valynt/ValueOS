/**
 * TemplateSelector
 * 
 * Compact template picker for case creation flow.
 */

import React, { useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  DollarSign,
  Shield,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DEFAULT_TEMPLATES } from './defaultTemplates';
import type { TemplateCategory, ValueCaseTemplate } from './types';

const CATEGORY_ICONS: Record<TemplateCategory, React.ComponentType<any>> = {
  general: BarChart3,
  saas: Zap,
  infrastructure: DollarSign,
  security: Shield,
  productivity: TrendingUp,
  custom: Star,
};

interface TemplateSelectorProps {
  selectedTemplateId?: string;
  onSelect: (template: ValueCaseTemplate) => void;
  className?: string;
}

export function TemplateSelector({
  selectedTemplateId,
  onSelect,
  className,
}: TemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedTemplate = DEFAULT_TEMPLATES.find(t => t.id === selectedTemplateId);

  return (
    <div className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-4 py-3",
          "bg-white border border-slate-200 rounded-lg",
          "hover:border-slate-300 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          {selectedTemplate ? (
            <>
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                {React.createElement(
                  CATEGORY_ICONS[selectedTemplate.category] || BarChart3,
                  { className: "w-4 h-4 text-primary" }
                )}
              </div>
              <div className="text-left">
                <div className="font-medium text-slate-900">{selectedTemplate.name}</div>
                <div className="text-xs text-slate-500">
                  {selectedTemplate.metrics.length} metrics · {selectedTemplate.valueDrivers.length} drivers
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-left">
                <div className="font-medium text-slate-700">Select a template</div>
                <div className="text-xs text-slate-500">Choose a starting point for your value case</div>
              </div>
            </>
          )}
        </div>
        <ChevronDown className={cn(
          "w-5 h-5 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden max-h-96 overflow-y-auto">
            {DEFAULT_TEMPLATES.map((template) => {
              const Icon = CATEGORY_ICONS[template.category] || BarChart3;
              const isSelected = template.id === selectedTemplateId;
              
              return (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelect(template);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left",
                    "hover:bg-slate-50 transition-colors",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    isSelected ? "bg-primary/10" : "bg-slate-100"
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isSelected ? "text-primary" : "text-slate-500"
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium",
                        isSelected ? "text-primary" : "text-slate-900"
                      )}>
                        {template.name}
                      </span>
                      {template.isDefault && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span>{template.metrics.length} metrics</span>
                      <span>·</span>
                      <span>{template.valueDrivers.length} value drivers</span>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <Check className="w-5 h-5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Compact inline template selector for headers
 */
export function TemplateChip({
  template,
  onClick,
}: {
  template?: ValueCaseTemplate;
  onClick?: () => void;
}) {
  if (!template) return null;
  
  const Icon = CATEGORY_ICONS[template.category] || BarChart3;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      <span className="text-xs font-medium text-slate-600">{template.name}</span>
      <ChevronDown className="w-3 h-3 text-slate-400" />
    </button>
  );
}

export default TemplateSelector;
