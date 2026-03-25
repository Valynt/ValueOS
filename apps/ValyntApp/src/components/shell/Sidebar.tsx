/**
 * Shell Layer: Sidebar
 * Static navigation component with tenant context
 */

import {
  BookOpen,
  ChevronRight,
  FileText,
  FolderOpen,
  HelpCircle,
  Loader2,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import React from "react";

import { useI18n } from "@/i18n/I18nProvider";

export interface ValueCase {
  id: string;
  name: string;
  status: "in-progress" | "completed";
  updatedAt: string;
}

interface SidebarProps {
  cases: ValueCase[];
  selectedCaseId: string | null;
  collapsed: boolean;
  onSelectCase: (id: string) => void;
  onToggleCollapse: () => void;
  onNewCase: () => void;
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
}

export function Sidebar({
  cases,
  selectedCaseId,
  collapsed,
  onSelectCase,
  onToggleCollapse,
  onNewCase,
  onSettingsClick,
  onHelpClick,
}: SidebarProps) {
  const { t } = useI18n();
  const inProgressCases = cases.filter((c) => c.status === "in-progress");
  const completedCases = cases.filter((c) => c.status === "completed");
  const betaHubUrl = "https://docs.valuecanvas.com";

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-72"
      } flex flex-col border-r border-border bg-sidebar transition-all duration-200`}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sidebar-foreground">ValueOS</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
      </div>

      {/* New Case Button */}
      {!collapsed && (
        <div className="p-3">
          <button
            onClick={onNewCase}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow-teal transition-all hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            New Value Case
          </button>
        </div>
      )}

      {/* Cases List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {!collapsed && (
          <>
            {/* In Progress */}
            <CaseSection
              title="In Progress"
              icon={<Loader2 className="h-3 w-3 animate-spin" />}
              cases={inProgressCases}
              selectedCaseId={selectedCaseId}
              onSelectCase={onSelectCase}
            />

            {/* Completed */}
            <CaseSection
              title="Completed"
              icon={<FolderOpen className="h-3 w-3" />}
              cases={completedCases}
              selectedCaseId={selectedCaseId}
              onSelectCase={onSelectCase}
              dimmed
            />
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex flex-col gap-2">
            <a
              href={betaHubUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <BookOpen className="h-4 w-4" />
              Beta Hub
            </a>
            <div className="flex items-center justify-between">
              <button
                onClick={onSettingsClick}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Settings className="h-4 w-4" />
                {t("nav.settings")}
              </button>
              <button
                onClick={onHelpClick}
                className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-label="Help"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <a
              href={betaHubUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Beta Hub"
            >
              <BookOpen className="h-4 w-4" />
            </a>
            <button
              onClick={onSettingsClick}
              className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={t("nav.settings")}
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={onHelpClick}
              className="rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

interface CaseSectionProps {
  title: string;
  icon: React.ReactNode;
  cases: ValueCase[];
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
  dimmed?: boolean;
}

function CaseSection({
  title,
  icon,
  cases,
  selectedCaseId,
  onSelectCase,
  dimmed,
}: CaseSectionProps) {
  if (cases.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-1">
        {cases.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCase(c.id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              selectedCaseId === c.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <FileText className={`h-4 w-4 shrink-0 ${dimmed ? "opacity-60" : ""}`} />
            <div className="min-w-0 flex-1">
              <div className={`truncate ${selectedCaseId === c.id ? "font-medium" : ""}`}>
                {c.name}
              </div>
              <div className="text-xs text-muted-foreground">{c.updatedAt}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
