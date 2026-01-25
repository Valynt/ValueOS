import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/PageShell";
import { SectionCard } from "@/components/SectionCard";
import { KpiCard } from "@/components/KpiCard";
import { RecommendationsCard } from "@/components/RecommendationsCard";
import { SidebarLayout } from "@/components/SidebarLayout";
import { getLoginUrl } from "@/data/const";
import { useCurriculum, useProgress } from "@/hooks/useCurriculum";
import { getPillarStatus } from "@/lib/progress-logic";
import {
  BookOpen,
  TrendingUp,
  Award,
  Brain,
  Target,
  Users,
  Lightbulb,
  RefreshCw,
  Rocket,
  Crown,
  Lock,
  CheckCircle
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user, loading, isAuthenticated } = useAuth();
  const { curriculum, isLoading: curriculumLoading } = useCurriculum();
  const { progressStats, recommendedModules, completedModules, inProgressModules } = useProgress();

  // Fetch all pillars based on curriculum
  const pillars = useMemo(() => {
    if (!curriculum) return [];

    return curriculum.pillars.map(pillar => ({
      id: pillar.pillarId,
      pillarNumber: pillar.pillarId,
      title: pillar.title,
      description: pillar.description,
      targetMaturityLevel: pillar.targetMaturityLevel,
      duration: "Varies" // TODO: Calculate actual duration from modules
    }));
  }, [curriculum]);

  const pillarsLoading = false;

  // Redirect to login if not authenticated
  if (!loading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (loading || pillarsLoading || curriculumLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your learning dashboard...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  const pillarIcons = [
    BookOpen,    // 1: Unified Value Language
    Target,      // 2: Value Data Model Mastery
    Lightbulb,   // 3: Discovery Excellence
    TrendingUp,  // 4: Business Case Development
    RefreshCw,   // 5: Lifecycle Handoffs & Governance
    Award,       // 6: Realization Tracking & Value Proof
    Rocket,      // 7: Expansion & Benchmarking Strategy
    Users,       // 8: Cross-Functional Collaboration Patterns
    Brain,       // 9: AI-Augmented Value Workflows
    Crown        // 10: Leadership & Culture of Value
  ];

  // Get curriculum-driven pillar access
  const getPillarAccess = (pillarId: number) => {
    if (!curriculum || !user?.vosRole) return { canAccess: true, status: 'available' as const };

    const status = getPillarStatus(
      pillarId,
      user.vosRole,
      user.maturityLevel || 0,
      completedModules,
      inProgressModules
    );

    return {
      canAccess: status.status !== 'locked',
      status: status.status
    };
  };

  const getMaturityLevelColor = (level: number) => {
    if (level <= 0) return "maturity-0";
    if (level === 1) return "maturity-1";
    if (level === 2) return "maturity-2";
    if (level === 3) return "maturity-3";
    if (level === 4) return "maturity-4";
    return "maturity-5";
  };

  const getMaturityLevelLabel = (level: number) => {
    const labels = [
      "L0: Value Chaos",
      "L1: Ad-hoc/Manual",
      "L2: Performance Measurement",
      "L3: Managed/Optimizing",
      "L4: Predictive Analytics",
      "L5: Value Orchestration"
    ];
    return labels[level] || "Unknown";
  }

  return (
    <PageShell>
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.name}!</h1>
        <p className="text-muted-foreground">
          Continue your Value Operating System learning journey
        </p>
      </div>

      {/* AI Recommendations */}
      <div className="mb-8">
        <RecommendationsCard />
      </div>

      {/* Maturity Level */}
      <SectionCard
        title="Your VOS Maturity Level"
        description="Track your progression through the six levels of value operating maturity"
        className="mb-8"
      >
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <KpiCard label="Current Level" value={`L${user?.maturityLevel || 0}`} icon={Target} />
          <KpiCard label="Progress" value={`${(user?.maturityLevel || 0) * 20}%`} icon={TrendingUp} />
          <KpiCard label="Role" value={user?.vosRole || "Not set"} icon={Users} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-lg mb-1">
            {getMaturityLevelLabel(user?.maturityLevel || 0)}
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div className="bg-primary h-2 rounded-full" style={{ width: `${(user?.maturityLevel || 0) * 20}%` }}></div>
          </div>
        </div>
        {!user?.vosRole && (
          <div className="mt-4">
            <Link href="/profile" className="inline-flex items-center px-4 py-2 border border-input bg-background text-foreground shadow-sm rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              Select Your Role
            </Link>
          </div>
        )}
      </SectionCard>

      {/* Pillars Grid */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">
          {curriculum ? `${curriculum.displayName} Learning Path` : 'VOS Pillars'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {curriculum
            ? `Master the pillars most relevant to your ${curriculum.displayName.toLowerCase()} role`
            : 'Master each pillar to advance your value engineering capabilities'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pillars?.map((pillar, index) => {
          const Icon = pillarIcons[index] || BookOpen;
          const access = getPillarAccess(pillar.pillarNumber);

          return (
            <div
              key={pillar.id}
              className={`bg-card text-card-foreground shadow-beautiful-md rounded-lg transition-all duration-300 hover:-translate-y-1 ${
                !access.canAccess ? 'opacity-60' : 'hover:shadow-beautiful-lg'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shadow-beautiful-sm">
                    {access.canAccess ? (
                      <Icon className="h-6 w-6 text-primary" />
                    ) : (
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded-md border border-border text-xs font-medium bg-background text-foreground">
                    Pillar {pillar.pillarNumber}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {pillar.description}
                </p>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Target Level:</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium">
                      L{pillar.targetMaturityLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-medium">{pillar.duration}</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    {access.canAccess ? (
                      <>
                        <Link href={`/pillar/${pillar.pillarNumber}`} className="inline-flex items-center justify-center px-3 py-2 border border-input bg-background text-foreground shadow-sm rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 text-sm font-medium">
                          Learn
                        </Link>
                        <Link href={`/quiz/${pillar.pillarNumber}`} className="inline-flex items-center justify-center px-3 py-2 bg-primary text-primary-foreground shadow-sm rounded-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1 text-sm font-medium shadow-light-blue-sm">
                          Take Quiz
                        </Link>
                      </>
                    ) : (
                      <button disabled className="inline-flex items-center justify-center px-3 py-2 border border-input bg-background text-muted-foreground shadow-sm rounded-md cursor-not-allowed flex-1 text-sm font-medium">
                        Locked - Complete Prerequisites
                      </button>
                    )}
                  </div>
                </div>
                </div>
              </div>
          );
        })}
      </div>
    </PageShell>
  );
}
