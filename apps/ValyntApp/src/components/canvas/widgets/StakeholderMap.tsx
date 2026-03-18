/**
 * StakeholderMap Widget
 *
 * Grid showing stakeholders with role, priority, and source badge.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §3.1
 */

import { SourceBadge, SourceType } from "@valueos/components/components/SourceBadge";
import { Building, User, Users } from "lucide-react";
import React from "react";

import { WidgetProps } from "../CanvasHost";

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  priority: "high" | "medium" | "low";
  source: SourceType;
  email?: string;
  department?: string;
}

export interface StakeholderMapData {
  stakeholders: Stakeholder[];
}

export function StakeholderMap({ data, onAction }: WidgetProps) {
  const widgetData = data as unknown as StakeholderMapData;
  const stakeholders = widgetData.stakeholders ?? [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-50 border-red-200 text-red-700";
      case "medium":
        return "bg-amber-50 border-amber-200 text-amber-700";
      case "low":
        return "bg-green-50 border-green-200 text-green-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Stakeholder Map</h3>
          <p className="text-sm text-muted-foreground">{stakeholders.length} identified stakeholders</p>
        </div>
      </div>

      {stakeholders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No stakeholders identified yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stakeholders.map((stakeholder) => (
            <div
              key={stakeholder.id}
              className={`p-4 rounded-lg border ${getPriorityColor(stakeholder.priority)} transition-all hover:shadow-sm cursor-pointer`}
              onClick={() => onAction?.("select", { stakeholderId: stakeholder.id })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onAction?.("select", { stakeholderId: stakeholder.id });
                }
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 opacity-75" />
                  <span className="font-medium">{stakeholder.name}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${stakeholder.priority === "high"
                    ? "bg-red-100 text-red-800"
                    : stakeholder.priority === "medium"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-green-100 text-green-800"
                    }`}
                >
                  {stakeholder.priority}
                </span>
              </div>

              <p className="text-sm opacity-75 mb-2">{stakeholder.role}</p>

              {stakeholder.department && (
                <p className="text-xs opacity-60 mb-2">{stakeholder.department}</p>
              )}

              <div className="mt-3">
                <SourceBadge sourceType={stakeholder.source} size="sm" showTier={false} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default StakeholderMap;
