
This document outlines detailed interactive components for the Value Operating System (VOS) training program, aligned with the 10-Pillar Internal Alignment Training Program, the 6-level VOS Maturity Model, and role-specific curricula (Sales, Customer Success [CS], Marketing, Product, Executive Leadership, Value Engineering [VE]). Components emphasize practical application, behavioral change, and progression from foundational awareness (Level 1) to agentic execution (Level 5). They integrate key resources such as KPI definition sheets (standardized metrics with formulas, data sources, and benchmarks), discovery framework questions (structured inquiries for pain quantification), Value Commit templates (KPI tables with baselines/targets), QBR/EBR templates (variance analysis and executive summaries), and the B2BValue Company Playbook (lifecycle workflows and rituals).

Interactive elements are designed for an e-learning platform (e.g., Moodle or custom LMS), using HTML/JS for web implementation to ensure accessibility, mobile responsiveness, and tracking. Visual placeholders are noted for diagrams, tables, and attachments (e.g., downloadable KPI sheets as PDFs). Assessment rubrics link to certification: 80% pass rate across components grants role-specific badges (e.g., "Level 2 Value Alignment Certified"), with proficiency tied to maturity self-assessments. Total program integration: Quizzes build foundational knowledge for Pillars 1-2; simulations reinforce Pillars 5-8 handoffs; prompts accelerate Pillars 9-10 AI adoption. Capstone integration: Simulations include Value Tree building as a prerequisite artifact.

Estimated implementation: 20-30 hours per role track, with analytics for completion rates (target: 85%) and knowledge gain (pre/post quizzes). For depth, each section includes analytical rationale, multiple perspectives (e.g., role adaptations), evidence-based design (drawn from playbook outcomes like 90% realization rates), and actionable guidelines.

## Section 1: Quizzes for Pillar 1 - Unified Value Language

### Design Rationale and Alignment
Pillar 1 establishes a consistent vocabulary for value discussions, shifting from feature-focused operations (Level 0: Value Chaos) to quantifiable outcomes in Revenue, Cost, and Risk (Level 1: Value Awareness). Quizzes assess mastery of value definitions (e.g., economic impact over subjective benefits), KPI taxonomy (standardized metrics from KPI sheets), and introductory ROI frameworks (linking KPIs to financials via conservative modeling). This aligns with the maturity model by tying feedback to level-specific behaviors: e.g., Level 1 users receive prompts on basic language adoption; Level 3+ get advanced integration challenges.

**Analytical Inquiry:** Why quizzes here? Pillar 1 is foundational—poor language leads to 50%+ miscommunication in cross-functional handoffs (per playbook insights). Multiple perspectives: Sales needs pitch reframing; CS requires proof alignment; Executives demand OKR ties. Evidence: KPI sheets show inconsistent definitions cause 20-30% variance in realization rates. Second-order effects: Strong Pillar 1 reduces churn by enabling early value hypotheses.

**Component Overview:** 25 questions (15 multiple-choice for quick recall, 10 scenario-based for application). Delivered as adaptive quizzes (easier questions for lower maturity, branching to complex for higher). Duration: 30-45 minutes. Integration with role curricula: Questions adapt per track (e.g., Sales: Deal qualification; VE: Taxonomy governance). Prerequisites: Glossary review (50+ terms like "Value Tree"). Post-quiz: Personalized action plan (e.g., "Rephrase 5 pitches using R/C/R").

**Scoring Logic:** 
- Total: 100 points (4 points per question).
- Thresholds: 80%+ for certification (Level 1 badge); 60-79% for remedial module; <60% for Pillar 1 basics retake.
- Adaptive Scoring: +Bonus for maturity-tied feedback (e.g., Level 2 users get 10% extra for KPI linking).
- Granular: Value Definitions (40 points), KPI Taxonomy (30 points), ROI Frameworks (30 points).
- Algorithm: JS-based (e.g., if score >80, unlock simulation; else, targeted feedback).

**Feedback Mechanism Tied to Maturity Levels:**
- Instant, layered feedback: Correct/incorrect explanation + maturity progression tip + resource link (e.g., KPI sheet attachment).
- Level 0-1: Basic reinforcement (e.g., "This aligns with Value Awareness—review R/C/R triangle.").
- Level 2: Application focus (e.g., "Good on taxonomy; practice handoff integration for Alignment.").
- Level 3+: Integration challenges (e.g., "Excellent; now automate via AI prompts in Pillar 9 for Integration.").
- Holistic: End-of-quiz maturity slider (user self-assess current level; quiz score adjusts projected progression).

**Assessment Rubric for Certification:**
| Criterion | Description | Scoring (0-20%) | Maturity Tie | Evidence from Quiz |
|-----------|-------------|-----------------|--------------|--------------------|
| Value Definitions | Accurate use of enterprise value (quantifiable R/C/R over features) | 20% (5 questions) | Level 1: Awareness | Q1-5 correct rate >80% unlocks glossary edit access |
| KPI Taxonomy | Correct identification/application of standardized metrics (e.g., formulas, benchmarks) | 30% (7 questions) | Level 2: Alignment | Q6-12; links to sheet download; 80% for tree-building sim |
| ROI Frameworks | Basic linking of KPIs to financial outcomes (conservative assumptions) | 30% (8 questions) | Level 3: Integration | Q13-20; scenario success >80% for Commit template access |
| Overall Application | Scenario-based synthesis across roles | 20% (5 questions) | Level 4+: Automation | Role-adapted; 80% total for AI prompt intro in Pillar 9 |
| **Certification Pass:** 80% aggregate; retake after 1 week with targeted drills. Badges: Role-specific (e.g., Sales: "Outcome Framing Certified"). Metrics: Track % passing per level for program ROI (target: 85% uplift in unified language adoption). |

**Placeholders for Visuals and Attachments:**
- ![Revenue/Cost/Risk Triangle Diagram](placeholder_rcr_diagram.png): Interactive SVG for quiz hover tooltips.
- Attachment: [KPI Definition Sheet PDF](placeholder_kpi_sheet.pdf) – 50+ metrics (e.g., Lead Conversion Rate: Formula = (Qualified Leads / Total Leads) × 100; Benchmark: 15-25%; Data Source: CRM).
- Attachment: [Discovery Questions Excerpt](placeholder_discovery_questions.pdf) – Sample: "What KPIs does your role own? How are those measured today?"

### Detailed Quiz Questions
Questions are categorized for modularity. Each includes: Type, Points, Correct Answer, Feedback (maturity-tied), and Role Adaptation.

#### Category 1: Value Definitions (Questions 1-5, Multiple-Choice, 20 points total)
1. **Question:** What is the primary definition of "value" in the VOS framework?  
   **Options:** A) Subjective benefits from features; B) Quantifiable economic impact on Revenue, Cost, or Risk; C) Customer satisfaction scores; D) Product usability ratings.  
   **Correct:** B.  
   **Feedback:** Correct! This shifts from Level 0 feature-selling to Level 1 Awareness. Review the R/C/R framework for Sales pitches. (Role: Sales – Tie to outcome framing in deals.)  
   **Points:** 4.

2. **Question:** In enterprise context, how does "value" differ from "features"? Provide the VOS perspective.  
   **Options:** A) Features are outcomes; B) Value normalizes discussions to R/C/R impacts (e.g., revenue uplift from lead conversion); C) They are interchangeable; D) Features focus on cost only.  
   **Correct:** B.  
   **Feedback:** Excellent—avoids Level 0 pitfalls like inconsistent narratives. For CS, apply to realization proof. (Role: CS – Link to QBR outcome tracking.)  
   **Points:** 4.

3. **Question:** Which framework normalizes all value discussions in VOS?  
   **Options:** A) Feature/Benefit; B) Revenue/Cost/Risk; C) SWOT Analysis; D) Porter's Five Forces.  
   **Correct:** B.  
   **Feedback:** Right! Builds Level 1 consistency. Executives, use for OKR alignment. (Role: Executives – Conceptual buy-in for value imperatives.)  
   **Points:** 4.

4. **Question:** An example of Revenue value is:  
   **Options:** A) Reduced manual hours; B) Uplift in lead conversion rate leading to higher MRR; C) Minimized compliance exposure; D) Lower error rates.  
   **Correct:** B.  
   **Feedback:** Correct—quantifiable via KPI sheets. Marketing, frame in campaigns for Level 2 Alignment. (Role: Marketing – Outcome-aware messaging.)  
   **Points:** 4.

5. **Question:** Cost value focuses on:  
   **Options:** A) Increased sales efficiency; B) Savings like reduced onboarding cycle time; C) Risk mitigation; D) Expansion opportunities.  
   **Correct:** B.  
   **Feedback:** Spot on! Ties to Level 1 basics. Product, instrument for roadmaps. (Role: Product – KPI awareness in features.)  
   **Points:** 4.

#### Category 2: KPI Taxonomy (Questions 6-12, Mix: 4 MC, 3 Scenario-Based, 28 points total)
6. **Question (MC):** From the KPI sheet, what is the definition of "Lead Conversion Rate"?  
   **Options:** A) % of pipeline to closed deals; B) % of leads to pipeline; C) Total leads generated; D) Customer acquisition cost.  
   **Correct:** B.  
   **Feedback:** Accurate—standardizes taxonomy for Level 2. VE, govern for Fabric integration. (Role: VE – Standardized modeling basics.)  
   **Points:** 4.

7. **Question (MC):** The formula for "Onboarding Cycle Time" is:  
   **Options:** A) (Qualified Leads / Total Leads) × 100; B) Go-Live Date - Kickoff Date; C) Baseline Hours - Post-Hours; D) Error Rate Reduction %.  
   **Correct:** B.  
   **Feedback:** Correct! Benchmark: 20-35 days. For Level 3 Integration, link to lifecycle handoffs. (Role: Sales – Value-guided selling.)  
   **Points:** 4.

8. **Question (MC):** What is a leading indicator for Manual Hours Reduced?  
   **Options:** A) Actual cost savings; B) MQL volume; C) Training completion rate; D) Pipeline value.  
   **Correct:** C.  
   **Feedback:** Good—distinguishes from lagging. CS, use in dashboards for Level 2. (Role: CS – Structured realization.)  
   **Points:** 4.

9. **Question (Scenario-Based):** A Sales rep hears a customer say, "Our reporting takes too long." Using KPI taxonomy, map this to a standard metric and its impact.  
   **Options:** A) Lead Conversion Rate (Revenue); B) Manual Hours Reduced (Cost); C) Compliance Exposure (Risk); D) Onboarding Cycle Time (Revenue). Select and explain briefly.  