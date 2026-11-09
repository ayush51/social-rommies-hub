import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { sendNotification, setVapidDetails } from "web-push";
import type { Database } from "@/lib/database.types";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Called by pg_cron (via pg_net) every 5 minutes when reminders are waiting.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!secret || !same(given, secret)) return new Response("unauthorized", { status: 401 });

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return Response.json({ error: "push not configured" }, { status: 500 });
  setVapidDetails("https://abingdon-bros.vercel.app", pub, priv);

  // No user session here: the database functions verify the shared secret themselves.
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data: targets, error } = await supabase.rpc("reminders_claim", { p_secret: secret });
  if (error) return Response.json({ error: "claim failed" }, { status: 500 });

  const results = await Promise.allSettled(
    (targets ?? []).map((t) =>
      sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title: t.title, body: t.body, url: t.url, tag: `reminder:${t.url}` }),
        { TTL: 3600 },
      ),
    ),
  );
  const dead = (targets ?? [])
    .filter((_, i) => {
      const r = results[i];
      return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number }).statusCode ?? 0);
    })
    .map((t) => t.endpoint);
  if (dead.length) await supabase.rpc("reminders_drop", { p_secret: secret, p_endpoints: dead });

  return Response.json({
    sent: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length - dead.length,
    dropped: dead.length,
  });
}
