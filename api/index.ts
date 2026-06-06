/**
 * api/index.ts
 *
 * Vercel serverless entry point.
 * Exports the Express app as a default export so Vercel can invoke it
 * as a serverless function for all /api/* routes.
 *
 * This file does NOT call app.listen() — Vercel manages the HTTP lifecycle.
 */

import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { registerSmsWebhook } from "../server/routes/smsWebhook";
import { registerStripeWebhook } from "../server/routers";
import { registerEmailPasswordAuthRoutes } from "../server/routes/emailPasswordAuth";
import publicStatsRouter from '../server/routes/publicStats';
import demoRequestRouter from '../server/routes/demoRequest';
import { registerOnboardingRoutes } from '../server/routes/onboarding';

const app = express();

// Stripe webhook MUST be registered before express.json() to preserve raw body
// for HMAC-SHA256 signature verification.
registerStripeWebhook(app);

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Email/password auth endpoints: POST /api/auth/login, POST /api/auth/logout
registerEmailPasswordAuthRoutes(app);

// OAuth callback under /api/oauth/callback (kept for backward compatibility)
registerOAuthRoutes(app);

// Twilio inbound SMS webhook — must be before tRPC
registerSmsWebhook(app);

// Public stats endpoint (no auth required)
app.use('/api/public', publicStatsRouter);
app.use('/api/public', demoRequestRouter);

// Onboarding routes (authenticated)
registerOnboardingRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Export for Vercel serverless
export default app;
