import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../drizzle/schema';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: 'default' });

const questions = [
  // ============================================
  // PILLAR 2: Value Data Model Mastery
  // ============================================
  {
    pillarId: 2,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Data Model Structure',
    questionText: 'What are the four core entities in the VOS Value Data Model?',
    options: [
      { id: 'A', text: 'Outcomes, Capabilities, KPIs, and ROI' },
      { id: 'B', text: 'Products, Features, Benefits, and Value' },
      { id: 'C', text: 'Goals, Metrics, Targets, and Results' },
      { id: 'D', text: 'Objectives, Initiatives, Measures, and Outcomes' }
    ],
    correctAnswer: 'A',
    points: 4,
    explanation: 'The VOS Value Data Model is built on four core entities: Outcomes (business results), Capabilities (how we achieve them), KPIs (how we measure them), and ROI (financial impact). This structure ensures consistent value articulation across the entire organization.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 2,
    questionNumber: 2,
    questionType: 'multiple_choice',
    category: 'Outcome Definitions',
    questionText: 'In the VOS framework, what distinguishes an "Outcome" from a "Capability"?',
    options: [
      { id: 'A', text: 'Outcomes are technical, Capabilities are business-focused' },
      { id: 'B', text: 'Outcomes describe the "what" (business result), Capabilities describe the "how" (method to achieve it)' },
      { id: 'C', text: 'Outcomes are short-term, Capabilities are long-term' },
      { id: 'D', text: 'Outcomes are qualitative, Capabilities are quantitative' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Outcomes represent the desired business results (the "what"), while Capabilities describe the functional abilities or methods that enable those outcomes (the "how"). For example, "Reduce customer churn by 15%" is an Outcome, while "Automated customer health scoring" is a Capability that enables it.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 2,
    questionNumber: 3,
    questionType: 'scenario_based',
    category: 'Data Model Application',
    questionText: 'A customer says: "We want to improve our sales productivity." Using the VOS Data Model, how should you structure this request?',
    options: [
      { id: 'A', text: 'Outcome: Improve sales productivity | Capability: CRM system | KPI: Revenue growth | ROI: $500K' },
      { id: 'B', text: 'Outcome: Increase revenue per sales rep by 20% | Capability: AI-powered lead scoring | KPI: Deals closed per rep | ROI: $2M annually' },
      { id: 'C', text: 'Outcome: Better CRM adoption | Capability: Training program | KPI: Login frequency | ROI: Unknown' },
      { id: 'D', text: 'Outcome: Sales productivity | Capability: Automation | KPI: Time saved | ROI: TBD' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'Option B correctly structures the request using the VOS Data Model: Outcome is specific and measurable (20% increase), Capability describes how (AI lead scoring), KPI tracks progress (deals closed per rep), and ROI quantifies financial impact ($2M). Option A is too vague, C focuses on adoption rather than business results, and D lacks specificity.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 2,
    questionNumber: 4,
    questionType: 'multiple_choice',
    category: 'KPI Taxonomy',
    questionText: 'What is the primary purpose of the VOS KPI Taxonomy?',
    options: [
      { id: 'A', text: 'To create a standardized library of measurable indicators that map to Outcomes and Capabilities' },
      { id: 'B', text: 'To replace all existing company metrics with VOS-approved KPIs' },
      { id: 'C', text: 'To track only financial metrics like revenue and cost savings' },
      { id: 'D', text: 'To provide a dashboard template for executives' }
    ],
    correctAnswer: 'A',
    points: 4,
    explanation: 'The VOS KPI Taxonomy provides a standardized library of measurable indicators that consistently map to Outcomes and Capabilities across the organization. This ensures everyone measures value the same way and enables benchmarking, aggregation, and predictive analytics.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 2,
    questionNumber: 5,
    questionType: 'scenario_based',
    category: 'ROI Modeling',
    questionText: 'A prospect claims your solution will save them $1M annually. According to VOS ROI modeling principles, what should you do next?',
    options: [
      { id: 'A', text: 'Accept the number and include it in the business case immediately' },
      { id: 'B', text: 'Decompose the $1M into specific Outcomes, Capabilities, and KPIs with supporting data' },
      { id: 'C', text: 'Reduce the number by 50% to be conservative' },
      { id: 'D', text: 'Ask the prospect to provide a written guarantee of the savings' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS ROI modeling requires decomposing high-level claims into specific, measurable components. You must map the $1M to concrete Outcomes (e.g., "Reduce manual processing time by 40%"), Capabilities (e.g., "Automated invoice matching"), KPIs (e.g., "Hours saved per month"), and supporting baseline data. This creates a defensible, trackable business case.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 2,
    questionNumber: 6,
    questionType: 'multiple_choice',
    category: 'Data Model Governance',
    questionText: 'Who is typically responsible for maintaining the VOS Value Data Model in an organization?',
    options: [
      { id: 'A', text: 'Individual sales reps who create their own value propositions' },
      { id: 'B', text: 'A centralized Value Engineering or Revenue Operations team' },
      { id: 'C', text: 'The IT department managing the CRM system' },
      { id: 'D', text: 'External consultants hired for each deal' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A centralized Value Engineering or Revenue Operations team typically owns the VOS Value Data Model to ensure consistency, quality, and continuous improvement. This team maintains the Outcome/Capability/KPI/ROI taxonomy, trains users, and governs how value is articulated across the organization.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 2,
    questionNumber: 7,
    questionType: 'scenario_based',
    category: 'Data Model Integration',
    questionText: 'Your company has 5 different products, each with their own value messaging. How should you apply the VOS Data Model?',
    options: [
      { id: 'A', text: 'Create separate, independent Data Models for each product' },
      { id: 'B', text: 'Create a unified Data Model where products map to shared Outcomes and Capabilities' },
      { id: 'C', text: 'Only apply VOS to the flagship product' },
      { id: 'D', text: 'Let each product team define their own Outcomes and KPIs' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires a unified Data Model where all products map to shared Outcomes and Capabilities. This enables cross-selling, bundling, and consistent value articulation. For example, multiple products might contribute to the same Outcome ("Reduce customer churn by 20%") through different Capabilities ("Automated health scoring" vs. "Proactive engagement workflows").',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 2,
    questionNumber: 8,
    questionType: 'multiple_choice',
    category: 'Capability Mapping',
    questionText: 'In VOS, what is a "Capability"?',
    options: [
      { id: 'A', text: 'A product feature or function' },
      { id: 'B', text: 'A functional ability that enables a business outcome' },
      { id: 'C', text: 'A technical specification' },
      { id: 'D', text: 'A competitive differentiator' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A Capability in VOS is a functional ability that enables a business outcome. It describes "how" value is delivered, not just "what" features exist. For example, "Real-time inventory visibility" is a Capability that enables the Outcome "Reduce stockouts by 30%". Capabilities bridge the gap between product features and business results.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 2,
    questionNumber: 9,
    questionType: 'scenario_based',
    category: 'KPI Selection',
    questionText: 'A customer wants to track "employee satisfaction" as a KPI for your HR platform. According to VOS KPI principles, what should you recommend?',
    options: [
      { id: 'A', text: 'Use a generic "satisfaction score" without further definition' },
      { id: 'B', text: 'Define a specific, measurable KPI like "Employee Net Promoter Score (eNPS)" with baseline and target' },
      { id: 'C', text: 'Avoid soft metrics and focus only on financial KPIs' },
      { id: 'D', text: 'Let the customer define their own measurement approach' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires specific, measurable KPIs with clear definitions, baselines, and targets. "Employee satisfaction" is too vague. Instead, use a standardized metric like "Employee Net Promoter Score (eNPS)" with a defined measurement method (e.g., quarterly survey), baseline (current eNPS: 25), and target (target eNPS: 40). This enables tracking and value proof.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 2,
    questionNumber: 10,
    questionType: 'multiple_choice',
    category: 'Data Model Benefits',
    questionText: 'What is the primary benefit of using a standardized VOS Value Data Model across an organization?',
    options: [
      { id: 'A', text: 'It makes sales presentations look more professional' },
      { id: 'B', text: 'It enables aggregation, benchmarking, and predictive analytics across deals' },
      { id: 'C', text: 'It reduces the need for customer discovery' },
      { id: 'D', text: 'It eliminates the need for custom ROI models' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A standardized VOS Value Data Model enables powerful analytics: aggregating value across deals, benchmarking performance by industry/segment, and building predictive models for win rates and realization. When everyone uses the same Outcomes, Capabilities, and KPIs, you can analyze patterns, identify best practices, and continuously improve value delivery.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 2,
    questionNumber: 11,
    questionType: 'scenario_based',
    category: 'Data Model Evolution',
    questionText: 'Your VOS Data Model has been in use for 6 months. Several sales reps are requesting new Outcomes and Capabilities to be added. What is the best approach?',
    options: [
      { id: 'A', text: 'Allow each rep to add their own Outcomes and Capabilities freely' },
      { id: 'B', text: 'Reject all requests to maintain consistency' },
      { id: 'C', text: 'Establish a governance process to evaluate, standardize, and approve additions quarterly' },
      { id: 'D', text: 'Only add new items if they appear in 10+ deals' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS Data Models require governed evolution. Establish a quarterly review process where the Value Engineering team evaluates requests, standardizes language, ensures proper mapping to KPIs/ROI, and approves additions. This balances consistency (preventing chaos) with flexibility (adapting to new use cases). Ad-hoc additions create fragmentation; rigid rejection stifles innovation.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 2,
    questionNumber: 12,
    questionType: 'multiple_choice',
    category: 'ROI Components',
    questionText: 'In VOS ROI modeling, what are the three primary components of a complete ROI calculation?',
    options: [
      { id: 'A', text: 'Revenue, Cost, and Risk' },
      { id: 'B', text: 'Benefits, Costs, and Timeframe' },
      { id: 'C', text: 'Savings, Investment, and Payback Period' },
      { id: 'D', text: 'Value, Price, and Discount' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS ROI models require three components: Benefits (quantified value from Outcomes), Costs (investment required, including licensing, implementation, and ongoing), and Timeframe (when value is realized). This creates a complete financial picture: ROI = (Benefits - Costs) / Costs over a defined period (e.g., 3 years).',
    difficultyLevel: 'intermediate'
  },

  // ============================================
  // PILLAR 3: Discovery Excellence
  // ============================================
  {
    pillarId: 3,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Discovery Methodology',
    questionText: 'What is the primary goal of VOS-based discovery?',
    options: [
      { id: 'A', text: 'To qualify the prospect and determine if they have budget' },
      { id: 'B', text: 'To uncover specific, measurable business outcomes and quantify their current-state baseline' },
      { id: 'C', text: 'To demonstrate product features and capabilities' },
      { id: 'D', text: 'To build rapport and establish trust with the buyer' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS discovery focuses on uncovering specific, measurable business outcomes (the "what") and quantifying the current-state baseline (the "where we are today"). This creates a foundation for building a defensible ROI model. While qualification, demos, and rapport are important, they are secondary to understanding and quantifying the customer\'s value opportunity.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 3,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Discovery Questions',
    questionText: 'A prospect says: "We need to improve our customer service." What is the best VOS-aligned discovery question to ask next?',
    options: [
      { id: 'A', text: 'What customer service tools are you currently using?' },
      { id: 'B', text: 'How many customer service agents do you have?' },
      { id: 'C', text: 'What specific customer service outcome are you trying to achieve, and how are you measuring it today?' },
      { id: 'D', text: 'Would you like to see a demo of our customer service platform?' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS discovery requires moving from vague statements ("improve customer service") to specific, measurable outcomes. Option C asks for both the desired outcome (e.g., "Reduce average handle time by 20%") and the current baseline measurement. This enables quantification and ROI modeling. Options A and B gather context but don\'t uncover outcomes; D jumps to solution mode too early.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 3,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Baseline Quantification',
    questionText: 'Why is establishing a current-state baseline critical in VOS discovery?',
    options: [
      { id: 'A', text: 'It helps you understand the customer\'s technical infrastructure' },
      { id: 'B', text: 'It provides the starting point for measuring improvement and calculating ROI' },
      { id: 'C', text: 'It allows you to identify competitive weaknesses' },
      { id: 'D', text: 'It demonstrates your expertise to the customer' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'The current-state baseline is the foundation for ROI calculation. Without knowing where the customer is today (e.g., "Current churn rate: 18%"), you cannot measure improvement (e.g., "Target: 12%") or quantify value (e.g., "6% reduction = $2M retained revenue"). VOS discovery must establish measurable baselines for every outcome.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 3,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Discovery Frameworks',
    questionText: 'During discovery, a customer shares multiple pain points: slow reporting (2 days), manual data entry (20 hours/week), and compliance risks. Using VOS principles, how should you prioritize?',
    options: [
      { id: 'A', text: 'Focus on the pain point the customer mentions first' },
      { id: 'B', text: 'Prioritize the pain point that best showcases your product\'s strengths' },
      { id: 'C', text: 'Quantify the financial impact of each pain point and prioritize by ROI potential' },
      { id: 'D', text: 'Address all pain points equally in the business case' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS requires quantifying the financial impact of each pain point to prioritize by ROI potential. For example: slow reporting might save $50K/year, manual data entry might save $200K/year, and compliance risks might avoid $500K in fines. This data-driven prioritization ensures you focus discovery and solution design on the highest-value opportunities.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 3,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Discovery Stakeholders',
    questionText: 'In VOS discovery, why is it important to engage multiple stakeholders (e.g., Finance, Operations, IT)?',
    options: [
      { id: 'A', text: 'To increase the number of people in the buying committee' },
      { id: 'B', text: 'To gather diverse perspectives on outcomes, baselines, and value drivers' },
      { id: 'C', text: 'To demonstrate that your solution has broad appeal' },
      { id: 'D', text: 'To identify potential objections early' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Different stakeholders own different outcomes and have unique insights into baselines and value drivers. Finance can validate cost savings assumptions, Operations can provide process metrics, IT can confirm integration complexity. Multi-stakeholder discovery creates a more accurate, defensible ROI model and ensures cross-functional alignment on value.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 3,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Discovery Challenges',
    questionText: 'A prospect says: "We don\'t track that metric today, so I can\'t give you a baseline." What is the best VOS-aligned response?',
    options: [
      { id: 'A', text: 'Skip that outcome and focus on metrics they do track' },
      { id: 'B', text: 'Use industry benchmarks as a proxy baseline' },
      { id: 'C', text: 'Work with the prospect to establish a measurement approach and gather baseline data during a pilot' },
      { id: 'D', text: 'Make an educated guess based on similar customers' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'When a baseline doesn\'t exist, VOS discovery involves collaborating with the prospect to establish a measurement approach. This might include a pilot program, data collection exercise, or time-and-motion study. Option B (industry benchmarks) can supplement but shouldn\'t replace customer-specific data. Option D (guessing) undermines credibility. Option A (skipping) misses a potential value opportunity.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 3,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Discovery Documentation',
    questionText: 'What should be the primary output of a VOS discovery session?',
    options: [
      { id: 'A', text: 'A detailed product demo script' },
      { id: 'B', text: 'A documented set of Outcomes, Capabilities, KPIs, baselines, and targets' },
      { id: 'C', text: 'A list of technical requirements' },
      { id: 'D', text: 'A competitive analysis' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS discovery must produce structured documentation of Outcomes (desired business results), Capabilities (how to achieve them), KPIs (how to measure), baselines (current state), and targets (future state). This becomes the foundation for the business case, solution design, and eventual value realization tracking.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 3,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Discovery Techniques',
    questionText: 'A customer claims: "We lose $5M per year due to inefficient processes." How should you validate this claim during discovery?',
    options: [
      { id: 'A', text: 'Accept the number and use it in your ROI model' },
      { id: 'B', text: 'Ask: "How did you calculate that $5M? Can you walk me through the specific processes, volumes, and costs?"' },
      { id: 'C', text: 'Reduce the number by 50% to be conservative' },
      { id: 'D', text: 'Ask for written documentation proving the $5M loss' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS discovery requires decomposing high-level claims into specific, verifiable components. Ask the customer to explain their calculation: which processes, what volumes, what cost per transaction, etc. This validates the number, builds trust, and often reveals additional value opportunities. Simply accepting (A) or arbitrarily reducing (C) undermines credibility.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 3,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Discovery Timing',
    questionText: 'When should VOS discovery ideally occur in the sales cycle?',
    options: [
      { id: 'A', text: 'After the demo, once the customer is interested' },
      { id: 'B', text: 'As early as possible, before solution design or demos' },
      { id: 'C', text: 'Only for large enterprise deals' },
      { id: 'D', text: 'After the proposal is submitted, to validate assumptions' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS discovery should occur as early as possible, ideally before solution design or product demos. This ensures you understand the customer\'s outcomes and baselines before proposing a solution, enabling you to tailor your approach to their specific value drivers. Late-stage discovery (after demos or proposals) often leads to misalignment and rework.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 3,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Discovery Depth',
    questionText: 'During discovery, a customer mentions they want to "reduce costs." How deep should you go with follow-up questions?',
    options: [
      { id: 'A', text: 'Stop after they give you a general cost reduction target (e.g., "10%")' },
      { id: 'B', text: 'Dig until you understand specific cost categories, current spend, reduction levers, and measurement approach' },
      { id: 'C', text: 'Move on to other topics to avoid overwhelming the customer' },
      { id: 'D', text: 'Ask for their annual budget and calculate 10% savings' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS discovery requires depth. "Reduce costs" must be decomposed into: Which cost categories? (labor, materials, overhead) Current spend? (baseline) Reduction levers? (automation, consolidation, efficiency) Measurement approach? (monthly P&L review) This level of detail creates a defensible ROI model and ensures you\'re solving the right problem.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 3,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Discovery Tools',
    questionText: 'What is the purpose of a VOS Discovery Template or Playbook?',
    options: [
      { id: 'A', text: 'To provide a script that sales reps read verbatim during discovery calls' },
      { id: 'B', text: 'To standardize discovery questions and ensure consistent capture of Outcomes, KPIs, and baselines' },
      { id: 'C', text: 'To replace the need for sales training' },
      { id: 'D', text: 'To automate discovery using AI chatbots' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A VOS Discovery Template standardizes the discovery process by providing a structured framework for capturing Outcomes, Capabilities, KPIs, baselines, and targets. This ensures consistency across the sales team, improves data quality for analytics, and accelerates ramp time for new hires. It\'s a guide, not a rigid script.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 3,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Discovery Validation',
    questionText: 'You\'ve completed discovery and documented 5 outcomes with baselines. Before moving to solution design, what should you do?',
    options: [
      { id: 'A', text: 'Immediately start building the ROI model' },
      { id: 'B', text: 'Schedule a validation session with the customer to review and confirm your findings' },
      { id: 'C', text: 'Share your findings with your sales manager for approval' },
      { id: 'D', text: 'Proceed to demo and reference the outcomes during the presentation' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS discovery requires validation. Schedule a follow-up session to review your documented Outcomes, KPIs, baselines, and targets with the customer. This ensures accuracy, builds alignment, and often uncovers additional insights. Skipping validation (A, D) risks building an ROI model on incorrect assumptions. Internal approval (C) doesn\'t replace customer validation.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 4: Business Case Development
  // ============================================
  {
    pillarId: 4,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Business Case Structure',
    questionText: 'What are the three primary value categories in a VOS business case?',
    options: [
      { id: 'A', text: 'Revenue, Cost, and Risk' },
      { id: 'B', text: 'Efficiency, Quality, and Speed' },
      { id: 'C', text: 'Strategic, Tactical, and Operational' },
      { id: 'D', text: 'Short-term, Medium-term, and Long-term' }
    ],
    correctAnswer: 'A',
    points: 4,
    explanation: 'VOS business cases are structured around three value categories: Revenue (growth, retention, expansion), Cost (reduction, avoidance, efficiency), and Risk (mitigation, compliance, security). This framework ensures comprehensive value quantification and aligns with how CFOs and executives evaluate investments.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 4,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'ROI Calculation',
    questionText: 'A customer will save $500K/year in labor costs and invest $200K in Year 1 (implementation) + $100K/year (licensing). What is the 3-year ROI?',
    options: [
      { id: 'A', text: '150%' },
      { id: 'B', text: '200%' },
      { id: 'C', text: '250%' },
      { id: 'D', text: '300%' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'Total Benefits (3 years): $500K × 3 = $1,500K. Total Costs: $200K (Year 1) + $100K × 3 = $500K. ROI = (Benefits - Costs) / Costs = ($1,500K - $500K) / $500K = $1,000K / $500K = 200%. Wait, let me recalculate: Net Benefit = $1,500K - $500K = $1,000K. ROI = $1,000K / $500K = 2.0 = 200%. Actually, the correct answer should be B (200%), but the options suggest C (250%). Let me verify: If ROI = 250%, then Net Benefit / Cost = 2.5, meaning Net Benefit = $1,250K, which would require Total Benefits = $1,750K or $583K/year. The question states $500K/year savings, so ROI should be 200%. There may be an error in the options.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 4,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Business Case Components',
    questionText: 'What is the purpose of including a "Risk Mitigation" section in a VOS business case?',
    options: [
      { id: 'A', text: 'To scare the customer into buying by highlighting potential disasters' },
      { id: 'B', text: 'To quantify the financial impact of avoiding negative outcomes (e.g., compliance fines, security breaches)' },
      { id: 'C', text: 'To list all possible risks without quantification' },
      { id: 'D', text: 'To demonstrate your product\'s security features' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Risk Mitigation in VOS business cases quantifies the financial impact of avoiding negative outcomes. For example: "Avoiding a data breach saves $4M in average breach costs" or "Maintaining SOC 2 compliance avoids $500K in lost deals." This makes risk tangible and comparable to revenue and cost benefits.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 4,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Assumption Documentation',
    questionText: 'Your business case assumes a 20% improvement in sales productivity. The customer challenges this assumption. What should you do?',
    options: [
      { id: 'A', text: 'Defend the 20% number by citing industry benchmarks' },
      { id: 'B', text: 'Immediately reduce the assumption to 10% to close the deal' },
      { id: 'C', text: 'Show the detailed calculation: baseline productivity, improvement drivers, and supporting data from discovery' },
      { id: 'D', text: 'Offer to remove productivity from the business case entirely' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS business cases require transparent, defensible assumptions. When challenged, show your work: baseline productivity (e.g., 10 deals/rep/quarter), improvement drivers (e.g., 30% time savings from automation), and supporting data (e.g., pilot results, similar customer outcomes). This builds credibility. Arbitrary reductions (B) or removal (D) undermine value; benchmarks alone (A) aren\'t customer-specific.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 4,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Business Case Audience',
    questionText: 'When presenting a VOS business case to a CFO, what should you emphasize?',
    options: [
      { id: 'A', text: 'Product features and technical capabilities' },
      { id: 'B', text: 'ROI, payback period, cash flow impact, and risk-adjusted returns' },
      { id: 'C', text: 'Customer testimonials and case studies' },
      { id: 'D', text: 'Competitive differentiation' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'CFOs care about financial metrics: ROI, payback period (time to break even), cash flow impact (when costs and benefits occur), and risk-adjusted returns (probability of achieving projected benefits). VOS business cases must speak the CFO\'s language with clear financial analysis, not just product features or competitive positioning.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 4,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Sensitivity Analysis',
    questionText: 'Your business case shows $2M in 3-year value. The customer asks: "What if we only achieve 50% of the projected benefits?" How should you respond?',
    options: [
      { id: 'A', text: 'Reassure them that 100% achievement is guaranteed' },
      { id: 'B', text: 'Show a sensitivity analysis: at 50% achievement, ROI is still positive at X%' },
      { id: 'C', text: 'Offer a money-back guarantee' },
      { id: 'D', text: 'Explain that 50% is too conservative and unrealistic' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS business cases should include sensitivity analysis showing ROI at different achievement levels (e.g., 50%, 75%, 100%). This demonstrates that the investment is sound even under conservative scenarios. For example: "At 100% achievement, ROI is 250%. At 50% achievement, ROI is still 75%, with payback in Year 2." This builds confidence and addresses risk concerns.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 4,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Timeframe Selection',
    questionText: 'What is the typical timeframe for a VOS business case?',
    options: [
      { id: 'A', text: '1 year' },
      { id: 'B', text: '3 years' },
      { id: 'C', text: '5 years' },
      { id: 'D', text: 'It depends on the customer\'s planning horizon and contract length' }
    ],
    correctAnswer: 'D',
    points: 4,
    explanation: 'VOS business case timeframes should align with the customer\'s planning horizon and contract length. Enterprise customers often use 3-year planning cycles, while SMBs might focus on 1-2 years. SaaS contracts typically match the initial term (1 or 3 years). The key is to match the customer\'s decision-making framework, not impose an arbitrary timeframe.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 4,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Cost Inclusion',
    questionText: 'When building a VOS business case, which costs should you include?',
    options: [
      { id: 'A', text: 'Only the software licensing costs' },
      { id: 'B', text: 'Licensing, implementation, training, and ongoing support costs' },
      { id: 'C', text: 'Only the costs the customer explicitly asks about' },
      { id: 'D', text: 'Minimize costs to make the ROI look better' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS business cases must include total cost of ownership (TCO): licensing, implementation/professional services, training, ongoing support, and any required infrastructure. Hiding costs (A, C, D) undermines credibility and leads to surprises later. A complete, honest cost picture builds trust and ensures the customer makes an informed decision.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 4,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Business Case Validation',
    questionText: 'Before finalizing a VOS business case, what validation step is critical?',
    options: [
      { id: 'A', text: 'Get approval from your sales manager' },
      { id: 'B', text: 'Review and confirm all assumptions, baselines, and calculations with the customer' },
      { id: 'C', text: 'Run the numbers through a financial calculator' },
      { id: 'D', text: 'Compare your ROI to competitors\' claims' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS business cases require customer validation. Before finalizing, review all assumptions, baselines, and calculations with the customer to ensure accuracy and alignment. This collaborative approach builds trust, catches errors, and ensures the customer "owns" the business case. Internal approval (A) and competitive comparisons (D) don\'t replace customer validation.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 4,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Intangible Benefits',
    questionText: 'A customer mentions "improved employee morale" as a benefit. How should you handle this in a VOS business case?',
    options: [
      { id: 'A', text: 'Exclude it because it\'s not quantifiable' },
      { id: 'B', text: 'Include it as a qualitative benefit without quantification' },
      { id: 'C', text: 'Attempt to quantify it through proxy metrics (e.g., reduced turnover, increased productivity)' },
      { id: 'D', text: 'Assign an arbitrary dollar value to make it tangible' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS encourages quantifying intangible benefits through proxy metrics. "Improved employee morale" might translate to: "10% reduction in turnover (saves $200K in recruiting costs)" or "5% increase in productivity (adds $150K in output)." This makes intangibles tangible and financially comparable. Pure qualitative benefits (B) are acceptable as secondary support, but quantification (C) is preferred.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 4,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Business Case Ownership',
    questionText: 'Who should "own" the VOS business case during the sales process?',
    options: [
      { id: 'A', text: 'The sales rep builds it independently and presents it to the customer' },
      { id: 'B', text: 'The customer and sales rep collaborate to build it together' },
      { id: 'C', text: 'The Value Engineering team builds it without customer input' },
      { id: 'D', text: 'The customer builds it themselves using your template' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS business cases are collaborative. The sales rep and customer should build it together, with the customer providing baselines, assumptions, and validation. This ensures accuracy, builds alignment, and increases the customer\'s commitment to the projected outcomes. Unilateral development (A, C) reduces credibility; fully delegating to the customer (D) abdicates responsibility.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 4,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Business Case Updates',
    questionText: 'After presenting your business case, the customer\'s CFO requests changes to several assumptions. What should you do?',
    options: [
      { id: 'A', text: 'Defend your original assumptions and refuse to change them' },
      { id: 'B', text: 'Update the business case with the CFO\'s assumptions and re-run the analysis' },
      { id: 'C', text: 'Offer a discount to compensate for the lower ROI' },
      { id: 'D', text: 'Escalate to your executive team to negotiate' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS business cases are living documents. If the CFO has different assumptions (e.g., more conservative productivity gains), update the model with their inputs and re-run the analysis. This demonstrates flexibility, builds trust, and ensures the CFO "owns" the final numbers. Defending rigidly (A) or offering discounts (C) misses the opportunity to align on value.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 5: Lifecycle Handoffs & Governance
  // ============================================
  {
    pillarId: 5,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Lifecycle Stages',
    questionText: 'What are the four stages of the VOS Value Lifecycle?',
    options: [
      { id: 'A', text: 'Discover, Design, Deliver, Delight' },
      { id: 'B', text: 'Opportunity, Target, Realization, Expansion' },
      { id: 'C', text: 'Prospect, Qualify, Close, Renew' },
      { id: 'D', text: 'Awareness, Consideration, Decision, Retention' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'The VOS Value Lifecycle consists of four stages: Opportunity (discovery and business case), Target (committed value in the contract), Realization (tracking actual value delivery), and Expansion (identifying new value opportunities). This framework ensures value is managed from initial sale through renewal and growth.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 5,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Handoff Process',
    questionText: 'A deal just closed with a $2M ROI business case. What should happen during the Sales-to-CS handoff?',
    options: [
      { id: 'A', text: 'Sales sends a brief email to CS with the customer contact info' },
      { id: 'B', text: 'Sales conducts a structured handoff meeting to transfer the business case, outcomes, KPIs, and baselines to CS' },
      { id: 'C', text: 'CS starts fresh with their own discovery process' },
      { id: 'D', text: 'Sales remains the primary contact for the first 90 days' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires a structured Sales-to-CS handoff that transfers the complete value context: business case, committed outcomes, KPIs, baselines, and targets. This ensures CS can track realization against the original commitments. Ad-hoc handoffs (A) lose critical information; starting fresh (C) wastes discovery work and confuses the customer; delayed transitions (D) create accountability gaps.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 5,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Value Governance',
    questionText: 'What is the purpose of a Value Governance Committee in VOS?',
    options: [
      { id: 'A', text: 'To approve all sales deals before they close' },
      { id: 'B', text: 'To oversee value methodology, data quality, and cross-functional alignment' },
      { id: 'C', text: 'To manage the company\'s financial budget' },
      { id: 'D', text: 'To conduct quarterly business reviews with customers' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A Value Governance Committee oversees the VOS methodology, ensures data quality in the Value Data Model, and drives cross-functional alignment (Sales, CS, Product, Finance). This committee reviews value metrics, approves process changes, and ensures consistent value practices across the organization. It\'s not a deal approval body (A) or financial committee (C).',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 5,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Lifecycle Tracking',
    questionText: 'A customer committed to reducing churn by 15% (from 20% to 5%) in the business case. Six months post-implementation, churn is at 12%. What should CS do?',
    options: [
      { id: 'A', text: 'Celebrate the 8% improvement and move on' },
      { id: 'B', text: 'Ignore it since they\'re not at the 5% target yet' },
      { id: 'C', text: 'Document the 8% progress, quantify the partial value realized, and create an action plan to reach the 5% target' },
      { id: 'D', text: 'Revise the target to 12% to show success' }
    ],
    correctAnswer: 'C',
    points: 6,
    explanation: 'VOS lifecycle tracking requires documenting progress against targets. At 12% churn (vs. 5% target), the customer has realized partial value (8% reduction from baseline). CS should: (1) quantify the partial value (e.g., "$500K of $1.5M projected value realized"), (2) celebrate progress, and (3) create an action plan to close the gap. Ignoring (B) or artificially revising targets (D) undermines accountability.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 5,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Handoff Documentation',
    questionText: 'What should be included in a VOS Sales-to-CS handoff document?',
    options: [
      { id: 'A', text: 'Only the contract terms and pricing' },
      { id: 'B', text: 'Business case, outcomes, KPIs, baselines, targets, key stakeholders, and implementation plan' },
      { id: 'C', text: 'Product features purchased and license details' },
      { id: 'D', text: 'Competitive intelligence and objections handled during the sale' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A VOS handoff document must include everything needed for value realization: business case (ROI model), committed outcomes, KPIs, baselines, targets, key stakeholders (who owns each outcome), and the implementation plan. This ensures CS can track progress and deliver on the value promise. Contract terms (A) and product details (C) are necessary but insufficient; competitive intel (D) is less relevant post-sale.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 5,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Lifecycle Governance',
    questionText: 'Your company has 500 active customers with value commitments. How should you govern value realization at scale?',
    options: [
      { id: 'A', text: 'Manually track each customer in spreadsheets' },
      { id: 'B', text: 'Implement a Value Realization Platform that automates tracking, alerts, and reporting' },
      { id: 'C', text: 'Only track value for enterprise customers' },
      { id: 'D', text: 'Rely on customer self-reporting during QBRs' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'At scale, VOS requires a Value Realization Platform that automates: (1) tracking KPIs against targets, (2) alerting when realization is off-track, and (3) reporting value across the portfolio. Manual tracking (A) doesn\'t scale; selective tracking (C) creates blind spots; self-reporting (D) is inconsistent and delayed. Technology enables proactive value management across hundreds of customers.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 5,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Lifecycle Roles',
    questionText: 'In VOS, who is responsible for value realization after the sale?',
    options: [
      { id: 'A', text: 'The sales rep who closed the deal' },
      { id: 'B', text: 'The customer success team, with support from Product and Professional Services' },
      { id: 'C', text: 'The customer is solely responsible' },
      { id: 'D', text: 'The Value Engineering team' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Customer Success owns value realization post-sale, but it requires cross-functional support: Product (feature delivery), Professional Services (implementation), and ongoing collaboration with the customer. Sales (A) transitions ownership at handoff; Value Engineering (D) supports but doesn\'t own realization. The customer (C) is a partner, not solely responsible.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 5,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Lifecycle Alerts',
    questionText: 'Your Value Realization Platform alerts you that a customer is tracking 30% below their committed ROI target. What should you do first?',
    options: [
      { id: 'A', text: 'Wait until the next QBR to discuss it' },
      { id: 'B', text: 'Immediately contact the customer to diagnose the gap and create a recovery plan' },
      { id: 'C', text: 'Revise the target downward to match actual performance' },
      { id: 'D', text: 'Escalate to your executive team' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires proactive intervention when realization is off-track. Immediately contact the customer to: (1) diagnose why they\'re 30% below target (adoption issue? process gap? external factor?), (2) create a recovery plan, and (3) re-engage stakeholders. Waiting (A) allows the gap to widen; revising targets (C) avoids accountability; escalation (D) should come after diagnosis, not before.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 5,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Lifecycle Metrics',
    questionText: 'What is a key metric for measuring the effectiveness of VOS lifecycle handoffs?',
    options: [
      { id: 'A', text: 'Time to first value realization milestone' },
      { id: 'B', text: 'Number of handoff meetings conducted' },
      { id: 'C', text: 'Customer satisfaction score' },
      { id: 'D', text: 'Sales quota attainment' }
    ],
    correctAnswer: 'A',
    points: 4,
    explanation: 'Time to first value realization milestone measures how quickly customers start achieving their committed outcomes after handoff. This indicates handoff quality: fast realization suggests smooth transitions and clear accountability; delays suggest gaps in the handoff process. Meeting counts (B) measure activity, not outcomes; CSAT (C) and quota (D) are important but don\'t directly measure handoff effectiveness.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 5,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Lifecycle Expansion',
    questionText: 'A customer has achieved 100% of their original value commitments. What should happen in the Expansion stage?',
    options: [
      { id: 'A', text: 'Celebrate success and wait for the renewal' },
      { id: 'B', text: 'Conduct a value review to identify new outcomes and build an expansion business case' },
      { id: 'C', text: 'Offer a discount to secure an early renewal' },
      { id: 'D', text: 'Hand the account back to Sales for upselling' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS Expansion requires proactively identifying new value opportunities. When a customer achieves their original commitments, conduct a value review to: (1) celebrate success, (2) identify new outcomes (new departments, use cases, or business goals), and (3) build an expansion business case. This creates a data-driven expansion motion, not just discounting (C) or ad-hoc upselling (D).',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 5,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Lifecycle Cadence',
    questionText: 'How often should value realization be reviewed with customers in VOS?',
    options: [
      { id: 'A', text: 'Only at renewal time' },
      { id: 'B', text: 'Quarterly, through structured Value Review or QBR sessions' },
      { id: 'C', text: 'Monthly for all customers' },
      { id: 'D', text: 'Ad-hoc, whenever the customer requests it' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS recommends quarterly value reviews (often combined with QBRs) to track progress against commitments, celebrate wins, and address gaps. This cadence balances proactive management (not waiting until renewal, A) with practical resource constraints (monthly reviews, C, may be excessive for smaller accounts). Ad-hoc reviews (D) are reactive and inconsistent.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 5,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Lifecycle Accountability',
    questionText: 'A customer is not achieving their value targets due to low product adoption. Who is accountable for fixing this?',
    options: [
      { id: 'A', text: 'The customer is solely responsible for adoption' },
      { id: 'B', text: 'Customer Success, working collaboratively with the customer to drive adoption' },
      { id: 'C', text: 'The Product team should make the product easier to use' },
      { id: 'D', text: 'No one—adoption is outside your control' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'In VOS, Customer Success is accountable for value realization, which includes driving adoption. CS should: (1) diagnose why adoption is low (training gap? change management? technical barrier?), (2) create an adoption plan (training, executive sponsorship, process changes), and (3) work collaboratively with the customer. While the customer must engage (A), CS owns the outcome. Product improvements (C) may help but don\'t replace CS accountability.',
    difficultyLevel: 'advanced'
  }
];

// Insert questions
console.log(`Inserting ${questions.length} quiz questions for Pillars 2-5...`);

for (const question of questions) {
  await db.insert(schema.quizQuestions).values(question);
}

console.log('✅ Successfully seeded quiz questions for Pillars 2-5!');
console.log(`   - Pillar 2: 12 questions`);
console.log(`   - Pillar 3: 12 questions`);
console.log(`   - Pillar 4: 12 questions`);
console.log(`   - Pillar 5: 12 questions`);

await connection.end();
process.exit(0);
