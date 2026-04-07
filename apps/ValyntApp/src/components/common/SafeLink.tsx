/**
 * SafeLink Component
 *
 * Renders a native anchor tag with progressive enhancement:
 * - Server-side/No-JS: Works as normal link with validated href
 * - Hydrated: Intercepts click and uses safeNavigate for SPA navigation
 *
 * Provides accessibility benefits and works without JavaScript.
 */
import { AnchorHTMLAttributes, MouseEvent, useCallback } from "react";

import { cn } from "@/lib/utils";
import { sanitizeInternalPath } from "@/lib/safeNavigation";

interface SafeLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  fallback?: string;
  external?: boolean;
  /**
   * If true, renders as a button-styled anchor.
   * Preserves semantic `<a>` tag for accessibility/no-JS support.
   */
  variant?: "default" | "button" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Validates and renders a safe internal link.
 * Falls back to button behavior if path is invalid.
 */
export function SafeLink({
  to,
  fallback = "/dashboard",
  external = false,
  variant = "default",
  size = "md",
  children,
  className,
  onClick,
  ...props
}: SafeLinkProps) {
  // Sanitize the path for the href (always safe to render)
  const sanitizedHref = external ? to : (sanitizeInternalPath(to) ?? sanitizeInternalPath(fallback) ?? "/dashboard");

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      // Allow external links to behave normally
      if (external) {
        onClick?.(e);
        return;
      }

      // Let the event bubble if modified (Ctrl, Shift, Alt, Meta)
      // This allows: Ctrl+click (new tab), Shift+click (new window), etc.
      if (e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) {
        onClick?.(e);
        return;
      }

      // Prevent default navigation - we'll handle it via safeNavigate
      e.preventDefault();

      // Call any custom onClick handler first
      onClick?.(e);

      // Use dynamic import to avoid circular dependency
      import("@/lib/safeNavigation").then(({ safeNavigate }) => {
        safeNavigate(to, { fallback });
      });
    },
    [external, fallback, onClick, to]
  );

  const variantClasses = {
    default: cn(
      "text-primary underline-offset-4 hover:underline",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "rounded-sm"
    ),
    button: cn(
      "inline-flex items-center justify-center",
      "rounded-md font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "bg-primary text-primary-foreground hover:bg-primary/90",
      size === "sm" && "h-8 px-3 text-xs",
      size === "md" && "h-9 px-4 py-2 text-sm",
      size === "lg" && "h-10 px-6 text-base"
    ),
    ghost: cn(
      "inline-flex items-center justify-center",
      "rounded-md text-sm font-medium transition-colors",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "h-9 px-4 py-2"
    ),
  };

  return (
    <a
      href={sanitizedHref}
      onClick={handleClick}
      className={cn(variantClasses[variant], className)}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      {...props}
    >
      {children}
    </a>
  );
}

/**
 * SafeExternalLink - convenience wrapper for external links
 * Always opens in new tab with proper security attributes
 */
export function SafeExternalLink({
  href,
  children,
  className,
  ...props
}: Omit<SafeLinkProps, "to" | "external"> & { href: string }) {
  return (
    <SafeLink
      to={href}
      external
      className={cn("text-primary underline-offset-4 hover:underline", className)}
      {...props}
    >
      {children}
    </SafeLink>
  );
}
