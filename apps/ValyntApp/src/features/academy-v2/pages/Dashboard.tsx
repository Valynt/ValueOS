import {
  Award,
  BookOpen,
  Brain,
  CheckCircle,
  Crown,
  Lightbulb,
  Lock,
  Rocket,
  Target,
  TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function Dashboard() {
  // Mock data - replace with real data from backend
  const progressStats = {
    completedModules: 12,
    totalModules: 48,
    currentStreak: 7,
    totalPoints: 2450,
    certificates: 2,
    nextMilestone: "VOS Practitioner"
  };

  const recommendedModules = [
    {
      id: 1,
      title: "VOS Core Principles",
      description: "Master the fundamental concepts of the Value Operating System",
      duration: "2 hours",
      difficulty: "Beginner",
      progress: 75
    },
    {
      id: 2,
      title: "Advanced Value Mapping",
      description: "Learn to create sophisticated value maps for complex scenarios",
      duration: "4 hours",
      difficulty: "Advanced",
      progress: 30
    },
    {
      id: 3,
      title: "VOS in Enterprise",
      description: "Apply VOS principles at scale in large organizations",
      duration: "6 hours",
      difficulty: "Intermediate",
      progress: 0
    }
  ];

  const pillars = [
    {
      id: 1,
      pillarNumber: 1,
      title: "Value Discovery",
      description: "Identify and articulate value in any context",
      targetMaturityLevel: 3,
      duration: "8 hours",
      progress: 60,
      locked: false
    },
    {
      id: 2,
      pillarNumber: 2,
      title: "Value Creation",
      description: "Design and implement value-generating solutions",
      targetMaturityLevel: 3,
      duration: "10 hours",
      progress: 40,
      locked: false
    },
    {
      id: 3,
      pillarNumber: 3,
      title: "Value Capture",
      description: "Measure and optimize value realization",
      targetMaturityLevel: 3,
      duration: "6 hours",
      progress: 20,
      locked: false
    },
    {
      id: 4,
      pillarNumber: 4,
      title: "Value Distribution",
      description: "Fairly allocate and communicate value across stakeholders",
      targetMaturityLevel: 3,
      duration: "8 hours",
      progress: 0,
      locked: true
    }
  ];

  const completionPercentage = Math.round((progressStats.completedModules / progressStats.totalModules) * 100);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Academy Dashboard</h1>
          <p className="text-muted-foreground">Track your learning progress and continue your VOS journey</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completionPercentage}%</div>
              <p className="text-xs text-muted-foreground">
                {progressStats.completedModules} of {progressStats.totalModules} modules
              </p>
              <Progress value={completionPercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressStats.currentStreak} days</div>
              <p className="text-xs text-muted-foreground">Keep it up!</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressStats.totalPoints.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Level 12</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Certificates</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progressStats.certificates}</div>
              <p className="text-xs text-muted-foreground">Next: {progressStats.nextMilestone}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recommended Modules */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Recommended for You
                </CardTitle>
                <CardDescription>Personalized learning path based on your progress</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {recommendedModules.map((module) => (
                  <div key={module.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface">
                    <div className="flex-1">
                      <h3 className="font-semibold">{module.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{module.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {module.duration}
                        </span>
                        <Badge variant={module.difficulty === 'Beginner' ? 'default' :
                          module.difficulty === 'Advanced' ? 'destructive' : 'secondary'}>
                          {module.difficulty}
                        </Badge>
                      </div>
                      {module.progress > 0 && (
                        <div className="mt-2">
                          <Progress value={module.progress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">{module.progress}% complete</p>
                        </div>
                      )}
                    </div>
                    <Button asChild>
                      <Link to={`/academy/module/${module.id}`}>
                        {module.progress > 0 ? 'Continue' : 'Start'}
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/academy/ai-tutor">
                    <Brain className="mr-2 h-4 w-4" />
                    AI Tutor
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/academy/simulations">
                    <Target className="mr-2 h-4 w-4" />
                    Simulations
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/academy/certifications">
                    <Award className="mr-2 h-4 w-4" />
                    Certifications
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/academy/analytics">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Pillars Progress */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              VOS Pillars Progress
            </CardTitle>
            <CardDescription>Master each pillar to achieve VOS expertise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((pillar) => (
                <div key={pillar.id} className="relative">
                  <Card className={pillar.locked ? 'opacity-50' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">Pillar {pillar.pillarNumber}</Badge>
                        {pillar.locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <CardTitle className="text-lg">{pillar.title}</CardTitle>
                      <CardDescription>{pillar.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{pillar.progress}%</span>
                        </div>
                        <Progress value={pillar.progress} />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{pillar.duration}</span>
                          <span>Level {pillar.targetMaturityLevel}</span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={pillar.locked}
                          asChild={!pillar.locked}
                        >
                          {!pillar.locked ? (
                            <Link to={`/academy/pillar/${pillar.pillarNumber}`}>
                              {pillar.progress > 0 ? 'Continue' : 'Start'}
                            </Link>
                          ) : (
                            'Locked'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
