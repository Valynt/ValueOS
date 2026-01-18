import express, { Router } from "express";

const healthRouter: Router = express.Router();

healthRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

let shuttingDown = false;
const startTime = Date.now();

// Service instances for health checks - placeholder implementations
let supabaseClient: any = null;
let llmGateway: any = null;
let memorySystem: any = null;
let auditLogger: any = null;

// Initialize services for health checks
function initializeServices() {
  try {
    // Placeholder implementations - services would be properly imported
    supabaseClient = {
      from: () => ({ select: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
    };
    llmGateway = {
      health: () => Promise.resolve({ status: "healthy" }),
    };
    memorySystem = {
      health: () => Promise.resolve({ status: "healthy" }),
    };
    auditLogger = {
      health: () => Promise.resolve({ status: "healthy" }),
    };
  } catch (error) {
    console.warn("Failed to initialize some services for health checks:", error);
  }
}

function markAsShuttingDown() {
  shuttingDown = true;
}

export { healthRouter as default, markAsShuttingDown };
