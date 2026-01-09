import React, { useMemo, useState } from 'react';
import { useTemplateStore } from '../hooks/useTemplateStore';
import { TrustBadgeTooltip } from '../atoms/TrustBadgeTooltip';

export interface TimelineEvent {
  id: string;
  day: number;
  action: string;
  impact: number;
  description: string;
  confidence: number;
}

export interface StoryArcProps {
  timeline: TimelineEvent[];
  title?: string;
  subtitle?: string;
  onExport?: (format: 'pdf' | 'pptx') => void;
}

export const StoryArcCanvas: React.FC<StoryArcProps> = ({
  timeline,
  title = 'Strategic Value Journey',
  subtitle = 'From current state to projected outcomes',
  onExport
}) => {
  const { trustBadges, setShowTrustOverlay, setSelectedTrustBadge } = useTemplateStore();
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'narrative' | 'comparison'>('timeline');

  // Sort timeline by day
  const sortedEvents = useMemo(() => {
    return [...timeline].sort((a, b) => a.day - b.day);
  }, [timeline]);

  // Calculate cumulative impact
  const cumulativeImpact = useMemo(() => {
    return sortedEvents.reduce((acc, event) => acc + event.impact, 0);
  }, [sortedEvents]);

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
    
    // Find trust badge for this event
    const badge = trustBadges.find(b => 
      b.metric.toLowerCase().includes(event.action.toLowerCase())
    );
    
    if (badge) {
      setSelectedTrustBadge({ ...badge, value: event.impact });
      setShowTrustOverlay(true);
    }
  };

  const handleExport = (format: 'pdf' | 'pptx') => {
    if (onExport) {
      onExport(format);
    } else {
      console.log(`Exporting Story Arc as ${format.toUpperCase()}`);
      alert(`Export functionality would generate ${format.toUpperCase()} file`);
    }
  };

  const getEventColor = (impact: number) => {
    if (impact > 50) return '#10B981'; // High positive
    if (impact > 20) return '#3B82F6'; // Medium positive
    if (impact > 0) return '#60A5FA'; // Low positive
    if (impact > -20) return '#F59E0B'; // Low negative
    return '#EF4444'; // High negative
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return { color: '#10B981', label: 'High' };
    if (confidence >= 0.7) return { color: '#F59E0B', label: 'Medium' };
    return { color: '#EF4444', label: 'Low' };
  };

  return (
    <div 
      className="story-arc-canvas"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        height: '100%'
      }}
    >
      {/* Header */}
      <div 
        className="canvas-header"
        style={{
          background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
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
            {title}
          </h2>
          <p 
            style={{
              margin: 0,
              fontSize: '0.875rem',
              opacity: 0.9
            }}
          >
            {subtitle}
          </p>
        </div>

        <div 
          style={{
            display: 'flex',
            gap: '0.5rem'
          }}
        >
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              backgroundColor: viewMode === 'timeline' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'timeline' ? '#7C3AED' : '#FFFFFF',
              border: viewMode === 'timeline' ? 'none' : '1px solid #FFFFFF',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('narrative')}
            style={{
              backgroundColor: viewMode === 'narrative' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'narrative' ? '#7C3AED' : '#FFFFFF',
              border: viewMode === 'narrative' ? 'none' : '1px solid #FFFFFF',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Narrative
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            style={{
              backgroundColor: viewMode === 'comparison' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'comparison' ? '#7C3AED' : '#FFFFFF',
              border: viewMode === 'comparison' ? 'none' : '1px solid #FFFFFF',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Comparison
          </button>
          <button
            onClick={() => handleExport('pdf')}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#7C3AED',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            📄 Export
          </button>
        </div>
      </div>

      {/* View Mode: Timeline */}
      {viewMode === 'timeline' && (
        <div 
          className="timeline-view"
          style={{
            flex: 1,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '2rem',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          {/* Timeline Line */}
          <div 
            style={{
              position: 'absolute',
              left: '3rem',
              top: '2rem',
              bottom: '2rem',
              width: '3px',
              background: 'linear-gradient(to bottom, #E5E7EB, #A855F7, #E5E7EB)',
              borderRadius: '2px'
            }}
          />

          {/* Events */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2rem',
              marginLeft: '4rem'
            }}
          >
            {sortedEvents.map((event, index) => {
              const color = getEventColor(event.impact);
              const confidence = getConfidenceBadge(event.confidence);
              const isEven = index % 2 === 0;

              return (
                <div 
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(5px)';
                    e.currentTarget.style.backgroundColor = '#F9FAFB';
                    e.currentTarget.style.padding = '1rem';
                    e.currentTarget.style.borderRadius = '8px';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.padding = '0';
                  }}
                >
                  {/* Day Marker */}
                  <div 
                    style={{
                      width: '3rem',
                      height: '3rem',
                      borderRadius: '50%',
                      backgroundColor: color,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      flexShrink: 0
                    }}
                  >
                    D{event.day}
                  </div>

                  {/* Event Card */}
                  <div 
                    style={{
                      flex: 1,
                      background: '#FFFFFF',
                      border: `2px solid ${color}`,
                      borderRadius: '12px',
                      padding: '1.25rem',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                      position: 'relative'
                    }}
                  >
                    {/* Impact Badge */}
                    <div 
                      style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '10px',
                        backgroundColor: color,
                        color: '#FFFFFF',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      {event.impact > 0 ? '+' : ''}{event.impact}
                    </div>

                    <div 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h4 
                          style={{
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: 700,
                            color: '#111827',
                            marginBottom: '0.5rem'
                          }}
                        >
                          {event.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h4>
                        <p 
                          style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: '#374151',
                            lineHeight: '1.5'
                          }}
                        >
                          {event.description}
                        </p>
                      </div>

                      {/* Confidence Indicator */}
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
                            width: '8px',
                            height: '40px',
                            backgroundColor: '#E5E7EB',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}
                        >
                          <div 
                            style={{
                              width: '100%',
                              height: `${event.confidence * 100}%`,
                              backgroundColor: confidence.color
                            }}
                          />
                        </div>
                        <span 
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            color: confidence.color
                          }}
                        >
                          {confidence.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Card */}
          <div 
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
              borderRadius: '12px',
              border: '2px dashed #9CA3AF'
            }}
          >
            <h4 
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '0.5rem'
              }}
            >
              Journey Summary
            </h4>
            <p 
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#374151',
                lineHeight: '1.6'
              }}
            >
              Over <strong>{sortedEvents.length} days</strong>, the strategic initiatives are projected to generate a{' '}
              <strong style={{ color: cumulativeImpact > 0 ? '#10B981' : '#EF4444' }}>
                {cumulativeImpact > 0 ? '+' : ''}{cumulativeImpact} total impact
              </strong>
              . The journey begins with foundational changes and builds momentum toward significant value realization.
            </p>
          </div>
        </div>
      )}

      {/* View Mode: Narrative */}
      {viewMode === 'narrative' && (
        <div 
          className="narrative-view"
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
              maxWidth: '800px',
              margin: '0 auto'
            }}
          >
            <h3 
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '1.5rem',
                textAlign: 'center'
              }}
            >
              The Strategic Journey
            </h3>

            <div 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem'
              }}
            >
              {sortedEvents.map((event, index) => {
                const color = getEventColor(event.impact);
                const confidence = getConfidenceBadge(event.confidence);

                return (
                  <div 
                    key={event.id}
                    style={{
                      padding: '1.5rem',
                      borderLeft: `4px solid ${color}`,
                      backgroundColor: '#F9FAFB',
                      borderRadius: '8px',
                      position: 'relative'
                    }}
                  >
                    <div 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <div>
                        <div 
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: color,
                            marginBottom: '0.25rem'
                          }}
                        >
                          DAY {event.day}
                        </div>
                        <h4 
                          style={{
                            margin: 0,
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            color: '#111827'
                          }}
                        >
                          {event.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </h4>
                      </div>
                      <div 
                        style={{
                          backgroundColor: confidence.color,
                          color: '#FFFFFF',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        {confidence.label} Confidence
                      </div>
                    </div>

                    <p 
                      style={{
                        margin: 0,
                        fontSize: '0.9375rem',
                        color: '#374151',
                        lineHeight: '1.6',
                        marginBottom: '0.75rem'
                      }}
                    >
                      {event.description}
                    </p>

                    <div 
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      <span style={{ color: color }}>
                        Impact: {event.impact > 0 ? '+' : ''}{event.impact}
                      </span>
                      <span style={{ color: '#6B7280' }}>
                        Confidence: {(event.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Narrative Summary */}
            <div 
              style={{
                marginTop: '2rem',
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
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
                The Complete Story
              </h4>
              <p 
                style={{
                  margin: 0,
                  fontSize: '0.9375rem',
                  lineHeight: '1.6',
                  opacity: 0.95
                }}
              >
                This strategic journey begins with foundational operational improvements and builds toward significant 
                value creation. Each step is carefully planned and validated, with high confidence in the outcomes. 
                The cumulative impact of {cumulativeImpact > 0 ? '+' : ''}{cumulativeImpact} demonstrates a clear 
                path to sustainable growth and competitive advantage.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode: Comparison */}
      {viewMode === 'comparison' && (
        <div 
          className="comparison-view"
          style={{
            flex: 1,
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '2rem',
            overflow: 'auto'
          }}
        >
          <h3 
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#111827',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}
          >
            Before vs. After Comparison
          </h3>

          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2rem'
            }}
          >
            {/* Before State */}
            <div 
              style={{
                padding: '1.5rem',
                backgroundColor: '#FEF2F2',
                border: '2px solid #FECACA',
                borderRadius: '12px'
              }}
            >
              <h4 
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#991B1B',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}
              >
                Current State
              </h4>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {sortedEvents.slice(0, 2).map(event => (
                  <div 
                    key={event.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      borderLeft: '3px solid #EF4444'
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#991B1B' }}>
                      {event.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                      {event.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* After State */}
            <div 
              style={{
                padding: '1.5rem',
                backgroundColor: '#ECFDF5',
                border: '2px solid #A7F3D0',
                borderRadius: '12px'
              }}
            >
              <h4 
                style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#065F46',
                  marginBottom: '1rem',
                  textAlign: 'center'
                }}
              >
                Projected State
              </h4>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                {sortedEvents.slice(-2).map(event => (
                  <div 
                    key={event.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '6px',
                      borderLeft: '3px solid #10B981'
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#065F46' }}>
                      {event.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                      {event.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Impact Summary */}
          <div 
            style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%)',
              borderRadius: '12px',
              textAlign: 'center'
            }}
          >
            <div 
              style={{
                fontSize: '3rem',
                fontWeight: 800,
                color: cumulativeImpact > 0 ? '#10B981' : '#EF4444',
                marginBottom: '0.5rem'
              }}
            >
              {cumulativeImpact > 0 ? '+' : ''}{cumulativeImpact}
            </div>
            <div 
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#374151'
              }}
            >
              Total Projected Impact
            </div>
            <div 
              style={{
                fontSize: '0.875rem',
                color: '#6B7280',
                marginTop: '0.5rem'
              }}
            >
              Across {sortedEvents.length} strategic initiatives
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

export default StoryArcCanvas;