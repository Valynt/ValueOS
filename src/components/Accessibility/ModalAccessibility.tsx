/**
 * Modal Accessibility Hook
 *
 * Provides comprehensive keyboard navigation and accessibility features for modals:
 * - Escape key to close
 * - Focus trapping
 * - Initial focus management
 * - Screen reader announcements
 */

import { useEffect, useRef, RefObject } from "react";
import { trapFocus, announceToScreenReader } from "../../utils/accessibility";

export interface UseModalAccessibilityOptions {
  isOpen: boolean;
  onClose?: () => void;
  initialFocusRef?: RefObject<HTMLElement>;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  announceOnOpen?: string;
  announceOnClose?: string;
  modalLabel?: string;
  modalDescription?: string;
}

export interface UseModalAccessibilityReturn {
  modalRef: RefObject<HTMLDivElement>;
  handleBackdropClick: (e: React.MouseEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

export function useModalAccessibility({
  isOpen,
  onClose,
  initialFocusRef,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  announceOnOpen,
  announceOnClose,
  modalLabel,
  modalDescription,
}: UseModalAccessibilityOptions): UseModalAccessibilityReturn {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!closeOnBackdropClick) return;
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      onClose?.();
    }
  };

  // Setup modal when opened
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Announce modal opening
    if (announceOnOpen) {
      announceToScreenReader(announceOnOpen, "assertive");
    }

    // Set up focus trapping
    const cleanupFocusTrap = trapFocus(modal);

    // Set initial focus
    let focusElement: HTMLElement | null = null;

    if (initialFocusRef?.current) {
      focusElement = initialFocusRef.current;
    } else {
      // Find first focusable element
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusElement = focusableElements[0] || null;
    }

    if (focusElement) {
      // Small delay to ensure DOM is ready
      setTimeout(() => focusElement?.focus(), 10);
    }

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    // Cleanup function
    return () => {
      cleanupFocusTrap();
      document.body.style.overflow = "";

      // Announce modal closing
      if (announceOnClose) {
        announceToScreenReader(announceOnClose, "polite");
      }

      // Restore previous focus
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        try {
          previousFocusRef.current.focus();
        } catch (error) {
          // Focus might fail if element is no longer in DOM
        }
      }
    };
  }, [isOpen, initialFocusRef, announceOnOpen, announceOnClose]);

  return {
    modalRef,
    handleBackdropClick,
    handleKeyDown,
  };
}

/**
 * Skip Link Component
 *
 * Provides keyboard navigation to main content areas
 */
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ href, children }) => (
  <a
    href={href}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
  >
    {children}
  </a>
);

/**
 * Accessible Disclosure Component
 *
 * Provides expandable/collapsible content with proper ARIA attributes
 */
interface DisclosureProps {
  id: string;
  isOpen: boolean;
  onToggle: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  id,
  isOpen,
  onToggle,
  trigger,
  children,
  disabled = false,
}) => {
  const contentId = `${id}-content`;

  return (
    <>
      <button
        id={id}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        disabled={disabled}
        className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
      >
        {trigger}
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={id}
        hidden={!isOpen}
        className={isOpen ? "" : "sr-only"}
      >
        {children}
      </div>
    </>
  );
};

/**
 * Accessible Menu Component
 *
 * Provides dropdown menu with keyboard navigation
 */
interface MenuProps {
  id: string;
  isOpen: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  placement?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

export const Menu: React.FC<MenuProps> = ({
  id,
  isOpen,
  onClose,
  trigger,
  children,
  placement = "bottom-left",
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Handle escape key and outside clicks
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const placementClasses = {
    "bottom-left": "top-full left-0 mt-1",
    "bottom-right": "top-full right-0 mt-1",
    "top-left": "bottom-full left-0 mb-1",
    "top-right": "bottom-full right-0 mb-1",
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? onClose() : null)} // Handled by parent
        className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          id={`${id}-menu`}
          aria-labelledby={`${id}-trigger`}
          className={`absolute z-50 ${placementClasses[placement]} min-w-[200px] bg-white border border-gray-200 rounded-md shadow-lg py-1`}
        >
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Accessible Dialog/Modal Component
 *
 * Full-featured modal with accessibility features
 */
interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  initialFocusRef,
}) => {
  const titleId = `dialog-${Math.random().toString(36).substr(2, 9)}`;
  const descriptionId = description ? `dialog-desc-${titleId}` : undefined;

  const { modalRef, handleBackdropClick, handleKeyDown } =
    useModalAccessibility({
      isOpen,
      onClose,
      initialFocusRef,
      closeOnEscape,
      closeOnBackdropClick,
      announceOnOpen: `${title} dialog opened`,
      announceOnClose: `${title} dialog closed`,
      modalLabel: title,
      modalDescription: description,
    });

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div
        ref={modalRef}
        className={`w-full ${sizeClasses[size]} bg-white rounded-lg shadow-xl max-h-[90vh] overflow-hidden`}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-gray-600 mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            aria-label="Close dialog"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {children}
        </div>
      </div>
    </div>
  );
};
