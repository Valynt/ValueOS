/*
 Node helper to create a dummy Supabase auth user using service role key if available.
 Usage:
   node scripts/create_dummy_user.js

 Requires one of:
 - SUPABASE_SERVICE_ROLE (preferred) and SUPABASE_URL
 - or DATABASE_URL and psql available (not implemented here)

 The script will create a Supabase auth user via the Admin API and return a signed JWT (if JWT_SECRET present).
*/

const fetch = require("node-fetch");
const { sign } = require("jsonwebtoken");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const JWT_SECRET =
  process.env.JWT_SECRET || process.env.TEST_JWT_SECRET || "test-secret";

async function createUser() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE. Falling back to SQL seed file."
    );
    console.error(
      "Run: psql $DATABASE_URL -f scripts/seeds/create_dummy_user.sql"
    );
    process.exit(1);
  }

  const email = "dev+dummy@localhost";
  const password = "devpassword123";

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "developer", note: "local dummy user" },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Admin API failed:", resp.status, text);
    process.exit(1);
  }

  const data = await resp.json();
  console.log("Created auth user id:", data.id);

  // Generate a JWT for local dev use (not a real Supabase session token)
  const token = sign(
    { sub: data.id, aud: "authenticated", role: "authenticated" },
    JWT_SECRET,
    { expiresIn: "4h" }
  );
  console.log("Dev JWT (use as BEARER for local tests):", token);
  console.log("\nYou can also run the SQL seed to create a users row:");
  console.log("psql $DATABASE_URL -f scripts/seeds/create_dummy_user.sql");
}

createUser().catch((err) => {
  console.error(err);
  process.exit(1);
});
