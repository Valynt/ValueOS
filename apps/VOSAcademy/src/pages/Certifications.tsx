import { useAuth } from "@/hooks/useAuth";
import { SidebarLayout } from "@/components/SidebarLayout";
import CertificationDisplay from "@/components/CertificationDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Award, Download, Share2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Certifications() {
  const { user, loading: authLoading } = useAuth();
  
  const { data: certifications, isLoading } = trpc.certifications.getUserCertifications.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (authLoading || isLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-background">
          <div className="container py-8">
            <Skeleton className="h-12 w-64 mb-8" />
            <div className="grid gap-6">
              <Skeleton className="h-48" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  if (!user) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="max-w-md bg-card text-card-foreground shadow-beautiful-md rounded-lg">
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>Please log in to view your certifications</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  const handleDownloadCertificate = (certId: number) => {
    toast.info("Certificate download feature coming soon!");
    // TODO: Implement PDF certificate generation
  };

  const handleShareCertificate = (certId: number) => {
    const cert = certifications?.find(c => c?.id === certId);
    if (!cert) return;

    const text = `I just earned the ${cert.tier} certification for ${cert.pillarTitle} on VOS Academy! 🚀 #VOSAcademy #ProfessionalDevelopment`;
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="vos-gradient text-white py-12">
        <div className="container">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                <Award className="h-10 w-10" />
                My Certifications
              </h1>
              <p className="text-teal-100 text-lg">
                Track your VOS mastery and showcase your achievements
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-8 flex-1">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <CertificationDisplay
              certifications={(certifications || []).filter((cert): cert is NonNullable<typeof cert> & { id: number; pillarNumber: number; score: number; tier: "bronze" | "silver" | "gold"; pillarTitle: string; earnedAt: string; expiresAt: any } =>
                cert != null && typeof cert.id === 'number'
              ).map(cert => ({
                ...cert,
                earnedAt: new Date(cert.earnedAt),
                expiresAt: cert.expiresAt ? new Date(cert.expiresAt) : null
              }))}
              totalPillars={10}
              onShare={handleShareCertificate}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => toast.info("Feature coming soon!")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download All Certificates
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => {
                    const text = "I'm leveling up my skills with VOS Academy! 🚀 #VOSAcademy #ValueSelling";
                    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share on LinkedIn
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline" className="w-full justify-start">
                    <Award className="h-4 w-4 mr-2" />
                    Continue Learning
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Next Steps</CardTitle>
                <CardDescription>Earn more certifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {certifications && certifications.length < 10 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Complete {10 - certifications.length} more pillar{10 - certifications.length !== 1 ? 's' : ''} to achieve full VOS mastery!
                    </p>
                    <Link href="/dashboard">
                      <Button className="w-full">
                        View Available Pillars
                      </Button>
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <Award className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
                    <p className="font-semibold text-teal-600">Congratulations!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've completed all VOS pillars
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Certification Benefits */}
            <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">Certification Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 mt-0.5">✓</span>
                    <span>Demonstrate VOS expertise to employers and clients</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 mt-0.5">✓</span>
                    <span>Access exclusive advanced content and resources</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 mt-0.5">✓</span>
                    <span>Join the VOS certified professionals community</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-teal-600 mt-0.5">✓</span>
                    <span>Shareable digital badges for LinkedIn and resume</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </SidebarLayout>
  );
}
