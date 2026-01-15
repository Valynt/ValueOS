import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;
let _connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

/**
 * Get database connection with retry logic
 */
export async function getDbConnection() {
  if (_db) {
    return _db;
  }

  if (!process.env.DATABASE_URL) {
    console.error("[Database] DATABASE_URL not configured");
    return null;
  }

  if (_connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    console.error("[Database] Max connection attempts reached");
    return null;
  }

  try {
    _connectionAttempts++;
    console.log(`[Database] Connecting... (attempt ${_connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
    
    _client = postgres(process.env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {}, // Suppress notices
    });
    
    _db = drizzle(_client);
    
    // Test connection
    await _client`SELECT 1`;
    
    console.log("[Database] Connected successfully");
    _connectionAttempts = 0; // Reset on success
    
    return _db;
  } catch (error) {
    console.error(`[Database] Connection failed (attempt ${_connectionAttempts}):`, error);
    _db = null;
    _client = null;
    
    // Retry with exponential backoff
    if (_connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      const delay = Math.pow(2, _connectionAttempts) * 1000;
      console.log(`[Database] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return getDbConnection();
    }
    
    return null;
  }
}

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDbConnection() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
    console.log("[Database] Connection closed");
  }
}

/**
 * Check if database is connected
 */
export function isDbConnected(): boolean {
  return _db !== null && _client !== null;
}
