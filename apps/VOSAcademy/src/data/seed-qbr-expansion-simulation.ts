/**
 * Seed QBR Expansion Modeling simulation scenario
 * Run with: pnpm tsx scripts/seed-qbr-expansion-simulation.ts
 */

import * as db from "./db";

async function seedQBRExpansionSimulation() {
  console.log("🌱 Seeding QBR Expansion Modeling simulation...\n");

  await db.createSimulationScenario({
    title: "QBR Expansion Modeling: DataFlow Analytics",
    type: "qbr_expansion",
    pillarId: 8, // Pillar 8: Lifecycle Value Management & QBRs
    difficulty: "advanced",
    vosRole: null, // Available to all roles
    description: "Practice value realization storytelling and expansion opportunity identification during a Quarterly Business Review. Analyze actual vs. planned results, create compelling narratives, and build expansion business cases.",
    scenarioData: {
      context: `You're preparing for a Q3 QBR with DataFlow Analytics, a customer who implemented your platform 9 months ago. They initially purchased your Marketing Analytics module for $180K annually. You need to review value delivered and identify expansion opportunities.

Original Value Commitments (from initial business case):
1. Reduce campaign analysis time by 50% (from 40 hours to 20 hours per campaign)
2. Improve campaign ROI by 15% through better targeting
3. Enable 2x campaign volume without adding headcount

Actual Results (9 months):
• Campaign analysis time: Reduced to 18 hours (55% improvement)
• Campaign ROI: Improved by 22% (exceeded target)
• Campaign volume: Increased 1.6x (on track for 2x)
• Unexpected benefit: 30% reduction in wasted ad spend

Expansion Opportunities:
• Sales Analytics module ($240K annually)
• Customer Journey Analytics ($320K annually)
• Executive Dashboard ($80K annually)`,
      customerProfile: {
        company: "DataFlow Analytics",
        industry: "B2B SaaS - Marketing Technology",
        size: "250 employees, $45M ARR",
        keyContact: "VP Marketing Operations - Jennifer Wu",
        currentModules: ["Marketing Analytics"],
        currentARR: 180000,
        implementationDate: "2024-01-15",
        teamSize: 12, // marketing ops team
        challenges: [
          "Need visibility into sales funnel performance",
          "Executive team wants unified metrics dashboard",
          "Customer churn analysis currently manual"
        ],
        valueRealized: {
          campaignAnalysisTime: {
            baseline: 40, // hours per campaign
            current: 18, // hours per campaign
            improvement: 0.55 // 55%
          },
          campaignROI: {
            baseline: 1.8, // $1.80 return per $1 spent
            current: 2.2, // $2.20 return per $1 spent
            improvement: 0.22 // 22%
          },
          campaignVolume: {
            baseline: 24, // campaigns per quarter
            current: 38, // campaigns per quarter
            improvement: 0.58 // 58% increase
          },
          adSpendEfficiency: {
            baseline: 1.2, // million per quarter
            current: 0.84, // million per quarter
            savings: 360000 // annual savings
          }
        }
      },
      objectives: [
        "Analyze value delivered vs. commitments",
        "Build compelling value story with data visualization",
        "Identify top expansion opportunity with business case",
        "Prepare executive-ready QBR presentation"
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Value Delivered vs. Committed",
          instruction: "Analyze the actual results against the original value commitments. Calculate the total quantified value delivered in the first 9 months. Highlight wins and explain any gaps.",
          promptType: "data_analysis",
          expectedElements: [
            "Compares each commitment to actual results",
            "Quantifies total value delivered (dollar amount)",
            "Identifies overperformance areas",
            "Explains any underperformance with context",
            "Calculates ROI on customer's investment"
          ],
          hints: [
            "Marketing Ops team avg salary: $95K loaded",
            "Campaign analysis time saved: 22 hours × 38 campaigns",
            "Ad spend savings: $360K annually is significant",
            "Don't forget to quantify the 'unexpected benefits'"
          ]
        },
        {
          stepNumber: 2,
          title: "Compelling Value Narrative",
          instruction: "Create a compelling value story for VP Jennifer Wu that she can share with her executive team. Focus on business outcomes, not product features. Make it memorable and data-driven.",
          promptType: "storytelling",
          expectedElements: [
            "Opens with business context/challenge",
            "Uses specific numbers and percentages",
            "Highlights unexpected wins",
            "Connects to broader business goals",
            "Ends with forward-looking statement"
          ],
          hints: [
            "Start with 'Before DataFlow Analytics implemented...'",
            "Use the 'Rule of 3' - three key wins",
            "Quote Jennifer if possible (hypothetical)",
            "Think about what matters to the CEO"
          ]
        },
        {
          stepNumber: 3,
          title: "Expansion Opportunity Analysis",
          instruction: "Evaluate the three expansion opportunities (Sales Analytics, Customer Journey Analytics, Executive Dashboard). Recommend the top priority based on DataFlow's current challenges and value delivered so far.",
          promptType: "opportunity_analysis",
          expectedElements: [
            "Analyzes each expansion option against customer challenges",
            "Identifies clear #1 recommendation with rationale",
            "Explains why other options are lower priority",
            "Connects recommendation to value already delivered",
            "Considers timing and organizational readiness"
          ],
          hints: [
            "Which challenge is most urgent for DataFlow?",
            "Which module builds on Marketing Analytics success?",
            "What's the logical next step in their journey?",
            "Consider executive visibility needs"
          ]
        },
        {
          stepNumber: 4,
          title: "Expansion Business Case",
          instruction: "Build a mini business case for your recommended expansion module. Quantify the expected value using the same framework as the original implementation. Keep it concise - this is for a QBR, not a full sales cycle.",
          promptType: "business_case",
          expectedElements: [
            "Quantifies expected value in 2-3 categories",
            "Uses realistic assumptions based on current results",
            "Calculates ROI and payback period",
            "Addresses implementation effort/timeline",
            "Proposes next steps"
          ],
          hints: [
            "Leverage proof points from Marketing Analytics success",
            "Use conservative estimates (don't oversell)",
            "Reference industry benchmarks if available",
            "Make it easy to say yes"
          ]
        },
        {
          stepNumber: 5,
          title: "QBR Presentation Structure",
          instruction: "Create a slide-by-slide outline for the QBR presentation. Include slide titles, key messages, and data points for each slide. Aim for 8-10 slides total.",
          promptType: "presentation_outline",
          expectedElements: [
            "Logical flow: Results → Story → Expansion → Next Steps",
            "Each slide has clear title and 2-3 key points",
            "Includes data visualization recommendations",
            "Balances celebration and forward momentum",
            "Ends with clear call-to-action"
          ],
          hints: [
            "Slide 1: Agenda/Objectives",
            "Slides 2-4: Value delivered",
            "Slide 5: Customer success story",
            "Slides 6-7: Expansion opportunity",
            "Slide 8: Next steps/timeline"
          ]
        }
      ]
    },
    createdAt: new Date(),
  });

  console.log("✅ QBR Expansion Modeling simulation seeded successfully!");
}

seedQBRExpansionSimulation().catch(console.error);
