/**
 * ValueDriverSelector - Seller-facing component for selecting value drivers
 *
 * Shows only published drivers with persona-specific summaries and editable fields.
 */

import { useState } from "react";
import { Calculator, Check, ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MOCK_VALUE_DRIVERS,
  PERSONA_TAG_LABELS,
  VALUE_DRIVER_TYPE_LABELS,
  ValueDriver,
} from "@/types/valueDriver";
import { evaluateFormula } from "@/utils/formulas";

interface SelectedDriver {
  driver: ValueDriver;
  customValues: Record<string, number>;
  calculatedValue: number;
}

interface ValueDriverSelectorProps {
  selectedDrivers: SelectedDriver[];
  onSelect: (driver: ValueDriver) => void;
  onRemove: (driverId: string) => void;
  onUpdateValues: (driverId: string, values: Record<string, number>) => void;
  personaFilter?: string;
}

const TYPE_COLORS: Record<string, string> = {
  "cost-savings": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "revenue-lift": "bg-blue-100 text-blue-700 border-blue-200",
  "productivity-gain": "bg-purple-100 text-purple-700 border-purple-200",
  "risk-mitigation": "bg-amber-100 text-amber-700 border-amber-200",
};

export function ValueDriverSelector({
  selectedDrivers,
  onSelect,
  onRemove,
  onUpdateValues,
  personaFilter,
}: ValueDriverSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  // Only show published drivers
  const availableDrivers = MOCK_VALUE_DRIVERS.filter((d) => {
    if (d.status !== "published") return false;
    if (personaFilter && !d.personaTags.includes(personaFilter as any)) return false;
    if (searchQuery) {
      return (
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const selectedIds = selectedDrivers.map((s) => s.driver.id);

  const calculateValue = (driver: ValueDriver, customValues: Record<string, number>): number => {
    try {
      const scope: Record<string, number> = {};
      driver.formula.variables.forEach((v) => {
        scope[v.name] = customValues[v.name] ?? v.defaultValue;
      });
      // Use safe evaluator instead of new Function
      return evaluateFormula(driver.formula.expression, scope);
    } catch {
      return 0;
    }
  };

  const handleSelect = (driver: ValueDriver) => {
    if (selectedIds.includes(driver.id)) {
      onRemove(driver.id);
    } else {
      onSelect(driver);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <SearchInput
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onClear={() => setSearchQuery("")}
        placeholder="Search value drivers..."
      />

      {/* Available Drivers */}
      <div className="space-y-2">
        {availableDrivers.map((driver) => {
          const isSelected = selectedIds.includes(driver.id);
          const selectedData = selectedDrivers.find((s) => s.driver.id === driver.id);
          const isExpanded = expandedDriver === driver.id;

          return (
            <Card
              key={driver.id}
              className={cn(
                "transition-all cursor-pointer",
                isSelected && "border-primary bg-primary/5"
              )}
            >
              <CardContent className="p-4">
                {/* Header */}
                <div
                  className="flex items-start justify-between"
                  onClick={() => handleSelect(driver)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{driver.name}</span>
                      <Badge className={cn("text-xs", TYPE_COLORS[driver.type])}>
                        {VALUE_DRIVER_TYPE_LABELS[driver.type]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{driver.narrativePitch}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {driver.personaTags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {PERSONA_TAG_LABELS[tag]}
                        </Badge>
                      ))}
                      {driver.winRateCorrelation && (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {(driver.winRateCorrelation * 100).toFixed(0)}% win rate
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded: Customize Values */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Customize Assumptions
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDriver(isExpanded ? null : driver.id);
                        }}
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 ml-1 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {driver.formula.variables.map((variable) => (
                          <div key={variable.id}>
                            <label className="text-xs text-muted-foreground">
                              {variable.label} ({variable.unit})
                            </label>
                            <Input
                              type="number"
                              value={
                                selectedData?.customValues[variable.name] ?? variable.defaultValue
                              }
                              onChange={(e) => {
                                const newValues = {
                                  ...selectedData?.customValues,
                                  [variable.name]: parseFloat(e.target.value) || 0,
                                };
                                onUpdateValues(driver.id, newValues);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Calculated Value */}
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                      <span className="text-sm font-medium text-emerald-800">
                        Estimated Annual Value
                      </span>
                      <span className="text-xl font-bold text-emerald-700">
                        ${calculateValue(driver, selectedData?.customValues || {}).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {availableDrivers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No value drivers match your search</p>
        </div>
      )}

      {/* AI Suggestion */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">AI-Suggested Drivers</p>
                <p className="text-sm text-muted-foreground">
                  Get recommendations based on your prospect's industry and role
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Get Suggestions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ValueDriverSelector;
