/**
 * Seed Business Case Development simulation scenario
 * Run with: pnpm tsx scripts/seed-business-case-simulation.ts
 */

import * as db from "./db";

async function seedBusinessCaseSimulation() {
  console.log("🌱 Seeding Business Case Development simulation...\n");

  await db.createSimulationScenario({
    title: "Business Case Development: CloudSecure ROI",
    type: "business_case",
    pillarId: 4, // Pillar 4: Business Case Development
    difficulty: "advanced",
    vosRole: null, // Available to all roles
    description: "Build a comprehensive ROI business case for a cybersecurity platform using the Revenue/Cost/Risk framework. Practice quantifying value and creating executive-level narratives.",
    scenarioData: {
      context: `You're preparing a business case for CloudSecure Inc., an enterprise cybersecurity vendor, to present to the CFO of MegaCorp Financial Services. MegaCorp is evaluating CloudSecure's platform to reduce security incidents and improve compliance efficiency.

Current State:
• 45 security incidents per quarter (avg cost: $125K per incident)
• Compliance team: 8 FTEs spending 60% time on manual audits
• Average compliance audit duration: 6 weeks
• Annual security insurance premium: $2.4M

Proposed Solution:
• CloudSecure Enterprise Platform
• Annual cost: $480K (Year 1), $420K (Years 2-3)
• Implementation: 3 months, $150K services fee`,
      customerProfile: {
        company: "MegaCorp Financial Services",
        industry: "Financial Services - Regional Bank",
        size: "5,000 employees, $2.8B revenue",
        decisionMaker: "CFO Sarah Chen",
        challenges: [
          "High cost of security incidents ($5.6M annually)",
          "Compliance audit inefficiency (8 FTEs, 60% utilization)",
          "Rising cyber insurance premiums",
          "Regulatory pressure (SOC 2, PCI-DSS, GDPR)"
        ],
        currentState: {
          securityIncidents: 45, // per quarter
          incidentCost: 125000, // per incident
          complianceFTEs: 8,
          complianceUtilization: 0.6,
          auditDuration: 6, // weeks
          insurancePremium: 2400000 // annual
        }
      },
      objectives: [
        "Build a 3-year ROI model with Revenue/Cost/Risk breakdown",
        "Quantify value in at least 3 categories",
        "Create executive summary with key metrics (ROI, Payback, NPV)",
        "Address implementation risks and mitigation strategies"
      ],
      steps: [
        {
          stepNumber: 1,
          title: "Revenue Impact Analysis",
          instruction: "Identify and quantify how CloudSecure's platform could generate revenue or prevent revenue loss for MegaCorp. Consider customer retention, deal velocity, or market expansion opportunities.",
          promptType: "structured_text",
          expectedElements: [
            "Identifies at least one revenue-related KPI",
            "Provides quantified estimate with assumptions",
            "Explains causal link between solution and revenue impact",
            "Includes timeframe for realization"
          ],
          hints: [
            "Think about how security incidents affect customer trust",
            "Consider compliance as a competitive differentiator",
            "How might faster audits enable new market entry?"
          ]
        },
        {
          stepNumber: 2,
          title: "Cost Reduction Analysis",
          instruction: "Calculate the cost savings from reduced security incidents and improved compliance efficiency. Build a detailed cost model with clear assumptions.",
          promptType: "structured_calculation",
          expectedElements: [
            "Quantifies incident reduction savings",
            "Calculates compliance efficiency gains",
            "Includes insurance premium reduction potential",
            "Shows 3-year cumulative savings",
            "States assumptions clearly"
          ],
          hints: [
            "Current incident cost: $5.6M annually (45 × 4 × $125K)",
            "Compliance FTE cost: ~$120K loaded per FTE",
            "Industry benchmark: 60-70% incident reduction achievable"
          ]
        },
        {
          stepNumber: 3,
          title: "Risk Mitigation Value",
          instruction: "Quantify the value of risk reduction. Consider regulatory fines avoided, brand protection, and business continuity improvements.",
          promptType: "structured_text",
          expectedElements: [
            "Identifies specific risks being mitigated",
            "Quantifies probability and impact of risks",
            "Calculates expected value of risk reduction",
            "References industry data or benchmarks"
          ],
          hints: [
            "Average data breach fine for financial services: $4.5M",
            "Probability of major breach without controls: 15% annually",
            "Brand damage from public breach: 2-5% revenue impact"
          ]
        },
        {
          stepNumber: 4,
          title: "Executive Summary",
          instruction: "Create a compelling executive summary for CFO Sarah Chen. Include ROI, payback period, NPV, and key value drivers. Write in business language, not technical jargon.",
          promptType: "executive_summary",
          expectedElements: [
            "Leads with key financial metrics (ROI, Payback, NPV)",
            "Summarizes value in Revenue/Cost/Risk framework",
            "Addresses implementation considerations",
            "Includes clear recommendation",
            "Written for C-level audience (concise, business-focused)"
          ],
          hints: [
            "CFOs care about: ROI, payback period, cash flow impact",
            "Use specific numbers, not ranges",
            "Address 'what if we do nothing' scenario"
          ]
        },
        {
          stepNumber: 5,
          title: "Implementation Risks & Mitigation",
          instruction: "Identify the top 3 implementation risks and propose specific mitigation strategies. Consider technical, organizational, and timeline risks.",
          promptType: "risk_matrix",
          expectedElements: [
            "Identifies 3 specific implementation risks",
            "Assesses probability and impact for each",
            "Proposes concrete mitigation actions",
            "Assigns ownership/accountability"
          ],
          hints: [
            "Common risks: integration complexity, user adoption, timeline delays",
            "Think about MegaCorp's organizational readiness",
            "What could derail value realization?"
          ]
        }
      ]
    },
    createdAt: new Date(),
  });

  console.log("✅ Business Case Development simulation seeded successfully!");
}

seedBusinessCaseSimulation().catch(console.error);
