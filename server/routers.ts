import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { leadsRouter } from "./routers/leads";
import { emailTemplatesRouter, automationRulesRouter } from "./routers/emailTemplates";
import { communicationsRouter, attachmentsRouter } from "./routers/communications";
import { dashboardRouter } from "./routers/dashboard";
import { stripeRouter } from "./routers/stripe";
import { settingsRouter } from "./routers/settings";
import { smsRouter } from "./routers/sms";
import { appointmentsRouter } from "./routers/appointments";
import { invoicesRouter } from "./routers/invoices";
import { portalRouter } from "./routers/portal";
import { reviewsRouter } from "./routers/reviews";
import { photosRouter } from "./routers/photos";
import { crewRouter } from "./routers/crew";
import { blogRouter } from "./routers/blog";
import { aiRouter } from "./routers/ai";
import { brandKitRouter } from "./routers/brandKit";
import { subscriptionRouter } from "./routers/subscription";
import { seedDefaultTemplates } from "./db";
import { registerStripeWebhook } from "./routes/stripeWebhook";
import { markOverdueInvoices } from "./routers/invoices";

// Seed default templates on startup
seedDefaultTemplates().catch(console.error);

// Re-export the Stripe webhook registration function so server/_core/index.ts
// can call it with the Express app instance.
export { registerStripeWebhook };

// ─── Daily 9 AM cron job — mark overdue invoices and send SMS reminders ───────
// Runs once at startup (to catch any missed invoices), then schedules itself
// to fire every day at 9:00 AM server time.
function scheduleDailyOverdueCheck() {
  const runCheck = () => {
    markOverdueInvoices()
      .then(({ marked, smsSent }) => {
        if (marked > 0) {
          console.log(`[Overdue] Marked ${marked} invoice(s) as overdue, sent ${smsSent} SMS reminder(s).`);
        }
      })
      .catch((err) => console.error("[Overdue] Daily check failed:", err));
  };

  // Run immediately on startup to catch any invoices that became overdue overnight
  runCheck();

  // Schedule next run at 9:00 AM today (or tomorrow if already past 9 AM)
  const scheduleNext = () => {
    const now = new Date();
    const next9AM = new Date(now);
    next9AM.setHours(9, 0, 0, 0);
    if (next9AM <= now) {
      // Already past 9 AM today — schedule for tomorrow
      next9AM.setDate(next9AM.getDate() + 1);
    }
    const msUntilNext = next9AM.getTime() - now.getTime();
    setTimeout(() => {
      runCheck();
      // Schedule subsequent runs every 24 hours
      setInterval(runCheck, 24 * 60 * 60 * 1000);
    }, msUntilNext);
  };

  scheduleNext();
}
scheduleDailyOverdueCheck();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  leads: leadsRouter,
  emailTemplates: emailTemplatesRouter,
  automationRules: automationRulesRouter,
  communications: communicationsRouter,
  attachments: attachmentsRouter,
  dashboard: dashboardRouter,
  stripe: stripeRouter,
  settings: settingsRouter,
  sms: smsRouter,
  appointments: appointmentsRouter,
  invoices: invoicesRouter,
  portal: portalRouter,
  reviews: reviewsRouter,
  photos: photosRouter,
  crew: crewRouter,
  blog: blogRouter,
  ai: aiRouter,
  brandKit: brandKitRouter,
  subscription: subscriptionRouter,
});

export type AppRouter = typeof appRouter;
