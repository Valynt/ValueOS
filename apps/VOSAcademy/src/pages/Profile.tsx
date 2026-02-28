import { Award, BookOpen, Briefcase, CheckCircle, Target, TrendingUp, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

import MaturityAssessment from "@/components/MaturityAssessment";
import { PageShell } from "@/components/PageShell";
import RoleMaturityTrack from "@/components/RoleMaturityTrack";
import { SectionCard } from "@/components/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { getCurriculumForRole, MATURITY_LEVELS } from "@/data/curriculum";
import { useAuth } from "@/hooks/useAuth";
import { useCurriculum, useProgress } from "@/hooks/useCurriculum";
import { trpc } from "@/lib/trpc";


export default function Profile() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { curriculum } = useCurriculum();
  const { progressStats, recommendedModules } = useProgress();

  const [selectedRole, setSelectedRole] = useState<string>(user?.vosRole || "");
  const [selectedLevel, setSelectedLevel] = useState<number>(user?.maturityLevel || 0);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showMaturityTrack, setShowMaturityTrack] = useState(false);

  const updateRoleMutation = trpc.user.updateVosRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated successfully!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    }
  });

  const updateMaturityMutation = trpc.user.updateMaturityLevel.useMutation({
    onSuccess: () => {
      toast.success("Maturity level updated successfully!");
      utils.auth.me.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to update maturity level: ${error.message}`);
    }
  });

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
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </PageShell>
    );
  }

  const handleRoleUpdate = () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }
    updateRoleMutation.mutate({ 
      vosRole: selectedRole as "Sales" | "CS" | "Marketing" | "Product" | "Executive" | "VE"
    });
  };

  const handleMaturityUpdate = () => {
    updateMaturityMutation.mutate({ level: selectedLevel });
  };

  const handleAssessmentComplete = (level: number, scores: Record<string, number>) => {
    setSelectedLevel(level);
    setShowAssessment(false);
    updateMaturityMutation.mutate({ level });
    toast.success(`Assessment complete! Your maturity level is L${level}`);
  };

  const roleDescriptions = {
    Sales: getCurriculumForRole('sales')?.description || "Focus on value discovery, business case development, and deal progression",
    CS: getCurriculumForRole('customer_success')?.description || "Emphasize value realization, expansion opportunities, and customer success metrics",
    Marketing: getCurriculumForRole('marketing')?.description || "Learn value messaging, campaign ROI, and market positioning",
    Product: getCurriculumForRole('product')?.description || "Master product-value alignment, feature prioritization, and roadmap planning",
    Executive: getCurriculumForRole('executive')?.description || "Develop strategic value leadership, culture building, and organizational transformation",
    VE: getCurriculumForRole('value_engineer')?.description || "Comprehensive value engineering across all lifecycle stages and functions"
  };

  const maturityLevels = Object.entries(MATURITY_LEVELS).map(([level, data]) => ({
    level: parseInt(level),
    label: data.label,
    description: data.description,
    color: `maturity-${level}`
  }));

  return (
    <PageShell maxWidthClassName="max-w-4xl">
      {/* Profile Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Profile</h1>
        <p className="text-muted-foreground">
          Manage your role, maturity level, and learning preferences
        </p>
      </div>

      <SectionCard
        title="Account Information"
        className="mb-6"
        header={
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
        }
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Name</Label>
            <p className="text-lg font-medium">{user?.name}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Email</Label>
            <p className="text-lg">{user?.email}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Account Type</Label>
            <Badge variant="secondary" className="mt-1">
              {user?.role === "admin" ? "Administrator" : "Learner"}
            </Badge>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Your VOS Role"
        description="Select your primary role to receive customized learning paths and content"
        className="mb-6"
        header={
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Your VOS Role
          </CardTitle>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-select">Role</Label>
            <Select 
              value={selectedRole} 
              onValueChange={setSelectedRole}
            >
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="CS">Customer Success</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Executive">Executive Leadership</SelectItem>
                <SelectItem value="VE">Value Engineering</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {selectedRole && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {roleDescriptions[selectedRole as keyof typeof roleDescriptions]}
              </p>
            </div>
          )}

          <Button 
            onClick={handleRoleUpdate}
            disabled={updateRoleMutation.isPending || !selectedRole || selectedRole === user?.vosRole}
          >
            {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
          </Button>
        </div>
      </SectionCard>

      {/* Maturity Assessment */}
      {showAssessment ? (
        <div className="mb-6">
          <MaturityAssessment onComplete={handleAssessmentComplete} />
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => setShowAssessment(false)}
          >
            Cancel Assessment
          </Button>
        </div>
      ) : (
        <SectionCard
          title="Take Maturity Assessment"
          description="Complete a comprehensive assessment to determine your VOS maturity level"
          className="mb-6"
          header={
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Take Maturity Assessment
            </CardTitle>
          }
        >
          <Button onClick={() => setShowAssessment(true)}>
            Start Assessment
          </Button>
        </SectionCard>
      )}

      <SectionCard
        title="VOS Maturity Level"
        description="Assess your current maturity level to track your progression"
        className="mb-6"
        header={
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            VOS Maturity Level
          </CardTitle>
        }
      >
        <div className="space-y-6">
          {/* Current Status Overview */}
          {progressStats && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Learning Progress
                </h4>
                <Badge variant="secondary">
                  {progressStats.completionPercentage}% Complete
                </Badge>
              </div>
              <Progress value={progressStats.completionPercentage} className="mb-3" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-medium text-lg">{progressStats.totalModules}</div>
                  <div className="text-muted-foreground">Total Modules</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-lg text-green-600">{progressStats.completedModules}</div>
                  <div className="text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="font-medium text-lg text-blue-600">{progressStats.inProgressModules}</div>
                  <div className="text-muted-foreground">In Progress</div>
                </div>
              </div>
            </div>
          )}

          {/* Role-Specific Curriculum Info */}
          {curriculum && (
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium mb-1">{curriculum.displayName} Curriculum</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    {curriculum.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {curriculum.pillars.map(pillar => (
                      <Badge key={pillar.pillarId} variant="outline" className="text-xs">
                        {pillar.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Maturity Level Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maturity-select">Current Maturity Level</Label>
              <Select 
                value={selectedLevel.toString()} 
                onValueChange={(val) => setSelectedLevel(parseInt(val))}
              >
                <SelectTrigger id="maturity-select">
                  <SelectValue placeholder="Select your maturity level" />
                </SelectTrigger>
                <SelectContent>
                  {maturityLevels.map((level) => (
                    <SelectItem key={level.level} value={level.level.toString()}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {maturityLevels.map((level) => (
                <div 
                  key={level.level}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedLevel === level.level 
                      ? 'border-primary bg-primary/5' 
                      : 'border-transparent bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`h-8 w-8 rounded-full ${level.color} flex items-center justify-center font-bold text-sm`}>
                      L{level.level}
                    </div>
                    <div className="font-semibold">{level.label}</div>
                  </div>
                  <p className="text-sm text-muted-foreground ml-11">
                    {level.description}
                  </p>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleMaturityUpdate}
              disabled={updateMaturityMutation.isPending || selectedLevel === user?.maturityLevel}
            >
              {updateMaturityMutation.isPending ? "Updating..." : "Update Maturity Level"}
            </Button>
          </div>
        </div>
      </SectionCard>

      {user?.vosRole && (
        <div className="mb-6">
          <RoleMaturityTrack 
            role={user.vosRole} 
            currentLevel={user.maturityLevel} 
          />
        </div>
      )}

      <SectionCard
        title="Your Certifications"
        description="Track your VOS certification progress"
      >
        <div className="text-center py-8 text-muted-foreground">
          <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No certifications earned yet</p>
          <p className="text-sm mt-2">Complete pillar quizzes to earn certifications</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4">
              Start Learning
            </Button>
          </Link>
        </div>
      </SectionCard>
    </PageShell>
  );
}
