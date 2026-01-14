/**
 * Test Containers Global Setup
 *
 * Global setup utilities for integration testing with Express app creation.
 */

import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import agentsRouter from "../../src/api/agents";

/**
 * Create a test Express application with API routes
 *
 * This sets up a minimal Express app for integration testing
 * with mocked services and authentication.
 */
export async function createTestApp(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API routes
  app.use("/api/agents", agentsRouter);

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Test app error:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
    });
  });

  return app;
}
