import { createClient } from "redis";
import { getConfig } from "../../src/config/environment";

async function setMaintenanceMode() {
  const config = getConfig();
  const redisUrl = config.cache.url;

  if (!redisUrl) {
    console.error("Redis URL not configured");
    process.exit(1);
  }

  const client = createClient({ url: redisUrl });
  client.on("error", (err) => console.error("Redis Client Error", err));

  try {
    await client.connect();
    console.log("Connected to Redis.");

    await client.set("maintenance_mode", "true");
    console.log("Maintenance mode set to TRUE.");

    const val = await client.get("maintenance_mode");
    console.log("Verified value:", val);
  } catch (err) {
    console.error("Failed to set maintenance mode:", err);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

setMaintenanceMode();
