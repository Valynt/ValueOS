/*
 * ValueOS — Notification Center (Slide-out Panel)
 * Pattern: Real-time activity feed with agent actions, policy alerts, evidence updates
 * Features: Category filters, unread badges, timestamp grouping, mark-as-read, live pulse
 */
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Check, CheckCircle2,
  ChevronRight, Clock, Eye, FileText,
  Filter, FlaskConical, Layers, Microscope, Scale,
  Shield, Sparkles, TrendingUp, X
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { useWireframeAuth } from "./WireframeAuthContext";

import { apiClient } from "@/api/client/unified-api-client";
import { getRealtimeService } from "@/lib/realtime/supabaseRealtime";
import type { NotificationBroadcastPayload } from "@/lib/realtime/supabaseRealtime";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type NotifCategory = "agent" | "policy" | "evidence" | "approval" | "system";
type NotifPriority = "high" | "medium" | "low" | "info";

interface Notification {
  id: string;
  category: NotifCategory;
  priority: NotifPriority;
  title: string;
  description: string;
  source: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionRoute?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */
interface NotificationContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
  unreadCount: number;
  notifications: Notification[];
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
function createMockNotifications(): Notification[] {
  const now = new Date();
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);

  return [
    {
      id: "n1",
      category: "agent",
      priority: "high",
      title: "The Strategist composed a value narrative",
      description: "Draft executive brief for Acme Corp Cloud Migration is ready for review. Confidence: 72%.",
      source: "The Strategist",
      timestamp: ago(2),
      read: false,
      actionLabel: "Review Draft",
      actionRoute: "/wireframes/canvas",
      icon: Sparkles,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
    {
      id: "n2",
      category: "policy",
      priority: "high",
      title: "Policy §4.2 triggered — Discount exceeds threshold",
      description: "Stark Industries discount of 22% exceeds the 15% VP-approval threshold. Escalated to Decision Desk.",
      source: "PolicyEngine",
      timestamp: ago(12),
      read: false,
      actionLabel: "Review Decision",
      actionRoute: "/wireframes/decisions",
      icon: Shield,
      iconColor: "text-risk",
      iconBg: "bg-risk/10",
    },
    {
      id: "n3",
      category: "evidence",
      priority: "medium",
      title: "Evidence E4 flagged as stale",
      description: "Forrester Productivity Report (2022) is 3+ years old. The Analyst recommends sourcing a 2025 update.",
      source: "The Analyst",
      timestamp: ago(34),
      read: false,
      actionLabel: "View Evidence",
      actionRoute: "/wireframes/evidence",
      icon: FlaskConical,
      iconColor: "text-warning",
      iconBg: "bg-warning/10",
    },
    {
      id: "n4",
      category: "approval",
      priority: "medium",
      title: "Stage promotion pending — Acme Corp",
      description: "Value case meets 70% confidence threshold. Ready to promote from Evidence → Defensible.",
      source: "System",
      timestamp: ago(58),
      read: false,
      actionLabel: "Approve Promotion",
      actionRoute: "/wireframes/decisions",
      icon: Scale,
      iconColor: "text-violet-400",
      iconBg: "bg-violet-500/10",
    },
    {
      id: "n5",
      category: "agent",
      priority: "info",
      title: "The Modeler ran sensitivity analysis",
      description: "4 scenarios modeled for Acme Corp. Conservative: $2.8M, Base: $4.2M, Optimistic: $5.1M, Aggressive: $6.3M.",
      source: "The Modeler",
      timestamp: ago(72),
      read: true,
      actionLabel: "View Analysis",
      actionRoute: "/wireframes/canvas",
      icon: TrendingUp,
      iconColor: "text-health",
      iconBg: "bg-health/10",
    },
    {
      id: "n6",
      category: "system",
      priority: "medium",
      title: "Realization drift detected — Wayne Enterprises",
      description: "Actual value realization is +18% above model predictions. The Monitor recommends recalibrating.",
      source: "The Monitor",
      timestamp: ago(120),
      read: true,
      actionLabel: "View Case",
      actionRoute: "/wireframes/workspace/wayne",
      icon: Activity,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10",
    },
    {
      id: "n7",
      category: "agent",
      priority: "info",
      title: "The Analyst validated 2 assumptions",
      description: "A1 (infrastructure costs) confirmed at 92% confidence. A5 (implementation timeline) confirmed at 85%.",
      source: "The Analyst",
      timestamp: ago(180),
      read: true,
      icon: Microscope,
      iconColor: "text-health",
      iconBg: "bg-health/10",
    },
    {
      id: "n8",
      category: "evidence",
      priority: "low",
      title: "New benchmark ingested",
      description: "Gartner Cloud Migration Benchmark 2025 added to evidence library. Linked to 3 active value cases.",
      source: "Evidence Ingestion",
      timestamp: ago(240),
      read: true,
      icon: FileText,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10",
    },
    {
      id: "n9",
      category: "approval",
      priority: "info",
      title: "Cyberdyne case approved — entering Realization",
      description: "VP Sarah Chen approved the $5.6M Data Platform Migration case. Now tracking realization metrics.",
      source: "Decision Desk",
      timestamp: ago(360),
      read: true,
      actionLabel: "View Case",
      actionRoute: "/wireframes/workspace/cyberdyne",
      icon: CheckCircle2,
      iconColor: "text-health",
      iconBg: "bg-health/10",
    },
    {
      id: "n10",
      category: "system",
      priority: "low",
      title: "Domain Pack updated — Enterprise IT",
      description: "12 new industry benchmarks and 3 assumption templates added to the Enterprise IT domain pack.",
      source: "System",
      timestamp: ago(480),
      read: true,
      icon: Layers,
      iconColor: "text-muted-foreground",
      iconBg: "bg-muted/30",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

/** Map a DB row (snake_case) to the local Notification shape. */
function rowToNotification(row: NotificationBroadcastPayload): Notification {
  // Icon and colour are derived from category — same mapping as mock data.
  const iconMap: Record<string, { icon: React.ElementType; iconColor: string; iconBg: string }> = {
    agent:    { icon: Sparkles,      iconColor: "text-primary",          iconBg: "bg-primary/10" },
    policy:   { icon: Shield,        iconColor: "text-risk",             iconBg: "bg-risk/10" },
    evidence: { icon: FlaskConical,  iconColor: "text-warning",          iconBg: "bg-warning/10" },
    approval: { icon: Scale,         iconColor: "text-violet-400",       iconBg: "bg-violet-500/10" },
    system:   { icon: Activity,      iconColor: "text-amber-400",        iconBg: "bg-amber-500/10" },
  };
  const { icon, iconColor, iconBg } = iconMap[row.category] ?? iconMap.system;

  return {
    id: row.id,
    category: row.category as NotifCategory,
    priority: row.priority as NotifPriority,
    title: row.title,
    description: row.description,
    source: row.source,
    timestamp: new Date(row.created_at),
    read: row.read,
    actionLabel: row.action_label ?? undefined,
    actionRoute: row.action_route ?? undefined,
    icon,
    iconColor,
    iconBg,
  };
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { organizationId, accessToken } = useWireframeAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Seed with mock data so the UI is never empty while the API loads.
  const [notifications, setNotifications] = useState<Notification[]>(createMockNotifications);
  // Track the last org+token pair we fetched for, so we re-hydrate when either
  // changes (e.g. token refresh) but avoid duplicate fetches on unrelated renders.
  const lastFetchKeyRef = useRef<string | null>(null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ------------------------------------------------------------------
  // Hydrate from API whenever org or token changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!organizationId || !accessToken) return;
    const fetchKey = `${organizationId}:${accessToken}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    apiClient
      .get<{ data: NotificationBroadcastPayload[] }>(
        "/api/v1/notifications",
        undefined,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      .then((res) => {
        // Ignore stale responses if a newer fetch has been started.
        if (lastFetchKeyRef.current !== fetchKey) {
          return;
        }
        if (res.success && res.data?.data) {
          setNotifications(res.data.data.map(rowToNotification));
        }
      })
      .catch(() => {
        // Keep mock data on error — non-fatal for wireframe screens.
      });
  }, [organizationId, accessToken]);

  // ------------------------------------------------------------------
  // Realtime Broadcast subscription
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!organizationId) return;

    const unsubscribe = getRealtimeService().subscribeToNotifications(
      organizationId,
      (payload) => {
        setNotifications((prev) => [rowToNotification(payload), ...prev]);
      }
    );

    return unsubscribe;
  }, [organizationId]);

  // ------------------------------------------------------------------
  // Mutations (optimistic update + API call)
  // ------------------------------------------------------------------
  const markAsRead = useCallback(
    (id: string) => {
      // Optimistic
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

      if (!accessToken) return;
      apiClient
        .patch(
          `/api/v1/notifications/${id}/read`,
          undefined,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        .catch(() => {
          // Revert on failure
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
        });
    },
    [accessToken]
  );

  const markAllAsRead = useCallback(() => {
    // If we don't have an access token, just perform a local optimistic update.
    if (!accessToken) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }

    // Capture original read flags for all notifications that exist at this moment.
    let snapshotReadById: Record<string, boolean> = {};

    // Optimistically mark all current notifications as read.
    setNotifications((prev) => {
      snapshotReadById = prev.reduce<Record<string, boolean>>((acc, n) => {
        acc[n.id] = n.read;
        return acc;
      }, {});
      return prev.map((n) => ({ ...n, read: true }));
    });

    apiClient
      .post("/api/v1/notifications/read-all", undefined, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .catch(() => {
        // On failure, revert only the read flags for notifications
        // that existed when markAllAsRead was triggered. Leave any
        // newer notifications (not in snapshotReadById) untouched.
        setNotifications((prev) =>
          prev.map((n) =>
            Object.prototype.hasOwnProperty.call(snapshotReadById, n.id)
              ? { ...n, read: snapshotReadById[n.id] }
              : n
          )
        );
      });
  }, [accessToken]);

  // ------------------------------------------------------------------
  // Keyboard shortcut: N to toggle
  // ------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <NotificationContext.Provider value={{ isOpen, setIsOpen, toggle, unreadCount, notifications, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav Bell Button (for nav rail)                                     */
/* ------------------------------------------------------------------ */
export function NotificationBell() {
  const { toggle, unreadCount } = useNotifications();

  return (
    <button
      onClick={toggle}
      className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
      title="Notifications (N)"
    >
      <Bell className="w-4 h-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-risk text-[8px] font-bold text-white flex items-center justify-center ring-2 ring-card">
          {unreadCount}
        </span>
      )}
      {/* Pulse animation for unread */}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-risk animate-ping opacity-30" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */
const CATEGORIES: { key: NotifCategory | "all"; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All", icon: Bell },
  { key: "agent", label: "Agents", icon: Sparkles },
  { key: "policy", label: "Policy", icon: Shield },
  { key: "evidence", label: "Evidence", icon: FlaskConical },
  { key: "approval", label: "Approvals", icon: Scale },
  { key: "system", label: "System", icon: Activity },
];

const PRIORITY_STYLES: Record<NotifPriority, { dot: string; border: string }> = {
  high: { dot: "bg-risk", border: "border-l-risk" },
  medium: { dot: "bg-warning", border: "border-l-warning" },
  low: { dot: "bg-muted-foreground/40", border: "border-l-muted-foreground/20" },
  info: { dot: "bg-primary/40", border: "border-l-primary/20" },
};

/* ------------------------------------------------------------------ */
/*  Time grouping helpers                                              */
/* ------------------------------------------------------------------ */
function getTimeGroup(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = diff / 60000;
  if (minutes < 60) return "Just Now";
  if (minutes < 180) return "Earlier Today";
  if (minutes < 1440) return "Today";
  return "Yesterday";
}

function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Slide-out Panel                                                    */
/* ------------------------------------------------------------------ */
export default function NotificationCenter() {
  const { isOpen, setIsOpen, notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [activeFilter, setActiveFilter] = useState<NotifCategory | "all">("all");

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeFilter);

  // Group by time
  const grouped: Record<string, Notification[]> = {};
  for (const n of filtered) {
    const group = getTimeGroup(n.timestamp);
    (grouped[group] ??= []).push(n);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: -420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -420, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed top-0 left-[52px] bottom-0 z-50 w-[400px] bg-card border-r border-border shadow-2xl shadow-black/40 flex flex-col"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-[13px] font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-risk/10 text-risk text-[9px] font-mono font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="px-2 py-1 rounded text-[10px] font-mono text-primary hover:bg-primary/10 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Category Filters */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-1 overflow-x-auto shrink-0">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeFilter === cat.key;
                const count = cat.key === "all"
                  ? notifications.filter((n) => !n.read).length
                  : notifications.filter((n) => n.category === cat.key && !n.read).length;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setActiveFilter(cat.key)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {cat.label}
                    {count > 0 && (
                      <span className={`w-3.5 h-3.5 rounded-full text-[7px] font-bold flex items-center justify-center ${
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Live indicator */}
            <div className="px-4 py-1.5 border-b border-border/50 flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-health animate-pulse" />
              <span className="text-[9px] font-mono text-muted-foreground/60">Live — updates in real time</span>
            </div>

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <Filter className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-[11px] text-muted-foreground/50">No notifications in this category</p>
                </div>
              )}

              {Object.entries(grouped).map(([group, items]) => (
                <div key={group}>
                  {/* Time group header */}
                  <div className="px-4 py-1.5 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/40 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {group}
                    </span>
                  </div>

                  {/* Items */}
                  {items.map((notif, idx) => {
                    const Icon = notif.icon;
                    const priorityStyle = PRIORITY_STYLES[notif.priority];
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => markAsRead(notif.id)}
                        className={`relative px-4 py-3 border-l-2 cursor-pointer transition-colors group ${
                          priorityStyle.border
                        } ${
                          notif.read
                            ? "opacity-60 hover:opacity-80"
                            : "bg-primary/[0.02] hover:bg-primary/[0.04]"
                        }`}
                      >
                        {/* Unread dot */}
                        {!notif.read && (
                          <span className={`absolute top-4 right-4 w-2 h-2 rounded-full ${priorityStyle.dot}`} />
                        )}

                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`w-8 h-8 rounded-lg ${notif.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className={`w-4 h-4 ${notif.iconColor}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-4">
                            <p className={`text-[12px] leading-snug ${notif.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                              {notif.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-relaxed line-clamp-2">
                              {notif.description}
                            </p>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-mono text-muted-foreground/40">
                                {notif.source}
                              </span>
                              <span className="text-[9px] text-muted-foreground/30">·</span>
                              <span className="text-[9px] font-mono text-muted-foreground/40">
                                {formatRelativeTime(notif.timestamp)}
                              </span>
                            </div>

                            {/* Action button */}
                            {notif.actionLabel && (
                              <button className="mt-2 flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors">
                                {notif.actionLabel}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Hover read indicator */}
                        {!notif.read && (
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Check className="w-3 h-3 text-muted-foreground/40" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between shrink-0 bg-muted/10">
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground/40">
                <Eye className="w-3 h-3" />
                <span>{notifications.filter((n) => n.read).length} read</span>
                <span>·</span>
                <span>{unreadCount} unread</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/30">
                <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/50 text-[8px]">N</kbd>
                <span>toggle</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
