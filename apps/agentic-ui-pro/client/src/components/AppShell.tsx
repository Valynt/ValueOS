/*
 * DESIGN SYSTEM: Obsidian Enterprise
 * AppShell: Persistent sidebar + top header + main content area
 * Used by all inner pages (not the landing page)
 */
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bot, BookOpen, ChevronLeft, ChevronRight, Command,
  FlaskConical, GitBranch, LayoutDashboard, Layers, Sparkles,
  Zap
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard },
  { label: 'Pattern Library', href: '/patterns', icon: Layers },
  { label: 'Workflow Blueprints', href: '/workflows', icon: GitBranch },
  { label: 'Prompt Lab', href: '/prompt-lab', icon: FlaskConical, badge: 'AI' },
];

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode;
}

export default function AppShell({ children, title, subtitle, headerActions }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border transition-all duration-200 ease-in-out shrink-0',
          collapsed ? 'w-14' : 'w-56'
        )}
        style={{ background: 'var(--sidebar)' }}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-border h-12 shrink-0',
          collapsed ? 'justify-center px-0' : 'px-4 gap-2.5'
        )}>
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/20 shrink-0">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="text-sm font-semibold font-display text-foreground leading-none block truncate">
                Agentic UI
              </span>
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider">PRO</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));

            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <div className={cn(
                        'flex items-center justify-center w-10 h-9 rounded-md mx-auto transition-colors',
                        isActive
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <Badge className="ml-auto text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary border-0">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <><ChevronLeft className="h-3.5 w-3.5 mr-1.5" /><span className="text-xs">Collapse</span></>
            }
          </Button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Header */}
        {(title || headerActions) && (
          <header className="flex items-center justify-between px-5 h-12 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
            <div className="min-w-0">
              {title && (
                <h1 className="text-sm font-semibold font-display truncate">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 shrink-0 ml-4">
                {headerActions}
              </div>
            )}
          </header>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
