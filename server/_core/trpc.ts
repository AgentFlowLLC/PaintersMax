import { NOT_ADMIN_ERR_MSG, SUBSCRIPTION_REQUIRED_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Statuses written by server/routes/stripeWebhook.ts that grant dashboard
// access. The webhook normalizes Stripe's "trialing" status to "active" at
// write time, so "active" is the only status that currently means paid.
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active"]);

const requireActiveSubscription = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(ctx.user.subscriptionStatus)) {
    throw new TRPCError({ code: "FORBIDDEN", message: SUBSCRIPTION_REQUIRED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Same as protectedProcedure, plus a check that the painter has an active
// subscription. Use for any endpoint that serves dashboard data.
export const paidProcedure = protectedProcedure.use(requireActiveSubscription);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
