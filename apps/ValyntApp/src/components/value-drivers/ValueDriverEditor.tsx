/**
 * ValueDriverEditor - Modal for creating/editing value drivers
 *
 * Full editor with formula builder, persona tags, and narrative pitch.
 */

import {
  Calculator,
  Eye,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  FormulaVariable,
  PERSONA_TAG_LABELS,
  PersonaTag,
  SALES_MOTION_LABELS,
  SalesMotionTag,
  VALUE_DRIVER_TYPE_LABELS,
  ValueDriver,
  ValueDriverType,
} from "@/types/valueDriver";
import { evaluateFormula } from "@/utils/formulas";

interface ValueDriverEditorProps {
  driver: ValueDriver | null;
  onSave: (driver: ValueDriver) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = Object.entries(VALUE_DRIVER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const ALL_PERSONAS: PersonaTag[] = [
  "cro",
  "cmo",
  "cfo",
  "cto",
  "vp-sales",
  "se-director",
  "cs-leader",
  "procurement",
];
const ALL_MOTIONS: SalesMotionTag[] = [
  "new-logo",
  "renewal",
  "expansion",
  "land-expand",
  "competitive-displacement",
];

export function ValueDriverEditor({ driver, onSave, onClose }: ValueDriverEditorProps) {
  const isNew = !driver;
  const { user } = useAuth();

  const [formData, setFormData] = useState<Partial<ValueDriver>>({
    name: driver?.name || "",
    description: driver?.description || "",
    type: driver?.type || "cost-savings",
    personaTags: driver?.personaTags || [],
    salesMotionTags: driver?.salesMotionTags || [],
    formula: driver?.formula || {
      expression: "",
      variables: [],
      resultUnit: "currency",
    },
    narrativePitch: driver?.narrativePitch || "",
    status: driver?.status || "draft",
  });

  const [previewValue, setPreviewValue] = useState<number | null>(null);

  const handleChange = <K extends keyof ValueDriver>(key: K, value: ValueDriver[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const togglePersonaTag = (tag: PersonaTag) => {
    const current = formData.personaTags || [];
    const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    handleChange("personaTags", updated);
  };

  const toggleMotionTag = (tag: SalesMotionTag) => {
    const current = formData.salesMotionTags || [];
    const updated = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    handleChange("salesMotionTags", updated);
  };

  const addVariable = () => {
    const newVar: FormulaVariable = {
      id: `var-${Date.now()}`,
      name: "",
      label: "",
      defaultValue: 0,
      unit: "",
    };
    handleChange("formula", {
      ...formData.formula!,
      variables: [...(formData.formula?.variables ?? []), newVar],
    });
  };

  const updateVariable = (id: string, updates: Partial<FormulaVariable>) => {
    handleChange("formula", {
      ...formData.formula!,
      variables: formData.formula?.variables?.map((v) => (v.id === id ? { ...v, ...updates } : v)) ?? [],
    });
  };

  const removeVariable = (id: string) => {
    handleChange("formula", {
      ...formData.formula!,
      variables: formData.formula?.variables?.filter((v) => v.id !== id) ?? [],
    });
  };

  const calculatePreview = () => {
    try {
      const vars = formData.formula?.variables || [];
      const scope: Record<string, number> = {};
      vars.forEach((v) => {
        scope[v.name] = v.defaultValue;
      });

      // Use safe evaluator instead of new Function
      const expr = formData.formula?.expression || "0";
      const result = evaluateFormula(expr, scope);
      setPreviewValue(result);
    } catch {
      setPreviewValue(null);
    }
  };

  const handleSave = () => {
    const now = new Date().toISOString();
    const savedDriver: ValueDriver = {
      id: driver?.id || "",
      name: formData.name || "",
      description: formData.description || "",
      type: formData.type as ValueDriverType,
      personaTags: formData.personaTags || [],
      salesMotionTags: formData.salesMotionTags || [],
      formula: formData.formula!,
      narrativePitch: formData.narrativePitch || "",
      status: formData.status as "draft" | "published" | "archived",
      createdAt: driver?.createdAt || now,
      updatedAt: now,
      createdBy: driver?.createdBy || user?.email || "",
      version: (driver?.version || 0) + 1,
      usageCount: driver?.usageCount || 0,
      winRateCorrelation: driver?.winRateCorrelation,
    };
    onSave(savedDriver);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">
              {isNew ? "Create Value Driver" : "Edit Value Driver"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Define the formula, personas, and narrative for this driver
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="e.g., Demo Prep Time Reduction"
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Brief description of this value driver"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <SimpleSelect
                value={formData.type || "cost-savings"}
                onValueChange={(v) => handleChange("type", v as ValueDriverType)}
                options={TYPE_OPTIONS}
              />
            </div>
            <div>
              <Label>Status</Label>
              <SimpleSelect
                value={formData.status || "draft"}
                onValueChange={(v) =>
                  handleChange("status", v as "draft" | "published" | "archived")
                }
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                  { value: "archived", label: "Archived" },
                ]}
              />
            </div>
          </div>

          {/* Persona Tags */}
          <div>
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Persona Fit
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Which buyer personas does this driver resonate with?
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_PERSONAS.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-colors",
                    formData.personaTags?.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => togglePersonaTag(tag)}
                >
                  {PERSONA_TAG_LABELS[tag]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Sales Motion Tags */}
          <div>
            <Label className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sales Motion
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Where does this driver fit in the GTM lifecycle?
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_MOTIONS.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-colors",
                    formData.salesMotionTags?.includes(tag)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  )}
                  onClick={() => toggleMotionTag(tag)}
                >
                  {SALES_MOTION_LABELS[tag]}
                </Badge>
              ))}
            </div>
          </div>

          {/* Formula Builder */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <Label className="flex items-center gap-2 mb-3">
              <Calculator className="h-4 w-4" />
              Formula & Assumptions
            </Label>

            {/* Variables */}
            <div className="space-y-3 mb-4">
              {formData.formula?.variables.map((variable, _index) => (
                <div key={variable.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs">Variable Name</Label>
                    <Input
                      value={variable.name}
                      onChange={(e) => updateVariable(variable.id, { name: e.target.value })}
                      placeholder="variableName"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={variable.label}
                      onChange={(e) => updateVariable(variable.id, { label: e.target.value })}
                      placeholder="Display label"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Default</Label>
                    <Input
                      type="number"
                      value={variable.defaultValue}
                      onChange={(e) =>
                        updateVariable(variable.id, {
                          defaultValue: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Unit</Label>
                    <Input
                      value={variable.unit}
                      onChange={(e) => updateVariable(variable.id, { unit: e.target.value })}
                      placeholder="$, hrs, %"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariable(variable.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addVariable}>
              <Plus className="h-4 w-4 mr-2" />
              Add Variable
            </Button>

            {/* Expression */}
            <div className="mt-4">
              <Label className="text-xs">Formula Expression</Label>
              <Input
                value={formData.formula?.expression}
                onChange={(e) =>
                  handleChange("formula", { ...formData.formula!, expression: e.target.value })
                }
                placeholder="e.g., demosPerMonth * timeSaved * hourlyRate * 12"
                className="font-mono text-sm mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variable names in the expression. Supports basic math operators.
              </p>
            </div>

            {/* Preview */}
            <div className="mt-4 flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={calculatePreview}>
                <Eye className="h-4 w-4 mr-2" />
                Preview Result
              </Button>
              {previewValue !== null && (
                <span className="text-lg font-semibold text-emerald-600">
                  ${previewValue.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {/* Narrative Pitch */}
          <div>
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Narrative Pitch
            </Label>
            <p className="text-sm text-muted-foreground mb-2">
              Buyer-facing one-liner that drives urgency and relevance
            </p>
            <Textarea
              value={formData.narrativePitch}
              onChange={(e) => handleChange("narrativePitch", e.target.value)}
              placeholder="e.g., We cut demo prep time in half—freeing SEs to run more demos or focus on complex use cases."
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <Button variant="ghost" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Improve
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-muted/30">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleChange("status", "draft")}>
              Save as Draft
            </Button>
            <Button onClick={handleSave}>
              {formData.status === "published" ? "Update & Publish" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ValueDriverEditor;
