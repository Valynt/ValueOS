/**
 * VOS Academy Curriculum Definitions
 * Role-based learning paths mapping to VOS pillars and modules
 */

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  pillarId: number;
  order: number;
  requiredMaturityLevel: number;
  estimatedDuration: string; // e.g., "2 hours"
  prerequisites?: string[]; // module IDs
  skills?: string[];
  resources?: string[]; // resource IDs
}

export interface CurriculumPillar {
  pillarId: number;
  title: string;
  description: string;
  modules: CurriculumModule[];
  targetMaturityLevel: number;
}

export interface RoleCurriculum {
  role: string;
  displayName: string;
  description: string;
  pillars: CurriculumPillar[];
  maturityProgression: {
    [level: number]: {
      label: string;
      description: string;
      behaviors: string[];
      outcomes: string[];
    };
  };
}

// Maturity progression framework (L0-L5)
export const MATURITY_LEVELS = {
  0: {
    label: "L0: Value Chaos",
    description: "No systematic approach to value engineering",
    behaviors: [
      "Value discussions are ad-hoc and inconsistent",
      "No standardized ROI modeling processes",
      "KPIs are not connected to business outcomes"
    ],
    outcomes: [
      "Inconsistent deal sizes and win rates",
      "Difficulty proving solution value",
      "Limited customer expansion opportunities"
    ]
  },
  1: {
    label: "L1: Ad-hoc/Manual",
    description: "Basic value language and manual processes",
    behaviors: [
      "Basic understanding of value terminology",
      "Manual ROI calculations for key deals",
      "Some KPI tracking but not systematic"
    ],
    outcomes: [
      "Improved deal qualification",
      "Basic ROI conversations with prospects",
      "Foundation for systematic value approach"
    ]
  },
  2: {
    label: "L2: Performance Measurement",
    description: "Systematic value measurement and modeling",
    behaviors: [
      "Standardized value language across teams",
      "Consistent ROI modeling processes",
      "KPI dashboards and regular tracking"
    ],
    outcomes: [
      "Predictable deal economics",
      "Data-driven value conversations",
      "Customer value realization tracking"
    ]
  },
  3: {
    label: "L3: Managed/Optimizing",
    description: "Optimized value processes with cross-functional alignment",
    behaviors: [
      "Integrated value workflows across functions",
      "Automated value modeling tools",
      "Cross-functional value governance"
    ],
    outcomes: [
      "Optimized resource allocation",
      "Accelerated sales cycles",
      "Systematic expansion identification"
    ]
  },
  4: {
    label: "L4: Predictive Analytics",
    description: "Predictive value insights and proactive optimization",
    behaviors: [
      "Predictive value modeling and forecasting",
      "AI-augmented value discovery",
      "Real-time value optimization"
    ],
    outcomes: [
      "Predictive deal sizing and timing",
      "Proactive customer success",
      "Data-driven expansion strategies"
    ]
  },
  5: {
    label: "L5: Value Orchestration",
    description: "Fully orchestrated value ecosystem with autonomous optimization",
    behaviors: [
      "Autonomous value orchestration systems",
      "AI-driven value ecosystem management",
      "Culture of value excellence"
    ],
    outcomes: [
      "Maximum value capture and realization",
      "Industry-leading customer outcomes",
      "Sustainable competitive advantage"
    ]
  }
};

// Role-specific curriculum definitions
export const ROLE_CURRICULA: Record<string, RoleCurriculum> = {
  sales: {
    role: "sales",
    displayName: "Sales Engineer",
    description: "Value engineering for sales teams focused on deal qualification, ROI modeling, and customer value conversations",
    pillars: [
      {
        pillarId: 1,
        title: "Unified Value Language",
        description: "Master the common value language for effective customer conversations",
        targetMaturityLevel: 1,
        modules: [
          {
            id: "sales-1-1",
            title: "Value Terminology Fundamentals",
            description: "Learn core value concepts: Revenue, Cost, Risk framework",
            pillarId: 1,
            order: 1,
            requiredMaturityLevel: 0,
            estimatedDuration: "1 hour",
            skills: ["Value terminology", "ROI basics"],
            resources: ["internal-glossary"]
          },
          {
            id: "sales-1-2",
            title: "KPI Discovery Techniques",
            description: "Master techniques for identifying and quantifying customer KPIs",
            pillarId: 1,
            order: 2,
            requiredMaturityLevel: 0,
            estimatedDuration: "1.5 hours",
            prerequisites: ["sales-1-1"],
            skills: ["KPI identification", "Discovery conversations"],
            resources: ["discovery-scorecard"]
          }
        ]
      },
      {
        pillarId: 2,
        title: "Value Data Model Mastery",
        description: "Build and navigate Value Trees for comprehensive ROI modeling",
        targetMaturityLevel: 2,
        modules: [
          {
            id: "sales-2-1",
            title: "Value Tree Construction",
            description: "Learn to build hierarchical Value Trees from customer data",
            pillarId: 2,
            order: 1,
            requiredMaturityLevel: 1,
            estimatedDuration: "2 hours",
            prerequisites: ["sales-1-2"],
            skills: ["Value Tree building", "Data modeling"],
            resources: ["value-tree-template"]
          }
        ]
      },
      {
        pillarId: 4,
        title: "Business Case Development",
        description: "Create compelling, defensible ROI models for deals",
        targetMaturityLevel: 3,
        modules: [
          {
            id: "sales-4-1",
            title: "ROI Model Construction",
            description: "Build conservative, credible ROI models using Value Tree data",
            pillarId: 4,
            order: 1,
            requiredMaturityLevel: 2,
            estimatedDuration: "3 hours",
            prerequisites: ["sales-2-1"],
            skills: ["ROI modeling", "Financial analysis"],
            resources: ["roi-model-template"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  },

  customer_success: {
    role: "customer_success",
    displayName: "Customer Success Manager",
    description: "Value realization and expansion focused on post-sale customer outcomes",
    pillars: [
      {
        pillarId: 1,
        title: "Unified Value Language",
        description: "Align on value terminology for customer conversations",
        targetMaturityLevel: 1,
        modules: [
          {
            id: "cs-1-1",
            title: "Value Realization Fundamentals",
            description: "Understand how to measure and prove customer value realization",
            pillarId: 1,
            order: 1,
            requiredMaturityLevel: 0,
            estimatedDuration: "1.5 hours",
            skills: ["Value measurement", "Customer outcomes"],
            resources: ["internal-glossary"]
          }
        ]
      },
      {
        pillarId: 6,
        title: "Realization Tracking & Value Proof",
        description: "Implement value tracking and prove ROI to customers",
        targetMaturityLevel: 4,
        modules: [
          {
            id: "cs-6-1",
            title: "Value Tracking Implementation",
            description: "Set up KPI monitoring and value realization dashboards",
            pillarId: 6,
            order: 1,
            requiredMaturityLevel: 3,
            estimatedDuration: "2.5 hours",
            prerequisites: ["cs-1-1"],
            skills: ["KPI tracking", "Dashboard creation"],
            resources: ["value-realization-plan"]
          }
        ]
      },
      {
        pillarId: 7,
        title: "Expansion & Benchmarking Strategy",
        description: "Identify and pursue expansion opportunities",
        targetMaturityLevel: 4,
        modules: [
          {
            id: "cs-7-1",
            title: "Expansion Opportunity Identification",
            description: "Use benchmarking to find gaps and model expansion ROI",
            pillarId: 7,
            order: 1,
            requiredMaturityLevel: 3,
            estimatedDuration: "2 hours",
            skills: ["Benchmarking", "Expansion modeling"],
            resources: ["expansion-roi-model"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  },

  marketing: {
    role: "marketing",
    displayName: "Marketing Manager",
    description: "Value-focused marketing content and lead generation",
    pillars: [
      {
        pillarId: 1,
        title: "Unified Value Language",
        description: "Create value-focused marketing content and messaging",
        targetMaturityLevel: 1,
        modules: [
          {
            id: "marketing-1-1",
            title: "Value-Based Messaging",
            description: "Develop marketing messages that speak the customer's value language",
            pillarId: 1,
            order: 1,
            requiredMaturityLevel: 0,
            estimatedDuration: "1.5 hours",
            skills: ["Value messaging", "Content creation"],
            resources: ["value-messaging-framework"]
          }
        ]
      },
      {
        pillarId: 3,
        title: "Discovery Excellence",
        description: "Support sales with value-focused discovery enablement",
        targetMaturityLevel: 2,
        modules: [
          {
            id: "marketing-3-1",
            title: "Discovery Content Creation",
            description: "Create content and tools to enable better customer discovery",
            pillarId: 3,
            order: 1,
            requiredMaturityLevel: 1,
            estimatedDuration: "2 hours",
            prerequisites: ["marketing-1-1"],
            skills: ["Content strategy", "Sales enablement"],
            resources: ["discovery-scorecard"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  },

  product: {
    role: "product",
    displayName: "Product Manager",
    description: "Value-driven product development and roadmap planning",
    pillars: [
      {
        pillarId: 2,
        title: "Value Data Model Mastery",
        description: "Understand value data requirements for product planning",
        targetMaturityLevel: 2,
        modules: [
          {
            id: "product-2-1",
            title: "Value Data Integration",
            description: "Design products that generate the data needed for value modeling",
            pillarId: 2,
            order: 1,
            requiredMaturityLevel: 1,
            estimatedDuration: "2 hours",
            skills: ["Product design", "Data modeling"],
            resources: ["value-tree-template"]
          }
        ]
      },
      {
        pillarId: 9,
        title: "AI-Augmented Value Workflows",
        description: "Integrate AI capabilities into value engineering workflows",
        targetMaturityLevel: 5,
        modules: [
          {
            id: "product-9-1",
            title: "AI Integration Design",
            description: "Design AI features that enhance value engineering capabilities",
            pillarId: 9,
            order: 1,
            requiredMaturityLevel: 4,
            estimatedDuration: "3 hours",
            prerequisites: ["product-2-1"],
            skills: ["AI product design", "Workflow automation"],
            resources: ["genai-prompt-library"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  },

  executive: {
    role: "executive",
    displayName: "Executive Leader",
    description: "Strategic leadership for value-driven organizational transformation",
    pillars: [
      {
        pillarId: 10,
        title: "Leadership & Culture of Value",
        description: "Build organizational commitment to value excellence",
        targetMaturityLevel: 5,
        modules: [
          {
            id: "executive-10-1",
            title: "Value Leadership Strategy",
            description: "Develop strategies for embedding value thinking across the organization",
            pillarId: 10,
            order: 1,
            requiredMaturityLevel: 3,
            estimatedDuration: "2.5 hours",
            skills: ["Strategic leadership", "Culture change"],
            resources: ["leadership-charter"]
          }
        ]
      },
      {
        pillarId: 8,
        title: "Cross-Functional Collaboration Patterns",
        description: "Establish operating rhythms for value-led organizations",
        targetMaturityLevel: 3,
        modules: [
          {
            id: "executive-8-1",
            title: "Value Operating Model Design",
            description: "Design cross-functional processes that maximize value capture",
            pillarId: 8,
            order: 1,
            requiredMaturityLevel: 2,
            estimatedDuration: "2 hours",
            skills: ["Process design", "Cross-functional leadership"],
            resources: ["operating-rhythm-guide"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  },

  value_engineer: {
    role: "value_engineer",
    displayName: "Value Engineer",
    description: "Expert practitioners specializing in complex value engineering scenarios",
    pillars: [
      {
        pillarId: 1,
        title: "Unified Value Language",
        description: "Master advanced value terminology and concepts",
        targetMaturityLevel: 1,
        modules: [
          {
            id: "ve-1-1",
            title: "Advanced Value Frameworks",
            description: "Deep dive into Revenue/Cost/Risk frameworks and advanced value concepts",
            pillarId: 1,
            order: 1,
            requiredMaturityLevel: 0,
            estimatedDuration: "2 hours",
            skills: ["Advanced value theory", "Framework application"],
            resources: ["internal-glossary"]
          }
        ]
      },
      {
        pillarId: 2,
        title: "Value Data Model Mastery",
        description: "Expert-level Value Tree construction and data modeling",
        targetMaturityLevel: 2,
        modules: [
          {
            id: "ve-2-1",
            title: "Complex Value Tree Modeling",
            description: "Build sophisticated Value Trees for enterprise-scale scenarios",
            pillarId: 2,
            order: 1,
            requiredMaturityLevel: 1,
            estimatedDuration: "3 hours",
            prerequisites: ["ve-1-1"],
            skills: ["Advanced data modeling", "Enterprise scenarios"],
            resources: ["value-tree-template"]
          }
        ]
      },
      {
        pillarId: 3,
        title: "Discovery Excellence",
        description: "Advanced discovery techniques for complex customer situations",
        targetMaturityLevel: 2,
        modules: [
          {
            id: "ve-3-1",
            title: "Strategic Discovery Frameworks",
            description: "Apply advanced discovery methodologies for strategic customer engagements",
            pillarId: 3,
            order: 1,
            requiredMaturityLevel: 1,
            estimatedDuration: "3 hours",
            skills: ["Strategic discovery", "Complex problem analysis"],
            resources: ["discovery-scorecard"]
          }
        ]
      },
      {
        pillarId: 4,
        title: "Business Case Development",
        description: "Expert ROI modeling and business case construction",
        targetMaturityLevel: 3,
        modules: [
          {
            id: "ve-4-1",
            title: "Advanced ROI Modeling",
            description: "Build sophisticated ROI models for complex, multi-year scenarios",
            pillarId: 4,
            order: 1,
            requiredMaturityLevel: 2,
            estimatedDuration: "4 hours",
            prerequisites: ["ve-2-1", "ve-3-1"],
            skills: ["Advanced financial modeling", "Risk analysis"],
            resources: ["roi-model-template"]
          }
        ]
      },
      {
        pillarId: 5,
        title: "Lifecycle Handoffs & Governance",
        description: "Expert lifecycle management and governance processes",
        targetMaturityLevel: 3,
        modules: [
          {
            id: "ve-5-1",
            title: "Lifecycle Orchestration",
            description: "Master complex handoffs and governance across enterprise lifecycles",
            pillarId: 5,
            order: 1,
            requiredMaturityLevel: 2,
            estimatedDuration: "2.5 hours",
            skills: ["Lifecycle management", "Governance design"],
            resources: ["handoff-playbook"]
          }
        ]
      },
      {
        pillarId: 6,
        title: "Realization Tracking & Value Proof",
        description: "Advanced value realization measurement and proof",
        targetMaturityLevel: 4,
        modules: [
          {
            id: "ve-6-1",
            title: "Advanced Value Instrumentation",
            description: "Design comprehensive value tracking systems and measurement frameworks",
            pillarId: 6,
            order: 1,
            requiredMaturityLevel: 3,
            estimatedDuration: "3 hours",
            prerequisites: ["ve-4-1"],
            skills: ["Advanced instrumentation", "Measurement design"],
            resources: ["value-realization-plan"]
          }
        ]
      },
      {
        pillarId: 7,
        title: "Expansion & Benchmarking Strategy",
        description: "Expert expansion modeling and strategic benchmarking",
        targetMaturityLevel: 4,
        modules: [
          {
            id: "ve-7-1",
            title: "Strategic Expansion Modeling",
            description: "Develop sophisticated expansion strategies and ROI models",
            pillarId: 7,
            order: 1,
            requiredMaturityLevel: 3,
            estimatedDuration: "3 hours",
            skills: ["Strategic expansion", "Advanced benchmarking"],
            resources: ["expansion-roi-model"]
          }
        ]
      },
      {
        pillarId: 8,
        title: "Cross-Functional Collaboration Patterns",
        description: "Expert cross-functional orchestration and operating rhythms",
        targetMaturityLevel: 3,
        modules: [
          {
            id: "ve-8-1",
            title: "Enterprise Operating Model Design",
            description: "Design scalable cross-functional processes for value orchestration",
            pillarId: 8,
            order: 1,
            requiredMaturityLevel: 2,
            estimatedDuration: "2.5 hours",
            skills: ["Operating model design", "Scalable processes"],
            resources: ["operating-rhythm-guide"]
          }
        ]
      },
      {
        pillarId: 9,
        title: "AI-Augmented Value Workflows",
        description: "Expert AI integration and automation for value engineering",
        targetMaturityLevel: 5,
        modules: [
          {
            id: "ve-9-1",
            title: "AI Value Orchestration",
            description: "Design AI systems that autonomously optimize value engineering workflows",
            pillarId: 9,
            order: 1,
            requiredMaturityLevel: 4,
            estimatedDuration: "4 hours",
            prerequisites: ["ve-6-1"],
            skills: ["AI orchestration", "Autonomous systems"],
            resources: ["genai-prompt-library"]
          }
        ]
      },
      {
        pillarId: 10,
        title: "Leadership & Culture of Value",
        description: "Expert leadership for value transformation at scale",
        targetMaturityLevel: 5,
        modules: [
          {
            id: "ve-10-1",
            title: "Value Transformation Leadership",
            description: "Lead large-scale organizational transformation toward value excellence",
            pillarId: 10,
            order: 1,
            requiredMaturityLevel: 4,
            estimatedDuration: "3 hours",
            skills: ["Transformation leadership", "Culture design"],
            resources: ["leadership-charter"]
          }
        ]
      }
    ],
    maturityProgression: MATURITY_LEVELS
  }
};

// Utility functions for curriculum management
export function getCurriculumForRole(role: string): RoleCurriculum | undefined {
  return ROLE_CURRICULA[role];
}

export function getAllRoles(): string[] {
  return Object.keys(ROLE_CURRICULA);
}

export function getModulesForRole(role: string): CurriculumModule[] {
  const curriculum = getCurriculumForRole(role);
  if (!curriculum) return [];

  return curriculum.pillars.flatMap(pillar => pillar.modules);
}

export function getRecommendedModules(
  userRole: string,
  userMaturityLevel: number,
  completedModules: string[] = [],
  inProgressModules: string[] = [],
  limit: number = 5
): CurriculumModule[] {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) return [];

  // Get all available modules (not completed, not locked)
  const availableModules = curriculum.pillars
    .flatMap(pillar => pillar.modules)
    .filter(module => {
      // Inline getModuleStatus logic to avoid circular import
      if (completedModules.includes(module.id)) return false;
      if (inProgressModules.includes(module.id)) return false;
      if (userMaturityLevel < module.requiredMaturityLevel) return false;
      if (module.prerequisites) {
        const hasAllPrerequisites = module.prerequisites.every(prereq =>
          completedModules.includes(prereq)
        );
        if (!hasAllPrerequisites) return false;
      }
      return true;
    })
    .filter(module => !completedModules.includes(module.id))
    .filter(module => !inProgressModules.includes(module.id));

  // Sort by pillar order, then module order
  availableModules.sort((a, b) => {
    if (a.pillarId !== b.pillarId) {
      return a.pillarId - b.pillarId;
    }
    return a.order - b.order;
  });

  return availableModules.slice(0, limit);
}

export function getNextModulesForUser(
  userRole: string,
  userMaturityLevel: number,
  completedModules: string[] = [],
  inProgressModules: string[] = []
): CurriculumModule[] {
  const curriculum = getCurriculumForRole(userRole);
  if (!curriculum) return [];

  const accessibleModules = curriculum.pillars
    .flatMap(pillar => pillar.modules)
    .filter(module => {
      // Inline isModuleAccessible logic to avoid circular import
      if (completedModules.includes(module.id)) return false;
      if (inProgressModules.includes(module.id)) return false;
      if (userMaturityLevel < module.requiredMaturityLevel) return false;
      if (module.prerequisites) {
        const hasAllPrerequisites = module.prerequisites.every(prereq =>
          completedModules.includes(prereq)
        );
        if (!hasAllPrerequisites) return false;
      }
      return true;
    })
    .filter(module => !completedModules.includes(module.id));

  // Return modules sorted by pillar and order
  return accessibleModules.sort((a, b) => {
    if (a.pillarId !== b.pillarId) {
      return a.pillarId - b.pillarId;
    }
    return a.order - b.order;
  });
}
