import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { IntegrityStatus } from '../../types/agents';

interface IntegrityStatusBarProps {
  status?: IntegrityStatus;
  compact?: boolean;
}

const defaultStatus: IntegrityStatus = {
  overallScore: 94,
  logicCoverage: 98,
  dataQuality: 91,
  lastVerified: new Date(),
  issues: []
};

export default function IntegrityStatusBar({ status = defaultStatus, compact = false }: IntegrityStatusBarProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-green-500/10';
    if (score >= 70) return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-lg border border-border">
        <ShieldCheck className={`w-4 h-4 ${getScoreColor(status.overallScore)}`} />
        <span className="text-xs text-muted-foreground">Integrity:</span>
        <span className={`text-xs font-semibold ${getScoreColor(status.overallScore)}`}>
          {status.overallScore}%
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-5 h-5 ${getScoreColor(status.overallScore)}`} />
          <span className="text-sm font-medium text-foreground">System Integrity</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          Verified {status.lastVerified.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`p-3 rounded-lg ${getScoreBg(status.overallScore)}`}>
          <div className="text-xs text-muted-foreground mb-1">Overall Score</div>
          <div className={`text-xl font-bold ${getScoreColor(status.overallScore)}`}>
            {status.overallScore}%
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getScoreBg(status.logicCoverage)}`}>
          <div className="text-xs text-muted-foreground mb-1">Logic Coverage</div>
          <div className={`text-xl font-bold ${getScoreColor(status.logicCoverage)}`}>
            {status.logicCoverage}%
          </div>
        </div>
        <div className={`p-3 rounded-lg ${getScoreBg(status.dataQuality)}`}>
          <div className="text-xs text-muted-foreground mb-1">Data Quality</div>
          <div className={`text-xl font-bold ${getScoreColor(status.dataQuality)}`}>
            {status.dataQuality}%
          </div>
        </div>
      </div>

      {status.issues.length > 0 && (
        <div className="mt-4 space-y-2">
          {status.issues.map((issue, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 p-2 rounded text-xs ${
                issue.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
