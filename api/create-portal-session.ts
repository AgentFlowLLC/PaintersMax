/**
 * /api/create-portal-session.ts — Vercel serverless function
 *
 * Creates a Stripe Customer Portal session so the user can manage/cancel their subscription.
 * Accepts: painter_id
 * Returns: Stripe Customer Portal URL
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { painter_id } = req.body as { painter_id: number };

  if (!painter_id) {
    return res.status(400).json({ error: "Missing required field: painter_id" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return res.status(500).json({ error: "Stripe is not configured" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the painter's Stripe customer ID
    const { data: user } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("id", painter_id)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: "No active subscription found for this user" });
    }

    const stripe = new Stripe(stripeSecretKey);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.APP_URL || "https://app.dfwpropainters.com"}/pricing`,
    });

    return res.status(200).json({ url: portalSession.url });
  } catch (error) {
    console.error("[create-portal-session] Error:", (error as Error).message);
    return res.status(500).json({ error: (error as Error).message });
  }
}
