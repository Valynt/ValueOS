/**
 * ValueOS Wireframes — Shared Responsive Navigation
 * Desktop: Vertical nav rail (w-12) on the left
 * Tablet: Collapsed icon bar (w-10) on the left
 * Mobile: Bottom navigation bar with 5 key items + overflow menu
 */
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, LayoutDashboard, FileText, Sparkles, Layers,
  FlaskConical, Scale, Settings, MoreHorizontal, X,
  Target, Rocket, TrendingUp, BookOpen
} from "lucide-react";
import { AutonomyNavToggle } from "@/components/wireframes/AutonomyMode";
import { NotificationBell } from "@/components/wireframes/NotificationCenter";

export interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  label: string;
}

const allNavItems: NavItem[] = [
  { icon: Home, href: "/wireframes", label: "Home" },
  { icon: LayoutDashboard, href: "/wireframes/command-center", label: "Command" },
  { icon: FileText, href: "/wireframes/workspace/acme-cloud", label: "Workspace" },
  { icon: Sparkles, href: "/wireframes/canvas", label: "Canvas" },
  { icon: Layers, href: "/wireframes/maturity", label: "Maturity" },
  { icon: FlaskConical, href: "/wireframes/evidence", label: "Evidence" },
  { icon: Scale, href: "/wireframes/decisions", label: "Decisions" },
  { icon: Target, href: "/wireframes/realization", label: "Realization" },
  { icon: Rocket, href: "/wireframes/onboarding", label: "Onboarding" },
  { icon: TrendingUp, href: "/wireframes/expansion", label: "Expansion" },
];

// Mobile shows first 4 + overflow
const MOBILE_PRIMARY_COUNT = 4;

export function ResponsiveNav({ activeHref }: { activeHref: string }) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentHref = activeHref || location;

  const primaryMobileItems = allNavItems.slice(0, MOBILE_PRIMARY_COUNT);
  const overflowItems = allNavItems.slice(MOBILE_PRIMARY_COUNT);

  return (
    <>
      {/* Desktop Nav Rail — hidden on mobile */}
      <nav className="hidden md:flex w-12 border-r border-border flex-col items-center py-3 gap-1 shrink-0">
        <div className="w-7 h-7 rounded bg-primary/20 flex items-center justify-center mb-4">
          <span className="text-primary text-[10px] font-bold font-mono">V</span>
        </div>
        {allNavItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                currentHref === item.href
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title={item.label}
            >
              <item.icon className="w-4 h-4" />
            </div>
          </Link>
        ))}
        <div className="mt-auto space-y-1 flex flex-col items-center">
          <NotificationBell />
          <AutonomyNavToggle />
          <Link href="/wireframes/governance">
            <div className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Settings className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </nav>

      {/* Mobile Bottom Bar — hidden on desktop */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="flex items-center justify-around h-14 px-2">
          {primaryMobileItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  currentHref === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </div>
            </Link>
          ))}
          {/* Overflow menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
              mobileMenuOpen ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            <span className="text-[9px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile Overflow Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-card border-t border-border rounded-t-xl p-4"
            >
              <div className="grid grid-cols-4 gap-3">
                {overflowItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-colors ${
                        currentHref === item.href
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-[9px] font-medium text-center">{item.label}</span>
                    </div>
                  </Link>
                ))}
                {/* Utility items */}
                <Link href="/wireframes/governance">
                  <div
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center gap-1 p-3 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="text-[9px] font-medium">Settings</span>
                  </div>
                </Link>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-center gap-4">
                <NotificationBell />
                <AutonomyNavToggle />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Responsive page wrapper that handles the nav rail / bottom bar layout.
 * Desktop: flex row with nav rail on left
 * Mobile: flex column with bottom padding for the bottom bar
 */
export function ResponsivePageLayout({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col md:flex-row bg-background overflow-hidden">
      <ResponsiveNav activeHref={activeHref} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-14 md:pb-0">
        {children}
      </div>
    </div>
  );
}
