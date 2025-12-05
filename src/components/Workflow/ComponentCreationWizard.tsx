import React, { useState } from 'react';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { CanvasComponent } from '../../types';

interface ComponentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateComponent: (component: Omit<CanvasComponent, 'id' | 'position'>) => void;
  initialType?: 'metric-card' | 'interactive-chart' | 'data-table' | 'narrative-block';
}

type CreationMode = 'simple' | 'detailed' | 'agent-assisted';

export const ComponentCreationWizard: React.FC<ComponentCreationWizardProps> = ({
  isOpen,
  onClose,
  onCreateComponent,
  initialType
}) => {
  const [mode, setMode] = useState<CreationMode | null>(null);
  const [componentType, setComponentType] = useState<string>(initialType || '');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<any>({});

  if (!isOpen) return null;

  const handleModeSelect = (selectedMode: CreationMode) => {
    setMode(selectedMode);
    if (selectedMode === 'simple' && componentType) {
      createSimpleComponent();
    } else {
      setStep(2);
    }
  };

  const createSimpleComponent = () => {
    const defaultComponents: Record<string, Omit<CanvasComponent, 'id' | 'position'>> = {
      'metric-card': {
        type: 'metric-card',
        size: { width: 300, height: 120 },
        props: {
          title: 'New Metric',
          value: '0',
          trend: 'neutral',
          change: 'No change'
        }
      },
      'interactive-chart': {
        type: 'interactive-chart',
        size: { width: 500, height: 300 },
        props: {
          title: 'New Chart',
          type: 'bar',
          data: [
            { name: 'Item 1', value: 100, id: 'item1', color: '#3b82f6' },
            { name: 'Item 2', value: 200, id: 'item2', color: '#10b981' }
          ],
          config: { showValue: true, showLegend: true }
        }
      },
      'data-table': {
        type: 'data-table',
        size: { width: 600, height: 250 },
        props: {
          title: 'New Table',
          headers: ['Column 1', 'Column 2', 'Column 3'],
          rows: [
            ['Data 1', 'Data 2', 'Data 3'],
            ['Data 4', 'Data 5', 'Data 6']
          ],
          editableColumns: []
        }
      },
      'narrative-block': {
        type: 'narrative-block',
        size: { width: 600, height: 200 },
        props: {
          title: 'New Narrative',
          content: 'Add your narrative content here...',
          style: 'default'
        }
      }
    };

    const component = defaultComponents[componentType];
    if (component) {
      onCreateComponent(component);
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setMode(null);
    setStep(1);
    setFormData({});
    onClose();
  };

  const renderModeSelection = () => (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        How would you like to create this component?
      </h2>

      <div className="space-y-3">
        <button
          onClick={() => handleModeSelect('simple')}
          className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-900">
                Quick Create
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Use default settings and customize later
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => handleModeSelect('detailed')}
          className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-900">
                Detailed Setup
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure all properties and settings now
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600" />
          </div>
        </button>

        <button
          onClick={() => handleModeSelect('agent-assisted')}
          className="w-full p-4 border-2 border-blue-200 bg-blue-50 rounded-lg hover:border-blue-500 hover:bg-blue-100 transition-all text-left group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Agent-Assisted
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  Let AI help configure based on your needs
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-blue-600" />
          </div>
        </button>
      </div>
    </div>
  );

  const renderDetailedForm = () => {
    if (componentType === 'metric-card') {
      return (
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configure Metric Card</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Total Revenue"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
            <input
              type="text"
              value={formData.value || ''}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder="e.g., $1.2M"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Trend</label>
            <select
              value={formData.trend || 'neutral'}
              onChange={(e) => setFormData({ ...formData, trend: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="neutral">Neutral</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Change Description</label>
            <input
              type="text"
              value={formData.change || ''}
              onChange={(e) => setFormData({ ...formData, change: e.target.value })}
              placeholder="e.g., +15% vs last month"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => {
                onCreateComponent({
                  type: 'metric-card',
                  size: { width: 300, height: 120 },
                  props: formData
                });
                resetAndClose();
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Create Component
            </button>
            <button
              onClick={resetAndClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-30 z-50" onClick={resetAndClose} />

      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Create {componentType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </h2>
            <button
              onClick={resetAndClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {step === 1 && renderModeSelection()}
          {step === 2 && mode === 'detailed' && renderDetailedForm()}
        </div>
      </div>
    </>
  );
};
