import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { AgentChatSidebar } from "./AgentChatSidebar";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

import { cn } from "@/lib/utils";

/**
 * PageTransition — lightweight opacity fade on route change.
 * No layout shift, no jank, no heavy animation library needed.
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const prevKey = useRef(location.key);

  useEffect(() => {
    if (location.key !== prevKey.current) {
      prevKey.current = location.key;
      setVisible(false);
      // Two nested rAFs ensure the browser commits the opacity-0 frame before
      // restoring opacity-1. A single rAF can be batched with the state update
      // on fast machines, making the transition invisible.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    }
  }, [location.key]);

  return (
    <div
      className={cn(
        "transition-opacity duration-150 ease-out",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {children}
    </div>
  );
}

const MAIN_CONTENT_ID = "main-content";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const closeAgent = useCallback(() => setAgentOpen(false), []);

  const focusMainContent = useCallback(() => {
    const mainContent = mainContentRef.current;
    if (!mainContent) return;

    if (window.location.hash !== `#${MAIN_CONTENT_ID}`) {
      window.history.replaceState(null, "", `#${MAIN_CONTENT_ID}`);
    }

    mainContent.focus();
    mainContent.scrollIntoView?.({ block: "start" });
  }, []);

  const handleSkipLinkClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    focusMainContent();
  }, [focusMainContent]);

  const handleSkipLinkKeyDown = useCallback((event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      focusMainContent();
    }
  }, [focusMainContent]);

  return (
    <>
      <a
        href={`#${MAIN_CONTENT_ID}`}
        onClick={handleSkipLinkClick}
        onKeyDown={handleSkipLinkKeyDown}
        className={cn(
          "sr-only",
          "focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100]",
          "focus-visible:inline-flex focus-visible:items-center focus-visible:justify-center",
          "focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        Skip to main content
      </a>

      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 animate-fade-in bg-black/30 lg:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-full max-w-[20rem] transform transition-transform duration-200 ease-out",
            "lg:static lg:inset-0 lg:w-auto lg:max-w-none lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar onClose={closeSidebar} />
        </div>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            onMenuClick={() => setSidebarOpen(true)}
            onAgentOpen={() => setAgentOpen(true)}
          />
          <main
            id={MAIN_CONTENT_ID}
            ref={mainContentRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto overscroll-contain focus-visible:outline-none bg-background"
          >
            <PageTransition>
              <div className="min-h-full flex flex-col">
                <Outlet />
              </div>
            </PageTransition>
          </main>
        </div>

        {/* Agent chat */}
        <AgentChatSidebar open={agentOpen} onClose={closeAgent} />
      </div>
    </>
  );
}

export default MainLayout;
