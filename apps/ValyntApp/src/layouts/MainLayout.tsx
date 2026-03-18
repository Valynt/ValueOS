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

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const closeAgent = useCallback(() => setAgentOpen(false), []);

  return (
    <div className="flex h-screen bg-[#fafafa] text-zinc-900 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden animate-fade-in"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-full max-w-[20rem] transform transition-transform duration-200 ease-out",
          "lg:w-auto lg:max-w-none lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar onClose={closeSidebar} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
          onAgentOpen={() => setAgentOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>

      {/* Agent chat */}
      <AgentChatSidebar open={agentOpen} onClose={closeAgent} />
    </div>
  );
}

export default MainLayout;
