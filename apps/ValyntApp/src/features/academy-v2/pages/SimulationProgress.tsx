/**
 * Simulation Progress Page
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function SimulationProgress() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Simulation Progress</h1>
      <Card>
        <CardHeader>
          <CardTitle>Current Simulation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Your progress in the current simulation.</p>
          <Progress value={65} />
          <p className="text-sm text-muted-foreground mt-2">65% complete</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default SimulationProgress;
