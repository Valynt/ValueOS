// Optimized icon loading with fallbacks for blocked resources

import { lazy } from 'react';
import React from 'react';

type IconSource = React.ComponentType<any> | (() => any);

const iconCache = new WeakMap<IconSource, React.ComponentType<any>>();

// Lazy load icons to avoid blocking issues
const IconLoader = {
  // Core navigation icons
  Home: lazy(() => import('lucide-react').then(mod => ({ default: mod.Home }))),
  BookOpen: lazy(() => import('lucide-react').then(mod => ({ default: mod.BookOpen }))),
  Gamepad2: lazy(() => import('lucide-react').then(mod => ({ default: mod.Gamepad2 }))),
  Brain: lazy(() => import('lucide-react').then(mod => ({ default: mod.Brain }))),
  BarChart3: lazy(() => import('lucide-react').then(mod => ({ default: mod.BarChart3 }))),
  User: lazy(() => import('lucide-react').then(mod => ({ default: mod.User }))),

  // Action icons
  Plus: lazy(() => import('lucide-react').then(mod => ({ default: mod.Plus }))),
  Search: lazy(() => import('lucide-react').then(mod => ({ default: mod.Search }))),
  Menu: lazy(() => import('lucide-react').then(mod => ({ default: mod.Menu }))),
  X: lazy(() => import('lucide-react').then(mod => ({ default: mod.X }))),
  ChevronLeft: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronLeft }))),
  ChevronRight: lazy(() => import('lucide-react').then(mod => ({ default: mod.ChevronRight }))),

  // Status icons
  CheckCircle2: lazy(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle2 }))),
  Trophy: lazy(() => import('lucide-react').then(mod => ({ default: mod.Trophy }))),
  Target: lazy(() => import('lucide-react').then(mod => ({ default: mod.Target }))),
  DollarSign: lazy(() => import('lucide-react').then(mod => ({ default: mod.DollarSign }))),
  TreePine: lazy(() => import('lucide-react').then(mod => ({ default: mod.TreePine }))),
  Loader2: lazy(() => import('lucide-react').then(mod => ({ default: mod.Loader2 }))),
  AlertTriangle: lazy(() => import('lucide-react').then(mod => ({ default: mod.AlertTriangle }))),
  RefreshCw: lazy(() => import('lucide-react').then(mod => ({ default: mod.RefreshCw }))),
  HelpCircle: lazy(() => import('lucide-react').then(mod => ({ default: mod.HelpCircle }))),
  Info: lazy(() => import('lucide-react').then(mod => ({ default: mod.Info }))),
  MessageSquare: lazy(() => import('lucide-react').then(mod => ({ default: mod.MessageSquare }))),
  Award: lazy(() => import('lucide-react').then(mod => ({ default: mod.Award }))),
  FileText: lazy(() => import('lucide-react').then(mod => ({ default: mod.FileText }))),
  Settings: lazy(() => import('lucide-react').then(mod => ({ default: mod.Settings }))),
  LogOut: lazy(() => import('lucide-react').then(mod => ({ default: mod.LogOut }))),
  TrendingUp: lazy(() => import('lucide-react').then(mod => ({ default: mod.TrendingUp }))),
  CheckCircle: lazy(() => import('lucide-react').then(mod => ({ default: mod.CheckCircle }))),
  Fingerprint: lazy(() => import('lucide-react').then(mod => ({ default: mod.Fingerprint }))),
  Minus: lazy(() => import('lucide-react').then(mod => ({ default: mod.Minus }))),
  Clock: lazy(() => import('lucide-react').then(mod => ({ default: mod.Clock }))),
  Zap: lazy(() => import('lucide-react').then(mod => ({ default: mod.Zap }))),
  Star: lazy(() => import('lucide-react').then(mod => ({ default: mod.Star }))),
};

// Fallback icon component for when lucide-react is blocked
const FallbackIcon = ({ name, className = '' }: { name: string; className?: string }) => (
  <div
    className={`inline-flex items-center justify-center w-5 h-5 bg-muted rounded text-xs font-bold ${className}`}
    title={name}
    aria-label={name}
  >
    ?
  </div>
);

// Safe icon component with error boundary
export const SafeIcon = React.forwardRef<HTMLElement, {
  icon: IconSource;
  name: string;
  className?: string;
  [key: string]: any;
}>(({ icon, name, className = '', onError, ...props }, ref) => {
  const [IconComponent, setIconComponent] = React.useState<React.ComponentType<any> | null>(() => {
    return iconCache.get(icon) || null;
  });
  const [hasError, setHasError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(!iconCache.has(icon));

  React.useEffect(() => {
    let isMounted = true;

    const loadIcon = async () => {
      setHasError(false);

      if (iconCache.has(icon)) {
        setIconComponent(() => iconCache.get(icon) || null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const loaded = await Promise.resolve(
          typeof icon === 'function' ? icon() : icon
        );
        const Component = (loaded as any)?.default || loaded;
        if (isMounted && Component) {
          iconCache.set(icon, Component);
          setIconComponent(() => Component);
        }
      } catch (error) {
        if (isMounted) {
          setHasError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadIcon();

    return () => {
      isMounted = false;
    };
  }, [icon]);

  const handleError = (event: React.SyntheticEvent<HTMLElement, Event>) => {
    setHasError(true);
    onError?.(event);
  };

  if (hasError || !IconComponent || isLoading) {
    return <FallbackIcon name={name} className={className} />;
  }

  try {
    return (
      <IconComponent
        ref={ref as any}
        className={className}
        onError={handleError}
        aria-hidden={false}
        role="img"
        {...props}
      />
    );
  } catch (error) {
    setHasError(true);
    return <FallbackIcon name={name} className={className} />;
  }
});

// Export optimized icon set
export const Icons = {
  Home: (props: any) => <SafeIcon icon={IconLoader.Home} name="Home" {...props} />,
  BookOpen: (props: any) => <SafeIcon icon={IconLoader.BookOpen} name="Book Open" {...props} />,
  Gamepad2: (props: any) => <SafeIcon icon={IconLoader.Gamepad2} name="Gamepad" {...props} />,
  Brain: (props: any) => <SafeIcon icon={IconLoader.Brain} name="Brain" {...props} />,
  BarChart3: (props: any) => <SafeIcon icon={IconLoader.BarChart3} name="Bar Chart" {...props} />,
  User: (props: any) => <SafeIcon icon={IconLoader.User} name="User" {...props} />,
  Plus: (props: any) => <SafeIcon icon={IconLoader.Plus} name="Plus" {...props} />,
  Search: (props: any) => <SafeIcon icon={IconLoader.Search} name="Search" {...props} />,
  Menu: (props: any) => <SafeIcon icon={IconLoader.Menu} name="Menu" {...props} />,
  X: (props: any) => <SafeIcon icon={IconLoader.X} name="Close" {...props} />,
  ChevronLeft: (props: any) => <SafeIcon icon={IconLoader.ChevronLeft} name="Chevron Left" {...props} />,
  ChevronRight: (props: any) => <SafeIcon icon={IconLoader.ChevronRight} name="Chevron Right" {...props} />,
  CheckCircle2: (props: any) => <SafeIcon icon={IconLoader.CheckCircle2} name="Check Circle" {...props} />,
  Trophy: (props: any) => <SafeIcon icon={IconLoader.Trophy} name="Trophy" {...props} />,
  Target: (props: any) => <SafeIcon icon={IconLoader.Target} name="Target" {...props} />,
  DollarSign: (props: any) => <SafeIcon icon={IconLoader.DollarSign} name="Dollar Sign" {...props} />,
  TreePine: (props: any) => <SafeIcon icon={IconLoader.TreePine} name="Tree Pine" {...props} />,
  Loader2: (props: any) => <SafeIcon icon={IconLoader.Loader2} name="Loader" {...props} />,
  AlertTriangle: (props: any) => <SafeIcon icon={IconLoader.AlertTriangle} name="Alert Triangle" {...props} />,
  RefreshCw: (props: any) => <SafeIcon icon={IconLoader.RefreshCw} name="Refresh" {...props} />,
  HelpCircle: (props: any) => <SafeIcon icon={IconLoader.HelpCircle} name="Help Circle" {...props} />,
  Info: (props: any) => <SafeIcon icon={IconLoader.Info} name="Info" {...props} />,
  MessageSquare: (props: any) => <SafeIcon icon={IconLoader.MessageSquare} name="Message Square" {...props} />,
  Award: (props: any) => <SafeIcon icon={IconLoader.Award} name="Award" {...props} />,
  FileText: (props: any) => <SafeIcon icon={IconLoader.FileText} name="File Text" {...props} />,
  Settings: (props: any) => <SafeIcon icon={IconLoader.Settings} name="Settings" {...props} />,
  LogOut: (props: any) => <SafeIcon icon={IconLoader.LogOut} name="Logout" {...props} />,
  TrendingUp: (props: any) => <SafeIcon icon={IconLoader.TrendingUp} name="Trending Up" {...props} />,
  CheckCircle: (props: any) => <SafeIcon icon={IconLoader.CheckCircle} name="Check Circle" {...props} />,
  Fingerprint: (props: any) => <SafeIcon icon={IconLoader.Fingerprint} name="Fingerprint" {...props} />,
  Minus: (props: any) => <SafeIcon icon={IconLoader.Minus} name="Minus" {...props} />,
  Clock: (props: any) => <SafeIcon icon={IconLoader.Clock} name="Clock" {...props} />,
  Zap: (props: any) => <SafeIcon icon={IconLoader.Zap} name="Zap" {...props} />,
  Star: (props: any) => <SafeIcon icon={IconLoader.Star} name="Star" {...props} />,
};
