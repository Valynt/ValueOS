/**
 * Wouter to React Router Adapter
 * Provides wouter-compatible hooks that use react-router-dom underneath
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
  matchPath,
  useLocation as useRouterLocation,
  useNavigate,
  useParams as useRouterParams,
} from "react-router-dom";

// ============================================================================
// useLocation hook - maps to react-router's useLocation
// ============================================================================

export type LocationTuple = [string, (to: string, options?: { replace?: boolean }) => void];

export function useLocation(): LocationTuple {
  const location = useRouterLocation();
  const navigate = useNavigate();

  const navigateFn = useCallback(
    (to: string, options?: { replace?: boolean }) => {
      navigate(to, { replace: options?.replace });
    },
    [navigate]
  );

  return [location.pathname + location.search + location.hash, navigateFn];
}

// ============================================================================
// useRoute hook - pattern matching for routes
// ============================================================================

export type RouteMatch = { params: Record<string, string> } | null;

export function useRoute(pattern: string): RouteMatch {
  const location = useRouterLocation();
  const match = matchPath(pattern, location.pathname);

  if (!match) {
    return null;
  }

  return { params: match.params as Record<string, string> };
}

// ============================================================================
// Link component - maps to react-router's Link
// ============================================================================

interface LinkProps extends Omit<RouterLinkProps, "to"> {
  href?: string;
  to?: string;
  children: React.ReactNode;
  className?: string;
}

export function Link({ href, to, children, className, ...props }: LinkProps) {
  const target = to || href || "";
  return (
    <RouterLink to={target} className={className} {...props}>
      {children}
    </RouterLink>
  );
}

// ============================================================================
// Switch component - maps routes to the first match
// ============================================================================

interface RouteProps {
  path?: string;
  component?: React.ComponentType;
  children?: React.ReactNode;
}

interface SwitchProps {
  children: React.ReactElement<RouteProps>[];
}

export function Switch({ children }: SwitchProps) {
  const location = useRouterLocation();

  for (const child of children) {
    const { path, component: Component, children: routeChildren } = child.props;

    if (!path) {
      // Catch-all route
      return Component ? <Component /> : routeChildren;
    }

    const match = matchPath(path, location.pathname);
    if (match) {
      return Component ? <Component /> : routeChildren;
    }
  }

  return null;
}

export function Route(_props: RouteProps) {
  // This is just a marker component - Switch handles the rendering
  return null;
}

// ============================================================================
// useParams hook - maps to react-router's useParams
// ============================================================================

export function useParams(): Record<string, string> {
  const params = useRouterParams();
  return params as Record<string, string>;
}

// ============================================================================
// useSearch hook - provides access to search params
// ============================================================================

export function useSearch(): string {
  const location = useRouterLocation();
  return location.search;
}

// ============================================================================
// Redirect component - maps to react-router's Navigate
// ============================================================================

interface RedirectProps {
  to: string;
  replace?: boolean;
}

export function Redirect({ to, replace }: RedirectProps) {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!hasRedirected.current) {
      hasRedirected.current = true;
      navigate(to, { replace: replace ?? true });
    }
  }, [navigate, to, replace]);

  return null;
}

// ============================================================================
// Router component - wrapper that provides the adapter context
// ============================================================================

interface RouterProps {
  children: React.ReactNode;
}

export function Router({ children }: RouterProps) {
  // The adapter doesn't need additional context since we're using react-router directly
  return <>{children}</>;
}
