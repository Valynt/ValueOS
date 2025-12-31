/**
 * Database Seed Script
 * Populates database with initial data for development and testing
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (development only!)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.canvas.deleteMany();
    await prisma.model.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
  }

  // Create Organizations
  console.log('🏢 Creating organizations...');
  
  const demoOrg = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo-org',
      tier: 'PRO',
      features: {
        aiAgents: true,
        advancedAnalytics: true,
        customModels: true,
        apiAccess: true,
      },
      limits: {
        max_users: 50,
        max_agents: 10,
        api_calls_per_month: 100000,
      },
      metadata: {
        industry: 'Technology',
        size: 'Medium',
      },
    },
  });

  const enterpriseOrg = await prisma.organization.create({
    data: {
      name: 'Enterprise Corp',
      slug: 'enterprise-corp',
      tier: 'ENTERPRISE',
      features: {
        aiAgents: true,
        advancedAnalytics: true,
        customModels: true,
        apiAccess: true,
        sso: true,
        dedicatedSupport: true,
        customIntegrations: true,
      },
      limits: {
        max_users: -1, // Unlimited
        max_agents: -1,
        api_calls_per_month: -1,
      },
      metadata: {
        industry: 'Finance',
        size: 'Enterprise',
      },
    },
  });

  const freeOrg = await prisma.organization.create({
    data: {
      name: 'Startup Inc',
      slug: 'startup-inc',
      tier: 'FREE',
      features: {
        aiAgents: false,
        advancedAnalytics: false,
        customModels: false,
        apiAccess: false,
      },
      limits: {
        max_users: 5,
        max_agents: 3,
        api_calls_per_month: 10000,
      },
    },
  });

  console.log(`✅ Created ${3} organizations`);

  // Create Users
  console.log('👥 Creating users...');
  
  const passwordHash = await bcrypt.hash('Demo123!@#', 10);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      email: 'admin@demo-org.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      status: 'ACTIVE',
      metadata: {
        department: 'Management',
        title: 'Administrator',
      },
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      email: 'manager@demo-org.com',
      passwordHash,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER',
      status: 'ACTIVE',
      metadata: {
        department: 'Operations',
        title: 'Project Manager',
      },
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      organizationId: demoOrg.id,
      email: 'member@demo-org.com',
      passwordHash,
      firstName: 'Member',
      lastName: 'User',
      role: 'MEMBER',
      status: 'ACTIVE',
      metadata: {
        department: 'Engineering',
        title: 'Software Engineer',
      },
    },
  });

  const enterpriseAdmin = await prisma.user.create({
    data: {
      organizationId: enterpriseOrg.id,
      email: 'admin@enterprise-corp.com',
      passwordHash,
      firstName: 'Enterprise',
      lastName: 'Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const freeUser = await prisma.user.create({
    data: {
      organizationId: freeOrg.id,
      email: 'founder@startup-inc.com',
      passwordHash,
      firstName: 'Startup',
      lastName: 'Founder',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log(`✅ Created ${5} users`);

  // Create Agents
  console.log('🤖 Creating agents...');

  const opportunityAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      name: 'Opportunity Discovery Agent',
      description: 'Identifies market opportunities and customer needs',
      agentType: 'opportunity',
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        tools: ['web_search', 'data_analysis'],
      },
      version: 1,
      isActive: true,
    },
  });

  const targetAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      name: 'Target Audience Agent',
      description: 'Analyzes and segments target audiences',
      agentType: 'target',
      config: {
        model: 'gpt-4',
        temperature: 0.5,
        maxTokens: 1500,
        tools: ['demographic_analysis', 'persona_generation'],
      },
      version: 1,
      isActive: true,
    },
  });

  const realizationAgent = await prisma.agent.create({
    data: {
      organizationId: demoOrg.id,
      name: 'Value Realization Agent',
      description: 'Tracks and measures value delivery',
      agentType: 'realization',
      config: {
        model: 'gpt-4',
        temperature: 0.3,
        maxTokens: 1000,
        tools: ['metrics_tracking', 'roi_calculation'],
      },
      version: 1,
      isActive: true,
    },
  });

  console.log(`✅ Created ${3} agents`);

  // Create Models
  console.log('📊 Creating models...');

  const businessModelCanvas = await prisma.model.create({
    data: {
      organizationId: demoOrg.id,
      name: 'Business Model Canvas',
      description: 'Strategic management template for developing new business models',
      modelType: 'business_model',
      schema: {
        sections: [
          { id: 'key_partners', name: 'Key Partners', type: 'text_list' },
          { id: 'key_activities', name: 'Key Activities', type: 'text_list' },
          { id: 'key_resources', name: 'Key Resources', type: 'text_list' },
          { id: 'value_propositions', name: 'Value Propositions', type: 'text_list' },
          { id: 'customer_relationships', name: 'Customer Relationships', type: 'text_list' },
          { id: 'channels', name: 'Channels', type: 'text_list' },
          { id: 'customer_segments', name: 'Customer Segments', type: 'text_list' },
          { id: 'cost_structure', name: 'Cost Structure', type: 'text_list' },
          { id: 'revenue_streams', name: 'Revenue Streams', type: 'text_list' },
        ],
      },
      version: 1,
      isPublished: true,
    },
  });

  const valuePropositionCanvas = await prisma.model.create({
    data: {
      organizationId: demoOrg.id,
      name: 'Value Proposition Canvas',
      description: 'Tool to ensure product-market fit',
      modelType: 'value_proposition',
      schema: {
        sections: [
          { id: 'customer_jobs', name: 'Customer Jobs', type: 'text_list' },
          { id: 'pains', name: 'Pains', type: 'text_list' },
          { id: 'gains', name: 'Gains', type: 'text_list' },
          { id: 'products_services', name: 'Products & Services', type: 'text_list' },
          { id: 'pain_relievers', name: 'Pain Relievers', type: 'text_list' },
          { id: 'gain_creators', name: 'Gain Creators', type: 'text_list' },
        ],
      },
      version: 1,
      isPublished: true,
    },
  });

  console.log(`✅ Created ${2} models`);

  // Create Sample Canvases
  console.log('🎨 Creating sample canvases...');

  const sampleCanvas1 = await prisma.canvas.create({
    data: {
      organizationId: demoOrg.id,
      modelId: businessModelCanvas.id,
      userId: adminUser.id,
      name: 'SaaS Product Business Model',
      data: {
        key_partners: ['Cloud providers', 'Payment processors', 'Marketing agencies'],
        key_activities: ['Software development', 'Customer support', 'Marketing'],
        key_resources: ['Development team', 'Cloud infrastructure', 'Brand'],
        value_propositions: ['Easy to use', 'Affordable pricing', 'Excellent support'],
        customer_relationships: ['Self-service', 'Automated support', 'Community'],
        channels: ['Website', 'App stores', 'Social media'],
        customer_segments: ['Small businesses', 'Startups', 'Freelancers'],
        cost_structure: ['Development costs', 'Infrastructure', 'Marketing', 'Support'],
        revenue_streams: ['Subscription fees', 'Premium features', 'Enterprise plans'],
      },
      version: 1,
      isShared: true,
    },
  });

  const sampleCanvas2 = await prisma.canvas.create({
    data: {
      organizationId: demoOrg.id,
      modelId: valuePropositionCanvas.id,
      userId: managerUser.id,
      name: 'Project Management Tool Value Prop',
      data: {
        customer_jobs: ['Manage projects', 'Track progress', 'Collaborate with team'],
        pains: ['Complex tools', 'Poor visibility', 'Communication gaps'],
        gains: ['Better organization', 'Time savings', 'Improved collaboration'],
        products_services: ['Task management', 'Gantt charts', 'Team chat', 'Reporting'],
        pain_relievers: ['Intuitive interface', 'Real-time updates', 'Integrated communication'],
        gain_creators: ['Automated workflows', 'Smart notifications', 'Analytics dashboard'],
      },
      version: 1,
      isShared: false,
    },
  });

  console.log(`✅ Created ${2} sample canvases`);

  // Create Sample Executions
  console.log('⚙️ Creating sample executions...');

  await prisma.execution.create({
    data: {
      organizationId: demoOrg.id,
      agentId: opportunityAgent.id,
      status: 'COMPLETED',
      input: {
        query: 'Identify opportunities in the project management software market',
        context: 'Focus on small to medium businesses',
      },
      output: {
        opportunities: [
          'Remote work collaboration tools',
          'AI-powered task prioritization',
          'Integration with popular tools',
        ],
        confidence: 0.85,
      },
      startedAt: new Date(Date.now() - 3600000),
      completedAt: new Date(Date.now() - 3000000),
    },
  });

  await prisma.execution.create({
    data: {
      organizationId: demoOrg.id,
      agentId: targetAgent.id,
      status: 'COMPLETED',
      input: {
        query: 'Analyze target audience for project management tool',
      },
      output: {
        segments: [
          { name: 'Tech Startups', size: 'Large', priority: 'High' },
          { name: 'Creative Agencies', size: 'Medium', priority: 'Medium' },
          { name: 'Consulting Firms', size: 'Medium', priority: 'High' },
        ],
      },
      startedAt: new Date(Date.now() - 7200000),
      completedAt: new Date(Date.now() - 6000000),
    },
  });

  console.log(`✅ Created ${2} sample executions`);

  // Create API Keys
  console.log('🔑 Creating API keys...');

  const apiKeyHash = await bcrypt.hash('demo_api_key_12345', 10);

  await prisma.apiKey.create({
    data: {
      organizationId: demoOrg.id,
      userId: adminUser.id,
      keyHash: apiKeyHash,
      name: 'Development API Key',
      scopes: ['read:models', 'write:canvases', 'execute:agents'],
      rateLimit: 1000,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });

  console.log(`✅ Created API keys`);

  // Create Audit Logs
  console.log('📝 Creating audit logs...');

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: demoOrg.id,
        userId: adminUser.id,
        action: 'create',
        resourceType: 'canvas',
        resourceId: sampleCanvas1.id,
        changes: {
          after: { name: 'SaaS Product Business Model' },
        },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
      {
        organizationId: demoOrg.id,
        userId: managerUser.id,
        action: 'create',
        resourceType: 'canvas',
        resourceId: sampleCanvas2.id,
        changes: {
          after: { name: 'Project Management Tool Value Prop' },
        },
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
      },
      {
        organizationId: demoOrg.id,
        userId: adminUser.id,
        action: 'execute',
        resourceType: 'agent',
        resourceId: opportunityAgent.id,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    ],
  });

  console.log(`✅ Created audit logs`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Organizations: 3`);
  console.log(`   Users: 5`);
  console.log(`   Agents: 3`);
  console.log(`   Models: 2`);
  console.log(`   Canvases: 2`);
  console.log(`   Executions: 2`);
  console.log('\n🔐 Demo Credentials:');
  console.log(`   Admin: admin@demo-org.com / Demo123!@#`);
  console.log(`   Manager: manager@demo-org.com / Demo123!@#`);
  console.log(`   Member: member@demo-org.com / Demo123!@#`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
