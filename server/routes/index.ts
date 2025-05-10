/**
 * Routes Aggregator
 * 
 * This module imports all Express routers and registers them with their respective base paths.
 * It serves as the main entry point for all application routes.
 */
import type { Express } from "express";
import healthRouter from "./health.routes.js";
import ingestionRouter from "./ingestion.routes.js";
import documentsRouter from "./documents.routes.js";
import processingRouter from "./processing.routes.js";
import extractionsRouter from "./extractions.routes.js";

/**
 * Initializes all application routes by mounting each router on its appropriate path
 * 
 * @param app - Express application instance
 */
export function initializeRoutes(app: Express): void {
  // Mount health check
  app.use("/health", healthRouter);

  // Mount the new Ingestion Service router
  app.use("/api/v1", ingestionRouter);

  // Mount other routers with their appropriate base paths
  app.use("/api/documents", documentsRouter);
  app.use("/api/documents", processingRouter);
  app.use("/api/extractions", extractionsRouter);

  console.log("✅ Modular application routes registered.");
} 