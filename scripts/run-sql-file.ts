import { Client } from "pg";
import fs from "fs";
import { getConfig } from "../src/config/environment";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: tsx scripts/run-sql-file.ts <file-path>");
  process.exit(1);
}

async function run() {
  const config = getConfig();

  // Use DB URL from config or env
  const connectionString =
    config.database.url ||
    process.env.DATABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  if (!connectionString) {
    console.error("Error: DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Executing SQL from ${filePath}...`);

    // Split by semicolons roughly to execute statements?
    // Or just run the whole thing. pg driver usually handles multiple statements if supported.
    // The validation script might be a single block or multiple.
    // Let's try running as single query first.

    const res = await client.query(sql);
    console.log("Success.");
    // Check if it returns rows and print them?
    if (Array.isArray(res)) {
      res.forEach((r) => console.log(r.rows));
    } else {
      console.log(res.rows);
    }
  } catch (err) {
    console.error("Error executing SQL:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
