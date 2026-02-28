import { CheckCircle2, Clock, Loader2, Target, TrendingUp, Trophy, XCircle } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { KpiCard } from "@/components/KpiCard";
import { PageShell } from "@/components/PageShell";
import { RecommendationsCard } from "@/components/RecommendationsCard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";


export function SimulationProgress() {
  const { data: analytics, isLoading } = trpc.simulations.getAnalytics.useQuery();

  if (isLoading) {
    return (
      <PageShell container={false} mainClassName="flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </PageShell>
    );
  }

  if (!analytics || analytics.overview.totalAttempts === 0) {
    return (
      <PageShell>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Simulation Progress</h1>
          <p className="text-muted-foreground">Track your simulation performance and improvement over time</p>
        </div>

        <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Simulation Attempts Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Complete your first simulation to start tracking your progress and see detailed analytics.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const radarData = [
    { category: "Technical", score: analytics.categoryAverages.technical, fullMark: 100 },
    { category: "Cross-Functional", score: analytics.categoryAverages.crossFunctional, fullMark: 100 },
    { category: "AI Augmentation", score: analytics.categoryAverages.aiAugmentation, fullMark: 100 }
  ];

  const lineChartData = analytics.scoreTrend.map((item, index) => ({
    name: `Attempt ${index + 1}`,
    score: item.score,
    date: new Date(item.completedAt).toLocaleDateString()
  }));

  return (
    <PageShell>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold">Simulation Progress</h1>
            <p className="text-muted-foreground">Track your performance and improvement over time</p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <RecommendationsCard />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <KpiCard label="Total Attempts" value={analytics.overview.totalAttempts} icon={Target} />
        <KpiCard label="Average Score" value={`${analytics.overview.avgScore}/100`} icon={TrendingUp} />
        <KpiCard label="Best Score" value={`${analytics.overview.bestScore}/100`} icon={Trophy} />
        <KpiCard label="Pass Rate" value={`${analytics.overview.completionRate}%`} icon={CheckCircle2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
          <CardHeader>
            <CardTitle>Score Trend</CardTitle>
            <CardDescription>Your performance over the last 10 attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
          <CardHeader>
            <CardTitle>Category Averages</CardTitle>
            <CardDescription>Performance across capability areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score" dataKey="score" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.4} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg mb-8">
        <CardHeader>
          <CardTitle>Scenario Performance</CardTitle>
          <CardDescription>Time spent and completion results</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-3">Scenario</th>
                <th className="pb-3">Attempts</th>
                <th className="pb-3">Avg Score</th>
                <th className="pb-3">Best Score</th>
                <th className="pb-3">Avg Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {analytics.scenarioStats.map((stat: any) => (
                <tr key={stat.scenarioId} className="hover:bg-muted/50">
                  <td className="py-3">{stat.scenarioTitle}</td>
                  <td className="py-3">{stat.attempts}</td>
                  <td className="py-3">{stat.avgScore}/100</td>
                  <td className="py-3">{stat.bestScore}/100</td>
                  <td className="py-3">{stat.avgDuration}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
        <CardHeader>
          <CardTitle>Recent Attempts</CardTitle>
          <CardDescription>Your latest simulation submissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {analytics.recentAttempts.map((attempt: any, index: number) => (
            <div key={index} className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Attempt {attempt.attemptNumber}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-4 w-4" />
                    {attempt.duration}s
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{attempt.overallScore}/100</span>
                  {attempt.passed ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-4 w-4" />
                      Passed
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <XCircle className="h-4 w-4" />
                      Not Passed
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground block">Technical</span>
                  {attempt.categoryScores.technical}
                </div>
                <div>
                  <span className="font-medium text-foreground block">Cross-Functional</span>
                  {attempt.categoryScores.crossFunctional}
                </div>
                <div>
                  <span className="font-medium text-foreground block">AI Augmentation</span>
                  {attempt.categoryScores.aiAugmentation}
                </div>
              </div>
              <div className="mt-3 text-sm">
                <span className="font-medium text-foreground">AI Feedback:</span>{" "}
                <span className="text-muted-foreground">{attempt.feedback}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
