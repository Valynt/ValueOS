import React, { useState, useEffect } from 'react';
import { FinancialSummary } from '../molecules/FinancialSummary';
import { CashFlowChart } from '../molecules/CashFlowChart';
import { RiskAnalysis } from '../molecules/RiskAnalysis';
import { TrustBadgeTooltip } from '../atoms/TrustBadgeTooltip';

export interface FinancialMetrics {
  roi: number;
  npv: number;
  paybackPeriod: number;
  roiConfidence?: number;
  npvConfidence?: number;
  paybackConfidence?: number;
  yearlyCashFlow: number[];
  sensitivity: {
    downside: { npv: number; roi: number; description: string };
    baseCase: { npv: number; roi: number; description: string };
    upside: { npv: number; roi: number; description: string };
  };
}

export interface TrustBadgeData {
  metric: string;
  value: any;
  confidence: number;
  formula: string;
  hash: string;
  sources: string[];
  reasoning: string;
}

export interface TrinityDashboardProps {
  financials: FinancialMetrics;
  trustBadges: TrustBadgeData[];
  isLoading?: boolean;
  onExport?: (format: 'pdf' | 'pptx') => void;
}

export const TrinityDashboard: React.FC<TrinityDashboardProps> = ({
  financials,
  trustBadges,
  isLoading = false,
  onExport
}) => {
  const [selectedTrustBadge, setSelectedTrustBadge] = useState<TrustBadgeData | null>(null);
  const [showTrustOverlay, setShowTrustOverlay] = useState(false);

  const handleTrustClick = (metric: string) => {
    const badge = trustBadges.find(b => b.metric === metric);
    if (badge) {
      setSelectedTrustBadge(badge);
      setShowTrustOverlay(true);
    }
  };

  const closeTrustOverlay = () => {
    setShowTrustOverlay(false);
    setSelectedTrustBadge(null);
  };

  const handleExport = (format: 'pdf' | 'pptx') => {
    if (onExport) {
      onExport(format);
    } else {
      // Default export handler
      console.log(`Exporting Trinity Dashboard as ${format.toUpperCase()}`);
      alert(`Export functionality would generate ${format.toUpperCase()} file`);
    }
  };

  if (isLoading) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '600px',
          backgroundColor: '#F9FAFB',
          borderRadius: '12px'
        }}
      >
        <div 
          style={{
            textAlign: 'center',
            color: '#6B7280'
          }}
        >
          <div 
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid #E5E7EB',
              borderTopColor: '#3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }}
          />
          <div>Loading Trinity Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="trinity-dashboard"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div 
        className="dashboard-header"
        style={{
          background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
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
          <h1 
            style={{
              margin: 0,
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.25rem'
            }}
          >
            Trinity Dashboard
          </h1>
          <p 
            style={{
              margin: 0,
              fontSize: '0.875rem',
              opacity: 0.9
            }}
          >
            Financial Analysis & Risk Assessment
          </p>
        </div>
        
        <div 
          style={{
            display: 'flex',
            gap: '0.5rem'
          }}
        >
          <button
            onClick={() => handleExport('pdf')}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#1E40AF',
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
            📄 PDF
          </button>
          <button
            onClick={() => handleExport('pptx')}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#1E40AF',
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
            📊 PPTX
          </button>
        </div>
      </div>

      {/* KPI Summary */}
      <FinancialSummary 
        financials={financials}
        onTrustClick={handleTrustClick}
      />

      {/* Charts & Risk Analysis */}
      <div 
        className="charts-section"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem'
        }}
      >
        <CashFlowChart 
          data={financials.yearlyCashFlow}
          projection={{
            downside: financials.yearlyCashFlow.map((v, i) => ({ year: i + 1, cashFlow: v * 0.7 })),
            baseCase: financials.yearlyCashFlow.map((v, i) => ({ year: i + 1, cashFlow: v })),
            upside: financials.yearlyCashFlow.map((v, i) => ({ year: i + 1, cashFlow: v * 1.3 }))
          }}
        />
        
        <RiskAnalysis 
          downside={financials.sensitivity.downside}
          baseCase={financials.sensitivity.baseCase}
          upside={financials.sensitivity.upside}
          confidence={0.95}
        />
      </div>

      {/* Trust Overlay */}
      {showTrustOverlay && selectedTrustBadge && (
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
          onClick={closeTrustOverlay}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TrustBadgeTooltip 
              confidence={selectedTrustBadge.confidence}
              formula={selectedTrustBadge.formula}
              hash={selectedTrustBadge.hash}
              sources={selectedTrustBadge.sources}
              reasoning={selectedTrustBadge.reasoning}
              value={selectedTrustBadge.value}
              onClose={closeTrustOverlay}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div 
        className="dashboard-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          backgroundColor: '#F9FAFB',
          borderRadius: '8px',
          fontSize: '0.8125rem',
          color: '#6B7280'
        }}
      >
        <span>Powered by Ground Truth Engine</span>
        <span>
          Overall Confidence: {Math.round(
            (financials.roiConfidence || 0.95 + 
             financials.npvConfidence || 0.95 + 
             financials.paybackConfidence || 0.95) / 3 * 100
          )}%
        </span>
      </div>

      {/* Global Styles */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @media (max-width: 1024px) {
          .charts-section {
            grid-template-columns: 1fr;
          }
        }
        
        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .dashboard-header > div:last-child {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

// Default export for easy importing
export default TrinityDashboard;