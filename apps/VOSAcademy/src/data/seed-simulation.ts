/**
 * Seed one simulation scenario for testing
 * Run with: pnpm tsx scripts/seed-simulation.ts
 */

import * as db from "./db";

async function seedSimulation() {
  console.log("🌱 Seeding simulation scenario...\n");

  await db.createSimulationScenario({
    title: "Value Discovery Practice Session",
    type: "value_discovery",
    pillarId: 3,
    difficulty: "intermediate",
    vosRole: null,
    description: "Practice conducting a value discovery session with a SaaS company experiencing customer churn.",
    scenarioData: {
      context: "You're meeting with TechFlow Solutions, a B2B SaaS company with 500 customers experiencing 25% annual churn. Practice asking discovery questions to identify quantifiable KPIs.",
      customerProfile: {
        company: "TechFlow Solutions",
        industry: "B2B SaaS - Project Management",
        size: "500 customers, $15M ARR",
        challenges: [
          "25% annual customer churn",
          "60-day average onboarding time",
          "Limited customer health visibility"
        ]
      },
      objectives: [
        "Identify 3-5 quantifiable KPIs",
        "Uncover root causes of churn",
        "Build initial value hypotheses"
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Opening Question",
          instruction: "Ask an open-ended discovery question to understand their current state and pain points. Focus on business outcomes, not features.",
          promptType: "text",
          expectedElements: [
            "Open-ended question format",
            "Focus on business impact",
            "References current state or challenges",
            "Avoids leading with product features"
          ]
        },
        {
          stepNumber: 2,
          title: "Quantification",
          instruction: "Ask a question to quantify the financial impact of their 25% churn rate.",
          promptType: "text",
          expectedElements: [
            "Asks for specific numbers",
            "Guides calculation of churn cost",
            "References revenue or cost impact"
          ]
        },
        {
          stepNumber: 3,
          title: "Value Hypothesis",
          instruction: "Summarize your understanding by creating a value hypothesis. State the problem, quantify the impact, and propose a measurable outcome.",
          promptType: "text",
          expectedElements: [
            "States current state with metrics",
            "Quantifies business impact",
            "Proposes specific improvement target",
            "Includes timeframe"
          ]
        }
      ]
    },
    createdAt: new Date(),
  });

  console.log("✅ Simulation scenario seeded successfully!");
}

seedSimulation().catch(console.error);
