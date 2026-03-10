/*
 * Barrel exports for Agentic UI wireframe components.
 * These are frontend-only components using mock data — no backend integration.
 */

// Layout & shell
export { default as WireframeShell } from "./WireframeShell";

// Navigation
export { ResponsiveNav, ResponsivePageLayout } from "./ResponsiveNav";

// Command palette (Cmd+K)
export { default as CommandPalette, useCommandPalette } from "./CommandPalette";

// Notification center (slide-out panel)
export {
  default as NotificationCenter,
  NotificationProvider,
  NotificationBell,
  useNotifications,
} from "./NotificationCenter";

// Autonomy mode toggle
export {
  AutonomyProvider,
  useAutonomy,
  AutonomyNavToggle,
  AutonomyStatusPill,
} from "./AutonomyMode";

// Annotation overlay (design annotations)
export {
  AnnotationProvider,
  useAnnotations,
  AnnotationToggle,
  AnnotationMarker,
  AnnotatedSection,
  ANNOTATIONS,
} from "./AnnotationOverlay";
