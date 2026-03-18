/**
 * Analytics Page
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Analytics() {
  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Learning Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Study Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">24h</div>
            <p className="text-sm text-muted-foreground">Total study time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quizzes Taken</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">12</div>
            <p className="text-sm text-muted-foreground">Completed quizzes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">87%</div>
            <p className="text-sm text-muted-foreground">Quiz average</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Analytics;
