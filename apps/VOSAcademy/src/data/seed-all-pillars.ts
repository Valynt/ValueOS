import { pillars, resources } from "../drizzle/schema";

import { getDb } from "./db";

async function seedAllPillars() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log("Seeding all 10 VOS pillars...\n");

  // Pillar data structure matching schema
  const pillarData = [
    {
      pillarNumber: 1,
      title: "Unified Value Language",
      description: "Ensure every employee speaks the same value language—outcomes, capabilities, KPIs, and ROI.",
      duration: "4 hours",
      content: {
        overview: "This pillar establishes a common value language across your organization, ensuring everyone from Sales to Customer Success to Product speaks the same language when discussing outcomes, capabilities, KPIs, and ROI.",
        learningObjectives: [
          "Define value in enterprise context using the Revenue/Cost/Risk framework",
          "Master KPI taxonomy and standard definitions",
          "Apply unified value language across all functions",
          "Create and maintain an internal value glossary"
        ],
        keyTakeaways: [
          "Value is quantifiable through Revenue, Cost, and Risk dimensions",
          "Consistent terminology prevents miscommunication across teams",
          "KPI definitions must be standardized organization-wide",
          "A shared value language enables better discovery and ROI modeling"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 2,
      title: "Value Data Model Mastery",
      description: "Train teams on the structure and purpose of the VOS Value Data Model.",
      duration: "6 hours",
      content: {
        overview: "Master the Value Tree hierarchy and understand how to structure value data that feeds into ROI calculations. Learn the inputs required for the ROI Engine and data collection standards.",
        learningObjectives: [
          "Understand Value Tree hierarchy structure",
          "Identify inputs required for ROI Engine",
          "Apply data collection standards consistently",
          "Build a complete Value Tree for real-world scenarios"
        ],
        keyTakeaways: [
          "Value Trees provide hierarchical structure for organizing value data",
          "Proper data collection is foundational to accurate ROI modeling",
          "ROI Engine requires specific inputs at each level of the hierarchy",
          "Standardized data models enable cross-team collaboration"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 3,
      title: "Discovery Excellence",
      description: "Enable teams to run high-quality discovery using the unified method.",
      duration: "8 hours",
      content: {
        overview: "Learn to conduct effective discovery sessions using persona frameworks, pain quantification techniques, and structured problem analysis. Master the art of uncovering quantifiable value opportunities.",
        learningObjectives: [
          "Apply persona frameworks to discovery conversations",
          "Quantify pain points with concrete data",
          "Structure problems systematically for analysis",
          "Conduct discovery sessions that uncover real value opportunities"
        ],
        keyTakeaways: [
          "Effective discovery requires structured methodology",
          "Pain quantification separates good from great value engineers",
          "Persona-based approaches improve discovery quality",
          "Discovery insights directly feed business case development"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 4,
      title: "Business Case Development",
      description: "Create consistent, defensible ROI models across the organization.",
      duration: "10 hours",
      content: {
        overview: "Build conservative, defensible ROI models that link KPIs to product capabilities. Learn to structure executive-ready narratives that win deals and drive adoption.",
        learningObjectives: [
          "Build conservative, defensible ROI models",
          "Link KPIs directly to product capabilities",
          "Structure executive-ready value narratives",
          "Present business cases with confidence and credibility"
        ],
        keyTakeaways: [
          "Conservative modeling builds trust and credibility",
          "Clear KPI-to-capability linkage is essential",
          "Executive narratives must be concise and outcome-focused",
          "Defensible ROI models survive scrutiny from finance teams"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 5,
      title: "Lifecycle Handoffs & Governance",
      description: "Teach how value transitions across the Opportunity → Target → Realization → Expansion lifecycle.",
      duration: "6 hours",
      content: {
        overview: "Master the value lifecycle from initial opportunity through realization and expansion. Learn required handoff artifacts, governance review processes, and version control expectations.",
        learningObjectives: [
          "Understand all stages of the value lifecycle",
          "Execute clean handoffs with complete artifacts",
          "Participate effectively in governance reviews",
          "Maintain version control across the lifecycle"
        ],
        keyTakeaways: [
          "Value must survive transitions between teams",
          "Handoff artifacts prevent value loss",
          "Governance ensures accountability",
          "Version control maintains single source of truth"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 6,
      title: "Realization Tracking & Value Proof",
      description: "Ensure CS and Product teams execute on value realization.",
      duration: "8 hours",
      content: {
        overview: "Implement instrumentation for value tracking, monitor KPIs through dashboards, conduct variance analysis, and prove value realization to customers with data.",
        learningObjectives: [
          "Implement proper instrumentation for value tracking",
          "Monitor KPIs effectively through dashboards",
          "Conduct variance analysis to identify gaps",
          "Prove value realization to customers with concrete data"
        ],
        keyTakeaways: [
          "Instrumentation must be planned during sales cycle",
          "KPI dashboards drive accountability",
          "Variance analysis identifies intervention opportunities",
          "Proven value drives renewals and expansion"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 7,
      title: "Expansion & Benchmarking Strategy",
      description: "Teach how to identify new value opportunities after initial sale.",
      duration: "6 hours",
      content: {
        overview: "Apply benchmark methodology to identify gaps, conduct systematic gap analysis, and model ROI for expansion opportunities including upsell and cross-sell.",
        learningObjectives: [
          "Apply benchmark methodology effectively",
          "Conduct gap analysis to find opportunities",
          "Model ROI for expansion scenarios",
          "Identify and quantify upsell and cross-sell value"
        ],
        keyTakeaways: [
          "Benchmarking reveals untapped value potential",
          "Gap analysis drives expansion conversations",
          "Expansion ROI must be as rigorous as initial sale",
          "Systematic approach prevents missed opportunities"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 8,
      title: "Cross-Functional Collaboration Patterns",
      description: "Standardize how functions work together in a value-led company.",
      duration: "5 hours",
      content: {
        overview: "Establish operating rhythms for Marketing→Sales→CS transitions, Product alignment loops, and cross-functional value workflows. Build collaboration patterns that scale.",
        learningObjectives: [
          "Execute smooth Marketing→Sales value transitions",
          "Meet Sales→CS handoff expectations consistently",
          "Participate effectively in Product alignment loops",
          "Establish sustainable cross-functional operating rhythm"
        ],
        keyTakeaways: [
          "Cross-functional alignment multiplies value impact",
          "Operating rhythms prevent ad-hoc chaos",
          "Clear expectations enable smooth transitions",
          "Product alignment ensures solution-value fit"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 9,
      title: "AI-Augmented Value Workflows",
      description: "Train teams on how AI agents support value engineering.",
      duration: "7 hours",
      content: {
        overview: "Leverage GenAI prompts for value engineering tasks, apply AI agent usage patterns, integrate with Value Fabric, and achieve 30% productivity gains through AI augmentation.",
        learningObjectives: [
          "Use GenAI prompts effectively for value engineering",
          "Apply AI agent usage patterns to workflows",
          "Integrate seamlessly with Value Fabric platform",
          "Achieve measurable productivity gains through AI"
        ],
        keyTakeaways: [
          "AI augmentation is the 30% scoring factor in certification",
          "Proper prompting unlocks AI value engineering potential",
          "Agent patterns standardize AI usage across teams",
          "Value Fabric integration enables autonomous workflows"
        ],
        resources: []
      }
    },
    {
      pillarNumber: 10,
      title: "Leadership & Culture of Value",
      description: "Build leadership commitment to value-first behavior.",
      duration: "5 hours",
      content: {
        overview: "Learn how leaders reinforce value-first behavior, apply value-based decision frameworks, align incentive structures with value outcomes, and build a sustainable culture of value.",
        learningObjectives: [
          "Reinforce value-first behavior as a leader",
          "Apply value-based decision frameworks consistently",
          "Align incentive structures with value outcomes",
          "Build and sustain a culture of value across the organization"
        ],
        keyTakeaways: [
          "Leadership commitment is essential for VOS success",
          "Incentives must align with value outcomes",
          "Decision frameworks embed value thinking",
          "Culture change requires consistent reinforcement"
        ],
        resources: []
      }
    }
  ];

  // Insert all pillars
  for (const pillar of pillarData) {
    await db.insert(pillars).values({
      pillarNumber: pillar.pillarNumber,
      title: pillar.title,
      description: pillar.description,
      duration: pillar.duration,
      content: pillar.content,
    } as any).onConflictDoUpdate({
      target: pillars.pillarNumber,
      set: {
        title: pillar.title,
        description: pillar.description,
        duration: pillar.duration,
        content: pillar.content,
      } as any
    });
    
    console.log(`✓ Created/Updated Pillar ${pillar.pillarNumber}: ${pillar.title}`);
  }

  // Create resources for each pillar
  const resourceData = [
    { pillarId: 1, title: "Internal Glossary", resourceType: "template", fileUrl: "/resources/internal-glossary.pdf", vosRole: null },
    { pillarId: 2, title: "Value Tree Template", resourceType: "template", fileUrl: "/resources/value-tree-template.xlsx", vosRole: null },
    { pillarId: 3, title: "Discovery Scorecard", resourceType: "template", fileUrl: "/resources/discovery-scorecard.pdf", vosRole: null },
    { pillarId: 4, title: "ROI Model Template", resourceType: "template", fileUrl: "/resources/roi-model-template.xlsx", vosRole: null },
    { pillarId: 5, title: "Handoff Playbook", resourceType: "guide", fileUrl: "/resources/handoff-playbook.pdf", vosRole: null },
    { pillarId: 6, title: "Value Realization Plan Template", resourceType: "template", fileUrl: "/resources/value-realization-plan.xlsx", vosRole: null },
    { pillarId: 7, title: "Expansion ROI Model", resourceType: "template", fileUrl: "/resources/expansion-roi-model.xlsx", vosRole: null },
    { pillarId: 8, title: "Operating Rhythm Guide", resourceType: "guide", fileUrl: "/resources/operating-rhythm-guide.pdf", vosRole: null },
    { pillarId: 9, title: "AI Usage Policy", resourceType: "playbook", fileUrl: "/resources/ai-usage-policy.pdf", vosRole: null },
    { pillarId: 9, title: "GenAI Prompt Library", resourceType: "framework", fileUrl: "/resources/genai-prompt-library.pdf", vosRole: null },
    { pillarId: 10, title: "Leadership Charter", resourceType: "guide", fileUrl: "/resources/leadership-charter.pdf", vosRole: null },
    { pillarId: 10, title: "VOS Leadership Presentation", resourceType: "template", fileUrl: "/resources/vos-leadership-presentation.pptx", vosRole: null },
  ];

  for (const resource of resourceData) {
    await db.insert(resources).values({
      title: resource.title,
      resourceType: resource.resourceType as "template" | "guide" | "playbook" | "framework" | "kpi_sheet",
      fileUrl: resource.fileUrl,
      pillarId: resource.pillarId,
      vosRole: resource.vosRole,
    } as any);
  }
  
  console.log(`\n✓ Created ${resourceData.length} downloadable resources`);

  console.log("\n✅ All 10 pillars seeded successfully!");
  process.exit(0);
}

seedAllPillars();
