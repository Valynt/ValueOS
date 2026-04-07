/**
 * SettingsAuditLog
 *
 * Displays audit trail of setting changes with user attribution and timestamps.
 * Shows "Last modified by X Y time ago" summary and expandable history.
 */

import { ChevronDown, ChevronUp, History, User } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  settingKey: string;
  settingLabel?: string;
  oldValue?: string;
  newValue: string;
  userId: string;
  userEmail: string;
  userName?: string;
  timestamp: string;
  action: "create" | "update" | "delete";
}

interface SettingsAuditLogProps {
  /** Recent entries to display */
  entries: AuditLogEntry[];
  /** Maximum entries to show in collapsed state */
  previewCount?: number;
  /** Optional className for styling */
  className?: string;
  /** Title override */
  title?: string;
  /** Show inline compact view instead of collapsible */
  compact?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getChangeDescription(entry: AuditLogEntry): string {
  switch (entry.action) {
    case "create":
      return "created";
    case "delete":
      return "deleted";
    case "update":
    default:
      return "updated";
  }
}

function truncateValue(value: string, maxLength = 30): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Compact inline audit indicator (e.g., "Last modified by Jane 2h ago")
 */
export function AuditIndicator({
  entry,
  className,
}: {
  entry?: AuditLogEntry;
  className?: string;
}) {
  if (!entry) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        No changes yet
      </span>
    );
  }

  return (
    <span className={cn("text-xs text-muted-foreground flex items-center gap-1", className)}>
      <History className="h-3 w-3" />
      Last {getChangeDescription(entry)} by{" "}
      <span className="font-medium text-foreground">{entry.userName ?? entry.userEmail}</span>{" "}
      {formatRelativeTime(entry.timestamp)}
    </span>
  );
}

/**
 * Individual audit entry row
 */
function AuditEntryRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      <div className="flex-shrink-0 mt-0.5">
        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">
            {entry.userName ?? entry.userEmail}
          </span>
          <span className="text-sm text-muted-foreground">
            {getChangeDescription(entry)}
          </span>
          <span className="text-sm font-medium">
            {entry.settingLabel ?? entry.settingKey}
          </span>
        </div>
        {entry.oldValue !== undefined && (
          <div className="mt-1 text-xs text-muted-foreground">
            Changed from "{truncateValue(entry.oldValue)}" to "
            {truncateValue(entry.newValue)}"
          </div>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/**
 * Full audit log component with collapsible history
 */
export function SettingsAuditLog({
  entries,
  previewCount = 3,
  className,
  title = "Change history",
  compact = false,
}: SettingsAuditLogProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No changes recorded yet.
      </div>
    );
  }

  // Most recent entry for the indicator
  const latestEntry = entries[0];

  if (compact) {
    return <AuditIndicator entry={latestEntry} className={className} />;
  }

  const previewEntries = entries.slice(0, previewCount);
  const hasMore = entries.length > previewCount;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("space-y-2", className)}>
        {/* Header with latest change indicator */}
        <div className="flex items-center justify-between">
          <AuditIndicator entry={latestEntry} />
          {hasMore && (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                {isOpen ? (
                  <>
                    Less <ChevronUp className="h-3 w-3 ml-1" />
                  </>
                ) : (
                  <>
                    {entries.length} changes <ChevronDown className="h-3 w-3 ml-1" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Always visible: recent entries */}
        <div className="space-y-0">
          {previewEntries.map((entry) => (
            <AuditEntryRow key={entry.id} entry={entry} />
          ))}
        </div>

        {/* Collapsible: older entries */}
        {hasMore && (
          <CollapsibleContent>
            <div className="space-y-0 pt-2 border-t border-border/50">
              {entries.slice(previewCount).map((entry) => (
                <AuditEntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

/**
 * Section-level audit summary (for SettingsSection header)
 */
export function SettingsSectionAudit({
  sectionName,
  entries,
  className,
}: {
  sectionName: string;
  entries: AuditLogEntry[];
  className?: string;
}) {
  const sectionEntries = entries.filter((e) =>
    e.settingKey.toLowerCase().includes(sectionName.toLowerCase())
  );

  if (sectionEntries.length === 0) return null;

  return (
    <div className={cn("mt-2", className)}>
      <SettingsAuditLog entries={sectionEntries} compact previewCount={1} />
    </div>
  );
}

export default SettingsAuditLog;
