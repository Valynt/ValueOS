import { ArrowRight, BookOpen, Lightbulb, Loader2, Target, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";


interface SimulationRec { simulationTitle: string; priority: string; reason: string; }
interface PillarRec { pillarNumber: number; pillarTitle: string; priority: string; reason: string; }
interface ImprovementArea { area: string; currentScore: number; targetScore: number; priority: string; actionItems?: string[]; }
interface RecommendationsShape {
  overallGuidance?: string;
  nextSimulations?: SimulationRec[];
  pillarsToStudy?: PillarRec[];
  improvementAreas?: ImprovementArea[];
}

export function RecommendationsCard() {
  const [, setLocation] = useLocation();
  const { data: rawRecommendations, isLoading } = trpc.simulations.getRecommendations.useQuery();
  const recommendations = rawRecommendations as RecommendationsShape | undefined;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <CardTitle>Personalized Recommendations</CardTitle>
          </div>
          <CardDescription>AI-powered learning path suggestions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-primary" />
          <CardTitle>Personalized Recommendations</CardTitle>
        </div>
        <CardDescription>AI-powered learning path suggestions based on your progress</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Guidance */}
        {recommendations.overallGuidance && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm leading-relaxed">{recommendations.overallGuidance}</p>
          </div>
        )}

        {/* Next Simulations */}
        {recommendations.nextSimulations && recommendations.nextSimulations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-primary" />
              <h4 className="font-semibold">Recommended Simulations</h4>
            </div>
            <div className="space-y-3">
              {recommendations.nextSimulations.map((sim, index) => (
                <div key={index} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="font-medium text-sm">{sim.simulationTitle}</h5>
                    <Badge variant={getPriorityColor(sim.priority)} className="text-xs">
                      {sim.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{sim.reason}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setLocation('/simulations')}
                  >
                    Start Simulation <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pillars to Study */}
        {recommendations.pillarsToStudy && recommendations.pillarsToStudy.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h4 className="font-semibold">Recommended Pillars</h4>
            </div>
            <div className="space-y-3">
              {recommendations.pillarsToStudy.map((pillar, index) => (
                <div key={index} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h5 className="font-medium text-sm">
                      Pillar {pillar.pillarNumber}: {pillar.pillarTitle}
                    </h5>
                    <Badge variant={getPriorityColor(pillar.priority)} className="text-xs">
                      {pillar.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{pillar.reason}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setLocation(`/pillar/${pillar.pillarNumber}`)}
                  >
                    Study Pillar <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improvement Areas */}
        {recommendations.improvementAreas && recommendations.improvementAreas.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h4 className="font-semibold">Areas for Improvement</h4>
            </div>
            <div className="space-y-3">
              {recommendations.improvementAreas.map((area, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm mb-1">{area.area}</h5>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Current: {area.currentScore}/100</span>
                        <span>→</span>
                        <span>Target: {area.targetScore}/100</span>
                      </div>
                    </div>
                    <Badge variant={getPriorityColor(area.priority)} className="text-xs">
                      {area.priority}
                    </Badge>
                  </div>
                  {area.actionItems && area.actionItems.length > 0 && (
                    <ul className="space-y-1 mt-2">
                      {area.actionItems.map((item: string, itemIndex: number) => (
                        <li key={itemIndex} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
