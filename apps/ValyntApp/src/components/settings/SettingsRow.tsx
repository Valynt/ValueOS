/**
 * SettingsRow - Edit-in-place row pattern for settings
 * 
 * Read-only display with Edit action. Prevents accidental edits.
 */

import { ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  label: string;
  value: string;
  description?: string;
  onSave?: (value: string) => void;
  type?: "text" | "email" | "password";
  editable?: boolean;
  children?: ReactNode;
}

export function SettingsRow({
  label,
  value,
  description,
  onSave,
  type = "text",
  editable = true,
  children,
}: SettingsRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave?.(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>

        {children ? (
          <div className="flex-shrink-0">{children}</div>
        ) : isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-64"
              autoFocus
            />
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {type === "password" ? "••••••••" : value}
            </span>
            {editable && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SettingsToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsToggleRow({
  label,
  description,
  checked,
  onChange,
}: SettingsToggleRowProps) {
  return (
    <div className="py-4 border-b border-border last:border-b-0">
      <label className="flex items-start justify-between gap-4 cursor-pointer">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              checked ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                checked ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
      </label>
    </div>
  );
}

interface SettingsSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="mb-8">
      {title && (
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}
      <div className="bg-white rounded-lg border border-border">
        {children}
      </div>
    </div>
  );
}

interface SettingsAlertProps {
  type: "warning" | "info" | "success" | "error";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function SettingsAlert({ type, title, description, action }: SettingsAlertProps) {
  const colors = {
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
  };

  const buttonColors = {
    warning: "bg-amber-600 hover:bg-amber-700 text-white",
    info: "bg-blue-600 hover:bg-blue-700 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
    error: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <div className={cn("rounded-lg border p-4 mb-6", colors[type])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{title}</p>
          {description && <p className="text-sm mt-1 opacity-90">{description}</p>}
        </div>
        {action && (
          <Button
            size="sm"
            className={buttonColors[type]}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export default SettingsRow;
