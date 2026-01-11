import React, { useState, useMemo } from 'react';
import { useTemplateStore } from '../hooks/useTemplateStore';
import { TrustBadgeTooltip } from '../atoms/TrustBadgeTooltip';

export interface CausalChain {
  driver: string;
  effect: string;
  impact: number;
  probability: number;
  confidence: number;
  timeToEffect: number;
  evidence: string[];
}

export interface CascadeNode {
  id: string;
  label: string;
  type: 'action' | 'kpi' | 'outcome';
  value: number;
  confidence: number;
  children: string[];
}

export interface ImpactCascadeProps {
  causalChains: CausalChain[];
  maxDepth?: number;
}

export const ImpactCascadeTemplate: React.FC<ImpactCascadeProps> = ({
  causalChains,
  maxDepth = 3
}) => {
  const { templateData, trustBadges, setShowTrustOverlay, setSelectedTrustBadge } = useTemplateStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<CascadeNode | null>(null);

  // Build nodes and links from causal chains
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, CascadeNode>();
    const links: Array<{ source: string; target: string; value: number; confidence: number }> = [];

    causalChains.forEach(chain => {
      // Create or update driver node
      if (!nodeMap.has(chain.driver)) {
        nodeMap.set(chain.driver, {
          id: chain.driver,
          label: formatActionName(chain.driver),
          type: 'action',
          value: 0,
          confidence: chain.confidence,
          children: []
        });
      }

      // Create or update effect node
      if (!nodeMap.has(chain.effect)) {
        nodeMap.set(chain.effect, {
          id: chain.effect,
          label: formatKPIName(chain.effect),
          type: 'kpi',
          value: 0,
          confidence: chain.confidence,
          children: []
        });
      }

      // Update values
      const driver = nodeMap.get(chain.driver)!;
      const effect = nodeMap.get(chain.effect)!;
      
      driver.value += Math.abs(chain.impact);
      effect.value += Math.abs(chain.impact);
      
      driver.children.push(chain.effect);

      // Create link
      links.push({
        source: chain.driver,
        target: chain.effect,
        value: Math.abs(chain.impact),
        confidence: chain.confidence
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links
    };
  }, [causalChains]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleNodeClick = (node: CascadeNode) => {
    setSelectedNode(node);
    
    // Find trust badge for this node
    const badge = trustBadges.find(b => 
      b.metric.toLowerCase().includes(node.id.toLowerCase())
    );
    
    if (badge) {
      setSelectedTrustBadge(badge);
      setShowTrustOverlay(true);
    }
  };

  const getLinkColor = (confidence: number) => {
    if (confidence >= 0.9) return '#10B981';
    if (confidence >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const getNodeColor = (type: string) => {
    const colors = {
      action: '#3B82F6',
      kpi: '#8B5CF6',
      outcome: '#10B981'
    };
    return colors[type as keyof typeof colors] || '#6B7280';
  };

  return (
    <div 
      className="impact-cascade"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%'
      }}
    >
      {/* Header */}
      <div 
        className="cascade-header"
        style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #8B5CF6 100%)',
          color: '#FFFFFF',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <h2 
          style={{
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: 700,
            marginBottom: '0.25rem'
          }}
        >
          Impact Cascade
        </h2>
        <p 
          style={{
            margin: 0,
            fontSize: '0.875rem',
            opacity: 0.9
          }}
        >
          Visualizing causal chains from actions to outcomes
        </p>
      </div>

      {/* Cascade Visualization */}
      <div 
        className="cascade-visualization"
        style={{
          flex: 1,
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '1.5rem',
          overflow: 'auto',
          position: 'relative'
        }}
      >
        <svg 
          width="100%" 
          height="100%"
          style={{
            minHeight: '400px'
          }}
        >
          {/* Render Links */}
          {links.map((link, i) => {
            const sourceNode = nodes.find(n => n.id === link.source);
            const targetNode = nodes.find(n => n.id === link.target);
            
            if (!sourceNode || !targetNode) return null;

            const sourceIndex = nodes.indexOf(sourceNode);
            const targetIndex = nodes.indexOf(targetNode);

            const x1 = 100 + (sourceIndex % 3) * 250;
            const y1 = 100 + Math.floor(sourceIndex / 3) * 150;
            const x2 = 100 + (targetIndex % 3) * 250;
            const y2 = 100 + Math.floor(targetIndex / 3) * 150;

            return (
              <g key={`link-${i}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={getLinkColor(link.confidence)}
                  strokeWidth={Math.max(2, link.value / 10)}
                  opacity="0.6"
                  style={{
                    transition: 'all 0.3s ease'
                  }}
                />
                {/* Confidence indicator */}
                <circle
                  cx={(x1 + x2) / 2}
                  cy={(y1 + y2) / 2}
                  r="4"
                  fill={getLinkColor(link.confidence)}
                  opacity="0.8"
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {nodes.map((node, i) => {
            const x = 100 + (i % 3) * 250;
            const y = 100 + Math.floor(i / 3) * 150;
            const isExpanded = expandedNodes.has(node.id);
            const hasChildren = node.children.length > 0;

            return (
              <g 
                key={node.id}
                onClick={() => handleNodeClick(node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Node Circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={25}
                  fill={getNodeColor(node.type)}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />

                {/* Node Label */}
                <text
                  x={x}
                  y={y + 40}
                  textAnchor="middle"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    fill: '#374151',
                    pointerEvents: 'none'
                  }}
                >
                  {node.label}
                </text>

                {/* Value Badge */}
                <rect
                  x={x - 20}
                  y={y - 35}
                  width="40"
                  height="16"
                  rx="4"
                  fill="#111827"
                  opacity="0.9"
                />
                <text
                  x={x}
                  y={y - 24}
                  textAnchor="middle"
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    fill: '#FFFFFF',
                    pointerEvents: 'none'
                  }}
                >
                  {Math.round(node.value)}
                </text>

                {/* Expand/Collapse Indicator */}
                {hasChildren && (
                  <circle
                    cx={x + 20}
                    cy={y - 20}
                    r="8"
                    fill={isExpanded ? '#10B981' : '#F59E0B'}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNode(node.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <title>{isExpanded ? 'Collapse' : 'Expand'}</title>
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div 
          style={{
            position: 'absolute',
            bottom: '1rem',
            left: '1rem',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '0.75rem'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Legend</div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
              <span>Action</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
              <span>KPI</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981' }} />
              <span>Outcome</span>
            </div>
          </div>
        </div>
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div 
          className="node-details"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}
          >
            <h3 
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#111827'
              }}
            >
              {selectedNode.label}
            </h3>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#6B7280',
                padding: '0.25rem'
              }}
            >
              ×
            </button>
          </div>

          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Type</div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{selectedNode.type}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Impact Value</div>
              <div style={{ fontWeight: 600, color: '#10B981' }}>{Math.round(selectedNode.value)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Confidence</div>
              <div style={{ fontWeight: 600, color: selectedNode.confidence >= 0.9 ? '#10B981' : selectedNode.confidence >= 0.7 ? '#F59E0B' : '#EF4444' }}>
                {Math.round(selectedNode.confidence * 100)}%
              </div>
            </div>
          </div>

          {selectedNode.children.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600, marginBottom: '0.5rem' }}>
                AFFECTED METRICS
              </div>
              <div 
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}
              >
                {selectedNode.children.map(child => (
                  <span 
                    key={child}
                    style={{
                      backgroundColor: '#EEF2FF',
                      color: '#4338CA',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  >
                    {formatKPIName(child)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust Overlay */}
      <TrustOverlay />
    </div>
  );
};

// Helper components
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

// Utility functions
const formatActionName = (action: string): string => {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Pct', '%');
};

const formatKPIName = (kpi: string): string => {
  const nameMap: Record<string, string> = {
    'saas_arr': 'ARR',
    'saas_mrr': 'MRR',
    'saas_nrr': 'NRR',
    'saas_logo_churn': 'Logo Churn',
    'saas_cac': 'CAC',
    'saas_ltv': 'LTV',
    'saas_arpu': 'ARPU'
  };
  return nameMap[kpi] || kpi.replace(/_/g, ' ').toUpperCase();
};

export default ImpactCascadeTemplate;