import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash } from 'crypto';

interface BetaProvisionOptions {
  email: string;
  plan: string;
}

interface BetaProvisionResult {
  organizationId: string;
  organizationSlug: string;
  ownerId: string;
  ownerEmail: string;
  inviteLink: string;
  temporaryPassword: string;
  welcomeProjectId?: string;
}

const BETA_FEATURE_FLAGS = ['beta_core', 'advanced_export'];
const PREMIUM_LIMITS = {
  max_users: 250,
  max_agents: 100,
  api_calls_per_month: 5_000_000,
};

const PLAN_MAPPING: Record<string, { tier: 'enterprise' | 'pro' | 'free'; name: string }> = {
  enterprise_beta: {
    tier: 'enterprise',
    name: 'Enterprise Beta',
  },
};

function parseArgs(): BetaProvisionOptions {
  const [, , ...rawArgs] = process.argv;
  const args: Record<string, string> = {};

  rawArgs.forEach((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key && value) {
      args[key] = value;
    }
  });

  const email = args.email || args.e;
  const plan = args.plan || 'enterprise_beta';

  if (!email) {
    throw new Error('Missing required --email argument.');
  }

  if (!PLAN_MAPPING[plan]) {
    throw new Error(`Unsupported plan "${plan}". Supported plans: ${Object.keys(PLAN_MAPPING).join(', ')}`);
  }

  return { email, plan };
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

function buildInviteLink(token: string): string {
  const baseAppUrl = (process.env.VITE_APP_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${baseAppUrl}/beta-invite?token=${token}`;
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function ensureOrganization(
  supabase: ReturnType<typeof createClient>,
  email: string,
  plan: string
): Promise<{ id: string; slug: string; created: boolean }> {
  const domain = email.split('@')[1] || 'beta';
  const slug = slugify(`${domain}-${plan}`);

  const { data: existing, error: fetchError } = await supabase
    .from('organizations')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Unable to verify existing organization: ${fetchError.message}`);
  }

  if (existing) {
    await supabase
      .from('organizations')
      .update({
        tier: PLAN_MAPPING[plan].tier === 'enterprise' ? 'enterprise' : PLAN_MAPPING[plan].tier,
        features: { plan, feature_flags: BETA_FEATURE_FLAGS },
        limits: PREMIUM_LIMITS,
        metadata: { plan, source: 'beta-provision-script', premium_applied_at: new Date().toISOString() },
      })
      .eq('id', existing.id);

    return { id: existing.id, slug: existing.slug, created: false };
  }

  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: `${PLAN_MAPPING[plan].name} (${domain})`,
      slug,
      tier: PLAN_MAPPING[plan].tier,
      features: { plan, feature_flags: BETA_FEATURE_FLAGS },
      limits: PREMIUM_LIMITS,
      metadata: { plan, source: 'beta-provision-script', premium_applied_at: new Date().toISOString() },
    })
    .select('id, slug')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create organization: ${error?.message}`);
  }

  return { id: data.id, slug: data.slug, created: true };
}

async function createOwner(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  email: string,
  plan: string
): Promise<{ userId: string; temporaryPassword: string; inviteLink: string }> {
  const temporaryPassword = `Beta-${Math.random().toString(36).slice(2, 8)}!${Math.random().toString(10).slice(2, 4)}`;
  const inviteToken = randomUUID();
  const inviteLink = buildInviteLink(inviteToken);
  const passwordHash = hashPassword(temporaryPassword);

  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('email', email)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Unable to verify existing user: ${fetchError.message}`);
  }

  if (existingUser) {
    await supabase
      .from('users')
      .update({
        status: 'invited',
        password_hash: passwordHash,
        metadata: {
          plan,
          waitlist_bypass: true,
          beta_invite_token: inviteToken,
          beta_invite_link: inviteLink,
          premium_limits_applied: true,
        },
      })
      .eq('id', existingUser.id);

    return { userId: existingUser.id, temporaryPassword, inviteLink };
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      organization_id: organizationId,
      email,
      status: 'invited',
      role: 'admin',
      password_hash: passwordHash,
      metadata: {
        plan,
        waitlist_bypass: true,
        beta_invite_token: inviteToken,
        beta_invite_link: inviteLink,
        premium_limits_applied: true,
      },
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create owner user: ${error?.message}`);
  }

  return { userId: data.id, temporaryPassword, inviteLink };
}

async function seedWelcomeProject(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  ownerId: string
): Promise<string | undefined> {
  const welcomeModel = {
    organization_id: organizationId,
    created_by_user_id: ownerId,
    name: 'Welcome Project',
    status: 'active',
    description: 'A pre-loaded project that showcases ValueCanvas workflows and onboarding steps.',
    model_data: {
      goals: ['Collect beta feedback', 'Validate onboarding flow', 'Demonstrate collaboration'],
      checklist: [
        'Invite your team with the beta link',
        'Review the welcome canvas sections',
        'Complete the onboarding checklist to unlock Day 7 survey',
      ],
    },
    metadata: {
      template: true,
      seeded_by: 'beta-provision-script',
      feature_flags: BETA_FEATURE_FLAGS,
    },
  };

  const { data, error } = await supabase
    .from('models')
    .insert(welcomeModel)
    .select('id')
    .single();

  if (error) {
    console.warn('⚠️  Unable to seed Welcome Project template:', error.message);
    return undefined;
  }

  return data?.id;
}

async function provision(): Promise<BetaProvisionResult> {
  const { email, plan } = parseArgs();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is required to provision beta tenants.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const org = await ensureOrganization(supabase, email, plan);
  const owner = await createOwner(supabase, org.id, email, plan);
  const welcomeProjectId = await seedWelcomeProject(supabase, org.id, owner.userId);

  return {
    organizationId: org.id,
    organizationSlug: org.slug,
    ownerEmail: email,
    ownerId: owner.userId,
    inviteLink: owner.inviteLink,
    temporaryPassword: owner.temporaryPassword,
    welcomeProjectId,
  };
}

provision()
  .then((result) => {
    console.log('✅ Beta tenant provisioned successfully');
    console.log('---------------------------------------');
    console.log(`Organization ID: ${result.organizationId}`);
    console.log(`Organization Slug: ${result.organizationSlug}`);
    console.log(`Owner User ID: ${result.ownerId}`);
    if (result.welcomeProjectId) {
      console.log(`Welcome Project ID: ${result.welcomeProjectId}`);
    }
    console.log('Feature Flags:', BETA_FEATURE_FLAGS.join(', '));
    console.log('Premium Limits:', PREMIUM_LIMITS);
    console.log('');
    console.log('Login / Invite Details');
    console.log(`  Email: ${result.ownerEmail}`);
    console.log(`  Temporary Password: ${result.temporaryPassword}`);
    console.log(`  Invite Link (waitlist bypass): ${result.inviteLink}`);
    console.log('---------------------------------------');
  })
  .catch((error) => {
    console.error('❌ Beta provisioning failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
