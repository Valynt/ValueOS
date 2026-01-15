/**
 * TenantSwitcher Component
 *
 * Dropdown for switching between tenants with confirmation dialog.
 * Includes dirty state detection to warn about unsaved work.
 */

import { useState, useCallback } from "react";
import { ChevronDown, Building2, AlertTriangle, Check } from "lucide-react";
import { useTenant } from "@/app/providers/TenantContext";
import { TenantBadge } from "./TenantBadge";
import { cn } from "../../lib/utils";

interface TenantSwitcherProps {
  className?: string;
  isDirty?: boolean;
}

export function TenantSwitcher({ className, isDirty = false }: TenantSwitcherProps) {
  const { currentTenant, tenants, isLoading, error, isApiEnabled, switchTenant } = useTenant();

  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingTenantId, setPendingTenantId] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleTenantSelect = useCallback(
    (tenantId: string) => {
      if (tenantId === currentTenant?.id) {
        setIsOpen(false);
        return;
      }

      if (isDirty) {
        setPendingTenantId(tenantId);
        setShowConfirmation(true);
        setIsOpen(false);
      } else {
        performSwitch(tenantId);
      }
    },
    [currentTenant?.id, isDirty]
  );

  const performSwitch = useCallback(
    async (tenantId: string) => {
      setIsSwitching(true);
      try {
        await switchTenant(tenantId);
        setIsOpen(false);
        setShowConfirmation(false);
        setPendingTenantId(null);
      } finally {
        setIsSwitching(false);
      }
    },
    [switchTenant]
  );

  const handleConfirmSwitch = useCallback(() => {
    if (pendingTenantId) {
      performSwitch(pendingTenantId);
    }
  }, [pendingTenantId, performSwitch]);

  const handleCancelSwitch = useCallback(() => {
    setShowConfirmation(false);
    setPendingTenantId(null);
  }, []);

  if (!isApiEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="w-6 h-6 rounded bg-gray-700 animate-pulse" />
        <div className="w-24 h-4 rounded bg-gray-700 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md",
          "bg-amber-500/10 border border-amber-500/20 text-amber-500",
          className
        )}
        title={error.message}
      >
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Tenant unavailable</span>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md",
          "bg-gray-800 text-gray-400",
          className
        )}
      >
        <Building2 className="w-4 h-4" />
        <span className="text-sm">No tenants</span>
      </div>
    );
  }

  if (tenants.length === 1) {
    return (
      <div className={cn("flex items-center gap-2 px-3 py-2", className)}>
        <TenantBadge size="md" />
      </div>
    );
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSwitching}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md",
            "bg-gray-800/50 hover:bg-gray-800 border border-gray-700",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            isSwitching && "opacity-50 cursor-wait"
          )}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Switch tenant"
        >
          <TenantBadge size="md" />
          <ChevronDown
            className={cn(
              "w-4 h-4 text-gray-400 transition-transform duration-150",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            <div
              className={cn(
                "absolute top-full left-0 mt-1 z-50",
                "min-w-[200px] max-w-[300px]",
                "bg-gray-900 border border-gray-700 rounded-lg shadow-xl",
                "py-1 overflow-hidden"
              )}
              role="listbox"
              aria-label="Available tenants"
            >
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => handleTenantSelect(tenant.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2",
                    "hover:bg-gray-800 transition-colors duration-100",
                    "text-left",
                    tenant.id === currentTenant?.id && "bg-gray-800/50"
                  )}
                  role="option"
                  aria-selected={tenant.id === currentTenant?.id}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tenant.color }}
                  />
                  <span className="flex-1 truncate text-sm">{tenant.name}</span>
                  {tenant.id === currentTenant?.id && <Check className="w-4 h-4 text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {showConfirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-switch-title"
        >
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 id="confirm-switch-title" className="text-lg font-semibold text-white">
                  Switch Tenant?
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  You have unsaved changes in{" "}
                  <span className="font-medium text-white">{currentTenant?.name}</span>. Switching
                  tenants will discard these changes.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelSwitch}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium",
                  "bg-gray-800 hover:bg-gray-700 text-gray-300",
                  "transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-gray-500"
                )}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                disabled={isSwitching}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium",
                  "bg-amber-600 hover:bg-amber-500 text-white",
                  "transition-colors duration-150",
                  "focus:outline-none focus:ring-2 focus:ring-amber-500",
                  isSwitching && "opacity-50 cursor-wait"
                )}
              >
                {isSwitching ? "Switching..." : "Switch Anyway"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TenantSwitcher;
