/**
 * Collapsible
 *
 * Simple collapsible component for expanding/collapsing content.
 * Built on top of Radix UI Collapsible primitive pattern.
 */

import * as React from "react";

import { cn } from "@/lib/utils";

// ============================================================================
// Context
// ============================================================================

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(undefined);

function useCollapsibleContext() {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("Collapsible components must be used within a Collapsible");
  }
  return context;
}

// ============================================================================
// Components
// ============================================================================

interface CollapsibleProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

export function Collapsible({ 
  children, 
  open: controlledOpen, 
  onOpenChange,
  defaultOpen = false 
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  }, [isControlled, onOpenChange]);

  const value = React.useMemo(
    () => ({ open, onOpenChange: handleOpenChange }),
    [open, handleOpenChange]
  );

  return (
    <CollapsibleContext.Provider value={value}>
      {children}
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export function CollapsibleTrigger({ 
  children, 
  asChild = false,
  className 
}: CollapsibleTriggerProps) {
  const { open, onOpenChange } = useCollapsibleContext();

  const handleClick = () => {
    onOpenChange(!open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: handleClick,
      className: cn((children.props as { className?: string }).className, className),
    });
  }

  return (
    <button 
      type="button"
      onClick={handleClick}
      className={className}
      aria-expanded={open}
    >
      {children}
    </button>
  );
}

interface CollapsibleContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleContent({ 
  children, 
  className 
}: CollapsibleContentProps) {
  const { open } = useCollapsibleContext();

  if (!open) return null;

  return (
    <div 
      className={cn(
        "overflow-hidden transition-all data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      data-state={open ? "open" : "closed"}
    >
      {children}
    </div>
  );
}

export default Collapsible;
