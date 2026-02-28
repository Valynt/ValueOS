-- Domain Packs v2: Add remaining overlay layers
-- Adds glossary, narrative_templates, compliance_rules, risk_weights,
-- and benchmarks JSONB columns to domain_packs table.

BEGIN;

-- =====================================================
-- 1. Add overlay layer columns to domain_packs
-- =====================================================

ALTER TABLE public.domain_packs
ADD COLUMN IF NOT EXISTS glossary JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS narrative_templates JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS compliance_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS risk_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS benchmarks JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS description TEXT;

-- =====================================================
-- 2. Add slug column for URL-friendly identifiers
-- =====================================================

ALTER TABLE public.domain_packs
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Populate slug from name for existing rows
UPDATE public.domain_packs
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- =====================================================
-- 3. Seed global domain packs (Banking + SaaS)
-- =====================================================

INSERT INTO public.domain_packs (
  id, tenant_id, name, slug, industry, version, status,
  glossary, narrative_templates, compliance_rules, risk_weights, benchmarks, description
) VALUES
(
  '00000000-0000-4000-a000-000000000001',
  NULL,
  'Banking & Financial Services',
  'banking',
  'Banking',
  '1.0.0',
  'active',
  '{"revenue_uplift": "Net Interest Margin Expansion", "cost_reduction": "Core System Modernization Savings", "efficiency_gain": "Straight-Through Processing Rate", "risk_mitigation": "Fraud Exposure Reduction", "user": "Account Holder", "customer": "Client", "product": "Financial Instrument"}'::jsonb,
  '{"executive_summary": "banking-exec-summary-v1", "board_presentation": "banking-board-v1"}'::jsonb,
  '["SOX compliance required for all financial reporting", "Basel III capital adequacy standards apply", "PCI-DSS compliance for payment processing", "CCAR/DFAST stress testing requirements", "BSA/AML anti-money laundering controls"]'::jsonb,
  '{"compliance": {"weight": 0.30, "label": "Regulatory Compliance"}, "operational": {"weight": 0.25, "label": "Operational Risk"}, "technology": {"weight": 0.20, "label": "Technology Risk"}, "market": {"weight": 0.15, "label": "Market Risk"}, "reputational": {"weight": 0.10, "label": "Reputational Risk"}}'::jsonb,
  '[]'::jsonb,
  'KPI overlay for regulated financial institutions including banking, insurance, and capital markets'
),
(
  '00000000-0000-4000-a000-000000000002',
  NULL,
  'SaaS / HiTech',
  'saas',
  'SaaS',
  '1.0.0',
  'active',
  '{"revenue_uplift": "ARR Expansion", "cost_reduction": "OpEx Optimization", "efficiency_gain": "Engineering Velocity", "risk_mitigation": "Churn Prevention", "user": "End User", "customer": "Account", "product": "Platform"}'::jsonb,
  '{"executive_summary": "saas-exec-summary-v1", "board_presentation": "saas-board-v1"}'::jsonb,
  '["SOC 2 Type II compliance for data handling", "GDPR/CCPA data privacy requirements", "SLA uptime commitments (99.9%+)"]'::jsonb,
  '{"technology": {"weight": 0.30, "label": "Technology & Platform Risk"}, "market": {"weight": 0.25, "label": "Market & Competition Risk"}, "operational": {"weight": 0.20, "label": "Operational Risk"}, "compliance": {"weight": 0.15, "label": "Compliance Risk"}, "financial": {"weight": 0.10, "label": "Financial Risk"}}'::jsonb,
  '[]'::jsonb,
  'KPI overlay for SaaS and high-tech software companies'
),
(
  '00000000-0000-4000-a000-000000000003',
  NULL,
  'Industrial Manufacturing',
  'manufacturing',
  'Manufacturing',
  '1.0.0',
  'active',
  '{"revenue_uplift": "Yield Improvement Revenue", "cost_reduction": "Scrap & Rework Reduction", "efficiency_gain": "OEE Improvement", "risk_mitigation": "Unplanned Downtime Reduction", "user": "Operator", "customer": "OEM Partner", "product": "Production Line"}'::jsonb,
  '{"executive_summary": "mfg-exec-summary-v1", "board_presentation": "mfg-board-v1"}'::jsonb,
  '["ISO 9001 quality management compliance", "OSHA workplace safety requirements", "EPA environmental compliance", "Industry 4.0 cybersecurity standards (IEC 62443)"]'::jsonb,
  '{"operational": {"weight": 0.30, "label": "Operational & Supply Chain Risk"}, "technology": {"weight": 0.25, "label": "Technology Integration Risk"}, "safety": {"weight": 0.20, "label": "Safety & Environmental Risk"}, "market": {"weight": 0.15, "label": "Market & Demand Risk"}, "compliance": {"weight": 0.10, "label": "Regulatory Compliance Risk"}}'::jsonb,
  '[]'::jsonb,
  'KPI overlay for discrete and process manufacturing operations'
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 4. Seed KPIs for Banking pack
-- =====================================================

INSERT INTO public.domain_pack_kpis (
  domain_pack_id, kpi_key, default_name, description, unit, direction,
  baseline_hint, target_hint, default_confidence, sort_order
) VALUES
('00000000-0000-4000-a000-000000000001', 'core_modernization_savings', 'Core System Modernization Savings', 'Annual cost reduction from replacing legacy core banking systems', 'USD', 'increase', 'Typical legacy maintenance: $15M–$50M/year', 'Target: 30–50% reduction in first 3 years', 0.80, 1),
('00000000-0000-4000-a000-000000000001', 'regulatory_reporting_cost', 'Regulatory Reporting Cost Impact', 'Change in cost of producing regulatory reports (Basel, CCAR, DFAST)', 'USD', 'decrease', 'Typical: $5M–$20M annually', 'Automation target: 40–60% reduction', 0.75, 2),
('00000000-0000-4000-a000-000000000001', 'basel_capital_efficiency', 'Basel III Capital Efficiency Delta', 'Improvement in risk-weighted asset calculations reducing capital reserve requirements', 'bps', 'increase', 'Current RWA ratio: typically 10–14%', 'Target: 20–50 bps improvement', 0.70, 3),
('00000000-0000-4000-a000-000000000001', 'fraud_exposure_reduction', 'Fraud Exposure Reduction', 'Reduction in annual fraud losses through improved detection and prevention', 'USD', 'increase', 'Typical fraud losses: 0.1–0.3% of transaction volume', 'Target: 30–50% reduction in false negatives', 0.75, 4),
('00000000-0000-4000-a000-000000000001', 'audit_automation_savings', 'Audit Automation Savings', 'Cost reduction from automating internal and external audit preparation', 'USD', 'increase', 'Typical audit prep: 2,000–5,000 person-hours/year', 'Automation target: 50–70% reduction', 0.80, 5),
('00000000-0000-4000-a000-000000000001', 'stp_rate', 'Straight-Through Processing Rate', 'Percentage of transactions processed without manual intervention', '%', 'increase', 'Typical: 70–85%', 'Best-in-class: >95%', 0.85, 6)
ON CONFLICT (domain_pack_id, kpi_key) DO NOTHING;

-- =====================================================
-- 5. Seed KPIs for SaaS pack
-- =====================================================

INSERT INTO public.domain_pack_kpis (
  domain_pack_id, kpi_key, default_name, description, unit, direction,
  baseline_hint, target_hint, default_confidence, sort_order
) VALUES
('00000000-0000-4000-a000-000000000002', 'arr_expansion', 'ARR Expansion', 'Net new annual recurring revenue from upsell, cross-sell, and price increases', 'USD', 'increase', 'Current ARR: typically $5M–$50M', 'Target: 120–140% net revenue retention', 0.80, 1),
('00000000-0000-4000-a000-000000000002', 'cac_payback', 'CAC Payback Period', 'Months to recover fully-loaded customer acquisition cost', 'months', 'decrease', 'Typical: 12–18 months', 'Top quartile: <12 months', 0.80, 2),
('00000000-0000-4000-a000-000000000002', 'gross_churn_rate', 'Gross Churn Rate', 'Annual percentage of ARR lost to cancellations and downgrades', '%', 'decrease', 'Typical: 8–15% annually', 'Best-in-class: <5%', 0.85, 3),
('00000000-0000-4000-a000-000000000002', 'ndr', 'Net Dollar Retention', 'Revenue retained from existing customers including expansion, net of churn', '%', 'increase', 'Typical: 100–110%', 'Top quartile: >120%', 0.80, 4),
('00000000-0000-4000-a000-000000000002', 'ltv_cac_ratio', 'LTV:CAC Ratio', 'Lifetime value divided by customer acquisition cost', 'ratio', 'increase', 'Typical: 3:1', 'Target: >5:1', 0.75, 5),
('00000000-0000-4000-a000-000000000002', 'rule_of_40', 'Rule of 40 Score', 'Revenue growth rate + profit margin — measures balanced growth', '%', 'increase', 'Typical: 20–35%', 'Elite: >40%', 0.80, 6)
ON CONFLICT (domain_pack_id, kpi_key) DO NOTHING;

-- =====================================================
-- 6. Seed KPIs for Manufacturing pack
-- =====================================================

INSERT INTO public.domain_pack_kpis (
  domain_pack_id, kpi_key, default_name, description, unit, direction,
  baseline_hint, target_hint, default_confidence, sort_order
) VALUES
('00000000-0000-4000-a000-000000000003', 'oee', 'Overall Equipment Effectiveness', 'Availability × Performance × Quality — measures true productive capacity', '%', 'increase', 'World average: 60–65%', 'World-class: >85%', 0.85, 1),
('00000000-0000-4000-a000-000000000003', 'scrap_rate', 'Scrap & Rework Rate', 'Percentage of production output that requires rework or is scrapped', '%', 'decrease', 'Typical: 2–5% of production', 'Target: <1%', 0.80, 2),
('00000000-0000-4000-a000-000000000003', 'unplanned_downtime', 'Unplanned Downtime Reduction', 'Hours of unplanned production stoppage per month', 'hrs', 'decrease', 'Typical: 40–80 hrs/month', 'Target: <10 hrs/month', 0.80, 3),
('00000000-0000-4000-a000-000000000003', 'energy_per_unit', 'Energy Cost per Unit', 'Energy consumption cost per unit of production output', 'USD', 'decrease', 'Varies by process type', 'Target: 10–20% reduction', 0.75, 4),
('00000000-0000-4000-a000-000000000003', 'inventory_turns', 'Inventory Turns', 'Number of times inventory is sold and replaced per year', 'count', 'increase', 'Typical: 4–8 turns/year', 'Best-in-class: >12 turns/year', 0.80, 5),
('00000000-0000-4000-a000-000000000003', 'mttr', 'Mean Time to Repair', 'Average time to restore equipment to operational status after failure', 'hrs', 'decrease', 'Typical: 4–8 hours', 'Target: <2 hours', 0.80, 6)
ON CONFLICT (domain_pack_id, kpi_key) DO NOTHING;

-- =====================================================
-- 7. Seed Assumptions for Banking pack
-- =====================================================

INSERT INTO public.domain_pack_assumptions (
  domain_pack_id, assumption_key, value_type, value_number, unit, default_confidence, rationale
) VALUES
('00000000-0000-4000-a000-000000000001', 'discount_rate', 'number', 12, '%', 0.90, 'WACC — higher for regulated financial institutions'),
('00000000-0000-4000-a000-000000000001', 'risk_premium', 'number', 4, '%', 0.85, 'Additional risk adjustment for regulatory and operational risk'),
('00000000-0000-4000-a000-000000000001', 'payback_tolerance_months', 'number', 21, 'months', 0.90, 'Longer payback tolerance due to regulatory cycles'),
('00000000-0000-4000-a000-000000000001', 'compliance_cost_multiplier', 'number', 1.35, 'x', 0.85, 'Multiplier for regulatory compliance overhead (SOX, Basel, PCI-DSS)')
ON CONFLICT (domain_pack_id, assumption_key) DO NOTHING;

-- =====================================================
-- 8. Seed Assumptions for SaaS pack
-- =====================================================

INSERT INTO public.domain_pack_assumptions (
  domain_pack_id, assumption_key, value_type, value_number, unit, default_confidence, rationale
) VALUES
('00000000-0000-4000-a000-000000000002', 'discount_rate', 'number', 9, '%', 0.90, 'Weighted average cost of capital for NPV calculations'),
('00000000-0000-4000-a000-000000000002', 'risk_premium', 'number', 2, '%', 0.85, 'Additional risk adjustment for SaaS revenue volatility'),
('00000000-0000-4000-a000-000000000002', 'payback_tolerance_months', 'number', 15, 'months', 0.90, 'Maximum acceptable payback period for investment approval'),
('00000000-0000-4000-a000-000000000002', 'compliance_cost_multiplier', 'number', 1.05, 'x', 0.90, 'Multiplier for regulatory compliance overhead')
ON CONFLICT (domain_pack_id, assumption_key) DO NOTHING;

-- =====================================================
-- 9. Seed Assumptions for Manufacturing pack
-- =====================================================

INSERT INTO public.domain_pack_assumptions (
  domain_pack_id, assumption_key, value_type, value_number, unit, default_confidence, rationale
) VALUES
('00000000-0000-4000-a000-000000000003', 'discount_rate', 'number', 10, '%', 0.90, 'Standard WACC for capital-intensive manufacturing'),
('00000000-0000-4000-a000-000000000003', 'risk_premium', 'number', 3, '%', 0.85, 'Supply chain and operational risk adjustment'),
('00000000-0000-4000-a000-000000000003', 'payback_tolerance_months', 'number', 24, 'months', 0.90, 'Longer payback for capital equipment investments'),
('00000000-0000-4000-a000-000000000003', 'compliance_cost_multiplier', 'number', 1.15, 'x', 0.85, 'Multiplier for safety and environmental compliance (OSHA, EPA)')
ON CONFLICT (domain_pack_id, assumption_key) DO NOTHING;

COMMIT;
