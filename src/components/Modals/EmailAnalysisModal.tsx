/**
 * Email Analysis Modal
 * 
 * Allows users to paste email threads for AI-powered analysis.
 * Extracts sentiment, stakeholders, key asks, and suggests next steps.
 */

import React, { useState, useCallback } from 'react';
import {
  X,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  emailAnalysisService,
  EmailAnalysis,
} from '../../services/EmailAnalysisService';

// ============================================================================
// Types
// ============================================================================

interface EmailAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (analysis: EmailAnalysis, rawText: string) => void;
}

type AnalysisState = 'idle' | 'analyzing' | 'success' | 'error';

// ============================================================================
// Component
// ============================================================================

export const EmailAnalysisModal: React.FC<EmailAnalysisModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [emailText, setEmailText] = useState('');
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!emailText.trim()) {
      setError('Please paste an email thread');
      return;
    }

    if (emailText.trim().length < 50) {
      setError('Email thread seems too short. Please paste the full conversation.');
      return;
    }

    setError(null);
    setAnalysisState('analyzing');

    try {
      const result = await emailAnalysisService.analyzeThread(emailText);
      setAnalysis(result);
      setAnalysisState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setAnalysisState('error');
    }
  };

  const handleUseAnalysis = () => {
    if (analysis) {
      onComplete(analysis, emailText);
    }
  };

  const resetState = useCallback(() => {
    setEmailText('');
    setAnalysisState('idle');
    setAnalysis(null);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl m-4 border border-gray-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Analyze Email Thread</h2>
              <p className="text-sm text-gray-400">Paste an email conversation for AI analysis</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {analysisState === 'idle' || analysisState === 'error' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Thread
                </label>
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste your email thread here...

Include the full conversation with headers like:
From: sender@company.com
To: recipient@company.com
Date: Nov 28, 2024
Subject: Re: Follow up on our call

Email body text..."
                  className="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none font-mono text-sm"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-gray-500 text-xs">
                    {emailText.length} characters
                  </p>
                  <p className="text-gray-500 text-xs">
                    Tip: Include email headers for better analysis
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          ) : analysisState === 'analyzing' ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
              <p className="text-white font-medium">Analyzing email thread...</p>
              <p className="text-gray-400 text-sm mt-1">
                Extracting sentiment, stakeholders, and key insights
              </p>
            </div>
          ) : analysis ? (
            <AnalysisResults analysis={analysis} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-800 flex-shrink-0">
          {analysisState === 'success' ? (
            <>
              <button
                onClick={() => {
                  setAnalysisState('idle');
                  setAnalysis(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                ← Analyze Another
              </button>
              <button
                onClick={handleUseAnalysis}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                Use This Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                AI will identify sentiment, stakeholders, and next steps
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analysisState === 'analyzing' || !emailText.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {analysisState === 'analyzing' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Thread'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Analysis Results Component
// ============================================================================

const AnalysisResults: React.FC<{ analysis: EmailAnalysis }> = ({ analysis }) => {
  const getSentimentColor = () => {
    switch (analysis.sentiment) {
      case 'positive':
        return 'text-green-400 bg-green-400/10';
      case 'negative':
        return 'text-red-400 bg-red-400/10';
      case 'ghosting_risk':
        return 'text-orange-400 bg-orange-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSentimentIcon = () => {
    switch (analysis.sentiment) {
      case 'positive':
        return <TrendingUp className="w-5 h-5" />;
      case 'negative':
        return <TrendingDown className="w-5 h-5" />;
      case 'ghosting_risk':
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getSentimentLabel = () => {
    switch (analysis.sentiment) {
      case 'positive':
        return 'Positive Engagement';
      case 'negative':
        return 'Negative Signals';
      case 'ghosting_risk':
        return 'Ghosting Risk';
      default:
        return 'Neutral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white font-medium mb-2">Thread Summary</h3>
        <p className="text-gray-300">{analysis.threadSummary}</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Sentiment */}
        <div className={`rounded-xl p-4 ${getSentimentColor()}`}>
          <div className="flex items-center gap-2 mb-1">
            {getSentimentIcon()}
            <span className="font-medium">{getSentimentLabel()}</span>
          </div>
          <p className="text-sm opacity-80">{analysis.sentimentExplanation}</p>
        </div>

        {/* Urgency */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-white font-medium">
              Urgency: {analysis.urgencyScore}/10
            </span>
          </div>
          <p className="text-gray-400 text-sm">{analysis.urgencyReason}</p>
        </div>

        {/* Days Since Contact */}
        {analysis.daysSinceLastContact !== undefined && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="text-white font-medium">
                {analysis.daysSinceLastContact} days ago
              </span>
            </div>
            <p className="text-gray-400 text-sm">Last contact</p>
          </div>
        )}
      </div>

      {/* Participants */}
      {analysis.participants.length > 0 && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-gray-400" />
            <h3 className="text-white font-medium">Participants</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.participants.map((p, i) => (
              <div
                key={i}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  p.sentiment === 'positive'
                    ? 'bg-green-500/20 text-green-400'
                    : p.sentiment === 'negative'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {p.name}
                {p.role && <span className="opacity-60"> ({p.role})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Key Asks */}
        {analysis.keyAsks.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h3 className="text-white font-medium mb-3">Key Asks</h3>
            <ul className="space-y-2">
              {analysis.keyAsks.map((ask, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-purple-400 mt-0.5">•</span>
                  {ask}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Objections */}
        {analysis.objections.length > 0 && (
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <h3 className="text-white font-medium mb-3">Objections/Concerns</h3>
            <ul className="space-y-2">
              {analysis.objections.map((obj, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                  <span className="text-orange-400 mt-0.5">•</span>
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deal Signals */}
      {(analysis.dealSignals.positive.length > 0 || analysis.dealSignals.negative.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {analysis.dealSignals.positive.length > 0 && (
            <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
              <h3 className="text-green-400 font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Positive Signals
              </h3>
              <ul className="space-y-2">
                {analysis.dealSignals.positive.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2 text-green-300 text-sm">
                    <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.dealSignals.negative.length > 0 && (
            <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
              <h3 className="text-red-400 font-medium mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Warning Signs
              </h3>
              <ul className="space-y-2">
                {analysis.dealSignals.negative.map((signal, i) => (
                  <li key={i} className="flex items-start gap-2 text-red-300 text-sm">
                    <AlertCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Suggested Next Step */}
      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
        <h3 className="text-purple-400 font-medium mb-2 flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          Suggested Next Step
        </h3>
        <p className="text-white">{analysis.suggestedNextStep}</p>
      </div>
    </div>
  );
};

export default EmailAnalysisModal;
