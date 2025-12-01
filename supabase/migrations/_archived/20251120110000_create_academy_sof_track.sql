/*
  # Academy SOF Track Content
  
  Creates learning modules and documentation for the Systemic Outcome Framework.
  Integrates with existing documentation portal structure.
*/

-- ============================================================================
-- 1. Create SOF Academy Category
-- ============================================================================

INSERT INTO doc_categories (slug, name, description, icon, display_order, published) VALUES
  ('sof-academy', 'SOF Academy', 'Learn the Systemic Outcome Framework methodology', '🎯', 7, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  published = EXCLUDED.published;

-- ============================================================================
-- 2. SOF Introduction and Overview
-- ============================================================================

INSERT INTO doc_pages (
  slug,
  category_id,
  title,
  description,
  content,
  content_type,
  status,
  featured,
  tags,
  published_at
) VALUES
  (
    'sof-introduction',
    (SELECT id FROM doc_categories WHERE slug = 'sof-academy'),
    'Introduction to Systemic Outcome Framework',
    'Understanding complex systems and outcome engineering',
    '# Introduction to Systemic Outcome Framework (SOF)

## What is SOF?

The Systemic Outcome Framework (SOF) is a methodology for analyzing complex systems, designing high-leverage interventions, and engineering measurable outcomes. It extends traditional business case analysis by mapping the underlying system dynamics that drive value creation.

## Why Use SOF?

Traditional approaches often fail because they:
- Focus on symptoms rather than root causes
- Miss critical system interdependencies
- Ignore feedback loops and emergent behaviors
- Lack clear causal chains from intervention to outcome

SOF addresses these limitations by:
- **Mapping the System**: Identify entities, relationships, and leverage points
- **Designing Interventions**: Target high-leverage points for maximum impact
- **Engineering Outcomes**: Create testable hypotheses with clear causal chains
- **Monitoring Feedback**: Track behavior changes and system responses

## Core Concepts

### 1. System Mapping
Understanding the current state by identifying:
- **Entities**: Key actors, resources, and components
- **Relationships**: Connections and dependencies
- **Leverage Points**: High-impact intervention opportunities
- **Constraints**: Limitations and bottlenecks

### 2. Intervention Design
Selecting and designing interventions that:
- Target high-leverage points
- Consider system dynamics
- Minimize unintended consequences
- Enable measurable outcomes

### 3. Outcome Engineering
Creating outcome hypotheses that:
- Define clear causal chains
- Specify testable predictions
- Link to measurable KPIs
- Account for feedback loops

### 4. Realization Loops
Monitoring system behavior through:
- Feedback loop tracking
- Behavior change observation
- System update logging
- Loop closure validation

## The SOF Lifecycle

SOF integrates with the ValueCanvas lifecycle:

1. **Opportunity**: Map the system and identify leverage points
2. **Target**: Design interventions and engineer outcomes
3. **Realization**: Monitor feedback loops and behavior changes
4. **Expansion**: Replicate successful interventions to new contexts
5. **Integrity**: Ensure governance and system health

## When to Use SOF

SOF is particularly valuable for:
- Complex organizational transformations
- Multi-stakeholder initiatives
- System-level change programs
- Innovation and disruption strategies
- Sustainability and impact initiatives

## Getting Started

Ready to apply SOF? Start with:
1. [System Mapping Fundamentals](#)
2. [Identifying Leverage Points](#)
3. [Designing Effective Interventions](#)
4. [Creating Outcome Hypotheses](#)

## Learn More

- [SOF Methodology Guide](#)
- [Case Studies](#)
- [Best Practices](#)
- [Common Pitfalls](#)',
    'markdown',
    'published',
    true,
    ARRAY['sof', 'systems-thinking', 'introduction', 'methodology'],
    now()
  ),

-- ============================================================================
-- 3. System Mapping Module
-- ============================================================================

  (
    'sof-system-mapping',
    (SELECT id FROM doc_categories WHERE slug = 'sof-academy'),
    'System Mapping Fundamentals',
    'Learn to map complex systems and identify leverage points',
    '# System Mapping Fundamentals

## Overview

System mapping is the foundation of SOF. It creates a visual representation of the system you want to change, revealing hidden dynamics and high-leverage intervention points.

## What is a System Map?

A system map consists of:
- **Entities**: Actors, resources, processes, and components
- **Relationships**: Connections, dependencies, and flows
- **Leverage Points**: High-impact intervention opportunities
- **Constraints**: Limitations and bottlenecks

## Entity Types

### Actors
People or organizations that make decisions and take actions.
- Customers, employees, partners
- Departments, teams, stakeholders
- External influencers

### Resources
Assets that flow through the system.
- Financial capital
- Information and data
- Physical assets
- Time and attention

### Processes
Activities that transform inputs to outputs.
- Business processes
- Decision-making workflows
- Communication channels

### Structures
Organizational and systemic patterns.
- Hierarchies and reporting lines
- Policies and rules
- Cultural norms

## Relationship Types

### Causal
One entity directly influences another.
- "Marketing spend → Lead generation"
- "Training → Employee capability"

### Dependency
One entity requires another to function.
- "Sales depends on Product availability"
- "Delivery depends on Logistics"

### Feedback
Circular relationships that reinforce or balance.
- **Reinforcing**: Growth or decline spirals
- **Balancing**: Self-correcting mechanisms

### Information Flow
Data and knowledge transfer.
- Reporting relationships
- Communication channels
- Knowledge sharing

## Identifying Leverage Points

Leverage points are places where small changes create large effects. Ranked by effectiveness:

1. **Paradigms**: Fundamental beliefs and assumptions
2. **Goals**: System objectives and metrics
3. **Rules**: Policies, incentives, constraints
4. **Information Flows**: Who knows what, when
5. **Feedback Loops**: Reinforcing or balancing dynamics
6. **Material Flows**: Physical and financial resources

## Mapping Process

### Step 1: Define Scope
- What system are you mapping?
- What boundaries will you set?
- What time horizon matters?

### Step 2: Identify Entities
- List all relevant actors, resources, processes
- Categorize by type
- Note key attributes

### Step 3: Map Relationships
- Connect entities with relationships
- Specify relationship types
- Note strength and direction

### Step 4: Find Leverage Points
- Analyze the map for high-impact points
- Consider accessibility and feasibility
- Prioritize by potential impact

### Step 5: Validate
- Review with stakeholders
- Test assumptions
- Refine and iterate

## Common Patterns

### The Tragedy of the Commons
Shared resources depleted by individual self-interest.
- **Leverage**: Change incentives or governance

### Success to the Successful
Winners accumulate advantages, losers fall behind.
- **Leverage**: Level the playing field

### Fixes That Fail
Short-term solutions create long-term problems.
- **Leverage**: Address root causes

### Limits to Growth
Growth slows as constraints bind.
- **Leverage**: Remove or manage constraints

## Best Practices

1. **Start Simple**: Begin with core entities and relationships
2. **Iterate**: Refine as you learn more
3. **Validate**: Test with stakeholders and data
4. **Focus**: Don''t map everything, map what matters
5. **Visualize**: Use diagrams to communicate

## Tools and Techniques

- Causal loop diagrams
- Stock and flow models
- Network analysis
- Stakeholder mapping
- Value stream mapping

## Exercise: Map Your System

Try mapping a system you want to change:
1. List 5-10 key entities
2. Draw relationships between them
3. Identify 2-3 potential leverage points
4. Validate with a colleague

## Next Steps

- [Intervention Design](#)
- [Leverage Point Analysis](#)
- [System Dynamics](#)',
    'markdown',
    'published',
    true,
    ARRAY['sof', 'system-mapping', 'leverage-points', 'tutorial'],
    now()
  ),

-- ============================================================================
-- 4. Intervention Design Module
-- ============================================================================

  (
    'sof-intervention-design',
    (SELECT id FROM doc_categories WHERE slug = 'sof-academy'),
    'Intervention Design',
    'Design high-leverage interventions for system change',
    '# Intervention Design

## Overview

Intervention design is the art and science of selecting and crafting changes that will shift system behavior toward desired outcomes.

## What Makes a Good Intervention?

Effective interventions are:
- **High-Leverage**: Small effort, large impact
- **Feasible**: Achievable with available resources
- **Measurable**: Clear success criteria
- **Sustainable**: Lasting effects, not temporary fixes
- **Systemic**: Address root causes, not symptoms

## Intervention Types

### Structural Interventions
Change the system architecture.
- Reorganize teams or processes
- Modify reporting structures
- Redesign workflows

### Policy Interventions
Change rules and incentives.
- Update policies and procedures
- Modify compensation structures
- Implement new governance

### Information Interventions
Change what people know and when.
- Improve transparency
- Enhance communication
- Provide new data or insights

### Capability Interventions
Change what people can do.
- Training and development
- Tool and technology adoption
- Skill building programs

## Design Process

### Step 1: Select Leverage Point
From your system map, choose a high-leverage point that:
- Has significant impact potential
- Is accessible and feasible
- Aligns with organizational capacity

### Step 2: Generate Options
Brainstorm multiple intervention approaches:
- What could we change?
- How could we change it?
- What are alternative paths?

### Step 3: Assess Feasibility
Evaluate each option:
- **Effort**: Resources and time required
- **Risk**: Potential downsides
- **Impact**: Expected benefits
- **Alignment**: Fit with strategy and culture

### Step 4: Design Details
For selected intervention:
- Specify exactly what will change
- Define implementation steps
- Identify required resources
- Plan for resistance and obstacles

### Step 5: Create Hypotheses
Link intervention to outcomes:
- If we do X, then Y will happen
- Because of mechanism Z
- Measurable by indicator W

## Intervention Sequences

Complex changes often require multiple interventions in sequence:

1. **Foundation**: Build necessary capabilities
2. **Catalyst**: Trigger initial change
3. **Amplification**: Reinforce and scale
4. **Stabilization**: Lock in new patterns

Example: Digital Transformation
1. Foundation: Train staff on new tools
2. Catalyst: Launch pilot project
3. Amplification: Expand to more teams
4. Stabilization: Update policies and processes

## Anticipating Resistance

Common sources of resistance:
- **Loss of Status**: People fear losing position
- **Uncertainty**: Unknown outcomes create anxiety
- **Effort**: Change requires work
- **Habit**: Old patterns are comfortable

Strategies to address:
- Involve stakeholders early
- Communicate benefits clearly
- Provide support and resources
- Celebrate early wins

## Unintended Consequences

Every intervention can have side effects:
- **Displacement**: Problem moves elsewhere
- **Escalation**: Problem gets worse
- **Dependency**: Creates new dependencies
- **Erosion**: Benefits fade over time

Mitigation strategies:
- Map potential side effects
- Monitor for early warning signs
- Design feedback mechanisms
- Plan contingencies

## Case Study: Customer Service Transformation

**System Map Insight**: Long wait times caused by inefficient routing, not staff shortage.

**Leverage Point**: Information flow between customers and specialists.

**Intervention**: Implement AI-powered routing system.

**Hypothesis**: If we route customers to the right specialist immediately, then resolution time will decrease by 40% because customers won''t be transferred multiple times.

**Result**: 45% reduction in resolution time, 30% improvement in satisfaction.

## Best Practices

1. **Start Small**: Pilot before scaling
2. **Learn Fast**: Build in feedback loops
3. **Adapt**: Be ready to adjust based on results
4. **Communicate**: Keep stakeholders informed
5. **Persist**: System change takes time

## Exercise: Design an Intervention

For your system map:
1. Select your highest-leverage point
2. Generate 3 intervention options
3. Assess feasibility of each
4. Design details for the best option
5. Create outcome hypotheses

## Next Steps

- [Outcome Engineering](#)
- [Feedback Loop Design](#)
- [Implementation Planning](#)',
    'markdown',
    'published',
    true,
    ARRAY['sof', 'intervention-design', 'change-management', 'tutorial'],
    now()
  ),

-- ============================================================================
-- 5. Outcome Engineering Module
-- ============================================================================

  (
    'sof-outcome-engineering',
    (SELECT id FROM doc_categories WHERE slug = 'sof-academy'),
    'Outcome Engineering',
    'Create testable hypotheses and causal chains',
    '# Outcome Engineering

## Overview

Outcome engineering transforms vague goals into testable hypotheses with clear causal chains from intervention to measurable result.

## What is an Outcome Hypothesis?

An outcome hypothesis specifies:
- **Intervention**: What we will change
- **Outcome**: What result we expect
- **Mechanism**: Why we expect this result
- **Measurement**: How we will know if it worked
- **Timeline**: When we expect to see results

## Hypothesis Structure

### The Basic Formula

**If** [intervention] **then** [outcome] **because** [mechanism] **measured by** [KPI] **within** [timeframe].

### Example

**If** we implement AI-powered customer routing **then** resolution time will decrease by 40% **because** customers will reach the right specialist immediately without transfers **measured by** average time to resolution **within** 3 months.

## Causal Chains

A causal chain traces the path from intervention to outcome:

```
Intervention → Immediate Effect → Intermediate Effect → Final Outcome
```

### Example: Training Program

```
Training → Skill Increase → Behavior Change → Performance Improvement → Business Result
```

Detailed:
1. **Training**: Employees complete sales training
2. **Skill Increase**: Employees learn consultative selling
3. **Behavior Change**: Employees ask better discovery questions
4. **Performance Improvement**: Conversion rate increases
5. **Business Result**: Revenue grows

## Types of Outcomes

### Leading Indicators
Early signals that predict final outcomes.
- Engagement metrics
- Process improvements
- Behavior changes

### Lagging Indicators
Final results that confirm success.
- Revenue and profit
- Customer satisfaction
- Market share

### Balancing Metrics
Ensure no negative side effects.
- Employee satisfaction
- Quality metrics
- Risk indicators

## Creating Strong Hypotheses

### Characteristics of Good Hypotheses

1. **Specific**: Precise about what will change
2. **Measurable**: Clear metrics and targets
3. **Testable**: Can be proven true or false
4. **Causal**: Explains why the change will occur
5. **Bounded**: Specific timeframe and scope

### Common Mistakes

❌ **Too Vague**: "Improve customer experience"
✅ **Specific**: "Reduce average response time from 24h to 4h"

❌ **No Mechanism**: "Training will increase sales"
✅ **With Mechanism**: "Training will increase sales because reps will learn to identify customer needs and recommend appropriate solutions"

❌ **Unmeasurable**: "Make employees happier"
✅ **Measurable**: "Increase employee engagement score from 6.5 to 7.5 on 10-point scale"

## Mapping to KPIs

Each hypothesis should link to specific KPIs:

### Financial KPIs
- Revenue growth
- Cost reduction
- Profit margin
- ROI

### Operational KPIs
- Cycle time
- Throughput
- Quality metrics
- Efficiency ratios

### Customer KPIs
- Satisfaction scores
- Retention rate
- Net Promoter Score
- Lifetime value

### Employee KPIs
- Engagement scores
- Retention rate
- Productivity metrics
- Skill assessments

## Validation Criteria

Define success criteria upfront:
- **Minimum Viable**: Threshold for "good enough"
- **Target**: Expected result
- **Stretch**: Aspirational goal

Example:
- Minimum: 20% improvement
- Target: 40% improvement
- Stretch: 60% improvement

## Testing Hypotheses

### A/B Testing
Compare intervention group to control group.
- Random assignment
- Parallel execution
- Statistical comparison

### Before/After
Compare metrics before and after intervention.
- Baseline measurement
- Intervention period
- Post-intervention measurement

### Pilot Programs
Test with small group before full rollout.
- Limited scope
- Rapid learning
- Iterative refinement

## Outcome Pathways

Complex outcomes often require multiple pathways:

### Parallel Pathways
Multiple interventions working simultaneously.
- Diversifies risk
- Increases probability of success
- Addresses multiple leverage points

### Sequential Pathways
Interventions building on each other.
- Each step enables the next
- Cumulative effects
- Staged implementation

### Contingent Pathways
Alternative paths based on results.
- If X succeeds, do Y
- If X fails, do Z
- Adaptive strategy

## Case Study: Digital Adoption

**Goal**: Increase digital channel usage

**Hypothesis 1**: If we simplify the mobile app interface, then active users will increase by 30% because users will find it easier to complete tasks, measured by monthly active users within 6 months.

**Hypothesis 2**: If we add personalized recommendations, then transaction frequency will increase by 25% because users will discover relevant products, measured by transactions per user within 3 months.

**Causal Chain**:
1. Simplified interface → Reduced friction
2. Reduced friction → More frequent usage
3. More frequent usage → Habit formation
4. Habit formation → Sustained engagement
5. Sustained engagement → Higher lifetime value

## Best Practices

1. **Start with the End**: Define desired outcome first
2. **Work Backward**: Trace causal chain from outcome to intervention
3. **Be Specific**: Quantify everything possible
4. **Test Assumptions**: Validate each link in the chain
5. **Iterate**: Refine hypotheses based on results

## Exercise: Create Outcome Hypotheses

For your intervention:
1. Write 3 outcome hypotheses using the formula
2. Map the causal chain for each
3. Identify KPIs for measurement
4. Define success criteria
5. Plan validation approach

## Next Steps

- [Feedback Loop Monitoring](#)
- [KPI Dashboard Design](#)
- [Hypothesis Testing Methods](#)',
    'markdown',
    'published',
    true,
    ARRAY['sof', 'outcome-engineering', 'kpi', 'measurement', 'tutorial'],
    now()
  ),

-- ============================================================================
-- 6. Feedback Loops Module
-- ============================================================================

  (
    'sof-feedback-loops',
    (SELECT id FROM doc_categories WHERE slug = 'sof-academy'),
    'Feedback Loop Monitoring',
    'Track behavior changes and system responses',
    '# Feedback Loop Monitoring

## Overview

Feedback loops are the key to understanding whether your intervention is working. They track how the system responds to changes and whether behavior is shifting as expected.

## What is a Feedback Loop?

A feedback loop monitors:
- **Trigger**: What initiates the loop
- **Behavior**: What actions or changes occur
- **Response**: How the system reacts
- **Outcome**: What results emerge

## Types of Feedback Loops

### Reinforcing Loops
Amplify change in one direction (growth or decline).
- Success breeds more success
- Failure compounds
- Exponential growth or collapse

Example: Network effects
- More users → More value → More users

### Balancing Loops
Stabilize the system toward a goal.
- Self-correcting mechanisms
- Homeostasis
- Goal-seeking behavior

Example: Inventory management
- Low stock → Order more → Stock increases → Stop ordering

## Loop Components

### Trigger Conditions
What starts the loop?
- Threshold crossed
- Event occurred
- Time elapsed
- External signal

### Monitored Behaviors
What actions are we tracking?
- User actions
- Process changes
- Decision patterns
- Resource flows

### System Updates
How does the system change?
- State transitions
- Metric movements
- Pattern shifts
- Emergent behaviors

### Closure Criteria
When is the loop complete?
- Goal achieved
- Stable state reached
- Behavior normalized
- Hypothesis validated

## Monitoring Process

### Step 1: Define Loop
Specify what you''re monitoring:
- Trigger conditions
- Expected behaviors
- Success criteria
- Measurement approach

### Step 2: Instrument
Set up measurement:
- Data collection points
- Tracking mechanisms
- Alert thresholds
- Reporting cadence

### Step 3: Observe
Watch for changes:
- Behavior patterns
- Metric trends
- Unexpected effects
- Side effects

### Step 4: Analyze
Interpret results:
- Compare to hypothesis
- Identify patterns
- Assess causality
- Evaluate significance

### Step 5: Respond
Take action:
- Amplify what works
- Adjust what doesn''t
- Address side effects
- Close successful loops

## Behavior Change Indicators

### Early Signals
First signs of change:
- Increased engagement
- New usage patterns
- Changed conversations
- Pilot successes

### Intermediate Signals
Sustained changes:
- Habit formation
- Process adoption
- Cultural shifts
- Spreading effects

### Late Signals
Embedded changes:
- New norms
- Structural changes
- Sustained performance
- Irreversible shifts

## Loop Metrics

### Velocity
How fast is change happening?
- Adoption rate
- Spread rate
- Time to impact

### Magnitude
How large is the change?
- Effect size
- Reach
- Intensity

### Stability
How sustainable is the change?
- Persistence
- Resilience
- Reversibility

### Quality
How good is the change?
- Desired vs. undesired effects
- Side effects
- Alignment with goals

## Closing Loops

A loop is closed when:
- Behavior has stabilized
- Hypothesis is validated
- Goal is achieved
- Change is irreversible

### Closure Process

1. **Verify**: Confirm behavior change is real and sustained
2. **Document**: Record what happened and why
3. **Learn**: Extract lessons and insights
4. **Transition**: Move to maintenance mode

## Common Patterns

### The Dip
Initial decline before improvement.
- **Response**: Stay the course, support through transition

### The Spike
Rapid initial change that fades.
- **Response**: Build reinforcement mechanisms

### The Plateau
Change stalls before goal.
- **Response**: Identify and remove new constraints

### The Overshoot
Change exceeds target.
- **Response**: Add balancing mechanisms

## Case Study: Sales Process Change

**Intervention**: New CRM system

**Feedback Loop**: Adoption monitoring

**Trigger**: System launch

**Monitored Behaviors**:
- Login frequency
- Data entry completeness
- Feature usage
- Process compliance

**Observations**:
- Week 1: Low adoption, confusion
- Week 2-4: Gradual increase, champions emerge
- Week 5-8: Plateau at 60% adoption
- Week 9: Training refresh
- Week 10-12: Adoption reaches 85%

**Closure**: Week 12, behavior stabilized, hypothesis validated

## Best Practices

1. **Monitor Early**: Start tracking from day one
2. **Multiple Metrics**: Use leading and lagging indicators
3. **Regular Review**: Check progress frequently
4. **Adapt Quickly**: Respond to signals promptly
5. **Document**: Record observations and insights

## Exercise: Design Feedback Loops

For your intervention:
1. Define 2-3 feedback loops to monitor
2. Specify trigger conditions
3. List behaviors to track
4. Define closure criteria
5. Plan monitoring approach

## Next Steps

- [System Health Monitoring](#)
- [Expansion Planning](#)
- [Governance Integration](#)',
    'markdown',
    'published',
    true,
    ARRAY['sof', 'feedback-loops', 'monitoring', 'behavior-change', 'tutorial'],
    now()
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  updated_at = now();

-- ============================================================================
-- 7. Create SOF Learning Path
-- ============================================================================

COMMENT ON TABLE doc_pages IS 'Documentation pages with SOF Academy track for learning the Systemic Outcome Framework methodology';
