import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Award, BarChart3, BookOpen, Calendar, Download, Filter, Target, TrendingUp, Users } from 'lucide-react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { trpc } from '@/lib/trpc';
import { KnowledgeGainReport } from '@/lib/knowledge-gain';

// Analytics data types
interface UserStats {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  averageMaturityLevel: number;
}

interface QuizStats {
  totalQuizzes: number;
  averageScore: number;
  passRate: number;
  completionRate: number;
  pillarBreakdown: Array<{
    pillarId: number;
    pillarName: string;
    attempts: number;
    averageScore: number;
    passRate: number;
  }>;
}

interface CertificationStats {
  totalCertifications: number;
  bronzeCount: number;
  silverCount: number;
  goldCount: number;
  roleBreakdown: Array<{
    role: string;
    count: number;
  }>;
}

interface SimulationStats {
  totalAttempts: number;
  averageScore: number;
  completionRate: number;
  scenarioBreakdown: Array<{
    scenarioId: number;
    scenarioName: string;
    attempts: number;
    averageScore: number;
  }>;
}

interface LeaderboardEntry {
  userId: number;
  userName: string;
  totalScore: number;
  certifications: number;
  maturityLevel: number;
  lastActive: Date;
}

interface TeamStats {
  teamId: number;
  teamName: string;
  memberCount: number;
  avgMaturity: number;
  totalCertifications: number;
  avgQuizScore: number;
  completionRate: number;
  topPerformers: string[];
}

interface LeaderboardData {
  type: 'overall' | 'certifications' | 'pillars';
  entries: LeaderboardEntry[];
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardData['type']>('overall');

  // Fetch analytics data
  const { data: userStats, isLoading: userStatsLoading } = useQuery({
    queryKey: ['analytics', 'users', dateRange],
    queryFn: async () => {
      // This would call a tRPC endpoint for user analytics
      return {
        totalUsers: 1250,
        activeUsers: 890,
        newUsersThisMonth: 45,
        averageMaturityLevel: 2.3
      } as UserStats;
    }
  });

  const { data: quizStats, isLoading: quizStatsLoading } = useQuery({
    queryKey: ['analytics', 'quizzes', dateRange],
    queryFn: async () => {
      return {
        totalQuizzes: 3420,
        averageScore: 78.5,
        passRate: 85.2,
        completionRate: 92.1,
        pillarBreakdown: [
          { pillarId: 1, pillarName: 'Unified Value Language', attempts: 1250, averageScore: 82.3, passRate: 91.5 },
          { pillarId: 2, pillarName: 'Value Data Model', attempts: 980, averageScore: 75.8, passRate: 83.2 },
          { pillarId: 3, pillarName: 'Discovery Excellence', attempts: 890, averageScore: 79.1, passRate: 87.4 },
          { pillarId: 4, pillarName: 'Business Case Development', attempts: 765, averageScore: 76.9, passRate: 84.7 },
          { pillarId: 5, pillarName: 'Lifecycle Handoffs', attempts: 635, averageScore: 74.2, passRate: 81.9 }
        ]
      } as QuizStats;
    }
  });

  const { data: certificationStats, isLoading: certStatsLoading } = useQuery({
    queryKey: ['analytics', 'certifications', dateRange],
    queryFn: async () => {
      return {
        totalCertifications: 2150,
        bronzeCount: 1200,
        silverCount: 650,
        goldCount: 300,
        roleBreakdown: [
          { role: 'Sales', count: 580 },
          { role: 'Customer Success', count: 420 },
          { role: 'Marketing', count: 380 },
          { role: 'Product', count: 290 },
          { role: 'Executive', count: 180 },
          { role: 'Value Engineer', count: 300 }
        ]
      } as CertificationStats;
    }
  });

  const { data: simulationStats, isLoading: simStatsLoading } = useQuery({
    queryKey: ['analytics', 'simulations', dateRange],
    queryFn: async () => {
      return {
        totalAttempts: 1850,
        averageScore: 72.3,
        completionRate: 78.9,
        scenarioBreakdown: [
          { scenarioId: 1, scenarioName: 'Value Discovery Session', attempts: 950, averageScore: 75.2 },
          { scenarioId: 2, scenarioName: 'Business Case Development', attempts: 520, averageScore: 68.9 },
          { scenarioId: 3, scenarioName: 'QBR Expansion Modeling', attempts: 380, averageScore: 73.1 }
        ]
      } as SimulationStats;
    }
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['analytics', 'leaderboard', dateRange],
    queryFn: async () => {
      const entries: LeaderboardEntry[] = [
        { userId: 1, userName: 'Sarah Chen', totalScore: 2850, certifications: 8, maturityLevel: 4, lastActive: new Date('2024-12-04') },
        { userId: 2, userName: 'Mike Johnson', totalScore: 2720, certifications: 7, maturityLevel: 4, lastActive: new Date('2024-12-03') },
        { userId: 3, userName: 'Alex Rodriguez', totalScore: 2680, certifications: 6, maturityLevel: 3, lastActive: new Date('2024-12-04') },
        { userId: 4, userName: 'Emma Davis', totalScore: 2590, certifications: 7, maturityLevel: 3, lastActive: new Date('2024-12-02') },
        { userId: 5, userName: 'David Kim', totalScore: 2470, certifications: 5, maturityLevel: 4, lastActive: new Date('2024-12-01') }
      ];

      return {
        type: 'overall' as const,
        entries
      };
    }
  });

  const { data: teamStats } = useQuery({
    queryKey: ['analytics', 'teams', dateRange],
    queryFn: async (): Promise<TeamStats[]> => {
      return [
        { teamId: 1, teamName: 'Enterprise Sales', memberCount: 24, avgMaturity: 3.2, totalCertifications: 56, avgQuizScore: 82, completionRate: 87, topPerformers: ['Sarah Chen', 'Mike Johnson', 'Alex Rodriguez'] },
        { teamId: 2, teamName: 'Customer Success', memberCount: 18, avgMaturity: 2.8, totalCertifications: 42, avgQuizScore: 78, completionRate: 81, topPerformers: ['Emma Davis', 'David Kim'] },
        { teamId: 3, teamName: 'Marketing', memberCount: 15, avgMaturity: 2.4, totalCertifications: 28, avgQuizScore: 75, completionRate: 76, topPerformers: ['Lisa Wang', 'Tom Wilson'] },
        { teamId: 4, teamName: 'Product', memberCount: 12, avgMaturity: 3.5, totalCertifications: 32, avgQuizScore: 84, completionRate: 90, topPerformers: ['Maria Garcia', 'John Smith'] },
      ];
    }
  });

  const { data: knowledgeGain } = useQuery({
    queryKey: ['analytics', 'knowledge-gain', dateRange],
    queryFn: async (): Promise<KnowledgeGainReport> => {
      return {
        overall: {
          totalAssessments: 420,
          averageGain: 14,
          normalizedGain: 38,
          highPerformers: 68,
          lowPerformers: 24
        },
        trends: {
          monthly: [
            { month: 'Aug', averageGain: 10, totalAssessments: 80 },
            { month: 'Sep', averageGain: 12, totalAssessments: 85 },
            { month: 'Oct', averageGain: 14, totalAssessments: 90 },
            { month: 'Nov', averageGain: 15, totalAssessments: 82 },
            { month: 'Dec', averageGain: 17, totalAssessments: 83 },
          ]
        },
        byPillar: [
          { pillarId: 1, pillarName: 'Unified Value Language', averagePreScore: 62, averagePostScore: 78, averageGain: 16, normalizedGain: 42, totalAssessments: 140, highPerformers: 22, lowPerformers: 8 },
          { pillarId: 2, pillarName: 'Value Data Model', averagePreScore: 58, averagePostScore: 72, averageGain: 14, normalizedGain: 38, totalAssessments: 138, highPerformers: 19, lowPerformers: 10 },
          { pillarId: 3, pillarName: 'Discovery Excellence', averagePreScore: 60, averagePostScore: 80, averageGain: 20, normalizedGain: 50, totalAssessments: 142, highPerformers: 24, lowPerformers: 6 },
        ],
        byRole: [
          { role: 'Sales', averageGain: 15, normalizedGain: 40, totalUsers: 180, averageTimeSpent: 42, learningEfficiency: 21 },
          { role: 'Customer Success', averageGain: 13, normalizedGain: 35, totalUsers: 140, averageTimeSpent: 38, learningEfficiency: 20 },
          { role: 'Marketing', averageGain: 12, normalizedGain: 32, totalUsers: 110, averageTimeSpent: 30, learningEfficiency: 24 },
          { role: 'Product', averageGain: 16, normalizedGain: 45, totalUsers: 95, averageTimeSpent: 44, learningEfficiency: 22 },
        ]
      };
    }
  });

  const exportAnalytics = () => {
    // Export functionality would be implemented here
    console.log('Exporting analytics data...');
  };

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="h-8 w-8 text-primary" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive insights into learning platform performance and user progress
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Select value={dateRange} onValueChange={(value: '7d' | '30d' | '90d' | 'all') => setDateRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="customer_success">Customer Success</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="value_engineer">Value Engineer</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={exportAnalytics} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats?.totalUsers.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  +{userStats?.newUsersThisMonth || 0} new this month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userStats?.activeUsers.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {userStats ? Math.round((userStats.activeUsers / userStats.totalUsers) * 100) : 0}% of total users
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Quiz Pass Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{quizStats?.passRate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {quizStats?.totalQuizzes.toLocaleString() || 0} total attempts
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Certifications</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{certificationStats?.totalCertifications.toLocaleString() || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {certificationStats?.goldCount || 0} Gold tier
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
              <TabsTrigger value="certifications">Certifications</TabsTrigger>
              <TabsTrigger value="simulations">Simulations</TabsTrigger>
              <TabsTrigger value="knowledge-gain">Knowledge Gain</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Growth Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Growth Trend</CardTitle>
                    <CardDescription>Monthly active users over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={[
                        { month: 'Aug', users: 650 },
                        { month: 'Sep', users: 780 },
                        { month: 'Oct', users: 920 },
                        { month: 'Nov', users: 1100 },
                        { month: 'Dec', users: 1250 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Maturity Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle>Maturity Level Distribution</CardTitle>
                    <CardDescription>Current maturity levels across all users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Level 0', value: 180, fill: '#ef4444' },
                            { name: 'Level 1', value: 320, fill: '#f97316' },
                            { name: 'Level 2', value: 450, fill: '#eab308' },
                            { name: 'Level 3', value: 220, fill: '#22c55e' },
                            { name: 'Level 4', value: 80, fill: '#06b6d4' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Quiz Performance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Quiz Performance by Pillar</CardTitle>
                  <CardDescription>Average scores and pass rates across all pillars</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={quizStats?.pillarBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="pillarName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="averageScore" fill="#8884d8" name="Avg Score %" />
                      <Bar dataKey="passRate" fill="#82ca9d" name="Pass Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quizzes Tab */}
            <TabsContent value="quizzes" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Quiz Attempts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{quizStats?.totalQuizzes.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{quizStats?.averageScore || 0}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Pass Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{quizStats?.passRate || 0}%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Pillar Performance Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pillar</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Pass Rate</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quizStats?.pillarBreakdown.map((pillar) => (
                        <TableRow key={pillar.pillarId}>
                          <TableCell className="font-medium">{pillar.pillarName}</TableCell>
                          <TableCell>{pillar.attempts}</TableCell>
                          <TableCell>{pillar.averageScore}%</TableCell>
                          <TableCell>{pillar.passRate}%</TableCell>
                          <TableCell>
                            <Progress value={pillar.passRate} className="w-20" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Certifications Tab */}
            <TabsContent value="certifications" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Certifications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{certificationStats?.totalCertifications.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary">Bronze</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{certificationStats?.bronzeCount || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary">Silver</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{certificationStats?.silverCount || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="secondary">Gold</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{certificationStats?.goldCount || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Certifications by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={certificationStats?.roleBreakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="role" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Simulations Tab */}
            <TabsContent value="simulations" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Attempts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{simulationStats?.totalAttempts.toLocaleString() || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Score</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{simulationStats?.averageScore || 0}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{simulationStats?.completionRate || 0}%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Simulation Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scenario</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Performance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulationStats?.scenarioBreakdown.map((scenario) => (
                        <TableRow key={scenario.scenarioId}>
                          <TableCell className="font-medium">{scenario.scenarioName}</TableCell>
                          <TableCell>{scenario.attempts}</TableCell>
                          <TableCell>{scenario.averageScore}%</TableCell>
                          <TableCell>
                            <Progress value={scenario.averageScore} className="w-20" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Knowledge Gain Tab */}
            <TabsContent value="knowledge-gain" className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Assessments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{knowledgeGain?.overall?.totalAssessments || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Average Gain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{knowledgeGain?.overall?.averageGain || 0} pts</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Normalized Gain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{knowledgeGain?.overall?.normalizedGain || 0}%</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>High Performers</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{knowledgeGain?.overall?.highPerformers || 0}</div>
                    <p className="text-xs text-muted-foreground">gain &gt;20 points</p>
                  </CardContent>
                </Card>
              </div>

              {/* Knowledge Gain Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Gain Trends</CardTitle>
                  <CardDescription>Monthly learning improvement over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={knowledgeGain?.trends?.monthly || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="averageGain" stroke="#8884d8" strokeWidth={2} name="Avg Gain (pts)" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pillar Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Gain by Pillar</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pillar</TableHead>
                        <TableHead>Avg Pre-Score</TableHead>
                        <TableHead>Avg Post-Score</TableHead>
                        <TableHead>Avg Gain</TableHead>
                        <TableHead>Normalized Gain</TableHead>
                        <TableHead>High Performers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {knowledgeGain?.byPillar?.map((pillar) => (
                        <TableRow key={pillar.pillarId}>
                          <TableCell className="font-medium">{pillar.pillarName}</TableCell>
                          <TableCell>{pillar.averagePreScore}%</TableCell>
                          <TableCell>{pillar.averagePostScore}%</TableCell>
                          <TableCell className="font-semibold text-green-600">+{pillar.averageGain} pts</TableCell>
                          <TableCell>{pillar.normalizedGain}%</TableCell>
                          <TableCell>{pillar.highPerformers}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Role Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Gain by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Avg Gain</TableHead>
                        <TableHead>Normalized Gain</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Avg Time (min)</TableHead>
                        <TableHead>Learning Efficiency</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {knowledgeGain?.byRole?.map((role) => (
                        <TableRow key={role.role}>
                          <TableCell className="font-medium">{role.role}</TableCell>
                          <TableCell className="font-semibold text-green-600">+{role.averageGain} pts</TableCell>
                          <TableCell>{role.normalizedGain}%</TableCell>
                          <TableCell>{role.totalUsers}</TableCell>
                          <TableCell>{role.averageTimeSpent}</TableCell>
                          <TableCell>{role.learningEfficiency} pts/hr</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams" className="space-y-6">
              {/* Team Performance Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Teams</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{teamStats?.length || 0}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Avg Team Size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {teamStats ? Math.round(teamStats.reduce((sum, team) => sum + team.memberCount, 0) / teamStats.length) : 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Avg Maturity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {teamStats ? (teamStats.reduce((sum, team) => sum + team.avgMaturity, 0) / teamStats.length).toFixed(1) : 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Team Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {teamStats ? Math.round(teamStats.reduce((sum, team) => sum + team.completionRate, 0) / teamStats.length) : 0}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Team Performance Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Performance Comparison</CardTitle>
                  <CardDescription>Performance metrics across all teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Avg Maturity</TableHead>
                        <TableHead>Total Certifications</TableHead>
                        <TableHead>Avg Quiz Score</TableHead>
                        <TableHead>Completion Rate</TableHead>
                        <TableHead>Top Performers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamStats?.map((team) => (
                        <TableRow key={team.teamId}>
                          <TableCell className="font-medium">{team.teamName}</TableCell>
                          <TableCell>{team.memberCount}</TableCell>
                          <TableCell>{team.avgMaturity}</TableCell>
                          <TableCell>{team.totalCertifications}</TableCell>
                          <TableCell>{team.avgQuizScore}%</TableCell>
                          <TableCell>{team.completionRate}%</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {team.topPerformers.slice(0, 2).map((performer, index) => (
                                <span key={index} className="text-sm text-muted-foreground">• {performer}</span>
                              ))}
                              {team.topPerformers.length > 2 && (
                                <span className="text-sm text-muted-foreground">• +{team.topPerformers.length - 2} more</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Team Maturity Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Maturity Distribution</CardTitle>
                  <CardDescription>Average maturity levels across teams</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={teamStats?.map(team => ({
                      name: team.teamName.length > 15 ? team.teamName.substring(0, 15) + '...' : team.teamName,
                      maturity: team.avgMaturity,
                      certifications: team.totalCertifications,
                    })) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="maturity" fill="#8884d8" name="Avg Maturity Level" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Team Completion Rates */}
              <Card>
                <CardHeader>
                  <CardTitle>Team Completion Rates</CardTitle>
                  <CardDescription>Learning completion rates by team</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={teamStats?.map(team => ({
                      name: team.teamName.length > 15 ? team.teamName.substring(0, 15) + '...' : team.teamName,
                      completion: team.completionRate,
                      score: team.avgQuizScore,
                    })) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="completion" fill="#22c55e" name="Completion Rate %" />
                      <Bar dataKey="score" fill="#3b82f6" name="Avg Quiz Score %" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard" className="space-y-6">
              {/* Leaderboard Type Selector */}
              <div className="flex items-center gap-4 mb-6">
                <Button
                  variant={leaderboardType === 'overall' ? 'default' : 'outline'}
                  onClick={() => setLeaderboardType('overall')}
                >
                  Overall Performance
                </Button>
                <Button
                  variant={leaderboardType === 'certifications' ? 'default' : 'outline'}
                  onClick={() => setLeaderboardType('certifications')}
                >
                  Certification Leaders
                </Button>
                <Button
                  variant={leaderboardType === 'pillars' ? 'default' : 'outline'}
                  onClick={() => setLeaderboardType('pillars')}
                >
                  Pillar Masters
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>Users ranked by total score and certifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Total Score</TableHead>
                        <TableHead>Certifications</TableHead>
                        <TableHead>Maturity Level</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaderboard?.entries?.map((user, index) => (
                        <TableRow key={user.userId}>
                          <TableCell className="font-medium">#{index + 1}</TableCell>
                          <TableCell>{user.userName}</TableCell>
                          <TableCell>{user.totalScore.toLocaleString()}</TableCell>
                          <TableCell>{user.certifications}</TableCell>
                          <TableCell>
                            <Badge variant="outline">L{user.maturityLevel}</Badge>
                          </TableCell>
                          <TableCell>{user.lastActive.toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Certification Achievement Leaders */}
              <Card>
                <CardHeader>
                  <CardTitle>Certification Achievement Leaders</CardTitle>
                  <CardDescription>Top users by certification tier achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-amber-500">Gold</Badge> Champions
                      </h4>
                      <div className="space-y-2">
                        {[
                          { name: 'Sarah Chen', count: 6, score: 2950 },
                          { name: 'Mike Johnson', count: 5, score: 2780 },
                          { name: 'Alex Rodriguez', count: 4, score: 2650 }
                        ].map((user, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span className="font-medium">{user.name}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{user.count} Gold</div>
                              <div className="text-xs text-muted-foreground">{user.score} pts</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-gray-500">Silver</Badge> Achievers
                      </h4>
                      <div className="space-y-2">
                        {[
                          { name: 'Emma Davis', count: 4, score: 2680 },
                          { name: 'David Kim', count: 3, score: 2520 },
                          { name: 'Lisa Wang', count: 3, score: 2490 }
                        ].map((user, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span className="font-medium">{user.name}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{user.count} Silver</div>
                              <div className="text-xs text-muted-foreground">{user.score} pts</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-orange-600">Bronze</Badge> Contributors
                      </h4>
                      <div className="space-y-2">
                        {[
                          { name: 'John Smith', count: 5, score: 1890 },
                          { name: 'Maria Garcia', count: 4, score: 1750 },
                          { name: 'Tom Wilson', count: 4, score: 1720 }
                        ].map((user, index) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                            <span className="font-medium">{user.name}</span>
                            <div className="text-right">
                              <div className="text-sm font-semibold">{user.count} Bronze</div>
                              <div className="text-xs text-muted-foreground">{user.score} pts</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SidebarLayout>
  );
}
