import { v4 as uuidv4 } from "uuid";
import type { InterventionPoint, SystemMap } from "./sof-types";

interface InterventionResult {
  interventions: InterventionPoint[];
}

interface FeasibilityAssessment {
  score: number;
  factors: string[];
  risks: string[];
  resources: {
    time: string;
    budget: string;
    people: string;
  };
}

export class InterventionDesignerAgent {
  async designInterventions(
    systemMap: SystemMap,
    leveragePoints: Array<{
      id: string;
      system_map_id: string;
      leverage_type: string;
      leverage_description: string;
      impact_potential: number;
      feasibility_score: number;
    }>
  ): Promise<InterventionResult> {
    const interventions = leveragePoints.map((leveragePoint) => ({
      id: `intervention-${uuidv4()}`,
      system_map_id: systemMap.id,
      leverage_point_id: leveragePoint.id,
      intervention_type: leveragePoint.leverage_type,
      intervention_description: `Intervention for ${leveragePoint.leverage_description}`,
      expected_impact: leveragePoint.impact_potential * leveragePoint.feasibility_score,
      feasibility_score: leveragePoint.feasibility_score,
      required_resources: ["time", "budget", "people"],
      intervention_sequence: [
        "Align stakeholders",
        "Prototype changes",
        "Scale implementation",
      ],
    }));

    interventions.sort(
      (a, b) => (b.expected_impact ?? 0) - (a.expected_impact ?? 0)
    );

    return { interventions };
  }

  async assessFeasibility(intervention: InterventionPoint): Promise<FeasibilityAssessment> {
    const baseScore = intervention.required_resources.length > 0 ? 7 : 5;

    return {
      score: baseScore,
      factors: ["resource availability", "stakeholder alignment"],
      risks: ["change resistance", "timeline slippage"],
      resources: {
        time: "medium",
        budget: "medium",
        people: "small team",
      },
    };
  }

  async generateInterventionOptions(leveragePoint: {
    id: string;
    leverage_type: string;
    leverage_description: string;
  }): Promise<InterventionPoint[]> {
    const variants = [
      "policy",
      "capability",
      "structural",
      leveragePoint.leverage_type,
    ];

    const options = variants.slice(0, 3).map((variant) => ({
      id: `option-${uuidv4()}`,
      system_map_id: leveragePoint.id,
      intervention_type: variant,
      intervention_description: `Option focused on ${leveragePoint.leverage_description}`,
      required_resources: ["time", "budget"],
    }));

    return options;
  }
}
