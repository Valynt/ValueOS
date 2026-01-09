import { afterAll, beforeAll } from "vitest";
import { setup, teardown } from "./testcontainers-global-setup";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import { getEnvVar, setEnvVarForTests } from "../lib/env";
import { getDatabaseUrl } from "../config/database";

// Increase timeout for Docker operations (pulling images can take time)
const DOCKER_TIMEOUT = 120_000;

beforeAll(async () => {
  // Skip testcontainers setup if flag is set
  if (process.env.SKIP_TESTCONTAINERS === "1" || getEnvVar("SKIP_TESTCONTAINERS") === "1") {
    console.warn("⚠️ SKIP_TESTCONTAINERS set — skipping integration test setup");
    return;
  }

  await setup();

  // Read DATABASE_URL from temp file (written by globalSetup in separate process)
  let dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    const envFilePath = path.resolve(__dirname, "../../.vitest-env.json");
    if (fs.existsSync(envFilePath)) {
      const envData = JSON.parse(fs.readFileSync(envFilePath, "utf8"));
      dbUrl = envData.DATABASE_URL;
      setEnvVarForTests("DATABASE_URL", dbUrl);
    }
  }

  if (!dbUrl)
    throw new Error("DATABASE_URL not set by testcontainers-global-setup");

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const schemaExists = await client.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth';`
    );
    if (schemaExists.rowCount === 0) throw new Error("auth schema not created");

    const tableExists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='auth' AND table_name='users';`
    );
    if (tableExists.rowCount === 0)
      throw new Error("auth.users table not created");

    const uidFunc = await client.query(
      `SELECT 1 FROM information_schema.routines WHERE routine_schema='auth' AND routine_name='uid';`
    );
    if (uidFunc.rowCount === 0)
      throw new Error("auth.uid() function not created");
  } finally {
    await client.end();
  }
}, DOCKER_TIMEOUT);

afterAll(async () => {
  // Skip teardown if testcontainers were skipped
  if (process.env.SKIP_TESTCONTAINERS === "1" || getEnvVar("SKIP_TESTCONTAINERS") === "1") {
    return;
  }
  await teardown();
});
