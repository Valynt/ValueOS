/**
 * Maturity Assessment Page
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function MaturityAssessment() {
  return (
    <div className="container max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Maturity Assessment</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Maturity Level</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold mb-4">Level 2</div>
          <Progress value={40} />
          <p className="text-sm text-muted-foreground mt-4">
            Complete assessments to advance your maturity level.
          </p>
          <Button className="mt-4">Start Assessment</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default MaturityAssessment;
