#!/usr/bin/env node

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_KEY',
];

const missing = required.filter((name) => {
  const value = process.env[name];
  return !value || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error(`Missing required Supabase secrets for environment '${process.env.TARGET_ENVIRONMENT || 'unknown'}': ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.SUPABASE_KEY !== process.env.SUPABASE_ANON_KEY) {
  console.error('SUPABASE_KEY must match SUPABASE_ANON_KEY for backend compatibility.');
  process.exit(1);
}

const summarize = (value) => {
  const len = value.length;
  return `len=${len}`;
};

console.log(`Supabase secret contract validated for '${process.env.TARGET_ENVIRONMENT || 'unknown'}'.`);
for (const name of required) {
  console.log(`- ${name}: ${summarize(process.env[name])}`);
}
