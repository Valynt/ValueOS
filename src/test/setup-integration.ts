import { afterAll, beforeAll } from "vitest";
import { setup, teardown } from "./testcontainers-global-setup";
import { Client } from "pg";
import fs from "fs";
import path from "path";
import { getEnvVar, setEnvVarForTests } from "../lib/env";
import { getDatabaseUrl } from "../config/database";

// Increase timeout for Docker operations
const DOCKER_TIMEOUT = 120_000;

beforeAll(async () => {
  console.log("🐳 Starting integration test environment...");

  // Check if Docker is available
  const dockerAvailable = await isDockerAvailable();
  if (!dockerAvailable) {
    throw new Error(
      "❌ Docker is not available or not running. Integration tests require Docker.\n" +
        "   Please start Docker and ensure you have permissions to run containers.\n" +
        "   For unit tests only, run: npm run test:unit"
    );
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

  if (!dbUrl) {
    throw new Error(
      "❌ DATABASE_URL not set by testcontainers-global-setup.\n" +
        "   This indicates a problem with the testcontainer initialization.\n" +
        "   Check the logs above for any Docker-related errors."
    );
  }

  // Verify database connectivity
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
    if (tableExists.rowCount === 0) throw new Error("auth.users table not created");

    const uidFunc = await client.query(
      `SELECT 1 FROM information_schema.routines WHERE routine_schema='auth' AND routine_name='uid';`
    );
    if (uidFunc.rowCount === 0) throw new Error("auth.uid() function not created");

    console.log("✅ Integration test environment ready");
  } finally {
    await client.end();
  }
}, DOCKER_TIMEOUT);

afterAll(async () => {
  console.log("\n🧹 Cleaning up integration test environment...");
  await teardown();
});

// Helper function to check Docker availability
async function isDockerAvailable(): Promise<boolean> {
  try {
    const { execSync } = require("child_process");
    execSync("docker version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
