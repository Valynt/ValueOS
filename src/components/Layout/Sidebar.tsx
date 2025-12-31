import { NavLink, useLocation } from 'react-router-dom';
import {
  Calculator,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  LayoutGrid,
  LineChart,
  Map,
  Users
} from 'lucide-react';
import { useState } from 'react';
import UserProfileDropdown from './UserProfileDropdown';

const narrativeSteps = [
  {
    title: '1. Discovery',
    path: '/canvas',
    icon: Map,
    desc: 'Map problems to solutions'
  },
  {
    title: '2. Architecture',
    path: '/cascade',
    icon: Layers,
    desc: 'Connect drivers to KPIs'
  },
  {
    title: '3. Business Case',
    path: '/calculator',
    icon: Calculator,
    desc: 'Model financial ROI'
  },
  {
    title: '4. Realization',
    path: '/dashboard',
    icon: LineChart,
    desc: 'Track actual value'
  },
];

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const location = useLocation();

  return (
    <div
      className={`${
        isExpanded ? 'w-64' : 'w-[72px]'
      } bg-card border-r border-border transition-all duration-300 flex flex-col shadow-xl z-50 relative`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm z-10"
        aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {isExpanded ? (
          <ChevronsLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronsRight className="w-3.5 h-3.5" />
        )}
      </button>

      <div className="p-4 border-b border-border">
        <div className={`flex items-center ${isExpanded ? 'gap-3' : 'justify-center'}`}>
          <div className="w-9 h-9 bg-foreground rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-background font-bold text-lg">V</span>
          </div>
          {isExpanded && (
            <div className="font-bold text-lg tracking-tight text-foreground">
              ValueOS
            </div>
          )}
        </div>
      </div>

      <div className="p-3">
        {isExpanded ? (
          <div className="p-3 bg-secondary/50 rounded-xl border border-border/50 hover:border-muted-foreground/30 transition-colors cursor-pointer group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Active Client</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                AC
              </div>
              <div className="overflow-hidden">
                <div className="text-sm font-semibold text-foreground truncate">Acme Corp</div>
                <div className="text-xs text-muted-foreground truncate">Manufacturing</div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="w-10 h-10 mx-auto rounded-md bg-blue-500 flex items-center justify-center text-white font-bold text-xs cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all"
            title="Acme Corp"
          >
            AC
          </div>
        )}
      </div>

      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <NavLink
          to="/"
          title={!isExpanded ? 'All Accounts' : undefined}
          className={({ isActive }) =>
            `flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2.5 rounded-lg text-sm transition-all duration-200 group ${
              isActive
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`
          }
        >
          <LayoutGrid className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span>All Accounts</span>}
        </NavLink>

        <div className="my-4 border-t border-border/50" />

        {isExpanded && (
          <div className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Value Narrative
          </div>
        )}

        {narrativeSteps.map((step) => (
          <NavLink
            key={step.path}
            to={step.path}
            title={!isExpanded ? step.title : undefined}
            className={({ isActive }) =>
              `flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-3 rounded-lg text-sm transition-all duration-200 group relative ${
                isActive
                  ? 'bg-secondary text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
              }`
            }
          >
            <step.icon className="w-5 h-5 flex-shrink-0" />
            {isExpanded && (
              <div className="flex-1 text-left">
                <div className="font-medium">{step.title}</div>
                <div className="text-[10px] text-muted-foreground opacity-80 font-normal">
                  {step.desc}
                </div>
              </div>
            )}
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-foreground transition-opacity duration-200 ${
              location.pathname === step.path ? 'opacity-100' : 'opacity-0'
            }`} />
          </NavLink>
        ))}

        <div className="my-4 border-t border-border/50" />

        <NavLink
          to="/agents"
          title={!isExpanded ? 'AI Collaborators' : undefined}
          className={({ isActive }) =>
            `flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2.5 rounded-lg text-sm transition-all duration-200 ${
              isActive
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
            }`
          }
        >
          <Users className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span>AI Collaborators</span>}
        </NavLink>
      </div>

      <div className="p-3 border-t border-border mt-auto">
        <UserProfileDropdown isExpanded={isExpanded} />
      </div>
    </div>
  );
}
