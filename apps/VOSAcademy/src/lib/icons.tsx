// Optimized icon loading with fallbacks for blocked resources

import { lazy } from 'react';
import React from 'react';

/** Props accepted by all icon wrapper components. */
export type IconProps = React.SVGProps<SVGSVGElement> & { className?: string };

type IconSource = React.ComponentType<IconProps> | (() => Promise<{ default: React.ComponentType<IconProps> }>);

const iconCache = new WeakMap<IconSource, React.ComponentType<IconProps>>();

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
} & IconProps>(({ icon, name, className = '', onError, ...props }, ref) => {
  const [IconComponent, setIconComponent] = React.useState<React.ComponentType<IconProps> | null>(() => {
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
        const loaded_ = loaded as { default?: React.ComponentType<IconProps> } | React.ComponentType<IconProps>;
        const Component = (loaded_ as { default?: React.ComponentType<IconProps> }).default ?? (loaded_ as React.ComponentType<IconProps>);
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
        ref={ref as React.Ref<SVGSVGElement>}
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
  Home: (props: IconProps) => <SafeIcon icon={IconLoader.Home} name="Home" {...props} />,
  BookOpen: (props: IconProps) => <SafeIcon icon={IconLoader.BookOpen} name="Book Open" {...props} />,
  Gamepad2: (props: IconProps) => <SafeIcon icon={IconLoader.Gamepad2} name="Gamepad" {...props} />,
  Brain: (props: IconProps) => <SafeIcon icon={IconLoader.Brain} name="Brain" {...props} />,
  BarChart3: (props: IconProps) => <SafeIcon icon={IconLoader.BarChart3} name="Bar Chart" {...props} />,
  User: (props: IconProps) => <SafeIcon icon={IconLoader.User} name="User" {...props} />,
  Plus: (props: IconProps) => <SafeIcon icon={IconLoader.Plus} name="Plus" {...props} />,
  Search: (props: IconProps) => <SafeIcon icon={IconLoader.Search} name="Search" {...props} />,
  Menu: (props: IconProps) => <SafeIcon icon={IconLoader.Menu} name="Menu" {...props} />,
  X: (props: IconProps) => <SafeIcon icon={IconLoader.X} name="Close" {...props} />,
  ChevronLeft: (props: IconProps) => <SafeIcon icon={IconLoader.ChevronLeft} name="Chevron Left" {...props} />,
  ChevronRight: (props: IconProps) => <SafeIcon icon={IconLoader.ChevronRight} name="Chevron Right" {...props} />,
  CheckCircle2: (props: IconProps) => <SafeIcon icon={IconLoader.CheckCircle2} name="Check Circle" {...props} />,
  Trophy: (props: IconProps) => <SafeIcon icon={IconLoader.Trophy} name="Trophy" {...props} />,
  Target: (props: IconProps) => <SafeIcon icon={IconLoader.Target} name="Target" {...props} />,
  DollarSign: (props: IconProps) => <SafeIcon icon={IconLoader.DollarSign} name="Dollar Sign" {...props} />,
  TreePine: (props: IconProps) => <SafeIcon icon={IconLoader.TreePine} name="Tree Pine" {...props} />,
  Loader2: (props: IconProps) => <SafeIcon icon={IconLoader.Loader2} name="Loader" {...props} />,
  AlertTriangle: (props: IconProps) => <SafeIcon icon={IconLoader.AlertTriangle} name="Alert Triangle" {...props} />,
  RefreshCw: (props: IconProps) => <SafeIcon icon={IconLoader.RefreshCw} name="Refresh" {...props} />,
  HelpCircle: (props: IconProps) => <SafeIcon icon={IconLoader.HelpCircle} name="Help Circle" {...props} />,
  Info: (props: IconProps) => <SafeIcon icon={IconLoader.Info} name="Info" {...props} />,
  MessageSquare: (props: IconProps) => <SafeIcon icon={IconLoader.MessageSquare} name="Message Square" {...props} />,
  Award: (props: IconProps) => <SafeIcon icon={IconLoader.Award} name="Award" {...props} />,
  FileText: (props: IconProps) => <SafeIcon icon={IconLoader.FileText} name="File Text" {...props} />,
  Settings: (props: IconProps) => <SafeIcon icon={IconLoader.Settings} name="Settings" {...props} />,
  LogOut: (props: IconProps) => <SafeIcon icon={IconLoader.LogOut} name="Logout" {...props} />,
  TrendingUp: (props: IconProps) => <SafeIcon icon={IconLoader.TrendingUp} name="Trending Up" {...props} />,
  CheckCircle: (props: IconProps) => <SafeIcon icon={IconLoader.CheckCircle} name="Check Circle" {...props} />,
  Fingerprint: (props: IconProps) => <SafeIcon icon={IconLoader.Fingerprint} name="Fingerprint" {...props} />,
  Minus: (props: IconProps) => <SafeIcon icon={IconLoader.Minus} name="Minus" {...props} />,
  Clock: (props: IconProps) => <SafeIcon icon={IconLoader.Clock} name="Clock" {...props} />,
  Zap: (props: IconProps) => <SafeIcon icon={IconLoader.Zap} name="Zap" {...props} />,
  Star: (props: IconProps) => <SafeIcon icon={IconLoader.Star} name="Star" {...props} />,
};
