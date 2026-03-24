// apps/ValyntApp/src/components/DrawerForm.tsx
import { X } from "lucide-react";
import React, { useEffect, useRef, useCallback } from "react";

import { cn } from "@/lib/utils";

interface DrawerFormProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  showCloseButton?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-80",
  md: "w-96",
  lg: "w-[32rem]",
} as const;

const backdropClasses = "fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300";
const drawerBaseClasses = "absolute right-0 top-0 h-full bg-[var(--vds-color-surface-2)] shadow-xl transform transition-transform duration-300 ease-out flex flex-col";
const headerClasses = "flex items-center justify-between p-4 border-b border-[var(--vds-color-border)]";
const titleClasses = "text-lg font-semibold text-[var(--vds-color-text-primary)]";
const descriptionClasses = "text-sm text-[var(--vds-color-text-muted)]";
const closeButtonClasses = "p-2 rounded-lg text-[var(--vds-color-text-muted)] hover:text-[var(--vds-color-text-primary)] hover:bg-[var(--vds-color-surface)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vds-color-primary)]/30";
const contentClasses = "flex-1 p-4 overflow-auto";

const DrawerForm: React.FC<DrawerFormProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const focusFirstFocusable = useCallback((element: HTMLElement) => {
    const focusableSelectors = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
    const firstFocusable = element.querySelector(focusableSelectors);
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus();
    }
  }, []);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";

      const timer = setTimeout(() => {
        if (containerRef.current) {
          focusFirstFocusable(containerRef.current);
        }
      }, 100);

      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "";
        clearTimeout(timer);
      };
    }
  }, [isOpen, handleEscape, focusFirstFocusable]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [isOpen]);

  return (
    <div
      className={cn("fixed inset-0 z-50", isOpen ? "visible" : "invisible")}
      aria-hidden={!isOpen}
    >
      <div
        className={cn(backdropClasses, isOpen ? "opacity-100" : "opacity-0")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          drawerBaseClasses,
          sizeClasses[size],
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        aria-describedby={description ? "drawer-description" : undefined}
      >
        <div className={headerClasses}>
          <div>
            <h2 id="drawer-title" className={titleClasses}>{title}</h2>
            {description && (
              <p id="drawer-description" className={descriptionClasses}>{description}</p>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className={closeButtonClasses}
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div ref={containerRef} className={contentClasses}>
          {children}
        </div>
      </div>
    </div>
  );
};

DrawerForm.displayName = "DrawerForm";

export default DrawerForm;
