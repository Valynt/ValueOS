import React from 'react';
import { CanvasComponent } from '../../types';
import { Plus, Save, Share, BarChart3, FileText, Table, Zap } from 'lucide-react';

interface ToolbarProps {
  onAddComponent: (component: Omit<CanvasComponent, 'id'>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddComponent }) => {
  const addMetricCard = () => {
    onAddComponent({
      type: 'metric-card',
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      size: { width: 300, height: 120 },
      props: {
        title: 'New Metric',
        value: '$0',
        trend: 'neutral',
        change: 'No change'
      }
    });
  };

  const addChart = () => {
    onAddComponent({
      type: 'interactive-chart',
      position: { x: 100 + Math.random() * 200, y: 200 + Math.random() * 200 },
      size: { width: 400, height: 300 },
      props: {
        title: 'New Chart',
        type: 'bar',
        data: [
          { name: 'Category A', value: 100, id: 'cat-a' },
          { name: 'Category B', value: 150, id: 'cat-b' },
          { name: 'Category C', value: 75, id: 'cat-c' }
        ],
        config: { showValue: true }
      }
    });
  };

  const addTable = () => {
    onAddComponent({
      type: 'data-table',
      position: { x: 100 + Math.random() * 200, y: 300 + Math.random() * 200 },
      size: { width: 500, height: 250 },
      props: {
        title: 'Assumptions Table',
        headers: ['Assumption', 'Current Value', 'Source'],
        rows: [
          ['User Adoption Rate', '85%', 'Industry Benchmark'],
          ['Annual Growth', '15%', 'Customer Forecast'],
          ['Implementation Time', '3 months', 'Historical Data']
        ],
        editableColumns: [1]
      }
    });
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Value Canvas</span>
          </div>
          
          <div className="h-6 border-l border-gray-300"></div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={addMetricCard}
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Metric Card
            </button>
            <button
              onClick={addChart}
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Chart
            </button>
            <button
              onClick={addTable}
              className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Table className="h-4 w-4 mr-2" />
              Table
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Save className="h-4 w-4 mr-2" />
            Save
          </button>
          <button className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
            <Share className="h-4 w-4 mr-2" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};