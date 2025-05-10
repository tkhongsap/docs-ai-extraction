// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { initializeRoutes } from "./routes/index.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { config } from "./config.js";

// Import the Python OCR service to ensure it's available
// Temporarily commented out for testing purposes
// import pythonOcrService from './services/pythonOcrService.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Use port 5000 for Replit workflow compatibility
  // Start listening immediately so Replit can detect the port
  const port = 5000;
  
  // Try to ensure Python OCR service is running
  // Temporarily commented out for testing purposes
  /*
  try {
    await pythonOcrService.ensurePythonOcrServerRunning();
  } catch (error) {
    console.warn('Could not start Python OCR server:', error);
    console.warn('Some OCR features may not be available');
  }
  */
  console.log('Python OCR service disabled for testing');
  
  const httpServer = createServer(app);
  
  // Initialize all application routes
  initializeRoutes(app);
  
  httpServer.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    console.log(`Server ready and listening on port ${port}`);
    log(`serving on port ${port}`);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Set up static serving and Vite after server starts to avoid delaying port binding
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    serveStatic(app);
  }
})();
