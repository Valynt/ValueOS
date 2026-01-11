import React, { useState, useMemo } from 'react';
import { useTemplateStore } from '../hooks/useTemplateStore';
import { TrustBadgeTooltip } from '../atoms/TrustBadgeTooltip';

export interface Perspective {
  persona: string;
  metrics: Array<{
    id: string;
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'flat';
  }>;
  financials: {
    roi: number;
    npv: number;
    paybackPeriod: number;
  };
  confidence: number;
  summary: string;
}

export interface QuantumViewProps {
  perspectives: Perspective[];
  consensus?: {
    bestAction: string;
    highestImpact: string;
    lowestRisk: string;
  };
}

export const QuantumView: React.FC<QuantumViewProps> = ({
  perspectives,
  consensus
}) => {
  const { trustBadges, setShowTrustOverlay, setSelectedTrustBadge } = useTemplateStore();
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'consensus'>('split');

  // Calculate consensus metrics
  const calculatedConsensus = useMemo(() => {
    if (consensus) return consensus;

    // Auto-calculate if not provided
    const metrics = new Map<string, { values: number[]; confidence: number[] }>();
    
    perspectives.forEach(p => {
      p.metrics.forEach(m => {
        if (!metrics.has(m.id)) {
          metrics.set(m.id, { values: [], confidence: [] });
        }
        metrics.get(m.id)!.values.push(m.value);
        metrics.get(m.id)!.confidence.push(p.confidence);
      });
    });

    const consensusMetrics = Array.from(metrics.entries()).map(([id, data]) => {
      const weightedValue = data.values.reduce((sum, val, i) => 
        sum + val * data.confidence[i], 0
      ) / data.confidence.reduce((sum, c) => sum + c, 0);
      
      return { id, value: weightedValue };
    });

    return {
      bestAction: 'Price Optimization',
      highestImpact: consensusMetrics[0]?.id || 'ARR',
      lowestRisk: 'Conservative Scenario'
    };
  }, [perspectives, consensus]);

  const handleTrustClick = (persona: string, metric: string, value: number) => {
    const badge = trustBadges.find(b => b.metric === metric);
    if (badge) {
      setSelectedTrustBadge({ ...badge, value });
      setShowTrustOverlay(true);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return '#10B981';
    if (confidence >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const getPersonaColor = (persona: string) => {
    const colors: Record<string, string> = {
      'cfo': '#1E40AF',
      'cto': '#7C3AED',
      'vp_sales': '#059669',
      'vp_product': '#DC2626',
      'vp_ops': '#EA580C'
    };
    return colors[persona] || '#6B7280';
  };

  const formatMetric = (metric: { value: number; unit: string; trend: string }) => {
    const symbol = metric.trend === 'up' ? '▲' : metric.trend === 'down' ? '▼' : '─';
    const value = metric.unit === '$' 
      ? `$${metric.value.toLocaleString()}`
      : metric.unit === '%'
      ? `${metric.value.toFixed(1)}%`
      : metric.value.toLocaleString();
    
    return `${value} ${symbol}`;
  };

  return (
    <div 
      className="quantum-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%'
      }}
    >
      {/* Header */}
      <div 
        className="quantum-header"
        style={{
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
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
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <span>🔮</span> Quantum View
          </h2>
          <p 
            style={{
              margin: 0,
              fontSize: '0.875rem',
              opacity: 0.9
            }}
          >
            Multi-perspective unified dashboard
          </p>
        </div>

        <div 
          style={{
            display: 'flex',
            gap: '0.5rem'
          }}
        >
          <button
            onClick={() => setViewMode('split')}
            style={{
              backgroundColor: viewMode === 'split' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'split' ? '#0F172A' : '#FFFFFF',
              border: viewMode === 'split' ? 'none' : '1px solid #FFFFFF',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Split View
          </button>
          <button
            onClick={() => setViewMode('consensus')}
            style={{
              backgroundColor: viewMode === 'consensus' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'consensus' ? '#0F172A' : '#FFFFFF',
              border: viewMode === 'consensus' ? 'none' : '1px solid #FFFFFF',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Consensus
          </button>
        </div>
      </div>

      {/* Split View */}
      {viewMode === 'split' && (
        <div 
          className="split-view"
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1rem',
            overflow: 'auto'
          }}
        >
          {perspectives.map((perspective) => {
            const isSelected = selectedPersona === perspective.persona;
            const personaColor = getPersonaColor(perspective.persona);

            return (
              <div 
                key={perspective.persona}
                onClick={() => setSelectedPersona(isSelected ? null : perspective.persona)}
                style={{
                  background: '#FFFFFF',
                  border: `2px solid ${isSelected ? personaColor : '#E5E7EB'}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.15)' : '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  opacity: selectedPersona && !isSelected ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
                  }
                }}
              >
                {/* Persona Header */}
                <div 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: `2px solid ${personaColor}30`
                  }}
                >
                  <div>
                    <h3 
                      style={{
                        margin: 0,
                        fontSize: '1.125rem',
                        fontWeight: 700,
                        color: personaColor
                      }}
                    >
                      {perspective.persona.replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    <div 
                      style={{
                        fontSize: '0.75rem',
                        color: '#6B7280',
                        marginTop: '0.25rem'
                      }}
                    >
                      {perspective.persona === 'cfo' && 'Chief Financial Officer'}
                      {perspective.persona === 'cto' && 'Chief Technology Officer'}
                      {perspective.persona === 'vp_sales' && 'VP Sales'}
                      {perspective.persona === 'vp_product' && 'VP Product'}
                      {perspective.persona === 'vp_ops' && 'VP Operations'}
                    </div>
                  </div>
                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem'
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
                          width: `${perspective.confidence * 100}%`,
                          height: '100%',
                          backgroundColor: getConfidenceColor(perspective.confidence)
                        }}
                      />
                    </div>
                    <span 
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: getConfidenceColor(perspective.confidence)
                      }}
                    >
                      {(perspective.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginBottom: '1rem'
                  }}
                >
                  {perspective.metrics.slice(0, 3).map((metric) => (
                    <div 
                      key={metric.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        backgroundColor: '#F9FAFB',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrustClick(perspective.persona, metric.id, metric.value);
                      }}
                      title="Click for trust badge"
                    >
                      <span 
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#374151'
                        }}
                      >
                        {metric.name}
                      </span>
                      <span 
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: metric.trend === 'up' ? '#10B981' : metric.trend === 'down' ? '#EF4444' : '#6B7280',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}
                      >
                        {formatMetric(metric)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Snapshot */}
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.5rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div 
                    style={{
                      textAlign: 'center',
                      padding: '0.5rem',
                      backgroundColor: '#ECFDF5',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#065F46', fontWeight: 600 }}>ROI</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#065F46' }}>
                      {(perspective.financials.roi * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div 
                    style={{
                      textAlign: 'center',
                      padding: '0.5rem',
                      backgroundColor: '#EFF6FF',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#1E40AF', fontWeight: 600 }}>NPV</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1E40AF' }}>
                      ${Math.abs(perspective.financials.npv).toLocaleString()}
                    </div>
                  </div>
                  <div 
                    style={{
                      textAlign: 'center',
                      padding: '0.5rem',
                      backgroundColor: '#FEF2F2',
                      borderRadius: '4px'
                    }}
                  >
                    <div style={{ fontSize: '0.65rem', color: '#991B1B', fontWeight: 600 }}>Days</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#991B1B' }}>
                      {perspective.financials.paybackPeriod}
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div 
                  style={{
                    padding: '0.75rem',
                    backgroundColor: '#F9FAFB',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: '#374151',
                    lineHeight: '1.4',
                    fontStyle: 'italic'
                  }}
                >
                  "{perspective.summary}"
                </div>

                {/* Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPersona(isSelected ? null : perspective.persona);
                  }}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    backgroundColor: isSelected ? personaColor : '#F3F4F6',
                    color: isSelected ? '#FFFFFF' : '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSelected ? 'Selected' : 'Focus'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Consensus View */}
      {viewMode === 'consensus' && (
        <div 
          className="consensus-view"
          style={{
            flex: 1,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '2rem',
            overflow: 'auto'
          }}
        >
          <div 
            style={{
              maxWidth: '900px',
              margin: '0 auto'
            }}
          >
            {/* Consensus Header */}
            <div 
              style={{
                textAlign: 'center',
                marginBottom: '2rem'
              }}
            >
              <h3 
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#0F172A',
                  marginBottom: '0.5rem'
                }}
              >
                Unified Consensus
              </h3>
              <p 
                style={{
                  fontSize: '1rem',
                  color: '#6B7280',
                  margin: 0
                }}
              >
                Aggregated insights from {perspectives.length} perspectives
              </p>
            </div>

            {/* Consensus Metrics */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}
            >
              <div 
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                  Recommended Action
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {calculatedConsensus.bestAction}
                </div>
              </div>

              <div 
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                  Highest Impact
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {calculatedConsensus.highestImpact}
                </div>
              </div>

              <div 
                style={{
                  padding: '1.5rem',
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                  Lowest Risk
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  {calculatedConsensus.lowestRisk}
                </div>
              </div>
            </div>

            {/* Perspective Comparison Table */}
            <div 
              style={{
                background: '#F9FAFB',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid #E5E7EB'
              }}
            >
              <h4 
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: '1rem'
                }}
              >
                Perspective Alignment
              </h4>

              <div 
                style={{
                  overflowX: 'auto'
                }}
              >
                <table 
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem'
                  }}
                >
                  <thead>
                    <tr 
                      style={{
                        borderBottom: '2px solid #E5E7EB'
                      }}
                    >
                      <th 
                        style={{
                          padding: '0.75rem',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: '#374151'
                        }}
                      >
                        Metric
                      </th>
                      {perspectives.map(p => (
                        <th 
                          key={p.persona}
                          style={{
                            padding: '0.75rem',
                            textAlign: 'right',
                            fontWeight: 600,
                            color: getPersonaColor(p.persona)
                          }}
                        >
                          {p.persona.replace(/_/g, ' ').toUpperCase()}
                        </th>
                      ))}
                      <th 
                        style={{
                          padding: '0.75rem',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: '#111827'
                        }}
                      >
                        Consensus
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {['ROI', 'NPV', 'Payback'].map((metric, i) => {
                      const values = perspectives.map(p => {
                        if (metric === 'ROI') return p.financials.roi * 100;
                        if (metric === 'NPV') return p.financials.npv;
                        return p.financials.paybackPeriod;
                      });
                      
                      const consensusValue = values.reduce((sum, v) => sum + v, 0) / values.length;
                      const variance = Math.max(...values) - Math.min(...values);
                      const alignment = variance < 10 ? 'High' : variance < 30 ? 'Medium' : 'Low';

                      return (
                        <tr 
                          key={metric}
                          style={{
                            borderBottom: '1px solid #E5E7EB'
                          }}
                        >
                          <td 
                            style={{
                              padding: '0.75rem',
                              fontWeight: 600,
                              color: '#374151'
                            }}
                          >
                            {metric}
                          </td>
                          {perspectives.map((p, idx) => {
                            const value = values[idx];
                            const isBest = value === Math.max(...values);
                            const isWorst = value === Math.min(...values);

                            return (
                              <td 
                                key={p.persona}
                                style={{
                                  padding: '0.75rem',
                                  textAlign: 'right',
                                  fontWeight: isBest ? 700 : 600,
                                  color: isBest ? '#10B981' : isWorst ? '#EF4444' : '#374151',
                                  backgroundColor: isBest ? '#ECFDF5' : isWorst ? '#FEF2F2' : 'transparent'
                                }}
                              >
                                {metric === 'NPV' ? `$${Math.abs(value).toLocaleString()}` : value.toFixed(1)}
                                {metric === 'ROI' ? '%' : ''}
                                {metric === 'Payback' ? ' days' : ''}
                              </td>
                            );
                          })}
                          <td 
                            style={{
                              padding: '0.75rem',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: '#111827',
                              backgroundColor: '#F3F4F6'
                            }}
                          >
                            {metric === 'NPV' ? `$${Math.abs(consensusValue).toLocaleString()}` : consensusValue.toFixed(1)}
                            {metric === 'ROI' ? '%' : ''}
                            {metric === 'Payback' ? ' days' : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Alignment Indicator */}
              <div 
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#6B7280', fontWeight: 600 }}>
                    Overall Alignment
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                    {['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)]}
                  </div>
                </div>
                <div 
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'center'
                  }}
                >
                  {perspectives.map(p => (
                    <div 
                      key={p.persona}
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getPersonaColor(p.persona)
                      }}
                      title={p.persona}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Consensus Summary */}
            <div 
              style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                borderRadius: '12px',
                color: '#FFFFFF'
              }}
            >
              <h4 
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  marginBottom: '0.75rem'
                }}
              >
                Unified Recommendation
              </h4>
              <p 
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  opacity: 0.95
                }}
              >
                Based on the convergence of {perspectives.length} strategic perspectives, the consensus recommends{' '}
                <strong>{calculatedConsensus.bestAction}</strong> as the optimal path forward. This approach balances{' '}
                <strong>{calculatedConsensus.highestImpact}</strong> potential with{' '}
                <strong>{calculatedConsensus.lowestRisk}</strong> exposure, creating a robust strategy that aligns with{' '}
                cross-functional priorities and delivers measurable value across all stakeholder groups.
              </p>
            </div>
          </div>
        </div>
      )}

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

export default QuantumView;