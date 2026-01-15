import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../drizzle/schema';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// Get pillar IDs from database
const pillars = await db.select().from(schema.pillars);
const pillarMap = new Map(pillars.map(p => [p.pillarNumber, p.id]));

const questionsRaw = [
  // ============================================
  // PILLAR 6: Realization Tracking & Value Proof
  // ============================================
  {
    pillarId: 6,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Realization Fundamentals',
    questionText: 'What is the primary goal of Value Realization Tracking in VOS?',
    options: [
      { id: 'A', text: 'To prove the customer is using your product' },
      { id: 'B', text: 'To measure actual outcomes achieved against committed targets from the business case' },
      { id: 'C', text: 'To generate renewal quotes' },
      { id: 'D', text: 'To identify upsell opportunities' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Value Realization Tracking measures actual outcomes achieved (e.g., "Churn reduced from 20% to 8%") against the committed targets from the business case (e.g., "Target: 5% churn"). This creates accountability, enables course correction, and builds proof for renewals and expansions. Product usage (A), renewals (C), and upsells (D) are secondary benefits.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 6,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Realization Measurement',
    questionText: 'A customer committed to saving $500K/year through automation. How should you track realization?',
    options: [
      { id: 'A', text: 'Ask the customer if they\'re happy with the results' },
      { id: 'B', text: 'Track the specific KPIs (e.g., hours saved, cost per transaction) that drive the $500K savings' },
      { id: 'C', text: 'Assume they\'re realizing value if they renew' },
      { id: 'D', text: 'Wait until the end of the year to measure' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires tracking the underlying KPIs that drive financial outcomes. For $500K in automation savings, track: hours saved per month, cost per hour, and calculate monthly savings. This provides early indicators of realization (not waiting until year-end, D), creates objective proof (not just satisfaction, A), and enables proactive intervention if targets are missed.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 6,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Realization Cadence',
    questionText: 'How frequently should value realization be measured and reported in VOS?',
    options: [
      { id: 'A', text: 'Only at renewal time' },
      { id: 'B', text: 'Monthly or quarterly, depending on the KPI and customer segment' },
      { id: 'C', text: 'Daily for all customers' },
      { id: 'D', text: 'Annually' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS recommends monthly or quarterly realization tracking, depending on the KPI (some metrics update monthly, others quarterly) and customer segment (enterprise customers may have quarterly QBRs, SMBs may prefer monthly check-ins). This balances proactive management with practical resource constraints. Annual tracking (D) is too infrequent; daily (C) is excessive for most KPIs.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 6,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Realization Challenges',
    questionText: 'A customer is tracking 50% below their realization target due to low adoption. What should CS do?',
    options: [
      { id: 'A', text: 'Blame the customer for not using the product correctly' },
      { id: 'B', text: 'Create an adoption recovery plan with training, change management, and executive sponsorship' },
      { id: 'C', text: 'Offer a discount to compensate for the missed value' },
      { id: 'D', text: 'Revise the target downward to match current performance' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires proactive intervention when realization is off-track. CS should create an adoption recovery plan addressing root causes: training gaps, change management, executive sponsorship, technical barriers. Blaming the customer (A) damages the relationship; discounts (C) don\'t solve the underlying issue; revising targets (D) avoids accountability. CS owns value realization.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 6,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Value Proof',
    questionText: 'What is a "Value Proof" document in VOS?',
    options: [
      { id: 'A', text: 'A case study written by Marketing' },
      { id: 'B', text: 'A data-driven report showing actual outcomes achieved vs. committed targets' },
      { id: 'C', text: 'A customer testimonial video' },
      { id: 'D', text: 'A product usage dashboard' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A VOS Value Proof document is a data-driven report showing: (1) committed outcomes and targets from the business case, (2) actual results achieved (with supporting KPI data), and (3) quantified value realized. This creates objective proof for renewals, expansions, and case studies. Marketing case studies (A), testimonials (C), and usage dashboards (D) are valuable but don\'t replace quantified value proof.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 6,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Realization Reporting',
    questionText: 'You\'re preparing a Value Proof document for a customer who achieved 80% of their committed ROI. How should you present this?',
    options: [
      { id: 'A', text: 'Highlight only the successes and omit the 20% gap' },
      { id: 'B', text: 'Present the 80% achievement transparently, celebrate progress, and outline a plan to close the 20% gap' },
      { id: 'C', text: 'Revise the original target to make it look like 100% achievement' },
      { id: 'D', text: 'Focus on product features delivered instead of outcomes' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS Value Proof requires transparency. Present the 80% achievement honestly: (1) celebrate the $800K realized (if target was $1M), (2) acknowledge the 20% gap, (3) explain root causes, and (4) outline a plan to close the gap. This builds trust and demonstrates accountability. Hiding gaps (A), revising targets (C), or shifting to features (D) undermines credibility.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 6,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Realization Data Sources',
    questionText: 'Where should realization data ideally come from in VOS?',
    options: [
      { id: 'A', text: 'Customer self-reporting only' },
      { id: 'B', text: 'Product usage analytics only' },
      { id: 'C', text: 'A combination of customer systems, product analytics, and validated customer input' },
      { id: 'D', text: 'Industry benchmarks' }
    ],
    correctAnswer: 'C',
    points: 4,
    explanation: 'VOS realization data should come from multiple sources: (1) customer systems (e.g., their CRM, ERP, or BI tools for business metrics), (2) product analytics (usage, adoption, workflow completion), and (3) validated customer input (surveys, QBR discussions). This triangulation creates accurate, defensible proof. Relying solely on self-reporting (A), product data (B), or benchmarks (D) is insufficient.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 6,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Realization Automation',
    questionText: 'Your company has 200 customers with value commitments. How should you scale realization tracking?',
    options: [
      { id: 'A', text: 'Manually track each customer in spreadsheets' },
      { id: 'B', text: 'Implement automated KPI tracking with dashboards and alerts' },
      { id: 'C', text: 'Only track top 20 enterprise customers' },
      { id: 'D', text: 'Rely on annual customer surveys' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'At scale, VOS requires automated realization tracking: (1) integrate with customer systems to pull KPI data, (2) create dashboards showing progress vs. targets, and (3) set up alerts for at-risk accounts. Manual tracking (A) doesn\'t scale; selective tracking (C) creates blind spots; annual surveys (D) are too infrequent and subjective. Automation enables proactive value management across hundreds of customers.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 6,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Realization Stakeholders',
    questionText: 'Who should receive regular value realization reports in VOS?',
    options: [
      { id: 'A', text: 'Only the CSM managing the account' },
      { id: 'B', text: 'The customer\'s executive sponsor, key stakeholders, and internal CS leadership' },
      { id: 'C', text: 'Only the customer, not internal teams' },
      { id: 'D', text: 'Only internal teams, not the customer' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS realization reports should be shared with: (1) the customer\'s executive sponsor and key stakeholders (to drive accountability and celebrate wins), and (2) internal CS leadership (to identify at-risk accounts and best practices). Limiting to the CSM (A) reduces visibility; excluding the customer (D) or internal teams (C) creates misalignment.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 6,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Realization Metrics',
    questionText: 'A customer achieved their cost savings target but missed their revenue growth target. How should you calculate overall value realization?',
    options: [
      { id: 'A', text: 'Average the two percentages (e.g., 100% + 50% = 75% overall)' },
      { id: 'B', text: 'Weight by the dollar value of each outcome (e.g., $500K savings achieved + $200K of $1M revenue = $700K of $1.5M total = 47%)' },
      { id: 'C', text: 'Only report the successful outcome (cost savings)' },
      { id: 'D', text: 'Mark the entire engagement as unsuccessful' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS realization should be weighted by dollar value, not simple averages. If the customer achieved $500K in cost savings (100% of target) but only $200K in revenue growth (20% of $1M target), total realization is $700K of $1.5M committed = 47%. This provides an accurate financial picture. Simple averaging (A) distorts impact; selective reporting (C) or binary success/failure (D) miss nuance.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 6,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Realization Best Practices',
    questionText: 'What is a best practice for presenting value realization to customers?',
    options: [
      { id: 'A', text: 'Focus only on positive outcomes and hide any gaps' },
      { id: 'B', text: 'Use data visualization (charts, graphs) to make progress clear and celebrate wins' },
      { id: 'C', text: 'Present raw data tables without context' },
      { id: 'D', text: 'Wait until you have 100% achievement before sharing any results' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS realization reports should use data visualization (line charts showing progress over time, bar charts comparing targets vs. actuals) to make results clear and engaging. Celebrate wins, acknowledge gaps, and provide context. Hiding gaps (A) undermines trust; raw tables (C) are hard to interpret; waiting for perfection (D) misses opportunities to celebrate incremental progress.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 6,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Realization Governance',
    questionText: 'Your CS team is inconsistently tracking value realization across accounts. What governance mechanism should you implement?',
    options: [
      { id: 'A', text: 'Fire the CSMs who aren\'t tracking properly' },
      { id: 'B', text: 'Implement a standardized realization tracking process with templates, training, and regular audits' },
      { id: 'C', text: 'Make realization tracking optional' },
      { id: 'D', text: 'Hire a dedicated Value Realization team to do all the tracking' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires governance for consistent realization tracking: (1) standardized templates and processes, (2) training for CSMs, (3) regular audits to ensure compliance, and (4) dashboards showing which accounts have up-to-date realization data. Punitive measures (A) don\'t address root causes; optional tracking (C) creates inconsistency; fully delegating (D) removes CSM accountability.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 7: Expansion & Benchmarking Strategy
  // ============================================
  {
    pillarId: 7,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Expansion Fundamentals',
    questionText: 'In VOS, what is the foundation for a successful expansion strategy?',
    options: [
      { id: 'A', text: 'Offering discounts to encourage upsells' },
      { id: 'B', text: 'Proven value realization from the initial deployment' },
      { id: 'C', text: 'Aggressive sales tactics' },
      { id: 'D', text: 'New product features' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS expansion is built on proven value realization. When customers have achieved their initial outcomes (e.g., "Reduced churn by 15%"), they have confidence to expand to new use cases, departments, or products. Discounts (A), aggressive tactics (C), or new features (D) are secondary. Value proof creates expansion opportunities.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 7,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Expansion Identification',
    questionText: 'A customer has achieved 100% of their initial value commitments in the Sales department. How should you identify expansion opportunities?',
    options: [
      { id: 'A', text: 'Immediately pitch all your other products' },
      { id: 'B', text: 'Conduct a value review to identify new outcomes in other departments (Marketing, CS) or deeper use cases in Sales' },
      { id: 'C', text: 'Wait for the customer to ask about expansion' },
      { id: 'D', text: 'Offer a discount on additional licenses' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS expansion starts with a value review: (1) celebrate success in Sales, (2) explore new outcomes in other departments (e.g., "Marketing wants to improve lead quality"), and (3) identify deeper use cases in Sales (e.g., "Expand from lead scoring to full sales forecasting"). This creates a data-driven expansion business case. Product pitches (A), passive waiting (C), or discounts (D) are less effective.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 7,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Benchmarking Purpose',
    questionText: 'What is the primary purpose of benchmarking in VOS?',
    options: [
      { id: 'A', text: 'To compare your product features to competitors' },
      { id: 'B', text: 'To show customers how their value realization compares to similar companies and identify improvement opportunities' },
      { id: 'C', text: 'To justify price increases' },
      { id: 'D', text: 'To create marketing content' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS benchmarking compares a customer\'s value realization to similar companies (by industry, size, maturity) to: (1) validate their progress (e.g., "You\'re in the top quartile for churn reduction"), (2) identify improvement opportunities (e.g., "Similar companies achieve 20% better productivity"), and (3) drive expansion. This is about customer outcomes, not product features (A), pricing (C), or marketing (D).',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 7,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Expansion Business Case',
    questionText: 'You\'re proposing an expansion from 100 to 500 users. How should you build the expansion business case?',
    options: [
      { id: 'A', text: 'Multiply the original ROI by 5 (5x users = 5x value)' },
      { id: 'B', text: 'Build a new business case based on the specific outcomes, baselines, and targets for the 400 new users' },
      { id: 'C', text: 'Reference the original business case without updates' },
      { id: 'D', text: 'Focus on the cost per user decreasing with volume' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS expansion requires a new business case tailored to the expansion scope. The 400 new users may have different baselines, use cases, and value drivers than the original 100. Build a fresh ROI model: discover their outcomes, quantify baselines, and calculate incremental value. Simple multiplication (A) ignores nuance; reusing the old case (C) lacks specificity; cost focus (D) misses value.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 7,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Expansion Timing',
    questionText: 'When is the ideal time to introduce expansion opportunities in VOS?',
    options: [
      { id: 'A', text: 'Immediately after the initial sale closes' },
      { id: 'B', text: 'After the customer has achieved measurable value from the initial deployment' },
      { id: 'C', text: 'Only at renewal time' },
      { id: 'D', text: 'Randomly throughout the customer lifecycle' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS expansion should occur after the customer has achieved measurable value from the initial deployment. This creates credibility and momentum: "You\'ve reduced churn by 15% in Sales—let\'s apply the same approach to Customer Success." Immediate upselling (A) lacks proof; waiting until renewal (C) misses mid-cycle opportunities; random timing (D) is inefficient.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 7,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Benchmarking Data',
    questionText: 'A customer asks: "How does our 12% churn reduction compare to other companies?" What data should you provide?',
    options: [
      { id: 'A', text: 'Generic industry averages from a research report' },
      { id: 'B', text: 'Anonymized benchmarks from similar customers (same industry, size, maturity) showing distribution (median, top quartile)' },
      { id: 'C', text: 'Only your best customer success story' },
      { id: 'D', text: 'Avoid answering to protect customer confidentiality' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS benchmarking requires relevant, anonymized data from similar customers. Show: (1) median churn reduction (e.g., "10%"), (2) top quartile (e.g., "18%"), and (3) where they fall in the distribution. This provides context and motivation. Generic industry data (A) may not be comparable; cherry-picking success stories (C) isn\'t representative; avoiding the question (D) misses a value conversation opportunity.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 7,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Expansion Metrics',
    questionText: 'What is a key metric for measuring VOS expansion success?',
    options: [
      { id: 'A', text: 'Number of upsell emails sent' },
      { id: 'B', text: 'Net Revenue Retention (NRR) driven by value-based expansions' },
      { id: 'C', text: 'Discount percentage offered on expansions' },
      { id: 'D', text: 'Number of product demos conducted' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Net Revenue Retention (NRR) measures revenue growth from existing customers (expansions minus churn). VOS aims for high NRR driven by value-based expansions (customers expanding because they\'ve realized value, not because of discounts). Activity metrics (A, D) don\'t measure outcomes; discount levels (C) may indicate weak value articulation.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 7,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Expansion Challenges',
    questionText: 'A customer achieved strong value but declines an expansion proposal. What should you do?',
    options: [
      { id: 'A', text: 'Offer a larger discount' },
      { id: 'B', text: 'Understand the objection: budget constraints? competing priorities? unclear value for the new use case?' },
      { id: 'C', text: 'Escalate to your executive team to pressure the customer' },
      { id: 'D', text: 'Move on to other accounts' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires understanding expansion objections. Even with proven value, customers may face: budget constraints (timing issue), competing priorities (need to re-prioritize), or unclear value for the new use case (need better discovery). Diagnose the root cause, then address it: adjust timing, build a stronger business case, or explore alternative expansion paths. Discounts (A) or pressure (C) don\'t solve underlying issues.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 7,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Benchmarking Segmentation',
    questionText: 'When creating benchmarks in VOS, how should you segment customers?',
    options: [
      { id: 'A', text: 'Don\'t segment—use overall averages across all customers' },
      { id: 'B', text: 'Segment by relevant attributes: industry, company size, maturity level, use case' },
      { id: 'C', text: 'Segment only by revenue size' },
      { id: 'D', text: 'Segment by geographic region only' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS benchmarks should be segmented by attributes that affect outcomes: industry (SaaS vs. manufacturing), company size (SMB vs. enterprise), maturity level (early adopter vs. laggard), and use case (sales automation vs. customer support). This creates relevant comparisons. Overall averages (A) are too broad; single-dimension segmentation (C, D) misses important context.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 7,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Expansion Playbooks',
    questionText: 'Your company has identified 3 common expansion patterns: (1) Department expansion, (2) Use case expansion, (3) Product cross-sell. How should you operationalize these?',
    options: [
      { id: 'A', text: 'Let each CSM figure out their own approach' },
      { id: 'B', text: 'Create expansion playbooks for each pattern with discovery questions, business case templates, and success criteria' },
      { id: 'C', text: 'Only focus on the highest revenue pattern' },
      { id: 'D', text: 'Train Sales to handle all expansions' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS expansion requires playbooks for each pattern: (1) discovery questions (e.g., "What outcomes does Marketing want to achieve?"), (2) business case templates (pre-populated with typical baselines and targets), and (3) success criteria (how to measure expansion success). This standardizes the approach and accelerates execution. Ad-hoc approaches (A) create inconsistency; selective focus (C) misses opportunities; delegating to Sales (D) removes CS ownership.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 7,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Benchmarking Presentation',
    questionText: 'How should you present benchmark data to customers in VOS?',
    options: [
      { id: 'A', text: 'Raw data tables without context' },
      { id: 'B', text: 'Visual comparisons (charts) showing where they rank and opportunities to improve' },
      { id: 'C', text: 'Only tell them if they\'re in the top quartile' },
      { id: 'D', text: 'Focus on where they\'re underperforming to create urgency' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS benchmarks should be presented visually (bar charts, percentile rankings) showing: (1) where the customer ranks (e.g., "60th percentile"), (2) the distribution (median, top quartile), and (3) opportunities to improve (e.g., "Top quartile companies achieve 25% better results"). Celebrate strengths and identify growth areas. Raw tables (A) are hard to interpret; selective sharing (C) or negative framing (D) miss the balanced approach.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 7,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Expansion ROI',
    questionText: 'A customer is considering expanding from 1 department to 5 departments. The expansion will cost $500K. How should you justify the investment?',
    options: [
      { id: 'A', text: 'Show that the cost per department decreases with scale' },
      { id: 'B', text: 'Build a business case showing the incremental outcomes, KPIs, and ROI for the 4 new departments' },
      { id: 'C', text: 'Reference the original department\'s success without new analysis' },
      { id: 'D', text: 'Offer a discount to make the $500K more palatable' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS expansion requires a new business case quantifying the incremental value for the 4 new departments. Discover their specific outcomes (e.g., "Marketing wants to improve lead quality by 30%"), quantify baselines, and calculate ROI. This creates a defensible investment case. Cost efficiency (A) is a factor but not the primary justification; referencing past success (C) lacks specificity; discounts (D) don\'t address value.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 8: Cross-Functional Collaboration Patterns
  // ============================================
  {
    pillarId: 8,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Collaboration Fundamentals',
    questionText: 'Why is cross-functional collaboration critical in VOS?',
    options: [
      { id: 'A', text: 'To increase the number of people involved in deals' },
      { id: 'B', text: 'Because value spans the entire customer lifecycle (Sales, CS, Product, Finance) and requires coordinated execution' },
      { id: 'C', text: 'To distribute blame when deals fail' },
      { id: 'D', text: 'To satisfy corporate team-building requirements' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS requires cross-functional collaboration because value spans the entire lifecycle: Sales discovers and commits to value, CS delivers and tracks it, Product builds capabilities, Finance validates ROI. Without coordination, value promises get lost in handoffs, realization suffers, and customers churn. Collaboration ensures accountability and continuity.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 8,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Sales-CS Alignment',
    questionText: 'Sales closes a deal with a $2M ROI commitment. CS receives the account but has no visibility into the business case. What process should be in place?',
    options: [
      { id: 'A', text: 'CS should start fresh with their own discovery' },
      { id: 'B', text: 'Implement a structured Sales-to-CS handoff process that transfers the business case, outcomes, KPIs, and baselines' },
      { id: 'C', text: 'Sales should manage the account for the first 90 days' },
      { id: 'D', text: 'CS should only focus on product adoption, not value realization' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires a structured Sales-to-CS handoff that transfers the complete value context: business case, committed outcomes, KPIs, baselines, and key stakeholders. This ensures CS can track realization against the original commitments. Starting fresh (A) wastes discovery work; delayed transitions (C) create accountability gaps; ignoring value (D) misses the point of VOS.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 8,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Product-Sales Alignment',
    questionText: 'How should Product and Sales teams collaborate in VOS?',
    options: [
      { id: 'A', text: 'Product builds features, Sales sells them—no collaboration needed' },
      { id: 'B', text: 'Product provides Sales with a roadmap of capabilities mapped to customer outcomes, and Sales provides feedback on market demand' },
      { id: 'C', text: 'Sales should dictate the product roadmap' },
      { id: 'D', text: 'Product should only build features after Sales closes deals' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS requires Product-Sales alignment: Product shares a roadmap of capabilities mapped to outcomes (e.g., "AI lead scoring enables 20% higher conversion"), enabling Sales to sell future value. Sales provides market feedback (e.g., "Customers are asking for multi-currency support"). This creates a feedback loop. Silos (A), one-way dictation (C), or reactive building (D) are inefficient.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 8,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Finance-Sales Collaboration',
    questionText: 'A CFO prospect challenges your ROI assumptions. How should Sales and Finance collaborate to address this?',
    options: [
      { id: 'A', text: 'Sales should defend the assumptions independently' },
      { id: 'B', text: 'Sales should involve their internal Finance team to validate the ROI model and address the CFO\'s concerns' },
      { id: 'C', text: 'Offer a discount to avoid the ROI discussion' },
      { id: 'D', text: 'Escalate to the executive team' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS encourages Sales-Finance collaboration on complex ROI discussions. Your internal Finance team can: (1) validate the ROI methodology, (2) speak the CFO\'s language (NPV, IRR, payback period), and (3) address technical concerns. This builds credibility. Solo defense (A) may lack financial expertise; discounts (C) avoid the issue; escalation (D) should come after Finance involvement.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 8,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Collaboration Metrics',
    questionText: 'What is a key metric for measuring cross-functional collaboration effectiveness in VOS?',
    options: [
      { id: 'A', text: 'Number of cross-functional meetings held' },
      { id: 'B', text: 'Time to value realization (how quickly customers achieve outcomes after sale)' },
      { id: 'C', text: 'Number of Slack messages exchanged between teams' },
      { id: 'D', text: 'Employee satisfaction scores' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'Time to value realization measures how quickly customers achieve their first outcome after the sale. This indicates collaboration quality: fast realization suggests smooth Sales-CS handoffs, Product-CS alignment on implementation, and Finance-CS alignment on tracking. Activity metrics (A, C) don\'t measure outcomes; employee satisfaction (D) is important but indirect.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 8,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'CS-Product Collaboration',
    questionText: 'CS identifies that 20% of customers are not realizing value due to a missing product capability. How should CS and Product collaborate?',
    options: [
      { id: 'A', text: 'CS should work around the limitation without involving Product' },
      { id: 'B', text: 'CS should provide Product with data on the impact (20% of customers, $X in at-risk revenue) and collaborate on a solution (roadmap prioritization or workaround)' },
      { id: 'C', text: 'CS should blame Product for the gap' },
      { id: 'D', text: 'Product should immediately build the feature without validation' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires CS-Product collaboration on value blockers. CS should provide data: (1) how many customers are affected (20%), (2) the impact on value realization (e.g., "$500K in at-risk ARR"), and (3) the specific capability gap. Product can then prioritize the roadmap or suggest workarounds. Workarounds alone (A) don\'t solve the root cause; blame (C) is unproductive; building without validation (D) may miss the mark.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 8,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Collaboration Tools',
    questionText: 'What type of tool is most critical for enabling cross-functional collaboration in VOS?',
    options: [
      { id: 'A', text: 'Email' },
      { id: 'B', text: 'A shared Value Management Platform that provides visibility into commitments, realization, and handoffs across teams' },
      { id: 'C', text: 'Separate CRM and CS platforms with no integration' },
      { id: 'D', text: 'Monthly all-hands meetings' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS requires a shared Value Management Platform that gives all teams (Sales, CS, Product, Finance) visibility into: (1) value commitments (business cases), (2) realization progress, and (3) handoff status. This creates a single source of truth. Email (A) is too fragmented; siloed systems (C) create blind spots; meetings (D) are too infrequent.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 8,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Marketing-Sales Collaboration',
    questionText: 'Marketing creates case studies, but Sales says they\'re not useful for deals. How should they collaborate to fix this?',
    options: [
      { id: 'A', text: 'Marketing should keep creating the same type of case studies' },
      { id: 'B', text: 'Sales and Marketing should collaborate to create outcome-based case studies with specific KPIs, baselines, and results' },
      { id: 'C', text: 'Sales should stop using case studies entirely' },
      { id: 'D', text: 'Marketing should create more case studies to increase volume' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS case studies should be outcome-based: (1) customer\'s initial challenge and baseline (e.g., "20% churn"), (2) committed outcomes and targets (e.g., "Reduce to 5%"), (3) actual results achieved (e.g., "Achieved 7% churn = $2M retained revenue"). Sales and Marketing should collaborate to ensure case studies follow this structure, making them useful for discovery and business case validation.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 8,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Collaboration Governance',
    questionText: 'What is the purpose of a Value Governance Committee in VOS?',
    options: [
      { id: 'A', text: 'To approve all sales deals before they close' },
      { id: 'B', text: 'To oversee cross-functional alignment on value methodology, data quality, and process improvements' },
      { id: 'C', text: 'To manage the company\'s budget' },
      { id: 'D', text: 'To conduct customer QBRs' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A Value Governance Committee brings together leaders from Sales, CS, Product, Finance, and Marketing to: (1) oversee the VOS methodology, (2) ensure data quality in the Value Data Model, (3) drive process improvements (e.g., better handoffs), and (4) resolve cross-functional conflicts. It\'s not a deal approval body (A), financial committee (C), or customer-facing team (D).',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 8,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Collaboration Challenges',
    questionText: 'Sales and CS are blaming each other for poor value realization. How should leadership address this?',
    options: [
      { id: 'A', text: 'Side with Sales since they bring in revenue' },
      { id: 'B', text: 'Implement shared accountability metrics (e.g., "Time to first value milestone") and collaborative processes (structured handoffs)' },
      { id: 'C', text: 'Side with CS since they own post-sale relationships' },
      { id: 'D', text: 'Reorganize the teams to eliminate the conflict' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires shared accountability. Implement metrics that both teams own (e.g., "Time to first value milestone" requires Sales to set realistic commitments and CS to deliver quickly). Establish collaborative processes (structured handoffs, joint value reviews). Taking sides (A, C) perpetuates silos; reorganization (D) doesn\'t address the root cause (misaligned incentives and processes).',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 8,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Collaboration Patterns',
    questionText: 'What is a "value handoff" in VOS?',
    options: [
      { id: 'A', text: 'A casual email introducing the customer to the next team' },
      { id: 'B', text: 'A structured process for transferring value commitments, context, and accountability between teams (e.g., Sales to CS)' },
      { id: 'C', text: 'A discount offered during renewals' },
      { id: 'D', text: 'A customer success playbook' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'A VOS value handoff is a structured process that transfers: (1) value commitments (business case, outcomes, KPIs), (2) context (customer stakeholders, priorities, challenges), and (3) accountability (who owns what). This ensures continuity across the lifecycle. Casual emails (A) lose critical information; discounts (C) and playbooks (D) are unrelated concepts.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 8,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Collaboration Incentives',
    questionText: 'Sales is compensated only on new bookings, CS only on renewals. This creates misalignment. How should compensation be structured in VOS?',
    options: [
      { id: 'A', text: 'Keep the current structure—it\'s standard practice' },
      { id: 'B', text: 'Add shared metrics: Sales gets partial credit for realization milestones, CS gets partial credit for expansion sourced from realized value' },
      { id: 'C', text: 'Pay everyone the same regardless of performance' },
      { id: 'D', text: 'Eliminate commissions entirely' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS encourages shared accountability through compensation: Sales gets credit for realization milestones (incentivizing realistic commitments and smooth handoffs), CS gets credit for value-driven expansions (incentivizing proactive value management). This aligns incentives with the full value lifecycle. Maintaining silos (A) perpetuates misalignment; flat pay (C) or no commissions (D) reduce motivation.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 9: AI-Augmented Value Workflows
  // ============================================
  {
    pillarId: 9,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'AI Fundamentals',
    questionText: 'What is the primary role of AI in VOS workflows?',
    options: [
      { id: 'A', text: 'To replace human value engineers entirely' },
      { id: 'B', text: 'To augment human capabilities by automating data analysis, generating insights, and accelerating repetitive tasks' },
      { id: 'C', text: 'To create marketing content' },
      { id: 'D', text: 'To handle customer support tickets' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI in VOS augments human capabilities: (1) automating data analysis (e.g., calculating ROI scenarios), (2) generating insights (e.g., identifying value patterns across deals), and (3) accelerating repetitive tasks (e.g., populating business case templates). AI enhances, not replaces, human judgment and relationship-building. Marketing (C) and support (D) are specific applications, not the primary role.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 9,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'AI in Discovery',
    questionText: 'During discovery, a customer shares 50 pages of process documentation. How can AI help?',
    options: [
      { id: 'A', text: 'Ignore the documentation and rely on verbal conversation' },
      { id: 'B', text: 'Use AI to analyze the documentation, extract key processes, identify inefficiencies, and suggest discovery questions' },
      { id: 'C', text: 'Manually read all 50 pages during the call' },
      { id: 'D', text: 'Ask the customer to summarize the documentation themselves' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI can analyze large documents to: (1) extract key processes and workflows, (2) identify inefficiencies or bottlenecks (e.g., "Manual approval step takes 3 days"), and (3) suggest targeted discovery questions (e.g., "How often do approvals get delayed?"). This accelerates discovery and ensures you focus on high-value areas. Ignoring (A) or delegating (D) wastes valuable input; manual reading (C) is too slow.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 9,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'AI in Business Cases',
    questionText: 'How can AI assist in building VOS business cases?',
    options: [
      { id: 'A', text: 'AI should build the entire business case without human input' },
      { id: 'B', text: 'AI can suggest relevant outcomes, pre-populate baselines from similar customers, and generate ROI scenarios' },
      { id: 'C', text: 'AI should only format the final document' },
      { id: 'D', text: 'AI has no role in business case development' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI can accelerate business case development by: (1) suggesting relevant outcomes based on the customer\'s industry and role, (2) pre-populating baselines using benchmarks from similar customers, and (3) generating multiple ROI scenarios (conservative, moderate, aggressive). Humans validate assumptions and tailor the narrative. Fully automated (A) lacks customization; formatting only (C) underutilizes AI; no role (D) misses opportunities.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 9,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'AI in Realization Tracking',
    questionText: 'You have 500 customers with value commitments. How can AI help track realization at scale?',
    options: [
      { id: 'A', text: 'Manually review each customer monthly' },
      { id: 'B', text: 'Use AI to analyze KPI data, identify at-risk accounts (tracking below target), and generate alerts for CSMs' },
      { id: 'C', text: 'Only track top 50 enterprise customers' },
      { id: 'D', text: 'Rely on customers to self-report progress' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI enables scalable realization tracking by: (1) analyzing KPI data across all customers, (2) identifying at-risk accounts (e.g., "Customer X is 30% below target"), (3) generating alerts for CSMs, and (4) suggesting interventions (e.g., "Schedule adoption workshop"). Manual tracking (A) doesn\'t scale; selective tracking (C) creates blind spots; self-reporting (D) is inconsistent.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 9,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'AI in Benchmarking',
    questionText: 'How can AI enhance VOS benchmarking?',
    options: [
      { id: 'A', text: 'AI cannot help with benchmarking' },
      { id: 'B', text: 'AI can automatically segment customers, calculate percentile rankings, and identify improvement opportunities' },
      { id: 'C', text: 'AI should only create charts' },
      { id: 'D', text: 'AI should replace human analysis entirely' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI can automate benchmarking by: (1) segmenting customers by industry, size, and maturity, (2) calculating percentile rankings (e.g., "You\'re in the 60th percentile for churn reduction"), and (3) identifying improvement opportunities (e.g., "Top quartile companies achieve 25% better results by using Feature X"). Visualization (C) is one output; full replacement (D) misses human context.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 9,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'AI in Expansion',
    questionText: 'A customer has achieved 100% of their initial value. How can AI identify expansion opportunities?',
    options: [
      { id: 'A', text: 'Wait for the customer to ask about expansion' },
      { id: 'B', text: 'Use AI to analyze the customer\'s usage patterns, identify underutilized capabilities, and suggest new use cases or departments' },
      { id: 'C', text: 'Offer a discount on additional licenses' },
      { id: 'D', text: 'Manually review all customer data' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI can identify expansion opportunities by: (1) analyzing usage patterns (e.g., "Sales is using lead scoring heavily, but Marketing isn\'t"), (2) identifying underutilized capabilities (e.g., "Customer has forecasting license but hasn\'t activated it"), and (3) suggesting new use cases (e.g., "Similar companies expand to Customer Success after Sales success"). This creates data-driven expansion motions.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 9,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'AI Ethics',
    questionText: 'What is a key ethical consideration when using AI in VOS?',
    options: [
      { id: 'A', text: 'AI should make all decisions without human oversight' },
      { id: 'B', text: 'Ensure AI recommendations are transparent, explainable, and validated by humans before customer-facing use' },
      { id: 'C', text: 'Use AI to manipulate customer data' },
      { id: 'D', text: 'Hide the use of AI from customers' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI in VOS must be transparent and explainable: (1) show how AI arrived at recommendations (e.g., "Based on 50 similar customers..."), (2) validate AI outputs with human judgment before sharing with customers, and (3) be honest about AI use. Autonomous decisions (A), manipulation (C), or hiding AI (D) undermine trust and ethics.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 9,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'AI in QBRs',
    questionText: 'You\'re preparing for a QBR with a customer. How can AI help?',
    options: [
      { id: 'A', text: 'AI cannot help with QBRs' },
      { id: 'B', text: 'Use AI to analyze realization data, generate a value summary, identify trends, and suggest discussion topics' },
      { id: 'C', text: 'Have AI conduct the QBR meeting' },
      { id: 'D', text: 'Use AI only to schedule the meeting' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI can prepare QBR content by: (1) analyzing realization data (e.g., "Achieved 85% of committed value"), (2) generating a value summary with visualizations, (3) identifying trends (e.g., "Adoption increased 20% this quarter"), and (4) suggesting discussion topics (e.g., "Explore expansion to Marketing"). Humans conduct the meeting and build relationships. Scheduling (D) underutilizes AI; conducting meetings (C) removes the human element.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 9,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'AI Training Data',
    questionText: 'What data should be used to train AI models for VOS workflows?',
    options: [
      { id: 'A', text: 'Only data from your best customers' },
      { id: 'B', text: 'A representative dataset including successful and unsuccessful outcomes, across industries and segments' },
      { id: 'C', text: 'Generic industry data not specific to your company' },
      { id: 'D', text: 'Only data from the last 6 months' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI models should be trained on representative data: (1) successful and unsuccessful outcomes (to learn what works and what doesn\'t), (2) multiple industries and segments (to generalize patterns), and (3) sufficient historical data (to capture trends). Cherry-picking successes (A) creates bias; generic data (C) lacks specificity; recent data only (D) misses long-term patterns.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 9,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'AI Limitations',
    questionText: 'AI suggests a business case with $5M in projected value. What should you do before presenting it to the customer?',
    options: [
      { id: 'A', text: 'Present it immediately—AI is always accurate' },
      { id: 'B', text: 'Validate the assumptions, check for reasonableness, and customize the narrative based on customer context' },
      { id: 'C', text: 'Reduce the number by 50% to be conservative' },
      { id: 'D', text: 'Ignore the AI suggestion and build the case manually' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI-generated business cases require human validation: (1) check assumptions for reasonableness (e.g., "Is 30% productivity improvement realistic?"), (2) validate against customer-specific context (e.g., "Does this align with their priorities?"), and (3) customize the narrative. Blind trust (A) is risky; arbitrary reductions (C) lack justification; ignoring AI (D) wastes its value.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 9,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'AI in Forecasting',
    questionText: 'How can AI improve value realization forecasting in VOS?',
    options: [
      { id: 'A', text: 'AI cannot help with forecasting' },
      { id: 'B', text: 'AI can analyze historical realization patterns to predict which customers will achieve targets and which are at risk' },
      { id: 'C', text: 'AI should only forecast revenue, not value realization' },
      { id: 'D', text: 'AI should replace human judgment in all forecasting decisions' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'AI can forecast value realization by analyzing historical patterns: (1) which customers achieved targets (and why), (2) early indicators of success (e.g., "High adoption in first 30 days correlates with 90% realization"), and (3) risk factors (e.g., "Low executive engagement predicts 40% below target"). This enables proactive intervention. Revenue-only focus (C) misses value; full automation (D) removes human judgment.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 9,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'AI Adoption',
    questionText: 'Your team is resistant to using AI in VOS workflows, fearing job displacement. How should leadership address this?',
    options: [
      { id: 'A', text: 'Force adoption without explanation' },
      { id: 'B', text: 'Communicate that AI augments (not replaces) their work, provide training, and show how AI frees time for high-value activities (relationship-building, strategic thinking)' },
      { id: 'C', text: 'Abandon AI initiatives' },
      { id: 'D', text: 'Only allow senior employees to use AI' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'AI adoption requires change management: (1) communicate that AI augments human capabilities (e.g., "AI handles data analysis, you focus on customer relationships"), (2) provide training on AI tools, and (3) show benefits (e.g., "AI saves 5 hours/week on business case creation"). Forced adoption (A) creates resistance; abandoning AI (C) misses opportunities; selective access (D) creates inequity.',
    difficultyLevel: 'advanced'
  },

  // ============================================
  // PILLAR 10: Leadership & Culture of Value
  // ============================================
  {
    pillarId: 10,
    questionNumber: 1,
    questionType: 'multiple_choice',
    category: 'Leadership Fundamentals',
    questionText: 'What is the primary role of leadership in establishing a VOS culture?',
    options: [
      { id: 'A', text: 'To delegate VOS implementation to middle management' },
      { id: 'B', text: 'To model value-first behavior, set clear expectations, and hold teams accountable to value outcomes' },
      { id: 'C', text: 'To approve VOS budgets' },
      { id: 'D', text: 'To attend VOS training sessions' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS leadership requires executives to: (1) model value-first behavior (e.g., "Show me the customer outcomes" in deal reviews), (2) set clear expectations (e.g., "All deals must have defensible ROI models"), and (3) hold teams accountable to value outcomes (not just revenue). Delegation (A), budget approval (C), or passive attendance (D) are insufficient.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 10,
    questionNumber: 2,
    questionType: 'scenario_based',
    category: 'Cultural Change',
    questionText: 'Your company has a "sell at any cost" culture. How should leadership shift to a value-first culture?',
    options: [
      { id: 'A', text: 'Send an email announcing the new culture' },
      { id: 'B', text: 'Change incentives (reward value realization, not just bookings), update processes (require business cases), and model the behavior in leadership meetings' },
      { id: 'C', text: 'Fire employees who don\'t adopt VOS immediately' },
      { id: 'D', text: 'Keep the current culture—it\'s working' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'Cultural change requires systemic shifts: (1) change incentives (e.g., "Sales gets credit for realization milestones"), (2) update processes (e.g., "No deal closes without a validated business case"), and (3) model the behavior (e.g., "CEO asks about customer outcomes in every deal review"). Emails (A) don\'t change behavior; punitive measures (C) create fear; maintaining the status quo (D) perpetuates problems.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 10,
    questionNumber: 3,
    questionType: 'multiple_choice',
    category: 'Value Metrics',
    questionText: 'What is a key metric for measuring VOS cultural adoption?',
    options: [
      { id: 'A', text: 'Number of VOS training sessions completed' },
      { id: 'B', text: 'Percentage of deals with validated business cases and percentage of customers achieving committed outcomes' },
      { id: 'C', text: 'Number of VOS-related Slack channels' },
      { id: 'D', text: 'Employee satisfaction scores' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS cultural adoption is measured by outcomes: (1) percentage of deals with validated business cases (indicates Sales adoption), and (2) percentage of customers achieving committed outcomes (indicates CS adoption and overall effectiveness). Activity metrics (A, C) don\'t measure behavior change; employee satisfaction (D) is important but indirect.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 10,
    questionNumber: 4,
    questionType: 'scenario_based',
    category: 'Executive Sponsorship',
    questionText: 'A VOS initiative is struggling due to lack of executive support. What should the VOS champion do?',
    options: [
      { id: 'A', text: 'Continue the initiative without executive support' },
      { id: 'B', text: 'Build a business case for VOS showing the impact on revenue retention, win rates, and customer satisfaction, then present to the executive team' },
      { id: 'C', text: 'Abandon the initiative' },
      { id: 'D', text: 'Blame the executives for lack of vision' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires executive sponsorship. Build an internal business case showing: (1) current pain points (e.g., "40% of customers don\'t renew due to unmet expectations"), (2) VOS benefits (e.g., "Companies with VOS see 20% higher NRR"), and (3) implementation plan. Present to executives to secure support. Continuing without support (A) limits impact; abandoning (C) wastes opportunity; blame (D) is unproductive.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 10,
    questionNumber: 5,
    questionType: 'multiple_choice',
    category: 'Communication',
    questionText: 'How should leadership communicate the VOS vision to the organization?',
    options: [
      { id: 'A', text: 'Send a one-time email announcement' },
      { id: 'B', text: 'Consistently reinforce the vision through multiple channels: all-hands meetings, deal reviews, QBRs, and recognition programs' },
      { id: 'C', text: 'Only communicate to Sales and CS teams' },
      { id: 'D', text: 'Keep the vision confidential to avoid confusion' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS vision requires consistent, multi-channel communication: (1) all-hands meetings (set the vision), (2) deal reviews (reinforce in practice), (3) QBRs (celebrate value wins), and (4) recognition programs (reward value-first behavior). One-time announcements (A) are forgotten; selective communication (C) creates silos; confidentiality (D) prevents adoption.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 10,
    questionNumber: 6,
    questionType: 'scenario_based',
    category: 'Resistance Management',
    questionText: 'A senior sales leader resists VOS, saying: "Business cases slow down deals." How should leadership respond?',
    options: [
      { id: 'A', text: 'Make business cases optional to avoid conflict' },
      { id: 'B', text: 'Show data: deals with business cases have higher win rates, faster close times (after initial learning curve), and better retention' },
      { id: 'C', text: 'Fire the sales leader' },
      { id: 'D', text: 'Ignore the resistance' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS resistance should be addressed with data: (1) deals with business cases have higher win rates (e.g., "60% vs. 40%"), (2) faster close times after the learning curve (e.g., "30 days vs. 45 days for complex deals"), and (3) better retention (e.g., "90% vs. 70% NRR"). This builds credibility. Making it optional (A) undermines the initiative; firing (C) is extreme; ignoring (D) allows resistance to spread.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 10,
    questionNumber: 7,
    questionType: 'multiple_choice',
    category: 'Recognition Programs',
    questionText: 'What type of behavior should be recognized in a VOS culture?',
    options: [
      { id: 'A', text: 'Only revenue achievements' },
      { id: 'B', text: 'Value-first behaviors: building defensible business cases, achieving customer outcomes, and driving expansions from realized value' },
      { id: 'C', text: 'Activity metrics like number of calls made' },
      { id: 'D', text: 'Individual performance only, not team collaboration' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS recognition should celebrate value-first behaviors: (1) building defensible business cases (Sales), (2) achieving customer outcomes (CS), and (3) driving value-based expansions (CS + Sales). This reinforces the desired culture. Revenue-only focus (A) misses value; activity metrics (C) don\'t measure outcomes; individual-only recognition (D) discourages collaboration.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 10,
    questionNumber: 8,
    questionType: 'scenario_based',
    category: 'Hiring for VOS',
    questionText: 'Your company is hiring for a new Sales role. How should you assess VOS fit during interviews?',
    options: [
      { id: 'A', text: 'Only assess product knowledge' },
      { id: 'B', text: 'Ask candidates to walk through a discovery scenario, build a simple business case, and explain how they\'d track value realization' },
      { id: 'C', text: 'Only assess closing skills' },
      { id: 'D', text: 'Hire based on resume only' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS hiring should assess value engineering skills: (1) discovery (e.g., "How would you uncover a customer\'s outcomes?"), (2) business case building (e.g., "Walk me through an ROI calculation"), and (3) value mindset (e.g., "How would you ensure the customer achieves their goals?"). Product knowledge (A) and closing skills (C) are important but insufficient; resumes (D) don\'t predict VOS fit.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 10,
    questionNumber: 9,
    questionType: 'multiple_choice',
    category: 'Training Programs',
    questionText: 'What should be included in VOS training for new hires?',
    options: [
      { id: 'A', text: 'Only product training' },
      { id: 'B', text: 'VOS methodology, discovery techniques, business case building, value realization tracking, and hands-on practice with real scenarios' },
      { id: 'C', text: 'Only a one-hour overview session' },
      { id: 'D', text: 'No formal training—learn on the job' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS training should be comprehensive: (1) methodology overview (why VOS matters), (2) discovery techniques (how to uncover outcomes), (3) business case building (ROI modeling), (4) value realization tracking (CS focus), and (5) hands-on practice with real scenarios. Product-only (A), brief overviews (C), or no training (D) leave gaps.',
    difficultyLevel: 'beginner'
  },
  {
    pillarId: 10,
    questionNumber: 10,
    questionType: 'scenario_based',
    category: 'Leadership Behaviors',
    questionText: 'In a deal review, a sales rep presents a $1M deal with no business case. How should the VP of Sales respond?',
    options: [
      { id: 'A', text: 'Approve the deal to hit the quarter' },
      { id: 'B', text: 'Require the rep to build a business case before proceeding, and use this as a teaching moment for the team' },
      { id: 'C', text: 'Publicly criticize the rep' },
      { id: 'D', text: 'Build the business case for the rep' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS leadership requires consistent enforcement: (1) require the business case before proceeding (sets the standard), and (2) use it as a teaching moment (explain why business cases matter: higher win rates, better retention). Approving without a case (A) undermines VOS; public criticism (C) creates fear; doing the work for the rep (D) enables dependency.',
    difficultyLevel: 'advanced'
  },
  {
    pillarId: 10,
    questionNumber: 11,
    questionType: 'multiple_choice',
    category: 'Cultural Indicators',
    questionText: 'What is a sign that VOS culture is taking hold in an organization?',
    options: [
      { id: 'A', text: 'Employees use VOS terminology in casual conversation' },
      { id: 'B', text: 'Teams proactively discuss customer outcomes, share value wins, and collaborate across functions without being prompted' },
      { id: 'C', text: 'VOS posters are displayed in the office' },
      { id: 'D', text: 'The CEO mentions VOS in one all-hands meeting' }
    ],
    correctAnswer: 'B',
    points: 4,
    explanation: 'VOS culture is evident when value-first behavior becomes automatic: (1) teams proactively discuss customer outcomes (not just features), (2) value wins are celebrated and shared, and (3) cross-functional collaboration happens naturally. Terminology (A) and posters (C) are surface-level; one-time mentions (D) don\'t indicate sustained culture.',
    difficultyLevel: 'intermediate'
  },
  {
    pillarId: 10,
    questionNumber: 12,
    questionType: 'scenario_based',
    category: 'Sustaining VOS',
    questionText: 'VOS has been implemented for 6 months with strong initial adoption. How should leadership sustain momentum?',
    options: [
      { id: 'A', text: 'Declare victory and move on to other initiatives' },
      { id: 'B', text: 'Continue reinforcing VOS through ongoing training, regular value reviews, updated processes, and celebrating wins' },
      { id: 'C', text: 'Reduce focus on VOS to avoid "initiative fatigue"' },
      { id: 'D', text: 'Only maintain VOS in Sales, not other departments' }
    ],
    correctAnswer: 'B',
    points: 6,
    explanation: 'VOS requires sustained effort: (1) ongoing training (refresh skills, onboard new hires), (2) regular value reviews (quarterly governance meetings), (3) process updates (incorporate learnings), and (4) celebrating wins (recognition programs). Declaring victory (A) or reducing focus (C) leads to backsliding; limiting to Sales (D) creates silos. VOS is a long-term cultural shift, not a one-time project.',
    difficultyLevel: 'advanced'
  }
];

// Map pillar numbers to database IDs
const questions = questionsRaw.map(q => ({
  ...q,
  pillarId: pillarMap.get(q.pillarId) || q.pillarId
}));

// Insert questions
console.log(`Inserting ${questions.length} quiz questions for Pillars 6-10...`);

for (const question of questions) {
  await db.insert(schema.quizQuestions).values(question);
}

console.log('✅ Successfully seeded quiz questions for Pillars 6-10!');
console.log(`   - Pillar 6: 12 questions`);
console.log(`   - Pillar 7: 12 questions`);
console.log(`   - Pillar 8: 12 questions`);
console.log(`   - Pillar 9: 12 questions`);
console.log(`   - Pillar 10: 12 questions`);

await client.end();
process.exit(0);
