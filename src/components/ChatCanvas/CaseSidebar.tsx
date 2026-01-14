/**
 * Case Sidebar Component
 *
 * Extracted from ChatCanvasLayout to handle case management and selection.
 * Provides a focused interface for browsing and selecting value cases.
 */

import { FC, useState, memo, useMemo } from "react";
import {
  Building2,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { ValueCase } from "./types";

const stageConfig = {
  opportunity: { color: "bg-blue-500", label: "Opportunity" },
  target: { color: "bg-amber-500", label: "Target" },
  realization: { color: "bg-green-500", label: "Realization" },
  expansion: { color: "bg-purple-500", label: "Expansion" },
} as const;

interface CaseSidebarProps {
  cases: ValueCase[];
  selectedCaseId: string | null;
  isFetchingCases: boolean;
  onCaseSelect: (id: string) => void;
  onNewCase: () => void;
  onStarterAction: (action: string, data?: any) => void;
}

const StageIndicator: FC<{ stage: ValueCase["stage"] }> = ({ stage }) => {
  const config = stageConfig[stage as keyof typeof stageConfig] || stageConfig.opportunity;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white ${config.color}`}
    >
      {config.label}
    </span>
  );
};

const CaseItem = memo(
  ({
    case_,
    isSelected,
    onSelect,
  }: {
    case_: ValueCase;
    isSelected: boolean;
    onSelect: (id: string) => void;
  }) => {
    return (
      <button
        onClick={() => onSelect(case_.id)}
        aria-label={`${isSelected ? "Currently viewing" : "Open"} ${case_.name} for ${case_.company}`}
        aria-current={isSelected ? "page" : undefined}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
          isSelected
            ? "bg-card text-foreground shadow-beautiful-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {case_.name}
      </button>
    );
  }
);
CaseItem.displayName = "CaseItem";

export const CaseSidebar: React.FC<CaseSidebarProps> = ({
  cases,
  selectedCaseId,
  isFetchingCases,
  onCaseSelect,
  onNewCase,
  onStarterAction,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter cases based on search query
  const filteredCases = useMemo(() => {
    if (!searchQuery) return cases;

    const query = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.company.toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  // Group cases by status
  const inProgressCases = useMemo(
    () => filteredCases.filter((c) => c.status === "in-progress"),
    [filteredCases]
  );
  const completedCases = useMemo(
    () => filteredCases.filter((c) => c.status === "completed"),
    [filteredCases]
  );

  return (
    <div className="w-80 bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Value Cases</h2>
          <button
            onClick={onNewCase}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            aria-label="Create new case"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring"
          />
        </div>
      </div>

      {/* Case Lists */}
      <div className="flex-1 overflow-auto">
        {isFetchingCases ? (
          <div className="p-4 text-center text-muted-foreground">
            Loading cases...
          </div>
        ) : (
          <>
            {/* In Progress */}
            {inProgressCases.length > 0 && (
              <div className="mb-6">
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">
                    In Progress ({inProgressCases.length})
                  </h3>
                </div>
                <div className="py-2">
                  {inProgressCases.map((case_) => (
                    <div key={case_.id} className="px-2 py-1">
                      <CaseItem
                        case_={case_}
                        isSelected={selectedCaseId === case_.id}
                        onSelect={onCaseSelect}
                      />
                      <div className="ml-3 mt-1 flex items-center gap-2">
                        <StageIndicator stage={case_.stage} />
                        <span className="text-xs text-muted-foreground">
                          {case_.company}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {completedCases.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-muted/50 border-b border-border">
                  <h3 className="text-sm font-medium text-foreground">
                    Completed ({completedCases.length})
                  </h3>
                </div>
                <div className="py-2">
                  {completedCases.map((case_) => (
                    <div key={case_.id} className="px-2 py-1">
                      <CaseItem
                        case_={case_}
                        isSelected={selectedCaseId === case_.id}
                        onSelect={onCaseSelect}
                      />
                      <div className="ml-3 mt-1 flex items-center gap-2">
                        <StageIndicator stage={case_.stage} />
                        <span className="text-xs text-muted-foreground">
                          {case_.company}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredCases.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? "No cases found matching your search." : "No cases yet."}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
