/**
 * Type override for lucide-react with @types/react@19.
 *
 * React 19 adds `bigint` to `ReactNode`, but lucide-react's bundled types
 * are compiled against React 18's narrower `ReactNode` definition.
 * This causes "Type 'bigint' is not assignable to type 'ReactNode'" errors
 * when using Lucide icons as JSX components.
 *
 * This ambient module re-declares the icon exports as React.FC so the IDE
 * no longer flags every Lucide icon usage. The runtime is unaffected.
 *
 * Remove this file once lucide-react ships types built against React 19.
 */

// NOTE: No top-level imports — keeps this file in the global declaration scope.

declare module "lucide-react" {
  import type {
    ForwardRefExoticComponent,
    RefAttributes,
    SVGProps,
  } from "react";

  export type LucideProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  };

  export type LucideIcon = ForwardRefExoticComponent<
    LucideProps & RefAttributes<SVGSVGElement>
  >;

  // Re-export every icon used in the codebase so TS resolves them
  // against the corrected LucideIcon type above.
  export const AlertCircle: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const ArrowDown: LucideIcon;
  export const ArrowLeft: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUp: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Bell: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Bot: LucideIcon;
  export const Brain: LucideIcon;
  export const Calendar: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Clock: LucideIcon;
  export const Copy: LucideIcon;
  export const DollarSign: LucideIcon;
  export const Download: LucideIcon;
  export const Edit: LucideIcon;
  export const ExternalLink: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const FileSearch: LucideIcon;
  export const FileText: LucideIcon;
  export const Filter: LucideIcon;
  export const Folder: LucideIcon;
  export const Globe: LucideIcon;
  export const HelpCircle: LucideIcon;
  export const Home: LucideIcon;
  export const Info: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Lightbulb: LucideIcon;
  export const Loader2: LucideIcon;
  export const Lock: LucideIcon;
  export const LogOut: LucideIcon;
  export const Mail: LucideIcon;
  export const Menu: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Minus: LucideIcon;
  export const MoreHorizontal: LucideIcon;
  export const MoreVertical: LucideIcon;
  export const PanelLeftClose: LucideIcon;
  export const PanelLeftOpen: LucideIcon;
  export const Pencil: LucideIcon;
  export const Play: LucideIcon;
  export const Plus: LucideIcon;
  export const RefreshCw: LucideIcon;
  export const Search: LucideIcon;
  export const Send: LucideIcon;
  export const Settings: LucideIcon;
  export const Shield: LucideIcon;
  export const ShieldAlert: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Star: LucideIcon;
  export const Target: LucideIcon;
  export const Trash: LucideIcon;
  export const Trash2: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Upload: LucideIcon;
  export const User: LucideIcon;
  export const Users: LucideIcon;
  export const X: LucideIcon;
  export const XCircle: LucideIcon;
  export const Zap: LucideIcon;
}
