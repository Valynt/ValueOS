import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Database, FileText, Shield } from 'lucide-react';

interface Source {
  type: 'document' | 'database' | 'model' | 'constraint';
  label: string;
  reference?: string;
  confidence?: number;
}

interface LogicTraceProps {
  sources: Source[];
  constraints?: string[];
  modelVersion?: string;
}

const sourceIcons = {
  document: FileText,
  database: Database,
  model: Shield,
  constraint: AlertTriangle,
};

const sourceColors = {
  document: 'text-primary bg-primary/10',
  database: 'text-primary bg-primary/10',
  model: 'text-emerald-400 bg-emerald-500/10',
  constraint: 'text-amber-400 bg-amber-500/10',
};

export default function LogicTrace({ sources, constraints, modelVersion }: LogicTraceProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        <span>View reasoning</span>
        <span className="text-muted-foreground/60">({sources.length} sources)</span>
      </button>

      {isExpanded && (
        <div className="mt-2 p-3 bg-background/50 rounded-lg border border-border/50 space-y-3">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Data Sources
            </div>
            <div className="space-y-1.5">
              {sources.map((source, i) => {
                const Icon = sourceIcons[source.type];
                const colorClass = sourceColors[source.type];
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-foreground">{source.label}</span>
                    {source.reference && (
                      <span className="text-muted-foreground/60">({source.reference})</span>
                    )}
                    {source.confidence && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {source.confidence}% match
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {constraints && constraints.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Constraints Applied
              </div>
              <div className="flex flex-wrap gap-1.5">
                {constraints.map((constraint, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] rounded"
                  >
                    {constraint}
                  </span>
                ))}
              </div>
            </div>
          )}

          {modelVersion && (
            <div className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/50">
              Model: {modelVersion}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
