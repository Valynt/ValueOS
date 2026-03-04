/*
 * VALYNT MainLayout — Sidebar + TopBar + Content + Agent Chat
 */
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AgentChatSidebar } from "./AgentChatSidebar";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [agentOpen, setAgentOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
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
        <TopBar onOpenAgent={() => setAgentOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Agent Chat Sidebar */}
      <AgentChatSidebar open={agentOpen} onClose={() => setAgentOpen(false)} />
    </div>
  );
}
