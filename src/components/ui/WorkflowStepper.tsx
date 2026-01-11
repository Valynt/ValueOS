import { useLocation, useNavigate } from 'react-router-dom';
import { Calculator, CheckCircle2, GitBranch, Search, TrendingUp } from 'lucide-react';

const steps = [
  { id: 'discovery', label: 'Discovery', path: '/canvas', icon: Search },
  { id: 'architecture', label: 'Architecture', path: '/cascade', icon: GitBranch },
  { id: 'business-case', label: 'Business Case', path: '/calculator', icon: Calculator },
  { id: 'realization', label: 'Realization', path: '/dashboard', icon: TrendingUp }
];

interface WorkflowStepperProps {
  compact?: boolean;
}

export default function WorkflowStepper({ compact = false }: WorkflowStepperProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentIndex = steps.findIndex(s => s.path === location.pathname);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;

          return (
            <button
              key={step.id}
              onClick={() => navigate(step.path)}
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-foreground text-background'
                  : isCompleted
                  ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
              aria-label={`Go to ${step.label} phase`}
              aria-current={isActive ? 'step' : undefined}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              <span className="hidden md:inline">{step.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <nav aria-label="Workflow progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;
          const isLast = index === steps.length - 1;

          return (
            <li key={step.id} className={`flex items-center ${!isLast ? 'flex-1' : ''}`}>
              <button
                onClick={() => navigate(step.path)}
                className={`flex items-center gap-3 group ${
                  isActive ? '' : 'opacity-60 hover:opacity-100'
                } transition-opacity`}
                aria-label={`Go to ${step.label} phase`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-foreground text-background shadow-lg'
                      : isCompleted
                      ? 'bg-green-500 text-white'
                      : 'bg-secondary text-muted-foreground group-hover:bg-secondary/80'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </div>
                  <div className={`text-sm font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </div>
                </div>
              </button>

              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-4 rounded-full transition-colors ${
                    isCompleted ? 'bg-green-500' : 'bg-secondary'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
