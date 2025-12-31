/**
 * Seed Development Database
 * 
 * This script seeds the development database with realistic multi-tenant test data.
 * It is designed to be run via `tsx`, e.g., `npx tsx scripts/seed_database.ts`
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration ---
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'your-service-key'; // Ensure this is set in your env

if (!supabaseServiceKey || !supabaseUrl) {
  throw new Error('Supabase URL and Service Key must be provided in environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedDevelopmentData() {
  console.log('Seeding development database...');

  try {
    // ============================================ 
    // Create Test Organizations
    // ============================================ 
    console.log('Creating organizations...');
    const { data: orgs, error: orgError } = await supabase.from('organizations').insert([
      {
        name: 'Acme Corp',
        slug: 'acme-corp',
        tier: 'enterprise',
        features: { ai_agents: true, api_access: true },
        limits: { max_users: 100, max_agents: 50, api_calls_per_month: 1000000 },
      },
      {
        name: 'TechStart Inc',
        slug: 'techstart-inc',
        tier: 'pro',
        features: { ai_agents: true, api_access: false },
        limits: { max_users: 20, max_agents: 10, api_calls_per_month: 100000 },
      }
    ]).select();

    if (orgError) throw orgError;
    const [org1, org2] = orgs;
    console.log(`✓ Created ${orgs.length} organizations.`);

    // ============================================ 
    // Create Test Users
    // ============================================ 
    console.log('Creating users...');
    // Note: In a real scenario, you'd use Supabase Auth to create users.
    // For seeding, we're inserting directly into the public.users table.
    // This requires a password_hash, which we will simulate.
    const { data: users, error: userError } = await supabase.from('users').insert([
      {
        organization_id: org1.id,
        email: 'admin@acme.com',
        password_hash: 'hashed_pwd_1', // Placeholder
        first_name: 'Alice',
        last_name: 'Admin',
        role: 'admin',
        status: 'active',
      },
      {
        organization_id: org1.id,
        email: 'user@acme.com',
        password_hash: 'hashed_pwd_2', // Placeholder
        first_name: 'Bob',
        last_name: 'Member',
        role: 'member',
        status: 'active',
      },
      {
        organization_id: org2.id,
        email: 'cso@techstart.com',
        password_hash: 'hashed_pwd_3', // Placeholder
        first_name: 'Charlie',
        last_name: 'CSO',
        role: 'admin',
        status: 'active',
      }
    ]).select();

    if (userError) throw userError;
    const [adminUser] = users;
    console.log(`✓ Created ${users.length} users.`);


    // ============================================ 
    // Create Test Agents
    // ============================================ 
    console.log('Creating agents...');
    const agentTypes = ['research', 'analysis', 'modeling', 'narrative'];
    const agentInserts = agentTypes.map(type => ({
      organization_id: org1.id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
      agent_type: type,
      config: { model: "gpt-4", temperature: 0.7, tools: [] },
      is_active: true,
    }));
    const { data: agents, error: agentError } = await supabase.from('agents').insert(agentInserts).select();
    if (agentError) throw agentError;
    console.log(`✓ Created ${agents.length} agents.`);

    // ============================================ 
    // Create Test Agent Runs
    // ============================================ 
    console.log('Creating agent runs...');
    const agentRunInserts = Array.from({ length: 5 }, (_, i) => ({
      organization_id: org1.id,
      agent_id: agents[0].id, // Research agent
      user_id: adminUser.id,
      input: { query: `Analyze market trend ${i}` },
      output: { findings: `Trend ${i} analysis complete` },
      status: 'success',
      duration_ms: 2500 + (i * 100),
      tokens_used: { input: 1000, output: 1500 },
    }));
    const { data: agentRuns, error: agentRunError } = await supabase.from('agent_runs').insert(agentRunInserts).select();
    if (agentRunError) throw agentRunError;
    console.log(`✓ Created ${agentRuns.length} agent runs.`);

    // ============================================ 
    // Create Test Models (Value Models)
    // ============================================ 
    console.log('Creating value models...');
    const { data: model, error: modelError } = await supabase.from('models').insert({
      organization_id: org1.id,
      created_by_user_id: adminUser.id,
      name: 'Q1 2025 ROI Model',
      status: 'active',
      model_data: {
        scenario: 'conservative',
        assumptions: {
          discount_rate: 0.15,
          projection_years: 3,
        },
      },
    }).select().single();
    if (modelError) throw modelError;
    console.log('✓ Created 1 value model.');

    // ============================================ 
    // Create Test KPIs
    // ============================================ 
    console.log('Creating KPIs...');
    const kpiConfigs = [
      { name: "Lead Conversion Rate", category: "revenue", formula: "(qualified_leads / total_leads) * 100", baseline: 15.0, target: 25.0, unit: "%" },
      { name: "Onboarding Cycle Time", category: "cost", formula: "go_live_date - kickoff_date", baseline: 45.0, target: 25.0, unit: "days" },
      { name: "Manual Hours Reduced", category: "cost", formula: "baseline_hours - post_implementation_hours", baseline: 500.0, target: 900.0, unit: "hours" },
    ];
    const kpiInserts = kpiConfigs.map(kpi => ({
      organization_id: org1.id,
      model_id: model.id,
      ...kpi,
    }));
    const { data: kpis, error: kpiError } = await supabase.from('kpis').insert(kpiInserts).select();
    if (kpiError) throw kpiError;
    console.log(`✓ Created ${kpis.length} KPIs.`);

    // ============================================ 
    // Create API Keys
    // ============================================ 
    console.log('Creating API keys...');
    const { data: apiKey, error: apiKeyError } = await supabase.from('api_keys').insert({
      organization_id: org1.id,
      user_id: adminUser.id,
      key_hash: 'sk_dev_1234567890abcdef', // Placeholder, use proper hashing in reality
      name: 'Development Key',
      scopes: ['read:models', 'write:agents', 'execute:agents'],
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();
    if (apiKeyError) throw apiKeyError;
    console.log('✓ Created 1 API key.');

    console.log('
✅ Development database seeded successfully!');
  } catch (error) {
    console.error('
✗ Seeding failed:');
    console.error(error);
    process.exit(1);
  }
}

seedDevelopmentData();
