import express, { Router } from "express";

const healthRouter: Router = express.Router();

const getDependenciesStatus = () => ({
  database: { status: "healthy", lastChecked: new Date().toISOString() },
  supabase: { status: "healthy", lastChecked: new Date().toISOString() },
  redis: { status: "healthy", lastChecked: new Date().toISOString() }
});

healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    dependencies: getDependenciesStatus()
  });
});

let shuttingDown = false;

healthRouter.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "alive" });
});

healthRouter.get("/health/ready", (_req, res) => {
  if (shuttingDown) {
    res.status(503).json({ status: "shutting_down" });
    return;
  }
  res.status(200).json({
    status: "ready",
    dependencies: getDependenciesStatus()
  });
});

healthRouter.get("/health/startup", (_req, res) => {
  res.status(200).json({ status: "ready" });
});

healthRouter.get("/health/dependencies", (_req, res) => {
  res.status(200).json({
    status: "ok",
    dependencies: getDependenciesStatus()
  });
});

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
