import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createClient } from "@/lib/supabase/server";

export type PushKind = "message" | "plan" | "post";

// The database decides who may be notified (author-only, fresh, once); this only signs and sends.
export async function sendPush(kind: PushKind, ref: string) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  setVapidDetails("https://abingdon-bros.vercel.app", pub, priv);

  const supabase = await createClient();
  const { data: targets } = await supabase.rpc("push_targets", { p_kind: kind, p_ref: ref });
  if (!targets?.length) return;

  const results = await Promise.allSettled(
    targets.map((t) =>
      sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title: t.title, body: t.body, url: t.url, tag: `${kind}:${t.url}` }),
        { TTL: 3600 },
      ),
    ),
  );
  const dead = targets
    .filter((_, i) => {
      const r = results[i];
      return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number }).statusCode ?? 0);
    })
    .map((t) => t.endpoint);
  if (dead.length) await supabase.rpc("drop_subscriptions", { p_endpoints: dead });
}
