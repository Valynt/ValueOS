/**
 * DashboardPanel Layout Component
 * 
 * Renders children in a collapsible panel with optional title
 * Part of the agentic canvas layout system
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface DashboardPanelProps {
  title?: string;
  collapsible?: boolean;
  children: React.ReactNode[];
  defaultExpanded?: boolean;
}

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ 
  title,
  collapsible = false,
  children,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const toggleExpanded = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };
  
  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900 overflow-hidden">
      {title && (
        <div 
          className={`px-4 py-3 border-b border-gray-800 flex items-center justify-between ${
            collapsible ? 'cursor-pointer hover:bg-gray-850' : ''
          }`}
          onClick={toggleExpanded}
        >
          <h3 className="text-white font-medium">{title}</h3>
          {collapsible && (
            <button className="text-gray-400 hover:text-white">
              {isExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      )}
      
      {isExpanded && (
        <div className="p-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};
