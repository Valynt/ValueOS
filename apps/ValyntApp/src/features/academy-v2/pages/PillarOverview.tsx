/**
 * Pillar Overview Page
 */
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PillarOverview() {
  const { pillarNumber } = useParams<{ pillarNumber: string }>();
  const pillarId = parseInt(pillarNumber || "1", 10);

  const pillars = [
    "Value Selling Fundamentals",
    "Value Realization",
    "Expansion Selling",
    "Value-Based Negotiation",
    "Executive Business Case",
    "ROI Communication",
    "Value Quantification",
    "Cross-Functional Alignment",
    "Value-Driven Renewals",
    "Strategic Value Advisory",
  ];

  const title = pillars[pillarId - 1] || `Pillar ${pillarId}`;

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <span className="text-sm text-muted-foreground">Pillar {pillarId} of 10</span>
        <h1 className="text-3xl font-bold mt-2">{title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Learning Modules</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Module content for {title}</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full">Start Learning</Button>
              <Button variant="outline" className="w-full">Take Quiz</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PillarOverview;
