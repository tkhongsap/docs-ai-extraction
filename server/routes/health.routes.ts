/**
 * Health Check Routes
 * 
 * Simple endpoints to verify the application is running correctly
 * and provide basic runtime information.
 */
import { Router, Request, Response } from "express";

const router = Router();

/**
 * Health check endpoint
 * 
 * Provides basic information about the running application.
 * Used for monitoring and to help Replit detect the server.
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Server is running',
    time: new Date().toISOString(),
    service_name: "docs-ai-extraction-platform",
    build_metadata: {
      version: process.env.npm_package_version || "unknown",
      node_env: process.env.NODE_ENV || "development"
    }
  });
});

export default router; 