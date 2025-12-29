import React, { useState, useMemo } from 'react';
import { useTemplateStore } from '../hooks/useTemplateStore';
import { TrustBadgeTooltip } from '../atoms/TrustBadgeTooltip';

export interface Scenario {
  id: string;
  name: string;
  financials: {
    roi: number;
    npv: number;
    paybackPeriod: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  actions: string[];
}

export interface ScenarioMatrixProps {
  scenarios: Scenario[];
  variables?: Record<string, number>;
  onVariableChange?: (key: string, value: number) => void;
}

export const ScenarioMatrix: React.FC<ScenarioMatrixProps> = ({
  scenarios,
  variables = {},
  onVariableChange
}) => {
  const { trustBadges, setShowTrustOverlay, setSelectedTrustBadge } = useTemplateStore();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showVariableControls, setShowVariableControls] = useState(false);

  // Sort scenarios by ROI (best first)
  const sortedScenarios = useMemo(() => {
    return [...scenarios].sort((a, b) => b.financials.roi - a.financials.roi);
  }, [scenarios]);

  // Find best and worst
  const bestScenario = sortedScenarios[0];
  const worstScenario = sortedScenarios[sortedScenarios.length - 1];

  const handleTrustClick = (scenario: Scenario, metric: string) => {
    const badge = trustBadges.find(b => b.metric === metric);
    if (badge) {
      setSelectedTrustBadge({ ...badge, value: scenario.financials[metric as keyof typeof scenario.financials] });
      setShowTrustOverlay(true);
    }
  };

  const getRiskColor = (risk: string) => {
    const colors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444'
    };
    return colors[risk as keyof typeof colors];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return '#10B981';
    if (confidence >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div 
      className="scenario-matrix"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%'
      }}
    >
      {/* Header */}
      <div 
        className="matrix-header"
        style={{
          background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
          color: '#FFFFFF',
          borderRadius: '12px',
          padding: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div>
          <h2 
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.25rem'
            }}
          >
            Scenario Matrix
          </h2>
          <p 
            style={{
              margin: 0,
              fontSize: '0.875rem',
              opacity: 0.9
            }}
          >
            Compare multiple business scenarios side by side
          </p>
        </div>

        <button
          onClick={() => setShowVariableControls(!showVariableControls)}
          style={{
            backgroundColor: '#FFFFFF',
            color: '#059669',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ⚙️ Variables
        </button>
      </div>

      {/* Variable Controls */}
      {showVariableControls && (
        <div 
          className="variable-controls"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
          }}
        >
          <h3 
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: '#111827'
            }}
          >
            Adjustable Variables
          </h3>
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}
          >
            {Object.entries(variables).map(([key, value]) => (
              <div key={key}>
                <label 
                  style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: '#374151',
                    marginBottom: '0.5rem'
                  }}
                >
                  {key.replace(/_/g, ' ').toUpperCase()}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={value * 100}
                  onChange={(e) => onVariableChange?.(key, parseInt(e.target.value) / 100)}
                  style={{
                    width: '100%',
                    accentColor: '#059669'
                  }}
                />
                <div 
                  style={{
                    textAlign: 'right',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#059669',
                    marginTop: '0.25rem'
                  }}
                >
                  {(value * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div 
        className="comparison-table"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}
      >
        <table 
          style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr 
              style={{
                backgroundColor: '#F9FAFB',
                borderBottom: '2px solid #E5E7EB'
              }}
            >
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                Scenario
              </th>
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                ROI
              </th>
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                NPV
              </th>
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                Payback
              </th>
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                Risk
              </th>
              <th 
                style={{
                  padding: '1rem',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: '0.875rem'
                }}
              >
                Confidence
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedScenarios.map((scenario, index) => {
              const isBest = scenario.id === bestScenario.id;
              const isWorst = scenario.id === worstScenario.id;
              const isSelected = selectedScenario === scenario.id;

              return (
                <tr 
                  key={scenario.id}
                  onClick={() => setSelectedScenario(isSelected ? null : scenario.id)}
                  style={{
                    backgroundColor: isSelected ? '#ECFDF5' : isBest ? '#F0FDF4' : isWorst ? '#FEF2F2' : '#FFFFFF',
                    borderBottom: '1px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#F9FAFB';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = isBest ? '#F0FDF4' : isWorst ? '#FEF2F2' : '#FFFFFF';
                    }
                  }}
                >
                  <td 
                    style={{
                      padding: '1rem',
                      fontWeight: 600,
                      color: '#111827',
                      fontSize: '0.875rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isBest && <span style={{ color: '#10B981' }}>⭐</span>}
                      {isWorst && <span style={{ color: '#EF4444' }}>⚠️</span>}
                      {scenario.name}
                    </div>
                    {isSelected && (
                      <div 
                        style={{
                          fontSize: '0.75rem',
                          color: '#6B7280',
                          marginTop: '0.25rem'
                        }}
                      >
                        Actions: {scenario.actions.join(', ')}
                      </div>
                    )}
                  </td>
                  
                  <td 
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: scenario.financials.roi >= 0 ? '#10B981' : '#EF4444',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrustClick(scenario, 'roi');
                    }}
                    title="Click for trust badge"
                  >
                    {(scenario.financials.roi * 100).toFixed(1)}%
                  </td>
                  
                  <td 
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: scenario.financials.npv >= 0 ? '#10B981' : '#EF4444',
                      fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrustClick(scenario, 'npv');
                    }}
                    title="Click for trust badge"
                  >
                    ${Math.abs(scenario.financials.npv).toLocaleString()}
                  </td>
                  
                  <td 
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: '#374151',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}
                  >
                    {scenario.financials.paybackPeriod} days
                  </td>
                  
                  <td 
                    style={{
                      padding: '1rem',
                      textAlign: 'right'
                    }}
                  >
                    <span 
                      style={{
                        backgroundColor: getRiskColor(scenario.riskLevel) + '20',
                        color: getRiskColor(scenario.riskLevel),
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.75rem'
                      }}
                    >
                      {scenario.riskLevel.toUpperCase()}
                    </span>
                  </td>
                  
                  <td 
                    style={{
                      padding: '1rem',
                      textAlign: 'right'
                    }}
                  >
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '0.5rem'
                      }}
                    >
                      <div 
                        style={{
                          width: '40px',
                          height: '6px',
                          backgroundColor: '#E5E7EB',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}
                      >
                        <div 
                          style={{
                            width: `${scenario.confidence * 100}%`,
                            height: '100%',
                            backgroundColor: getConfidenceColor(scenario.confidence)
                          }}
                        />
                      </div>
                      <span 
                        style={{
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: '#374151'
                        }}
                      >
                        {(scenario.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Insights Panel */}
      <div 
        className="insights-panel"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}
      >
        <h3 
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            marginBottom: '1rem',
            color: '#111827'
          }}
        >
          Key Insights
        </h3>
        
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem'
          }}
        >
          <div 
            style={{
              padding: '1rem',
              backgroundColor: '#ECFDF5',
              borderRadius: '8px',
              border: '1px solid #A7F3D0'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#065F46', fontWeight: 600, marginBottom: '0.5rem' }}>
              BEST ROI
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#065F46' }}>
              {bestScenario.name}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#047857', marginTop: '0.25rem' }}>
              {(bestScenario.financials.roi * 100).toFixed(1)}% ROI
            </div>
          </div>

          <div 
            style={{
              padding: '1rem',
              backgroundColor: '#FEF2F2',
              borderRadius: '8px',
              border: '1px solid #FECACA'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#991B1B', fontWeight: 600, marginBottom: '0.5rem' }}>
              HIGHEST RISK
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#991B1B' }}>
              {worstScenario.name}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#DC2626', marginTop: '0.25rem' }}>
              {worstScenario.riskLevel.toUpperCase()} Risk
            </div>
          </div>

          <div 
            style={{
              padding: '1rem',
              backgroundColor: '#EFF6FF',
              borderRadius: '8px',
              border: '1px solid '#BFDBFE'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 600, marginBottom: '0.5rem' }}>
              SCENARIO COUNT
            </div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1E40AF' }}>
              {scenarios.length}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#3B82F6', marginTop: '0.25rem' }}>
              Total variations analyzed
            </div>
          </div>
        </div>

        {selectedScenario && (
          <div 
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E5E7EB'
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              SELECTED: {scenarios.find(s => s.id === selectedScenario)?.name}
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: '1.5' }}>
              {scenarios.find(s => s.id === selectedScenario)?.actions.join(' → ')}
            </div>
          </div>
        )}
      </div>

      {/* Trust Overlay */}
      <TrustOverlay />
    </div>
  );
};

// Helper component for trust overlay
const TrustOverlay: React.FC = () => {
  const { showTrustOverlay, selectedTrustBadge, setShowTrustOverlay, setSelectedTrustBadge } = useTemplateStore();
  
  if (!showTrustOverlay || !selectedTrustBadge) return null;

  return (
    <div 
      className="trust-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={() => {
        setShowTrustOverlay(false);
        setSelectedTrustBadge(null);
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <TrustBadgeTooltip 
          confidence={selectedTrustBadge.confidence}
          formula={selectedTrustBadge.formula}
          hash={selectedTrustBadge.hash}
          sources={selectedTrustBadge.sources}
          reasoning={selectedTrustBadge.reasoning}
          value={selectedTrustBadge.value}
          onClose={() => {
            setShowTrustOverlay(false);
            setSelectedTrustBadge(null);
          }}
        />
      </div>
    </div>
  );
};

export default ScenarioMatrix;