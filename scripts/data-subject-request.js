#!/usr/bin/env node
/**
 * Data Subject Request (DSR) utility
 *
 * Supports locate/export/anonymize actions across the core tables storing PII.
 * Usage: node scripts/data-subject-request.js --email user@example.com --action export
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    acc.push([key, value || 'true']);
    return acc;
  }, [])
);

const email = args.email;
const action = args.action || 'locate';

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('A valid --email must be provided.');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY before running.');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey);

const requestId = args.requestId || randomUUID();

async function recordAudit(eventType, details = {}) {
  await client.from('security_audit_log').insert({
    request_id: requestId,
    event_type: eventType,
    actor: 'dsr-script',
    user_id: null,
    action: action,
    resource: 'dsr',
    request_path: 'scripts/data-subject-request.js',
    event_data: { email, ...details },
    severity: 'medium',
  });
}

async function locateUser(emailAddress) {
  const { data, error } = await client.from('users').select('*').eq('email', emailAddress).maybeSingle();
  if (error) throw error;
  return data;
}

async function gatherFootprint(userId) {
  const tables = [
    ['cases', 'user_id'],
    ['messages', 'user_id'],
    ['agent_sessions', 'user_id'],
    ['agent_memory', 'user_id'],
    ['audit_logs', 'user_id'],
    ['security_audit_log', 'user_id'],
  ];

  const footprint = {};
  for (const [table, column] of tables) {
    const { data, error } = await client.from(table).select('*').eq(column, userId);
    if (error) throw error;
    footprint[table] = data;
  }
  return footprint;
}

async function exportUserData(user, footprint) {
  const exportDir = args.output || 'dsr-exports';
  fs.mkdirSync(exportDir, { recursive: true });
  const filePath = path.join(exportDir, `dsr-${user.email.replace(/[@.]/g, '_')}.json`);
  const payload = {
    user,
    footprint,
    exported_at: new Date().toISOString(),
    request_id: requestId,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return filePath;
}

async function anonymizeUser(user) {
  const placeholderEmail = `deleted+${user.id}@example.com`;

  await client.from('users').update({
    email: placeholderEmail,
    full_name: null,
    display_name: null,
    avatar_url: null,
    metadata: {
      ...user.metadata,
      anonymized: true,
      anonymized_at: new Date().toISOString(),
      original_email: user.email,
    },
  }).eq('id', user.id);

  const scrubbedFields = {
    content: '[anonymized]',
    metadata: { anonymized: true, redacted_at: new Date().toISOString() },
  };

  await client.from('messages').update(scrubbedFields).eq('user_id', user.id);
  await client.from('cases').update({ description: '[anonymized]' }).eq('user_id', user.id);
  await client.from('agent_memory').update({ content: '[anonymized]' }).eq('user_id', user.id);
}

async function run() {
  try {
    const user = await locateUser(email);
    if (!user) {
      console.error(`No user found for ${email}`);
      return;
    }

    const footprint = await gatherFootprint(user.id);

    if (action === 'locate') {
      console.log(JSON.stringify({ request_id: requestId, user, footprint_summary: Object.fromEntries(Object.entries(footprint).map(([table, rows]) => [table, rows.length])) }, null, 2));
      await recordAudit('dsr_locate', { tables: Object.keys(footprint) });
      return;
    }

    if (action === 'export') {
      const filePath = await exportUserData(user, footprint);
      console.log(`Exported user data to ${filePath}`);
      await recordAudit('dsr_export', { filePath });
      return;
    }

    if (action === 'anonymize') {
      await anonymizeUser(user);
      await recordAudit('dsr_anonymize', { tables_updated: ['users', 'messages', 'cases', 'agent_memory'] });
      console.log(`Anonymized user ${email}`);
      return;
    }

    console.error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('DSR script failed', error);
    await recordAudit('dsr_error', { message: error?.message || String(error) });
    process.exit(1);
  }
}

run();
