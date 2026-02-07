import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Lock, TrendingUp, Target, Award } from "lucide-react";

interface MaturityLevel {
  level: number;
  label: string;
  behaviors: string[];
  capabilities: string[];
  outcomes: string[];
  unlocked: boolean;
}

interface RoleMaturityTrackProps {
  role: string;
  currentLevel: number;
}

const roleMaturityTracks: Record<string, MaturityLevel[]> = {
  Sales: [
    {
      level: 0,
      label: "Feature-Focused Selling",
      behaviors: [
        "Leads with product features and specifications",
        "Relies on discounting to close deals",
        "Limited discovery of customer pain points"
      ],
      capabilities: [
        "Basic product knowledge",
        "Standard pitch delivery",
        "Reactive objection handling"
      ],
      outcomes: [
        "20-40% win rate",
        "High discount rates (>20%)",
        "Long sales cycles (>6 months)"
      ],
      unlocked: true
    },
    {
      level: 1,
      label: "Value-Aware Selling",
      behaviors: [
        "Asks discovery questions about ROI",
        "Uses basic value templates inconsistently",
        "Attempts to quantify business impact"
      ],
      capabilities: [
        "Basic ROI calculator usage",
        "Pain point identification",
        "Simple business case creation"
      ],
      outcomes: [
        "40-60% win rate",
        "Moderate discounts (10-20%)",
        "Sales cycles (4-6 months)"
      ],
      unlocked: true
    },
    {
      level: 2,
      label: "Value-Driven Selling",
      behaviors: [
        "Consistently leads with value discovery",
        "Co-creates business cases with customers",
        "Tracks value realization post-sale"
      ],
      capabilities: [
        "Advanced value discovery frameworks",
        "Multi-stakeholder alignment",
        "Data-driven business case development"
      ],
      outcomes: [
        "60-75% win rate",
        "Low discounts (<10%)",
        "Sales cycles (3-4 months)"
      ],
      unlocked: false
    },
    {
      level: 3,
      label: "Value Orchestration",
      behaviors: [
        "Proactively identifies expansion opportunities",
        "Uses predictive analytics for value forecasting",
        "Collaborates cross-functionally on value delivery"
      ],
      capabilities: [
        "AI-assisted value modeling",
        "Predictive deal scoring",
        "Value realization optimization"
      ],
      outcomes: [
        "75-85% win rate",
        "Premium pricing (0-5% discount)",
        "Sales cycles (2-3 months)"
      ],
      unlocked: false
    },
    {
      level: 4,
      label: "Predictive Value Selling",
      behaviors: [
        "Leverages AI agents for value discovery",
        "Predicts customer value realization risks",
        "Automates routine value calculations"
      ],
      capabilities: [
        "Agentic value discovery",
        "Predictive value analytics",
        "Automated business case generation"
      ],
      outcomes: [
        "85-95% win rate",
        "Value-based pricing",
        "Sales cycles (<2 months)"
      ],
      unlocked: false
    },
    {
      level: 5,
      label: "Autonomous Value Delivery",
      behaviors: [
        "AI agents autonomously identify opportunities",
        "Self-optimizing value delivery systems",
        "Continuous value realization monitoring"
      ],
      capabilities: [
        "Fully agentic value systems",
        "Autonomous deal orchestration",
        "Self-improving value models"
      ],
      outcomes: [
        ">95% win rate",
        "Premium value-based pricing",
        "Rapid cycles (<1 month)"
      ],
      unlocked: false
    }
  ],
  CS: [
    {
      level: 0,
      label: "Reactive Support",
      behaviors: [
        "Responds to customer issues reactively",
        "Limited proactive engagement",
        "No systematic value tracking"
      ],
      capabilities: [
        "Basic product support",
        "Ticket management",
        "Issue resolution"
      ],
      outcomes: [
        "60-70% retention rate",
        "High churn risk",
        "Limited expansion (<10%)"
      ],
      unlocked: true
    },
    {
      level: 1,
      label: "Proactive Engagement",
      behaviors: [
        "Regular check-ins with customers",
        "Basic usage monitoring",
        "Occasional value reviews"
      ],
      capabilities: [
        "Health score tracking",
        "Basic QBR preparation",
        "Usage analytics review"
      ],
      outcomes: [
        "70-80% retention rate",
        "Moderate churn risk",
        "Some expansion (10-20%)"
      ],
      unlocked: true
    },
    {
      level: 2,
      label: "Value Realization Focus",
      behaviors: [
        "Tracks value metrics consistently",
        "Conducts structured QBRs with ROI",
        "Identifies expansion opportunities"
      ],
      capabilities: [
        "Value realization dashboards",
        "ROI tracking and reporting",
        "Expansion planning"
      ],
      outcomes: [
        "80-90% retention rate",
        "Low churn risk",
        "Strong expansion (20-40%)"
      ],
      unlocked: false
    },
    {
      level: 3,
      label: "Strategic Partnership",
      behaviors: [
        "Acts as trusted advisor",
        "Proactively optimizes value delivery",
        "Co-creates success plans"
      ],
      capabilities: [
        "Strategic account planning",
        "Value optimization",
        "Executive relationship building"
      ],
      outcomes: [
        "90-95% retention rate",
        "Minimal churn",
        "High expansion (40-60%)"
      ],
      unlocked: false
    },
    {
      level: 4,
      label: "Predictive Success",
      behaviors: [
        "Predicts churn risks before they occur",
        "Uses AI to identify expansion signals",
        "Automates value tracking"
      ],
      capabilities: [
        "Predictive churn modeling",
        "AI-driven expansion recommendations",
        "Automated value reporting"
      ],
      outcomes: [
        "95-98% retention rate",
        "Near-zero churn",
        "Exceptional expansion (60-80%)"
      ],
      unlocked: false
    },
    {
      level: 5,
      label: "Autonomous Success",
      behaviors: [
        "AI agents monitor and optimize value",
        "Self-healing customer issues",
        "Continuous value maximization"
      ],
      capabilities: [
        "Fully agentic success management",
        "Self-optimizing value delivery",
        "Autonomous expansion orchestration"
      ],
      outcomes: [
        ">98% retention rate",
        "Negative churn",
        "Explosive expansion (>80%)"
      ],
      unlocked: false
    }
  ],
  // Add other roles with similar structure
  Marketing: [
    {
      level: 0,
      label: "Feature Marketing",
      behaviors: ["Feature-focused campaigns", "Generic messaging", "Limited ROI tracking"],
      capabilities: ["Basic campaign execution", "Content creation", "Lead generation"],
      outcomes: ["Low conversion rates", "High CAC", "Limited attribution"],
      unlocked: true
    },
    {
      level: 1,
      label: "Benefit Marketing",
      behaviors: ["Benefit-oriented messaging", "Basic segmentation", "Campaign ROI tracking"],
      capabilities: ["Audience segmentation", "ROI dashboards", "A/B testing"],
      outcomes: ["Improved conversion", "Moderate CAC", "Basic attribution"],
      unlocked: true
    },
    {
      level: 2,
      label: "Value Marketing",
      behaviors: ["Value-driven campaigns", "Persona-based messaging", "Multi-touch attribution"],
      capabilities: ["Value messaging frameworks", "Advanced analytics", "Customer journey mapping"],
      outcomes: ["Strong conversion", "Optimized CAC", "Clear attribution"],
      unlocked: false
    },
    {
      level: 3,
      label: "Strategic Marketing",
      behaviors: ["Integrated value campaigns", "Predictive targeting", "Cross-channel orchestration"],
      capabilities: ["Marketing automation", "Predictive analytics", "Channel optimization"],
      outcomes: ["High conversion", "Low CAC", "Multi-touch attribution"],
      unlocked: false
    },
    {
      level: 4,
      label: "Predictive Marketing",
      behaviors: ["AI-driven campaigns", "Predictive lead scoring", "Automated optimization"],
      capabilities: ["AI campaign generation", "Predictive modeling", "Real-time optimization"],
      outcomes: ["Exceptional conversion", "Minimal CAC", "Predictive attribution"],
      unlocked: false
    },
    {
      level: 5,
      label: "Autonomous Marketing",
      behaviors: ["Fully agentic campaigns", "Self-optimizing systems", "Continuous adaptation"],
      capabilities: ["Autonomous campaign orchestration", "Self-learning systems", "Dynamic personalization"],
      outcomes: ["Market-leading conversion", "Negative CAC", "Perfect attribution"],
      unlocked: false
    }
  ]
};

// Default track for roles not yet defined
const defaultTrack: MaturityLevel[] = Array.from({ length: 6 }, (_, i) => ({
  level: i,
  label: `Level ${i}`,
  behaviors: ["Coming soon"],
  capabilities: ["Coming soon"],
  outcomes: ["Coming soon"],
  unlocked: i <= 1
}));

export default function RoleMaturityTrack({ role, currentLevel }: RoleMaturityTrackProps) {
  const track = roleMaturityTracks[role] || defaultTrack;
  
  // Mark levels as unlocked based on current level
  const trackWithUnlockStatus = track.map((level, index) => ({
    ...level,
    unlocked: index <= currentLevel
  }));

  const progressPercentage = (currentLevel / (track.length - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-card text-card-foreground shadow-beautiful-md rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {role} Maturity Progression
          </CardTitle>
          <CardDescription>
            Your journey from L0 to L5 maturity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Current Level: L{currentLevel}</span>
            <span className="text-sm text-muted-foreground">{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-3" />
          <div className="grid grid-cols-6 gap-2 mt-4">
            {trackWithUnlockStatus.map((level) => (
              <div
                key={level.level}
                className={`text-center p-2 rounded-lg border-2 transition-all ${
                  level.level === currentLevel
                    ? 'border-primary bg-primary/10'
                    : level.unlocked
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-muted bg-muted/30'
                }`}
              >
                <div className="font-bold text-sm">L{level.level}</div>
                {level.level === currentLevel && (
                  <Badge variant="default" className="mt-1 text-xs">Current</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Maturity Levels Detail */}
      <div className="space-y-4">
        {trackWithUnlockStatus.map((level) => (
          <Card
            key={level.level}
            className={`bg-card text-card-foreground shadow-beautiful-md rounded-lg transition-all ${
              level.level === currentLevel
                ? 'border-2 border-primary shadow-lg'
                : level.unlocked
                ? 'border-green-500/30'
                : 'opacity-60'
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {level.unlocked ? (
                    level.level === currentLevel ? (
                      <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">L{level.level}</span>
                      </div>
                    ) : (
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    )
                  ) : (
                    <Lock className="h-10 w-10 text-muted-foreground" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{level.label}</CardTitle>
                    <CardDescription>Level {level.level} Maturity</CardDescription>
                  </div>
                </div>
                {level.level === currentLevel && (
                  <Badge variant="default">You are here</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                {/* Behaviors */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Circle className="h-4 w-4" />
                    Key Behaviors
                  </h4>
                  <ul className="space-y-1">
                    {level.behaviors.map((behavior, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{behavior}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Capabilities */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Capabilities
                  </h4>
                  <ul className="space-y-1">
                    {level.capabilities.map((capability, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{capability}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Outcomes */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Expected Outcomes
                  </h4>
                  <ul className="space-y-1">
                    {level.outcomes.map((outcome, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{outcome}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
