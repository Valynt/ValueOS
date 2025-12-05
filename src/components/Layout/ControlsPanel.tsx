import React, { useState } from 'react';
import { CanvasComponent } from '../../types';
import { Settings, Sliders, Database, ChevronDown, ChevronRight, Palette, Layout } from 'lucide-react';
import { ExpandablePanel } from './ExpandablePanel';

interface ControlsPanelProps {
  selectedComponent: CanvasComponent | null;
  onUpdateComponent: (id: string, updates: Partial<CanvasComponent>) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  selectedComponent,
  onUpdateComponent
}) => {
  if (!selectedComponent) {
    return (
      <div className="w-80 bg-white border-l border-gray-200 p-6">
        <div className="text-center text-gray-500 py-8">
          <Settings className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-sm font-medium text-gray-900 mb-2">No Component Selected</h3>
          <p className="text-sm text-gray-500">
            Select a component on the canvas to edit its properties
          </p>
        </div>
      </div>
    );
  }

  const renderMetricCardControls = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
        <input
          type="text"
          value={selectedComponent.props.title}
          onChange={(e) => onUpdateComponent(selectedComponent.id, {
            props: { ...selectedComponent.props, title: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
        <input
          type="text"
          value={selectedComponent.props.value}
          onChange={(e) => onUpdateComponent(selectedComponent.id, {
            props: { ...selectedComponent.props, value: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Trend</label>
        <select
          value={selectedComponent.props.trend}
          onChange={(e) => onUpdateComponent(selectedComponent.id, {
            props: { ...selectedComponent.props, trend: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="up">Positive</option>
          <option value="down">Negative</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>
    </div>
  );

  const renderChartControls = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Chart Title</label>
        <input
          type="text"
          value={selectedComponent.props.title}
          onChange={(e) => onUpdateComponent(selectedComponent.id, {
            props: { ...selectedComponent.props, title: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Chart Type</label>
        <select
          value={selectedComponent.props.type}
          onChange={(e) => onUpdateComponent(selectedComponent.id, {
            props: { ...selectedComponent.props, type: e.target.value }
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="bar">Bar Chart</option>
          <option value="pie">Pie Chart</option>
          <option value="line">Line Chart</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Component Controls</h2>
          <Sliders className="h-5 w-5 text-gray-400" />
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="flex items-center text-sm text-blue-800">
            <Database className="h-4 w-4 mr-2" />
            <span>Connected to Salesforce</span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Data auto-synced from Acme Corp opportunity
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Component Type</h3>
          <div className="bg-gray-50 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 capitalize">
            {selectedComponent.type.replace('-', ' ')}
          </div>
        </div>

        <ExpandablePanel title="Content" icon={<Sliders className="h-4 w-4" />} defaultExpanded={true}>
          {selectedComponent.type === 'metric-card' && renderMetricCardControls()}
          {selectedComponent.type === 'interactive-chart' && renderChartControls()}
        </ExpandablePanel>

        <ExpandablePanel title="Layout" icon={<Layout className="h-4 w-4" />}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">X Position</label>
                <input
                  type="number"
                  value={selectedComponent.position.x}
                  onChange={(e) => onUpdateComponent(selectedComponent.id, {
                    position: { ...selectedComponent.position, x: parseInt(e.target.value) }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Y Position</label>
                <input
                  type="number"
                  value={selectedComponent.position.y}
                  onChange={(e) => onUpdateComponent(selectedComponent.id, {
                    position: { ...selectedComponent.position, y: parseInt(e.target.value) }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  value={selectedComponent.size.width}
                  onChange={(e) => onUpdateComponent(selectedComponent.id, {
                    size: { ...selectedComponent.size, width: parseInt(e.target.value) }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  value={selectedComponent.size.height}
                  onChange={(e) => onUpdateComponent(selectedComponent.id, {
                    size: { ...selectedComponent.size, height: parseInt(e.target.value) }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </ExpandablePanel>

        <ExpandablePanel title="Style" icon={<Palette className="h-4 w-4" />}>
          <div className="text-sm text-gray-600">
            Style options coming soon...
          </div>
        </ExpandablePanel>
      </div>

      <div className="p-6 border-t border-gray-200">
        <button className="w-full bg-red-50 text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
          Remove Component
        </button>
      </div>
    </div>
  );
};