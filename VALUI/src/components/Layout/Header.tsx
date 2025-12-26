import { ChevronRight, Download, Presentation, Share2 } from 'lucide-react';
import WorkflowStepper from '../UI/WorkflowStepper';

interface HeaderProps {
  title: string;
  breadcrumbs?: string[];
  actions?: React.ReactNode;
  showStepper?: boolean;
}

export default function Header({ title, breadcrumbs = [], actions, showStepper = true }: HeaderProps) {
  return (
    <div className="border-b border-border">
      {showStepper && (
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-secondary/20">
          <WorkflowStepper compact />
        </div>
      )}

      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {breadcrumbs.length > 0 && (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-foreground/50 text-sm mb-1">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span className={i === breadcrumbs.length - 1 ? 'text-foreground' : ''}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </nav>
            )}
            <h1 className="text-foreground text-xl font-semibold tracking-tight">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {actions || (
              <>
                <button
                  className="btn btn-ghost h-9 px-3 text-foreground/50 hover:text-foreground"
                  aria-label="Share this business case"
                >
                  <Share2 className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  className="btn btn-outline h-9 px-3"
                  aria-label="Export business case"
                >
                  <Download className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  className="btn btn-primary h-9 px-3"
                  aria-label="Present business case"
                >
                  <Presentation className="w-4 h-4 sm:mr-2" aria-hidden="true" />
                  <span className="hidden sm:inline">Present</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
