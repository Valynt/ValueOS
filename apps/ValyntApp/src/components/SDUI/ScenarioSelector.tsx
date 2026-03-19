import React, { useMemo, useState } from "react";

export interface ScenarioSelectorScenario {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  category?: string;
  estimatedTime?: string;
  estimatedValue?: string;
  tags?: string[];
}

export interface ScenarioSelectorProps {
  scenarios: ScenarioSelectorScenario[];
  selectedId?: string;
  onChange?: (id: string) => void;
  onSelect?: (scenario: ScenarioSelectorScenario) => void;
  showSearch?: boolean;
  showViewToggle?: boolean;
  multiSelect?: boolean;
  onMultiSelect?: (selectedIds: string[]) => void;
}

const getScenarioLabel = (scenario: ScenarioSelectorScenario) =>
  scenario.label ?? scenario.title ?? scenario.id;

export function ScenarioSelector({
  scenarios,
  selectedId,
  onChange,
  onSelect,
  showSearch = false,
  showViewToggle = false,
  multiSelect = false,
  onMultiSelect,
}: ScenarioSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedId ? [selectedId] : []);

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return scenarios;
    }

    return scenarios.filter((scenario) => {
      const searchableParts = [
        getScenarioLabel(scenario),
        scenario.description,
        scenario.category,
        ...(scenario.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableParts.includes(normalizedQuery);
    });
  }, [scenarios, searchQuery]);

  const handleSingleSelect = (scenario: ScenarioSelectorScenario) => {
    onChange?.(scenario.id);
    onSelect?.(scenario);
  };

  const handleMultiSelect = (scenario: ScenarioSelectorScenario) => {
    setSelectedIds((currentSelectedIds) => {
      const nextSelectedIds = currentSelectedIds.includes(scenario.id)
        ? currentSelectedIds.filter((id) => id !== scenario.id)
        : [...currentSelectedIds, scenario.id];

      onMultiSelect?.(nextSelectedIds);
      onSelect?.(scenario);
      return nextSelectedIds;
    });
  };

  return (
    <section className="space-y-4" aria-label="Scenario selector">
      {(showSearch || showViewToggle) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {showSearch ? (
            <input
              aria-label="Search scenarios"
              className="rounded border border-border px-3 py-2 text-sm"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search scenarios..."
              type="search"
              value={searchQuery}
            />
          ) : (
            <div />
          )}

          {showViewToggle && (
            <div className="flex items-center gap-2" aria-label="Scenario layout controls">
              <button
                aria-pressed={viewMode === "grid"}
                className="rounded border border-border px-3 py-1.5 text-sm"
                onClick={() => setViewMode("grid")}
                type="button"
              >
                Grid
              </button>
              <button
                aria-pressed={viewMode === "list"}
                className="rounded border border-border px-3 py-1.5 text-sm"
                onClick={() => setViewMode("list")}
                type="button"
              >
                List
              </button>
            </div>
          )}
        </div>
      )}

      {!multiSelect && onChange ? (
        <label className="flex flex-col gap-1 text-sm">
          Scenario
          <select
            className="rounded border border-border px-2 py-1"
            onChange={(event) => onChange(event.target.value)}
            value={selectedId}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {getScenarioLabel(scenario)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {multiSelect && (
        <p className="text-sm text-muted-foreground">{selectedIds.length} scenarios selected</p>
      )}

      <div
        className={
          viewMode === "grid" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3"
        }
      >
        {filteredScenarios.map((scenario) => {
          const isSelected = multiSelect
            ? selectedIds.includes(scenario.id)
            : selectedId === scenario.id;

          return (
            <button
              aria-pressed={isSelected}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-secondary"
              }`}
              key={scenario.id}
              onClick={() =>
                multiSelect ? handleMultiSelect(scenario) : handleSingleSelect(scenario)
              }
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-medium text-foreground">{getScenarioLabel(scenario)}</h3>
                  {scenario.description && (
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  )}
                </div>
                {scenario.category && (
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {scenario.category}
                  </span>
                )}
              </div>

              {(scenario.estimatedTime || scenario.estimatedValue) && (
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {scenario.estimatedTime && <span>{scenario.estimatedTime}</span>}
                  {scenario.estimatedValue && <span>{scenario.estimatedValue}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
