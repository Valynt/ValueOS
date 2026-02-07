import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/PageShell";
import { SectionCard } from "@/components/SectionCard";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import AgenticTutor from "./AgenticTutor";

export default function AITutor() {
  const { user, loading, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (loading) {
    return (
      <PageShell container={false} mainClassName="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI Tutor...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClassName="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Tutor</h1>
        <p className="text-muted-foreground">
          Your agentic learning companion for mastering the Value Operating System
        </p>
      </div>

      <SectionCard className="rounded-xl border border-border/50 overflow-hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Agentic Tutor Online</span>
            </div>
            <h2 className="text-2xl font-semibold mt-2">Personalized VOS Guidance</h2>
            <p className="text-muted-foreground">
              Ask questions, get explanations, and receive tailored recommendations based on your maturity level and role.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              Role: {user?.vosRole || "Learner"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Maturity: L{user?.maturityLevel || 0}
            </Badge>
          </div>
        </div>

        <AgenticTutor context={{
          role: user?.vosRole || undefined,
          maturityLevel: user?.maturityLevel
        }} />
      </SectionCard>
    </PageShell>
  );
}
