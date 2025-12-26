import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Code, Eye } from 'lucide-react';
import { sduiSandboxService } from '../../services/SDUISandboxService';

interface ComponentPreviewProps {
  intentType: string;
  componentName: string;
  registryEntry: any;
  organizationId: string;
}

export const ComponentPreview: React.FC<ComponentPreviewProps> = ({
  intentType,
  componentName,
  registryEntry,
  organizationId,
}) => {
  const [previewMode, setPreviewMode] = useState<'visual' | 'code'>('visual');
  const [sampleProps, setSampleProps] = useState<any>({});
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Generate sample props based on registry entry
    const props = generateSampleProps(registryEntry);
    setSampleProps(props);
  }, [registryEntry]);

  const generateSampleProps = (entry: any) => {
    const props: any = {};
    
    // Generate samples based on required props
    if (entry.requiredProps) {
      entry.requiredProps.forEach((prop: string) => {
        props[prop] = getSampleValueForProp(prop);
      });
    }

    // Add some optional props with samples
    if (intentType === 'visualize_graph') {
      props.entities = [
        { id: '1', type: 'system', properties: { name: 'Sample System' } },
        { id: '2', type: 'component', properties: { name: 'Sample Component' } },
      ];
      props.relationships = [
        { from: '1', to: '2', type: 'contains' },
      ];
      props.title = 'Sample System Map';
    } else if (intentType === 'display_metric') {
      props.value = 42;
      props.label = 'Sample Metric';
      props.trend = 'up';
    }

    return props;
  };

  const getSampleValueForProp = (propName: string): any => {
    const samples: Record<string, any> = {
      entities: [{ id: '1', type: 'node' }],
      relationships: [{ from: '1', to: '2', type: 'connects' }],
      tree: { nodes: [], edges: [] },
      data: [{ id: 1, name: 'Sample' }],
      columns: [{ key: 'name', label: 'Name' }],
      value: 'Sample Value',
      label: 'Sample Label',
      title: 'Sample Title',
      items: [{ id: 1, name: 'Item 1' }],
      fields: [{ name: 'field1', type: 'text', label: 'Field 1' }],
      kpis: [{ name: 'Revenue', target: 100000 }],
      metrics: [{ name: 'Revenue', value: 95000, target: 100000 }],
    };

    return samples[propName] || `Sample ${propName}`;
  };

  const validateProps = async () => {
    setIsValidating(true);
    try {
      const result = await sduiSandboxService.validateComponent(
        intentType,
        sampleProps,
        organizationId
      );
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: ['Validation failed'],
        warnings: [],
      });
    }
    setIsValidating(false);
  };

  const updateProp = (propName: string, value: any) => {
    setSampleProps(prev => ({
      ...prev,
      [propName]: value,
    }));
  };

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {componentName} Preview
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setPreviewMode('visual')}
            className={`px-3 py-1 rounded ${
              previewMode === 'visual' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            <Eye className="w-4 h-4 inline mr-1" />
            Visual
          </button>
          <button
            onClick={() => setPreviewMode('code')}
            className={`px-3 py-1 rounded ${
              previewMode === 'code' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            <Code className="w-4 h-4 inline mr-1" />
            Code
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Props Editor */}
        <div>
          <h4 className="font-medium mb-2">Props Editor</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(sampleProps).map(([key, value]) => (
              <div key={key} className="flex items-center space-x-2">
                <label className="text-sm font-medium w-24">{key}:</label>
                <input
                  type="text"
                  value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateProp(key, parsed);
                    } catch {
                      updateProp(key, e.target.value);
                    }
                  }}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
              </div>
            ))}
          </div>
          
          <button
            onClick={validateProps}
            disabled={isValidating}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isValidating ? 'Validating...' : 'Validate Props'}
          </button>
        </div>

        {/* Preview/Schema */}
        <div>
          {previewMode === 'visual' ? (
            <div>
              <h4 className="font-medium mb-2">Visual Preview</h4>
              <div className="border rounded p-4 bg-gray-50 min-h-32">
                {/* Placeholder for actual component rendering */}
                <div className="text-center text-gray-500">
                  <Eye className="w-8 h-8 mx-auto mb-2" />
                  <p>Component preview would render here</p>
                  <p className="text-xs mt-1">Intent: {intentType}</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="font-medium mb-2">Schema & Validation</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Intent Type:</span>
                  <code className="ml-2 px-2 py-1 bg-gray-100 rounded text-xs">
                    {intentType}
                  </code>
                </div>
                
                <div>
                  <span className="text-sm font-medium">Required Props:</span>
                  <div className="mt-1">
                    {registryEntry.requiredProps?.map((prop: string) => (
                      <code key={prop} className="mr-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {prop}
                      </code>
                    )) || <span className="text-gray-500 text-sm">None</span>}
                  </div>
                </div>

                {validationResult && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      {validationResult.valid ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-sm font-medium">
                        {validationResult.valid ? 'Valid' : 'Invalid'}
                      </span>
                    </div>

                    {validationResult.errors.length > 0 && (
                      <div className="text-red-600 text-sm">
                        <strong>Errors:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {validationResult.errors.map((error: string, i: number) => (
                            <li key={i}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {validationResult.warnings.length > 0 && (
                      <div className="text-yellow-600 text-sm mt-2">
                        <strong>Warnings:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {validationResult.warnings.map((warning: string, i: number) => (
                            <li key={i}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
