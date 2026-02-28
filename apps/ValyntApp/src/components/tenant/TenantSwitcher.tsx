/**
 * TenantSwitcher
 *
 * Dropdown that lists the user's tenants and allows switching between them.
 * Uses Radix DropdownMenu for accessible keyboard navigation.
 */

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { TenantInfo } from "@/api/tenant";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface TenantSwitcherProps {
  /** Compact mode hides the name on small screens */
  compact?: boolean;
  className?: string;
}

export function TenantSwitcher({ compact = false, className }: TenantSwitcherProps) {
  const { currentTenant, tenants, switchTenant, isLoading } = useTenant();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (tenant: TenantInfo) => {
    if (tenant.id === currentTenant?.id) return;
    setSwitching(true);
    try {
      await switchTenant(tenant.id);
    } finally {
      setSwitching(false);
    }
  };

  if (isLoading || !currentTenant) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          disabled={switching}
          className={cn(
            "flex items-center gap-2 px-3 min-h-10 rounded-xl hover:bg-zinc-100 transition-colors min-w-0",
            switching && "opacity-60",
            className,
          )}
        >
          <div
            className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: currentTenant.color || "#18C3A5" }}
          >
            <span className="text-white text-[10px] font-black">
              {getInitials(currentTenant.name)}
            </span>
          </div>
          {!compact && (
            <div className="text-left hidden sm:block min-w-0">
              <p className="text-[13px] font-semibold text-zinc-900 leading-tight truncate">
                {currentTenant.name}
              </p>
              <p className="text-[10px] text-zinc-400 leading-tight capitalize">
                {currentTenant.role}
              </p>
            </div>
          )}
          <ChevronDown className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[14rem] rounded-xl border border-zinc-200 bg-white p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <DropdownMenu.Label className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
            Organizations
          </DropdownMenu.Label>

          {tenants.map((tenant) => (
            <DropdownMenu.Item
              key={tenant.id}
              onSelect={() => handleSwitch(tenant)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-700 cursor-pointer outline-none data-[highlighted]:bg-zinc-100 transition-colors"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: tenant.color || "#18C3A5" }}
              >
                <span className="text-white text-[9px] font-bold">
                  {getInitials(tenant.name)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{tenant.name}</p>
                <p className="text-[10px] text-zinc-400 capitalize">{tenant.role}</p>
              </div>
              {tenant.id === currentTenant.id && (
                <Check className="w-4 h-4 text-zinc-900 flex-shrink-0" />
              )}
            </DropdownMenu.Item>
          ))}

          <DropdownMenu.Separator className="my-1 h-px bg-zinc-100" />

          <DropdownMenu.Item
            onSelect={() => navigate("/create-org")}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-zinc-500 cursor-pointer outline-none data-[highlighted]:bg-zinc-100 transition-colors"
          >
            <div className="w-6 h-6 rounded border border-dashed border-zinc-300 flex items-center justify-center flex-shrink-0">
              <Plus className="w-3 h-3 text-zinc-400" />
            </div>
            <span>Create organization</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
