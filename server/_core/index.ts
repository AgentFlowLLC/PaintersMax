import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerSmsWebhook } from "../routes/smsWebhook";
import { registerStripeWebhook } from "../routers";
import { registerEmailPasswordAuthRoutes } from "../routes/emailPasswordAuth";
import { corsMiddleware } from "../routes/cors";
import { registerPublicLeadsRoute } from "../routes/publicLeads";
import demoRequestRouter from "../routes/demoRequest";
import { registerOnboardingRoutes } from "../routes/onboarding";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Stripe webhook MUST be registered before express.json() so the raw body
  // Buffer is preserved for HMAC-SHA256 signature verification.
  registerStripeWebhook(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // CORS for public API endpoints (dfw-painters.com, dfw-propainters.com)
  app.use("/api/public", corsMiddleware);

  // Public (unauthenticated) lead intake endpoint: POST /api/public/leads
  registerPublicLeadsRoute(app);
  // Demo request endpoint: POST /api/public/demo-request
  app.use("/api/public", demoRequestRouter);
  // Email/password auth endpoints: POST /api/auth/login, POST /api/auth/logout
  registerEmailPasswordAuthRoutes(app);
  // Onboarding / signup profile save routes
  registerOnboardingRoutes(app);
  // OAuth callback under /api/oauth/callback (kept for backward compatibility)
  registerOAuthRoutes(app);
  // Twilio inbound SMS webhook — must be before tRPC so it handles raw form bodies
  registerSmsWebhook(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
