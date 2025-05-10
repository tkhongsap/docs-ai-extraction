**Guidance for Modularizing `server/routes.ts`**

"The primary goal is to refactor the existing monolithic `server/routes.ts` into a more modular and maintainable structure using Express Routers. This will improve code clarity, scalability, and make it easier to manage routes as the application grows, especially with the new Ingestion Service and potential future features.

**Strategy:**

1.  **Create a Dedicated Routes Directory:**
    *   Inside the `server/` directory, create a new directory named `routes/`.
    *   The old `server/routes.ts` will eventually be replaced by an `index.ts` file within this new `server/routes/` directory, which will act as an aggregator.

2.  **Identify Logical Route Groups:**
    Based on the current `routes.ts` and project features, we can identify the following logical groups:
    *   **Ingestion Service:** (`POST /api/v1/documents` and its specific multer setup).
    *   **General Document Management:** (e.g., `GET /api/documents`, `GET /api/documents/:id`, `GET /api/documents/:id/file`, `DELETE /api/documents/:id`, `GET /api/documents/next/:currentId`).
    *   **Document Processing:** (e.g., `POST /api/documents/:id/process`, `POST /api/documents/:id/reprocess/:section`).
    *   **Data Extractions & Exports:** (e.g., `GET /api/extractions/document/:documentId`, `PATCH /api/extractions/:id`, all export endpoints, layout, confidence, history).
    *   **Health Check:** (`GET /health`).
    *   **(Optional) Legacy:** If any parts of the original `POST /api/documents` (the one commented out) were still needed for a different purpose, they could go here, but it seems the new ingestion endpoint is the focus.

3.  **Create Individual Router Files:**
    For each logical group, create a new `.ts` file within `server/routes/`. Example naming:
    *   `server/routes/ingestion.routes.ts`
    *   `server/routes/documents.routes.ts`
    *   `server/routes/processing.routes.ts`
    *   `server/routes/extractions.routes.ts`
    *   `server/routes/health.routes.ts`

4.  **Implement Each Router File:**
    *   **Example: `server/routes/ingestion.routes.ts`**
        ```typescript
        import { Router, Request, Response } from "express";
        import multer from "multer"; // And other necessary specific imports
        // TODO: Move the 'ingestionFileStorageConfig' and 'ingestionServiceUpload' multer setup here.
        // This includes the logic for UUID generation and specific directory creation under 'data/ingest'.

        const router = Router();

        // This route will effectively be POST /api/v1/documents due to how it's mounted later
        router.post("/documents", ingestionServiceUpload.single("file"), async (req: Request, res: Response) => {
            // Current logic from routes.ts for POST /api/v1/documents
        });

        // Add any other routes strictly related to the v1 ingestion process if they arise.

        export default router;
        ```
    *   **For other router files (e.g., `documents.routes.ts`):**
        *   Similarly, import `Router`, create an instance, and move the relevant endpoint definitions from the old `routes.ts` into it.
        *   **Important:** Ensure all necessary imports (like `storage`, schemas from `@shared/schema`, `fs`, `path`, specific service modules) are present in these new files or are correctly imported from shared locations if they remain general.
        *   Helper functions currently in `routes.ts` (like `recalculateOverallConfidence`, `generateCSVOutput`, `generateMarkdownOutput`) should be moved to the most relevant router file (e.g., `extractions.routes.ts` for export helpers) or to a new `server/utils/` directory if they are more broadly applicable.
        *   The original `multer` setup (`originalFileStorageConfig` and `originalUpload`) should be moved to `documents.routes.ts` if those non-ingestion service uploads are still implicitly supported by other routes, or to a `legacy.routes.ts` if they are being phased out. Given the focus on the new ingestion service, assess if this old multer config is still truly needed.

5.  **Create an Aggregator File: `server/routes/index.ts`**
    This file will import all individual routers and set them up with their base paths.
    ```typescript
    import type { Express } from "express";
    import healthRouter from "./health.routes";
    import ingestionRouter from "./ingestion.routes";
    import documentsRouter from "./documents.routes";
    import processingRouter from "./processing.routes";
    import extractionsRouter from "./extractions.routes";
    // Import other routers as they are created

    export function initializeRoutes(app: Express): void {
        // Mount health check (can be at root or /api)
        app.use("/health", healthRouter); // This will make routes in health.routes.ts available under /health

        // Mount the new Ingestion Service router
        // To match POST /api/v1/documents:
        app.use("/api/v1", ingestionRouter);

        // Mount other routers with their appropriate base paths
        // These paths should match what clients currently expect for non-ingestion routes.
        app.use("/api/documents", documentsRouter); // e.g., for GET /api/documents/:id
        app.use("/api/documents", processingRouter); // e.g., for POST /api/documents/:id/process. Careful with path overlaps.
                                                    // Consider a more distinct path like /api/processing for processingRouter
                                                    // e.g., app.use("/api/processing", processingRouter)
                                                    // then routes in processing.routes.ts would be like router.post("/documents/:id/process", ...)
        app.use("/api/extractions", extractionsRouter); // e.g., for GET /api/extractions/document/:documentId

        console.log("✅ Modular application routes registered.");
    }
    ```
    *Self-correction/Refinement on pathing for `processingRouter`:* It's better to give `processingRouter` its own distinct base path if its internal routes might clash or become confusing when merged under `/api/documents`. For example:
    `app.use("/api/processing", processingRouter);`
    Then, in `processing.routes.ts`, the route would be like `router.post("/documents/:id/process", ...)`, making the full path `POST /api/processing/documents/:id/process`. Or, keep it under `/api/documents` if its routes are distinct enough (e.g., all involve a sub-path like `/:id/process`). The current structure suggests they are distinct enough to be sub-routes of `/api/documents/:id/...`.

6.  **Update Main Server File (`server/server.ts` or your Express app entry point):**
    *   Modify your main server setup file to import and use `initializeRoutes` from `server/routes/index.ts`.
    *   The existing `registerRoutes` function (which returns a `Server`) will be replaced. The `httpServer` creation should happen in your main server file.
    *   Example (assuming your main file is `server/server.ts` as per project structure):
        ```typescript
        import express from "express";
        import { createServer } from "http"; // Keep if you create httpServer here
        import { initializeRoutes } from "./routes"; // Updated import
        // ... other necessary imports like 'storage', 'path', 'fs', etc.
        // Ensure 'uploadDir' and 'ingestDataDirRoot', 'ingestDir' constants,
        // and the async IIFE for creating 'ingestDir' are either moved to a config file,
        // kept in server.ts if they are global setup, or moved to specific route files if local.
        // The 'ingestDir' creation logic might best fit near the 'ingestion.routes.ts' or a startup script.

        const app = express();

        // Global middleware (json parsing, cors, etc.)
        app.use(express.json());
        // ...

        // Initialize all application routes
        initializeRoutes(app);

        // The http.createServer should wrap 'app' here.
        const httpServer = createServer(app);
        // The rest of your server startup logic (listening on port, etc.)
        // The pythonOcrService check can remain here or be part of a startup script.

        // ...
        ```

7.  **Clean Up:**
    *   Once all routes are migrated and `server/routes/index.ts` is in place, the original `server/routes.ts` can be deleted.
    *   Review all moved code for correct import paths.
    *   Ensure shared constants (like `uploadDir`, `ingestDir`) are defined in an appropriate shared location (e.g., `server/config.ts` or at the top of `server/routes/index.ts` if primarily used for routing setup) or moved into the specific route modules if their scope is limited. The initial `ingestDir` creation logic is a good candidate for `server.ts` or an init script.

**Specific Instructions for the "Ingestion Service" part:**

*   The `ingestionFileStorageConfig` and `ingestionServiceUpload` (multer instances) are specific to the new ingestion endpoint. They should be defined within or imported directly into `server/routes/ingestion.routes.ts`.
*   The route `POST /api/v1/documents` will be defined in `ingestion.routes.ts` as `router.post("/documents", ...)`. The `index.ts` will mount this router at `/api/v1`.
*   The logic for creating `ingestDir` (the IIFE using `fsPromises.mkdir`) should either be in `server.ts` as part of startup, or if `ingestion.routes.ts` is the *only* place that needs it, it could theoretically be there, but global startup is cleaner.

By following these steps, the routing logic will become significantly cleaner and more organized, aligning with best practices for Express applications."