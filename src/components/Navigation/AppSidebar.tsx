import React from 'react';
import { Activity, Home, Layers, Sparkles, Settings, Zap, Book } from 'lucide-react';
import { ViewMode } from '../../types';

interface AppSidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { id: 'library' as ViewMode, label: 'Library', icon: Home },
    { id: 'templates' as ViewMode, label: 'Templates', icon: Layers },
    { id: 'performance' as ViewMode, label: 'Performance', icon: Activity },
    { id: 'documentation' as ViewMode, label: 'Documentation', icon: Book },
  ];

  return (
    <div className="w-64 bg-gray-900 flex flex-col">
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Value Canvas</h1>
            <p className="text-xs text-gray-400">Business Intelligence</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800">
          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4 border border-blue-800">
            <div className="flex items-start space-x-2 mb-2">
              <Sparkles className="h-5 w-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-200">AI Agent Ready</h3>
                <p className="text-xs text-blue-300 mt-1">
                  Press ⌘K anytime to ask the agent for help
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            currentView === 'settings'
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings className="h-5 w-5" />
          <span className="font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
};
