/**
 * Agent Ontology Seeding Script
 * 
 * Populates agent_ontologies table with domain knowledge
 * Source: supabase/migrations/20251117131452_create_agent_fabric_schema.sql
 * 
 * Usage:
 *   npx ts-node scripts/seed-agent-ontologies.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// Ontology Definitions
// ============================================================================

const ONTOLOGIES = [
  // 1. OpportunityAgent Ontology
  {
    agent_name: 'opportunity',
    domain: 'value_discovery',
    knowledge: {
      pain_point_categories: [
        'operational_efficiency',
        'cost_reduction',
        'revenue_growth',
        'risk_mitigation',
        'customer_experience',
        'employee_productivity'
      ],
      persona_attributes: [
        'role',
        'seniority',
        'decision_authority',
        'budget_control',
        'technical_proficiency'
      ],
      discovery_signals: {
        high_intent: [
          'current project underway',
          'budget allocated',
          'executive sponsor identified',
          'RFP issued'
        ],
        medium_intent: [
          'exploring solutions',
          'researching vendors',
          'attending demos',
          'informal conversations'
        ],
        low_intent: [
          'general inquiry',
          'awareness stage',
          'no timeline mentioned'
        ]
      },
      value_drivers: [
        'time_savings',
        'cost_savings',
        'revenue_increase',
        'risk_reduction',
        'quality_improvement',
        'scalability',
        'automation'
      ]
    },
    version: 1
  },

  // 2. TargetAgent Ontology
  {
    agent_name: 'target',
    domain: 'value_quantification',
    knowledge: {
      kpi_categories: {
        financial: ['revenue', 'cost', 'margin', 'roi', 'npr', 'payback_period'],
        operational: ['throughput', 'cycle_time', 'error_rate', 'utilization'],
        customer: ['nps', 'csat', 'retention_rate', 'ltv', 'churn_rate'],
        employee: ['productivity', 'engagement', 'turnover', 'training_time']
      },
      value_reduction_rules: [
        'revenue_impact_must_tie_to_kpi',
        'cost_savings_must_be_quantifiable',
        'risk_reduction_must_have_probability_and_impact'
      ],
      assumption_types: [
        'baseline_metric',
        'target_metric',
        'adoption_curve',
        'implementation_timeline',
        'external_factor'
      ],
      roi_components: {
        benefits: ['increased_revenue', 'reduced_costs', 'avoided_costs'],
        costs: ['license_fees', 'implementation_costs', 'training_costs', 'maintenance_costs']
      }
    },
    version: 1
  },

  // 3. IntegrityAgent Ontology
  {
    agent_name: 'integrity',
    domain: 'manifesto_compliance',
    knowledge: {
      manifesto_rules: [
        {
          rule_id: 'RULE_001',
          title: 'Value Reduction',
          description: 'All value must reduce to revenue, cost, or risk',
          validation_criteria: [
            'outcome_maps_to_financial_metric',
            'kpi_ties_to_revenue_or_cost',
            'assumption_supports_financial_claim'
          ]
        },
        {
          rule_id: 'RULE_002',
          title: 'Assumption Quality',
          description: 'All assumptions must be conservative and sourced',
          validation_criteria: [
            'assumption_has_source',
            'estimate_is_conservative',
            'range_provided_for_uncertainty'
          ]
        },
        {
          rule_id: 'RULE_003',
          title: 'KPI Ontology',
          description: 'All KPIs must exist in Value Fabric',
          validation_criteria: [
            'kpi_in_value_fabric',
            'kpi_has_calculation_formula',
            'kpi_industry_relevant'
          ]
        },
        {
          rule_id: 'RULE_004',
          title: 'Explainability',
          description: 'All logic must have reasoning traces',
          validation_criteria: [
            'decision_has_reasoning',
            'calculation_shows_formula',
            'assumption_has_rationale'
          ]
        },
        {
          rule_id: 'RULE_005',
          title: 'Calculation Provenance',
          description: 'All financial claims must have calculation history',
          validation_criteria: [
            'roi_shows_input_variables',
            'formula_is_auditable',
            'intermediate_steps_captured'
          ]
        }
      ],
      violation_severity: {
        blocking: ['missing_value_reduction', 'invalid_kpi', 'no_calculation_provenance'],
        warning: ['missing_source', 'optimistic_estimate', 'incomplete_reasoning'],
        info: ['style_violation', 'missing_metadata']
      }
    },
    version: 1
  },

  // 4. ExpansionAgent Ontology
  {
    agent_name: 'expansion',
    domain: 'growth_opportunities',
    knowledge: {
      expansion_patterns: [
        'vertical_expansion', // Same product, deeper usage
        'horizontal_expansion', // Additional products/modules
        'geographic_expansion', // New regions
        'persona_expansion' // New buyer personas
      ],
      expansion_signals: [
        'high_product_adoption',
        'feature_requests',
        'additional_use_cases_identified',
        'executive_sponsorship',
        'success_metrics_exceeded'
      ],
      cross_sell_triggers: {
        product_synergies: ['complementary_features', 'data_integration', 'workflow_enhancement'],
        timing_indicators: ['milestone_reached', 'contract_renewal', 'budget_cycle']
      }
    },
    version: 1
  },

  // 5. RealizationAgent Ontology
  {
    agent_name: 'realization',
    domain: 'value_delivery',
    knowledge: {
      realization_stages: [
        'implementation',
        'adoption',
        'optimization',
        'measured_outcomes'
      ],
      value_leakage_causes: [
        'incomplete_adoption',
        'configuration_issues',
        'training_gaps',
        'process_misalignment',
        'external_factors'
      ],
      corrective_actions: {
        adoption_gaps: ['training_programs', 'change_management', 'executive_alignment'],
        technical_issues: ['configuration_review', 'integration_fixes', 'performance_tuning'],
        process_issues: ['workflow_redesign', 'stakeholder_alignment', 'governance_model']
      }
    },
    version: 1
  },

  // 6. CompanyIntelligenceAgent Ontology
  {
    agent_name: 'company_intelligence',
    domain: 'market_research',
    knowledge: {
      data_sources: [
        'company_website',
        'linkedin',
        'crunchbase',
        'public_filings',
        'news_articles',
        'analyst_reports'
      ],
      intelligence_dimensions: [
        'company_size',
        'growth_stage',
        'funding_history',
        'tech_stack',
        'competitive_landscape',
        'strategic_initiatives'
      ],
      industry_taxonomies: {
        technology: ['saas', 'infrastructure', 'security', 'devops', 'ai_ml'],
        financial_services: ['banking', 'fintech', 'insurance', 'payments'],
        healthcare: ['provider', 'payer', 'pharma', 'medtech'],
        retail: ['ecommerce', 'brick_and_mortar', 'omnichannel']
      }
    },
    version: 1
  },

  // 7. FinancialModelingAgent Ontology
  {
    agent_name: 'financial_modeling',
    domain: 'advanced_analytics',
    knowledge: {
      calculation_methods: [
        'npv',
        'irr',
        'payback_period',
        'roi',
        'total_cost_of_ownership',
        'customer_lifetime_value'
      ],
      sensitivity_variables: [
        'adoption_rate',
        'implementation_timeline',
        'discount_rate',
        'growth_rate',
        'churn_rate'
      ],
      scenario_types: {
        best_case: { adoption: 0.95, timeline_multiplier: 0.8 },
        base_case: { adoption: 0.75, timeline_multiplier: 1.0 },
        worst_case: { adoption: 0.5, timeline_multiplier: 1.3 }
      }
    },
    version: 1
  },

  // 8. ValueMappingAgent Ontology
  {
    agent_name: 'value_mapping',
    domain: 'capability_outcomes',
    knowledge: {
      capability_categories: [
        'automation',
        'analytics',
        'integration',
        'security',
        'collaboration',
        'scalability'
      ],
      outcome_types: [
        'efficiency_gain',
        'quality_improvement',
        'risk_reduction',
        'revenue_enablement',
        'cost_avoidance'
      ],
      mapping_confidence_factors: [
        'feature_maturity',
        'customer_evidence',
        'industry_relevance',
        'technical_feasibility'
      ]
    },
    version: 1
  }
];

// ============================================================================
// Seeding Logic
// ============================================================================

async function seedOntologies() {
  console.log('🌱 Starting Agent Ontology Seeding...\n');

  try {
    // 1. Get agent IDs
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('id, name');

    if (agentsError) throw agentsError;

    const agentMap = new Map(agents.map(a => [a.name, a.id]));

    console.log(`✅ Found ${agents.length} agents in database`);

    // 2. Seed ontologies
    let seedCount = 0;
    let updateCount = 0;

    for (const ontology of ONTOLOGIES) {
      const agentId = agentMap.get(ontology.agent_name);

      if (!agentId) {
        console.warn(`⚠️  Agent "${ontology.agent_name}" not found - skipping`);
        continue;
      }

      // Check if ontology exists
      const { data: existing } = await supabase
        .from('agent_ontologies')
        .select('id, version')
        .eq('agent_id', agentId)
        .eq('domain', ontology.domain)
        .single();

      if (existing) {
        // Update if version is newer
        if (ontology.version > existing.version) {
          const { error: updateError } = await supabase
            .from('agent_ontologies')
            .update({
              knowledge: ontology.knowledge,
              version: ontology.version
            })
            .eq('id', existing.id);

          if (updateError) throw updateError;

          console.log(`🔄 Updated ontology: ${ontology.agent_name}/${ontology.domain} (v${ontology.version})`);
          updateCount++;
        } else {
          console.log(`⏭️  Skipped (current version): ${ontology.agent_name}/${ontology.domain}`);
        }
      } else {
        // Insert new ontology
        const { error: insertError } = await supabase
          .from('agent_ontologies')
          .insert({
            agent_id: agentId,
            domain: ontology.domain,
            knowledge: ontology.knowledge,
            version: ontology.version
          });

        if (insertError) throw insertError;

        console.log(`✨ Created ontology: ${ontology.agent_name}/${ontology.domain} (v${ontology.version})`);
        seedCount++;
      }
    }

    console.log('\n📊 Seeding Complete:');
    console.log(`   - New ontologies: ${seedCount}`);
    console.log(`   - Updated ontologies: ${updateCount}`);
    console.log(`   - Total processed: ${seedCount + updateCount}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeding
seedOntologies().then(() => {
  console.log('\n✅ All done!');
  process.exit(0);
});
