/**
 * Email Analysis Modal
 *
 * Allows users to paste email threads for AI-powered analysis.
 * Extracts sentiment, stakeholders, key asks, and suggests next steps.
 */

import React, { useCallback, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  Mail,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  EmailAnalysis,
  emailAnalysisService,
} from "../../services/EmailAnalysisService";

// ============================================================================
// Types
// ============================================================================

interface EmailAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (analysis: EmailAnalysis, rawText: string) => void;
}

type AnalysisState = "idle" | "analyzing" | "success" | "error";

// ============================================================================
// Component
// ============================================================================

export const EmailAnalysisModal: React.FC<EmailAnalysisModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  // Handle Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);
  const [emailText, setEmailText] = useState("");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!emailText.trim()) {
      setError("Please paste an email thread");
      return;
    }

    if (emailText.trim().length < 50) {
      setError(
        "Email thread seems too short. Please paste the full conversation."
      );
      return;
    }

    setError(null);
    setAnalysisState("analyzing");

    try {
      const result = await emailAnalysisService.analyzeThread(emailText);
      setAnalysis(result);
      setAnalysisState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setAnalysisState("error");
    }
  };

  const handleUseAnalysis = () => {
    if (analysis) {
      onComplete(analysis, emailText);
    }
  };

  const resetState = useCallback(() => {
    setEmailText("");
    setAnalysisState("idle");
    setAnalysis(null);
    setError(null);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-vc-2 bg-popover/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-analysis-title"
    >
      <div className="bg-popover rounded-lg w-full max-w-4xl m-4 border border-border max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-vc-3 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-vc-2">
            <div className="w-vc-3 h-vc-3 bg-accent rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2
                id="email-analysis-title"
                className="text-3xl font-semibold text-foreground"
              >
                Analyze Email Thread
              </h2>
              <p className="text-sm text-muted-foreground">
                Paste an email conversation for AI analysis
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-vc-1 hover:bg-card rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {analysisState === "idle" || analysisState === "error" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
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
                  className="w-full h-64 px-vc-3 py-vc-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary resize-none font-mono text-sm"
                />
                <div className="flex justify-between mt-2">
                  <p className="text-muted-foreground text-xs">
                    {emailText.length} characters
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Tip: Include email headers for better analysis
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-vc-2 text-destructive text-sm bg-destructive/10 p-vc-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          ) : analysisState === "analyzing" ? (
            <div className="flex flex-col items-center justify-center py-vc-6">
              <Loader2 className="w-vc-8 h-vc-8 text-info animate-spin mb-vc-3" />
              <p className="text-foreground font-medium">
                Analyzing email thread...
              </p>
              <p className="text-muted-foreground text-sm mt-vc-1">
                Extracting sentiment, stakeholders, and key insights
              </p>
            </div>
          ) : analysis ? (
            <AnalysisResults analysis={analysis} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-vc-2 border-t border-border flex-shrink-0">
          {analysisState === "success" ? (
            <>
              <button
                onClick={() => {
                  setAnalysisState("idle");
                  setAnalysis(null);
                }}
                className="px-vc-3 py-vc-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Analyze Another
              </button>
              <button
                onClick={handleUseAnalysis}
                className="px-vc-4 py-vc-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-vc-2"
              >
                Use This Analysis
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                AI will identify sentiment, stakeholders, and next steps
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-vc-3 py-vc-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={analysisState === "analyzing" || !emailText.trim()}
                  className="px-vc-4 py-vc-1 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-vc-2"
                >
                  {analysisState === "analyzing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze Thread"
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

const AnalysisResults: React.FC<{ analysis: EmailAnalysis }> = ({
  analysis,
}) => {
  const getSentimentColor = () => {
    switch (analysis.sentiment) {
      case "positive":
        return "text-success bg-success/10";
      case "negative":
        return "text-destructive bg-destructive/10";
      case "ghosting_risk":
        return "text-warning bg-warning/10";
      default:
        return "text-muted-foreground bg-card/10";
    }
  };

  const getSentimentIcon = () => {
    switch (analysis.sentiment) {
      case "positive":
        return <TrendingUp className="w-5 h-5" />;
      case "negative":
        return <TrendingDown className="w-5 h-5" />;
      case "ghosting_risk":
        return <AlertTriangle className="w-5 h-5" />;
      default:
        return <MessageSquare className="w-5 h-5" />;
    }
  };

  const getSentimentLabel = () => {
    switch (analysis.sentiment) {
      case "positive":
        return "Positive Engagement";
      case "negative":
        return "Negative Signals";
      case "ghosting_risk":
        return "Ghosting Risk";
      default:
        return "Neutral";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
        <h3 className="text-foreground font-medium mb-vc-2">Thread Summary</h3>
        <p className="text-muted-foreground">{analysis.threadSummary}</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-vc-3">
        {/* Sentiment */}
        <div className={`rounded-lg p-vc-3 ${getSentimentColor()}`}>
          <div className="flex items-center gap-vc-2 mb-1">
            {getSentimentIcon()}
            <span className="font-medium">{getSentimentLabel()}</span>
          </div>
          <p className="text-sm opacity-80">{analysis.sentimentExplanation}</p>
        </div>

        {/* Urgency */}
        <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
          <div className="flex items-center gap-vc-2 mb-1">
            <Clock className="w-5 h-5 text-warning" />
            <span className="text-foreground font-medium">
              Urgency: {analysis.urgencyScore}/10
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {analysis.urgencyReason}
          </p>
        </div>

        {/* Days Since Contact */}
        {analysis.daysSinceLastContact !== undefined && (
          <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
            <div className="flex items-center gap-vc-2 mb-1">
              <Mail className="w-5 h-5 text-info" />
              <span className="text-foreground font-medium">
                {analysis.daysSinceLastContact} days ago
              </span>
            </div>
            <p className="text-muted-foreground text-sm">Last contact</p>
          </div>
        )}
      </div>

      {/* Participants */}
      {analysis.participants.length > 0 && (
        <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
          <div className="flex items-center gap-vc-2 mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-foreground font-medium">Participants</h3>
          </div>
          <div className="flex flex-wrap gap-vc-2">
            {analysis.participants.map((p, i) => (
              <div
                key={i}
                className={`px-vc-3 py-vc-1.5 rounded-full text-sm ${
                  p.sentiment === "positive"
                    ? "bg-success/10 text-success"
                    : p.sentiment === "negative"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-card text-muted-foreground"
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
      <div className="grid grid-cols-2 gap-vc-3">
        {/* Key Asks */}
        {analysis.keyAsks.length > 0 && (
          <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
            <h3 className="text-foreground font-medium mb-3">Key Asks</h3>
            <ul className="space-y-2">
              {analysis.keyAsks.map((ask, i) => (
                <li
                  key={i}
                  className="flex items-start gap-vc-2 text-muted-foreground text-sm"
                >
                  <span className="text-info mt-0.5">•</span>
                  {ask}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Objections */}
        {analysis.objections.length > 0 && (
          <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
            <h3 className="text-foreground font-medium mb-3">Objections/Concerns</h3>
            <ul className="space-y-2">
              {analysis.objections.map((obj, i) => (
                <li
                  key={i}
                  className="flex items-start gap-vc-2 text-muted-foreground text-sm"
                >
                  <span className="text-warning mt-0.5">•</span>
                  {obj}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deal Signals */}
      {(analysis.dealSignals.positive.length > 0 ||
        analysis.dealSignals.negative.length > 0) && (
        <div className="grid grid-cols-2 gap-vc-3">
          {analysis.dealSignals.positive.length > 0 && (
            <div className="bg-success/10 rounded-lg p-vc-3 border border-success/20">
              <h3 className="text-success font-medium mb-3 flex items-center gap-vc-2">
                <TrendingUp className="w-4 h-4" />
                Positive Signals
              </h3>
              <ul className="space-y-2">
                {analysis.dealSignals.positive.map((signal, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-vc-2 text-success text-sm"
                  >
                    <CheckCircle className="w-3 h-3 mt-1 flex-shrink-0" />
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.dealSignals.negative.length > 0 && (
            <div className="bg-destructive/10 rounded-lg p-vc-3 border border-destructive/20">
              <h3 className="text-destructive font-medium mb-3 flex items-center gap-vc-2">
                <TrendingDown className="w-4 h-4" />
                Warning Signs
              </h3>
              <ul className="space-y-2">
                {analysis.dealSignals.negative.map((signal, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-vc-2 text-destructive text-sm"
                  >
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
      <div className="bg-card/50 rounded-lg p-vc-3 border border-border">
        <h3 className="text-info font-medium mb-2 flex items-center gap-vc-2">
          <ArrowRight className="w-4 h-4" />
          Suggested Next Step
        </h3>
        <p className="text-foreground">{analysis.suggestedNextStep}</p>
      </div>
    </div>
  );
};

export default EmailAnalysisModal;
