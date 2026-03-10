/*
 * WireframeShell — Layout wrapper for Agentic UI wireframe screens.
 *
 * Responsibilities:
 *   1. Applies the .wireframe-dark scoped theme (dark cinematic look)
 *   2. Wraps children in wireframe-specific providers:
 *      - AutonomyProvider (shared autonomy mode state)
 *      - NotificationProvider (mock notification feed)
 *      - AnnotationProvider (design annotation overlay)
 *   3. Renders global wireframe overlays:
 *      - CommandPalette (Cmd+K)
 *      - NotificationCenter (slide-out panel)
 *      - AnnotationToggle (bottom-right toggle)
 *
 * This shell is intentionally decoupled from the main ValueOS layout
 * so the wireframes can run with mock data only — no backend required.
 */
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CommandPalette, { useCommandPalette } from "./CommandPalette";
import { AnnotationProvider, AnnotationToggle, useAnnotations } from "./AnnotationOverlay";
import { AutonomyProvider } from "./AutonomyMode";
import NotificationCenter, { NotificationProvider } from "./NotificationCenter";

/* Keyboard shortcut: press "A" to toggle annotations */
function AnnotationKeyboardShortcut() {
  const { toggle } = useAnnotations();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "a" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);
  return null;
}

function WireframeContent({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useCommandPalette();

  return (
    <>
      <Toaster />
      {children}
      <CommandPalette open={open} onClose={() => setOpen(false)} />
      <NotificationCenter />
      <AnnotationToggle />
      <AnnotationKeyboardShortcut />
    </>
  );
}

export default function WireframeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wireframe-dark bg-background text-foreground min-h-screen">
      <TooltipProvider>
        <AutonomyProvider>
          <NotificationProvider>
            <AnnotationProvider>
              <WireframeContent>{children}</WireframeContent>
            </AnnotationProvider>
          </NotificationProvider>
        </AutonomyProvider>
      </TooltipProvider>
    </div>
  );
}
