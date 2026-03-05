/*
 * VALYNT MainLayout — Sidebar + TopBar + Content + Agent Chat
 * Provides agent dispatch context so any page can open the sidebar with a specific agent.
 */
import { useState, useCallback, createContext, useContext } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentChatSidebar } from "./AgentChatSidebar";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------
   Agent Dispatch Context
   ------------------------------------------------------- */

interface AgentDispatchContextType {
  openAgent: (slug?: string) => void;
  closeAgent: () => void;
}

const AgentDispatchContext = createContext<AgentDispatchContextType>({
  openAgent: () => {},
  closeAgent: () => {},
});

export function useAgentDispatch() {
  return useContext(AgentDispatchContext);
}

/* -------------------------------------------------------
   Layout Component
   ------------------------------------------------------- */

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSlug, setAgentSlug] = useState<string | undefined>(undefined);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const openAgent = useCallback((slug?: string) => {
    setAgentSlug(slug);
    setAgentOpen(true);
  }, []);

  const closeAgent = useCallback(() => {
    setAgentOpen(false);
  }, []);

  return (
    <AgentDispatchContext.Provider value={{ openAgent, closeAgent }}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Mobile sidebar overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:translate-x-0 lg:static lg:inset-0",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <Sidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TopBar onOpenAgent={() => openAgent()} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>

        {/* Agent Chat Sidebar */}
        <AgentChatSidebar
          open={agentOpen}
          onClose={closeAgent}
          initialAgentSlug={agentSlug}
        />
      </div>
    </AgentDispatchContext.Provider>
  );
}
