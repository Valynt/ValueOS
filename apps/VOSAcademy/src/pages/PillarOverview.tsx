import { useAuth } from "@/hooks/useAuth";
import { PageShell } from "@/components/PageShell";
import { SectionCard } from "@/components/SectionCard";
import PillarModule from "@/components/PillarModule";
import PillarProgressVisualization from "@/components/PillarProgressVisualization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_LOGO, APP_TITLE } from "@/const";
import { ArrowLeft, BookOpen, Download, CheckCircle2, Clock, Target, Lock } from "lucide-react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useCurriculum, useProgress } from "@/hooks/useCurriculum";
import { getCurriculumForRole, CurriculumModule } from "@/data/curriculum";
import { getModuleStatus } from "@/lib/progress-logic";
import { downloadFile } from "@/lib/download";

type PillarResource = {
  id?: number | string;
  title?: string;
  description?: string;
  resourceType?: string;
  fileUrl?: string;
};

export default function PillarOverview() {
  const { user } = useAuth();
  const params = useParams<{ pillarNumber: string }>();
  const pillarNumber = parseInt(params.pillarNumber || "1");

  const { curriculum } = useCurriculum();
  const { progressStats, completedModules, inProgressModules } = useProgress();

  const { data: pillar, isLoading } = trpc.pillars.getByNumber.useQuery({ pillarNumber });

  // Get curriculum pillar data
  const curriculumPillar = curriculum?.pillars.find(p => p.pillarId === pillarNumber);
  const pillarModules = curriculumPillar?.modules || [];

  // Get user's access to this pillar
  const userRole = user?.vosRole || '';
  const userMaturityLevel = user?.maturityLevel || 0;
  const pillarStatus = curriculumPillar ?
    (userMaturityLevel >= curriculumPillar.targetMaturityLevel ? 'available' : 'locked') :
    'available';

  const handleStartModule = (moduleId: string) => {
    // TODO: Implement module start logic
    console.log('Starting module:', moduleId);
  };

  const handleCompleteModule = (moduleId: string) => {
    // TODO: Implement module completion logic
    console.log('Completing module:', moduleId);
  };

  const handleDownloadResource = async (resource: PillarResource) => {
    if (!resource.fileUrl) {
      console.log('Download requested for:', resource.title);
      return;
    }

    // Determine filename from URL or title
    const filename = resource.fileUrl.split('/').pop() || resource.title || 'download';

    try {
      // If it's a relative path, use downloadFile to force download
      if (resource.fileUrl.startsWith('/')) {
        await downloadFile(resource.fileUrl, filename);
      } else {
        // For external URLs, try downloadFile first, fallback to window.open
        try {
          // Attempt to download if CORS allows
          await downloadFile(resource.fileUrl, filename);
        } catch {
          // Fallback to opening in new tab
          window.open(resource.fileUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Download failed:', error);
      // Final fallback
      window.open(resource.fileUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <PageShell container={false} mainClassName="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading pillar content...</p>
        </div>
      </PageShell>
    );
  }

  if (!pillar) {
    return (
      <PageShell container={false} mainClassName="flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Pillar Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested pillar could not be found.</p>
          <Link href="/dashboard" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
            Back to Dashboard
          </Link>
        </div>
      </PageShell>
    );
  }

  const content = typeof pillar.content === 'string' ? JSON.parse(pillar.content) : pillar.content;
  const resources = (content?.resources || []) as PillarResource[];

  return (
    <PageShell maxWidthClassName="max-w-5xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="secondary">
                Pillar {pillar.pillarNumber}
              </Badge>
              {pillarStatus === 'locked' && (
                <Badge variant="outline" className="text-muted-foreground">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold mb-2">{pillar.title}</h1>
            <p className="text-xl text-muted-foreground">{pillar.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{pillar.duration}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span>Target Level: L{pillar.targetMaturityLevel}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span>{pillarModules.length} Module{pillarModules.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {pillarStatus === 'locked' && (
        <SectionCard
          title="Content Locked"
          className="mb-6 border-amber-200 bg-amber-50"
        >
          <div className="text-center py-8">
            <Lock className="h-16 w-16 text-amber-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Pillar Access Restricted</h3>
            <p className="text-muted-foreground mb-4">
              This pillar requires maturity level {curriculumPillar?.targetMaturityLevel}.
              Your current level is L{userMaturityLevel}.
            </p>
            <p className="text-sm text-muted-foreground">
              Complete modules from earlier pillars to unlock this content.
            </p>
          </div>
        </SectionCard>
      )}

      {pillarStatus !== 'locked' && pillarModules.length > 0 && (
        <div className="space-y-6 mb-8">
          <SectionCard title="Learning Modules" description="Complete these modules to master this pillar">
            <div className="space-y-4">
              {pillarModules.map((module) => {
                const status = getModuleStatus(
                  module,
                  userMaturityLevel,
                  completedModules,
                  inProgressModules
                );

                return (
                  <PillarModule
                    key={module.id}
                    module={module}
                    status={status}
                    userMaturityLevel={userMaturityLevel}
                    onStartModule={handleStartModule}
                    onCompleteModule={handleCompleteModule}
                  />
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Progress Visualization */}
      {pillarStatus !== 'locked' && pillarModules.length > 0 && (
        <PillarProgressVisualization
          pillarTitle={pillar.title}
          pillarNumber={pillarNumber}
          modules={pillarModules}
          completedModules={completedModules}
          inProgressModules={inProgressModules}
          userMaturityLevel={userMaturityLevel}
          targetMaturityLevel={curriculumPillar?.targetMaturityLevel || pillar.targetMaturityLevel}
        />
      )}

      {/* Legacy content sections - shown if no modules or as fallback */}
      {(pillarModules.length === 0 || pillarStatus === 'locked') && (
        <>
          {content?.learningObjectives && content.learningObjectives.length > 0 && (
            <SectionCard
              title="Learning Objectives"
              description="What you'll master in this pillar"
              className="mb-6"
            >
              <ul className="space-y-2">
                {content.learningObjectives.map((objective: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {content?.topics && content.topics.length > 0 && (
            <SectionCard
              title="Topics Covered"
              description="Core concepts and frameworks"
              className="mb-6"
            >
              <div className="grid gap-4">
                {content.topics.map((topic: string, index: number) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{topic}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {content?.keyTakeaways && content.keyTakeaways.length > 0 && (
            <SectionCard
              title="Key Takeaways"
              description="Essential insights to remember"
              className="mb-6"
            >
              <ul className="space-y-2">
                {content.keyTakeaways.map((takeaway: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </>
      )}

      {resources && resources.length > 0 && (
        <SectionCard
          title="Downloadable Resources"
          description="Templates, guides, and tools for this pillar"
          className="mb-6"
        >
          <div className="grid gap-3">
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => handleDownloadResource(resource)}
              >
                <div className="flex items-center gap-3">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{resource.title}</p>
                    {resource.description && (
                      <p className="text-sm text-muted-foreground">{resource.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{resource.resourceType}</Badge>
                  <span className="text-xs text-muted-foreground">Click to download</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex gap-4">
        <Link href={`/quiz/${pillar.pillarNumber}`} className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8">
          Take Quiz
        </Link>
        <Link href="/dashboard" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8">
          Back to Dashboard
        </Link>
      </div>
    </PageShell>
  );
}
