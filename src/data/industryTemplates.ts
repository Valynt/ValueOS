// This file acts as the "Brain" for specific industries.
// It maps keywords to specific value drivers and metrics.

export interface IndustryTemplate {
  name: string;
  keywords: string[];
  role: string;
  focusAreas: string[];
  metrics: string[];
  typicalPainPoints: string[];
}

export const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  logistics: {
    name: "Logistics & Supply Chain",
    keywords: [
      "logistics",
      "supply chain",
      "freight",
      "warehouse",
      "transportation",
      "fleet",
      "3pl",
    ],
    role: "Supply Chain Optimization Expert",
    focusAreas: [
      "Network Optimization",
      "Inventory Carrying Costs",
      "Last-Mile Delivery Efficiency",
      "Carrier Rate Negotiation",
    ],
    metrics: [
      "Cost Per Unit Shipped",
      "On-Time In-Full (OTIF)",
      "Inventory Turnover Ratio",
      "Total Landed Cost",
    ],
    typicalPainPoints: [
      "Rising fuel surcharges eroding margins",
      "Lack of real-time visibility into shipment status",
      "Inefficient warehouse slotting increasing pick times",
    ],
  },
  saas: {
    name: "B2B SaaS / Technology",
    keywords: ["software", "saas", "cloud", "platform", "subscription", "arr"],
    role: "Digital Transformation Consultant",
    focusAreas: [
      "Tech Stack Consolidation",
      "Process Automation",
      "Data Silo Elimination",
      "Security & Compliance",
    ],
    metrics: [
      "Customer Acquisition Cost (CAC)",
      "Lifetime Value (LTV)",
      "Net Revenue Retention (NRR)",
      "Time-to-Value",
    ],
    typicalPainPoints: [
      "Disjointed tools causing manual data entry",
      "High churn due to poor adoption",
      "Security vulnerabilities in legacy systems",
    ],
  },
  manufacturing: {
    name: "Industrial Manufacturing",
    keywords: [
      "manufacturing",
      "plant",
      "factory",
      "production",
      "oee",
      "industrial",
    ],
    role: "Lean Manufacturing Specialist",
    focusAreas: [
      "Overall Equipment Effectiveness (OEE)",
      "Unplanned Downtime Reduction",
      "Quality Yield Improvement",
      "Supply Chain Resilience",
    ],
    metrics: [
      "OEE %",
      "Scrap Rate",
      "Mean Time Between Failures (MTBF)",
      "Energy Cost Per Unit",
    ],
    typicalPainPoints: [
      "Aging assets causing unexpected downtime",
      "High scrap rates due to quality variance",
      "Energy inefficiencies driving up OPEX",
    ],
  },
  default: {
    name: "General Strategic Business",
    keywords: [],
    role: "Strategic Business Consultant",
    focusAreas: [
      "Revenue Growth",
      "Cost Reduction",
      "Risk Mitigation",
      "Operational Efficiency",
    ],
    metrics: [
      "Return on Investment (ROI)",
      "Net Profit Margin",
      "Customer Satisfaction (CSAT)",
      "Employee Productivity",
    ],
    typicalPainPoints: [
      "Stagnant growth in competitive markets",
      "Operational bottlenecks slowing delivery",
      "Rising operational costs",
    ],
  },
};

export const detectIndustry = (text: string): IndustryTemplate => {
  const lowerText = text.toLowerCase();

  for (const key in INDUSTRY_TEMPLATES) {
    if (key === "default") continue;
    const template = INDUSTRY_TEMPLATES[key];
    if (template.keywords.some((keyword) => lowerText.includes(keyword))) {
      return template;
    }
  }
  return INDUSTRY_TEMPLATES.default;
};
