import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import rateLimit from 'express-rate-limit';
import { startBatchStatusCron } from './cron/batch-status-cron';
import { initializeEmailService } from './email-service';
import logger from './utils/logger';

// Environment check
const isProduction = process.env.NODE_ENV === 'production';

logger.debug("Starting server initialization");

const app = express();
logger.debug("Express app created");

// Configure trust proxy - Add this before other middleware
app.set('trust proxy', 1);
logger.debug("Trust proxy configured");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
logger.debug("Basic middleware setup complete");

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per minute
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to API routes
app.use('/api', limiter);
logger.debug("Rate limiting configured");

// Enhanced request logging middleware
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
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});
logger.debug("Request logging middleware setup complete");

// Add a test route to verify server is handling requests
app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: app.get("env") });
});
logger.debug("Health check route added");

// Serve static files from the public directory
app.use(express.static('public'));

// Direct Excel file serving with proper headers
app.get('/ultra-simple-template.xlsx', (_req, res) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ultra-simple-template.xlsx"');
  res.sendFile('ultra-simple-template.xlsx', { root: '.' });
});
logger.debug("Static file routes added");

(async () => {
  try {
    logger.debug("Starting async initialization");

    // Create HTTP server explicitly
    logger.debug("Registering routes...");
    const server = await registerRoutes(app);
    logger.debug("Routes registered successfully");

    // Start the batch status update cron job
    logger.debug("Starting batch status cron job...");
    startBatchStatusCron();
    log("Started batch status update cron job");
    logger.debug("Batch status cron job started");

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });
    logger.debug("Error handling middleware setup complete");

    // Detect environment
    const nodeEnv = process.env.NODE_ENV || "development";
    app.set("env", nodeEnv);
    logger.debug(`Environment set to: ${app.get("env")}`);

    if (app.get("env") === "development") {
      logger.debug("Setting up Vite middleware for development");
      await setupVite(app, server);
      logger.debug("Vite middleware setup complete");
    } else {
      logger.debug("Setting up static file serving for production");
      serveStatic(app);
      logger.debug("Static file serving setup complete");
    }

    // Setup server listening
    const startListening = async (): Promise<number> => {
      // In production environments (like Replit deployment), always use the provided PORT
      if (app.get("env") !== "development") {
        const port = parseInt(process.env.PORT || '8080');
        logger.debug(`Using production port: ${port}`);
        await new Promise<void>((resolve) => {
          server.listen(port, '0.0.0.0', () => {
            logger.debug(`Server listening on port ${port} in production mode`);
            resolve();
          });
        });
        return port;
      } 
      
      // Development mode - try different ports if needed
      const tryPort = async (port: number): Promise<number> => {
        try {
          await new Promise((resolve, reject) => {
            server.listen(port, '0.0.0.0')
              .once('error', reject)
              .once('listening', resolve);
          });
          return port;
        } catch (error: any) {
          if (error.code === 'EADDRINUSE' && port < 5010) {
            logger.debug(`Port ${port} in use, trying ${port + 1}`);
            return tryPort(port + 1);
          }
          throw error;
        }
      };

      const startPort = parseInt(process.env.PORT || '5000');
      logger.debug(`Attempting to start server on port ${startPort}`);
      return tryPort(startPort);
    };

    const port = await startListening();
    log(`Server running in ${app.get("env")} mode`);
    log(`API and client being served on port ${port}`);
    logger.debug("Server started successfully");

  } catch (error) {
    logger.error(`Fatal error during initialization: ${error}`);
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();