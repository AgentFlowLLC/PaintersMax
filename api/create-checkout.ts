/**
 * /api/create-checkout.ts — Vercel serverless function
 *
 * Creates a Stripe Checkout session for subscription billing.
 * Accepts: painter_id, tier (starter/professional/agency), email
 * Returns: checkout URL
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

const TIER_PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_TIER1_PRICE_ID,
  professional: process.env.STRIPE_TIER2_PRICE_ID,
  agency: process.env.STRIPE_TIER3_PRICE_ID,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { painter_id, tier, email } = req.body as {
    painter_id: number;
    tier: string;
    email: string;
  };

  if (!painter_id || !tier || !email) {
    return res.status(400).json({ error: "Missing required fields: painter_id, tier, email" });
  }

  const priceId = TIER_PRICE_MAP[tier];
  if (!priceId) {
    return res.status(400).json({ error: `Invalid tier: ${tier}. Must be starter, professional, or agency.` });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  try {
    const stripe = new Stripe(stripeSecretKey);

    // Check if this painter already has a Stripe customer ID in the database
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", painter_id)
      .single();

    let customerId = user?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { painter_id: String(painter_id) },
      });
      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", painter_id);
    }

    // Build checkout session params
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || "https://app.dfwpropainters.com"}/dashboard?checkout=success`,
      cancel_url: `${process.env.APP_URL || "https://app.dfwpropainters.com"}/pricing?checkout=cancelled`,
      metadata: {
        painter_id: String(painter_id),
        tier,
      },
    };

    // Include 14-day free trial for starter tier only
    if (tier === "starter") {
      sessionParams.subscription_data = {
        trial_period_days: 14,
        metadata: {
          painter_id: String(painter_id),
          tier,
        },
      };
    } else {
      sessionParams.subscription_data = {
        metadata: {
          painter_id: String(painter_id),
          tier,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("[create-checkout] Error:", (error as Error).message);
    return res.status(500).json({ error: (error as Error).message });
  }
}
