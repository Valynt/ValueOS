import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import { Icons } from "../lib/icons";
import { Award, CheckCircle, Download } from "lucide-react";

interface Certification {
  id: number;
  pillarNumber: number;
  pillarTitle: string;
  tier: "bronze" | "silver" | "gold";
  score: number;
  earnedAt: Date;
  expiresAt: Date | null;
}

interface CertificationDisplayProps {
  certifications: Certification[];
  totalPillars: number;
  onDownload?: (id: number) => void;
}

const tierConfig = {
  bronze: {
    icon: Icons.Award,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    label: "Bronze",
    description: "Passed all knowledge checks",
  },
  silver: {
    icon: Icons.Star,
    color: "text-gray-400",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    label: "Silver",
    description: "80%+ on final simulation",
  },
  gold: {
    icon: Icons.Trophy,
    color: "text-yellow-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-300",
    label: "Gold",
    description: "95%+ with exceptional insight",
  },
};

export default function CertificationDisplay({
  certifications,
  totalPillars,
  onDownload,
}: CertificationDisplayProps) {
  const completionRate = (certifications.length / totalPillars) * 100;

  // Group certifications by tier
  const certsByTier = {
    bronze: certifications.filter((c) => c.tier === "bronze").length,
    silver: certifications.filter((c) => c.tier === "silver").length,
    gold: certifications.filter((c) => c.tier === "gold").length,
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icons.Trophy className="h-5 w-5 text-teal-600" />
            Certification Progress
          </CardTitle>
          <CardDescription>
            {certifications.length} of {totalPillars} pillars completed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={completionRate} className="h-2" />

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-amber-600">{certsByTier.bronze}</div>
              <div className="text-sm text-muted-foreground">Bronze</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-400">{certsByTier.silver}</div>
              <div className="text-sm text-muted-foreground">Silver</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-500">{certsByTier.gold}</div>
              <div className="text-sm text-muted-foreground">Gold</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Earned Certifications */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Earned Certifications</h3>

        {certifications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Award className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No certifications earned yet</p>
              <p className="text-sm mt-1">
                Complete pillar quizzes to earn your first certification!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certifications.map((cert) => {
              const config = tierConfig[cert.tier];
              const Icon = config.icon;

              return (
                <Card key={cert.id} className={`border-2 ${config.borderColor} ${config.bgColor}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-6 w-6 ${config.color}`} />
                        <div>
                          <CardTitle className="text-base">
                            Pillar {cert.pillarNumber}: {cert.pillarTitle}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {config.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${config.color} border-current`}>
                        {config.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Score:</span>
                      <span className="font-semibold">{cert.score}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Earned:</span>
                      <span>{new Date(cert.earnedAt).toLocaleDateString()}</span>
                    </div>
                    {cert.expiresAt && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Expires:</span>
                        <span>{new Date(cert.expiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="pt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-teal-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>Verified Certification</span>
                      </div>
                      {onDownload && (
                        <Button
                          variant="primary"
                          className="h-8 px-2 text-xs"
                          onClick={() => onDownload(cert.id)}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certification Tiers</CardTitle>
          <CardDescription>Requirements for each certification level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(tierConfig).map(([tier, config]) => {
            const Icon = config.icon;
            return (
              <div key={tier} className="flex items-start gap-3 p-3 rounded-lg border">
                <Icon className={`h-5 w-5 ${config.color} mt-0.5`} />
                <div className="flex-1">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-sm text-muted-foreground">{config.description}</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
